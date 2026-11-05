import type { ToolCall } from '../llm/types';
import { normalizeDomain } from '../page/blocklist';
import { addLogEntry, type NewLogEntry } from '../storage/actionLog';
import { getSettings, updateSettings, type Settings } from '../storage/settings';
import { clipResult, parseToolArguments, runTool } from '../tools/registry';
import type { ActionDecision, ActionIntent, Tool, ToolContext, ToolOutcome } from '../tools/types';
import { parsePlan, PLAN_TOOL_NAME, type PlanProposal } from '../tools/writeTools';
import { detectInjection } from './injection';
import { actionKey, LOOP_STOP, LOOP_WARN } from './loopGuard';
import { observePage, type Observation } from './observe';
import { evaluateAction, hostOf, type Verdict } from './policy';
import { createSession, type AgentSession } from './session';
import { runAssistantTurn, type CallOutcome, type TurnOptions, type TurnResult } from './toolLoop';

/** Pedido de confirmação mostrado ao usuário (cartão no painel). */
export interface ConfirmRequest {
  tool: string;
  intent: ActionIntent;
  verdict: Verdict;
  /** Justificativa dada pelo modelo (não confiável; só informativa). */
  reason?: string;
}

export interface PlanDecision {
  approved: boolean;
  /** Domínios do plano em que o usuário habilitou o agente no mesmo clique. */
  enableSites: string[];
}

export interface AgentStatus {
  round: number;
  maxSteps: number;
  actions: number;
  startedAt: number;
  deadline: number;
  targetTabId: number;
  /** Texto de injeção visto numa página (sessão suspeita). */
  tainted?: string;
}

/** Ponte com a interface. As promessas rejeitam quando o sinal aborta (botão PARAR). */
export interface AgentUi {
  askPlan(plan: PlanProposal, signal: AbortSignal): Promise<PlanDecision>;
  confirm(req: ConfirmRequest, signal: AbortSignal): Promise<boolean>;
  status(s: AgentStatus): void;
}

export interface AgentDeps {
  observe(tabId: number, screenshot: boolean): Promise<Observation>;
  log(entry: NewLogEntry): Promise<void>;
  /** Acrescenta domínios à lista de sites em que o agente pode agir. */
  enableSites(domains: string[]): Promise<void>;
  /** Configurações atuais (a lista de sites pode mudar no meio da tarefa). */
  getSettings(): Promise<Settings>;
}

const defaultDeps: AgentDeps = {
  observe: observePage,
  log: async (e) => {
    await addLogEntry(e).catch((err: unknown) => console.error('Lucerna: falha no registro', err));
  },
  enableSites: async (domains) => {
    await updateSettings((s) => ({
      agentAllowedDomains: [...s.agentAllowedDomains, ...domains],
    }));
  },
  getSettings,
};

export interface AgentTurnOptions extends Omit<
  TurnOptions,
  'executeCall' | 'beforeRound' | 'mode' | 'maxRounds'
> {
  conversationId: string;
  /** Aba em que a tarefa começa (a ativa quando o usuário enviou o pedido). */
  startTab: { id: number; url?: string };
  settings: Settings;
  ui: AgentUi;
  deps?: Partial<AgentDeps>;
  now?: () => number;
}

interface Env {
  tools: Tool[];
  session: AgentSession;
  ui: AgentUi;
  deps: AgentDeps;
  settings: Settings;
  now: () => number;
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function statusOf(session: AgentSession, round: number): AgentStatus {
  return {
    round,
    maxSteps: session.maxSteps,
    actions: session.actions,
    startedAt: session.startedAt,
    deadline: session.deadline,
    targetTabId: session.targetTabId,
    tainted: session.tainted,
  };
}

/** Marca a sessão como suspeita se o texto (vindo de páginas) tiver cara de injeção. */
function scanTaint(env: Env, text: string | undefined, round: number): void {
  if (env.session.tainted || !text) return;
  const hit = detectInjection(text);
  if (!hit) return;
  env.session.tainted = hit;
  env.ui.status(statusOf(env.session, round));
}

function logBase(env: Env, call: ToolCall, intent: Partial<ActionIntent>) {
  return {
    conversationId: env.session.conversationId,
    tabId: intent.tabId,
    url: intent.url ?? intent.destination,
    tool: call.name,
    args: call.arguments,
    summary: intent.summary ?? call.name,
  };
}

async function handlePlan(
  env: Env,
  call: ToolCall,
  args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<CallOutcome> {
  const plan = parsePlan(args);
  const { session, ui, deps } = env;
  const decision = await ui.askPlan(plan, signal);
  await deps.log({
    ...logBase(env, call, {
      summary: `Plano: ${plan.goal || plan.steps[0]}`,
      tabId: session.targetTabId,
    }),
    decision: decision.approved ? 'plan_approved' : 'plan_refused',
    reasons: [],
    ok: decision.approved,
  });
  if (!decision.approved) {
    return {
      ok: false,
      text: 'O usuário recusou o plano. Não execute nenhuma ação; pergunte o que ele quer mudar.',
      decision: { kind: 'plan_refused' },
    };
  }
  const sites = plan.sites.map(normalizeDomain).filter(Boolean);
  session.plan = plan;
  session.planApproved = true;
  session.scopeDomains = Array.from(new Set([...session.scopeDomains, ...sites]));
  if (decision.enableSites.length) await deps.enableSites(decision.enableSites);
  return {
    ok: true,
    text:
      'Plano aprovado pelo usuário. Execute-o passo a passo. Ações sensíveis e fora do plano ' +
      'ainda pedirão confirmação.',
    decision: { kind: 'plan_approved' },
  };
}

function refusal(kind: ActionDecision, verdict: Verdict): CallOutcome {
  if (kind === 'denied') {
    return {
      ok: false,
      text: `Ação bloqueada pela política de segurança da Lucerna: ${verdict.reasons.join(' ')}`,
      decision: { kind, reasons: verdict.reasons },
    };
  }
  return {
    ok: false,
    text: 'O usuário recusou esta ação. Não tente de novo nem por outro caminho; pergunte como prosseguir.',
    decision: { kind, reasons: verdict.reasons },
  };
}

async function handleAction(
  env: Env,
  tool: Tool,
  call: ToolCall,
  args: Record<string, unknown>,
  ctx: ToolContext,
  round: number,
): Promise<CallOutcome> {
  const { session, ui, deps, now } = env;
  if (now() > session.deadline) {
    return {
      ok: false,
      text: 'Tempo limite da tarefa atingido; a ação não foi executada.',
      stop: `Tempo limite de ${env.settings.agentMaxMinutes} min atingido.`,
    };
  }

  let intent: ActionIntent;
  try {
    intent = tool.intent ? await tool.intent(args, ctx) : { kind: 'wait', summary: tool.name };
  } catch (err) {
    if (ctx.signal.aborted) throw err;
    return { ok: false, text: `Erro: ${errText(err)}` };
  }

  const settings = await deps.getSettings();
  const verdict = evaluateAction(intent, session, settings);
  const base = logBase(env, call, intent);
  if (verdict.decision === 'deny') {
    await deps.log({ ...base, decision: 'denied', reasons: verdict.reasons, ok: false });
    return refusal('denied', verdict);
  }

  let decision: ActionDecision = 'auto';
  if (verdict.decision === 'confirm') {
    const reason = typeof args.reason === 'string' ? args.reason : undefined;
    let approved: boolean;
    try {
      approved = await ui.confirm({ tool: call.name, intent, verdict, reason }, ctx.signal);
    } catch (err) {
      await deps.log({ ...base, decision: 'cancelled', reasons: verdict.reasons });
      throw err;
    }
    if (!approved) {
      await deps.log({ ...base, decision: 'refused', reasons: verdict.reasons, ok: false });
      return refusal('refused', verdict);
    }
    decision = 'confirmed';
    // O usuário aprovou explicitamente estes domínios para o resto da tarefa.
    for (const host of [hostOf(intent.url), hostOf(intent.destination)])
      if (host) session.scopeDomains.push(host);
    if (verdict.enableDomain) await deps.enableSites([verdict.enableDomain]);
  }

  const tabBefore = session.targetTabId;
  const sigBefore = session.pageSig.get(tabBefore);
  session.actions += 1;
  let result: ToolOutcome;
  try {
    const r = await tool.execute(args, ctx);
    result = { ok: true, text: clipResult(r.text), images: r.images };
  } catch (err) {
    if (ctx.signal.aborted) {
      await deps.log({ ...base, decision: 'cancelled', reasons: [] });
      throw err;
    }
    result = { ok: false, text: `Erro: ${errText(err)}` };
  }

  // Verificar: observa a aba do agente (pode ter mudado com open_tab/switch_tab).
  const tabAfter = session.targetTabId;
  const obs: Observation = await deps
    .observe(tabAfter, settings.agentScreenshotEachStep)
    .catch((err: unknown) => ({ text: `Não foi possível observar a página: ${errText(err)}` }));
  if (ctx.signal.aborted) throw ctx.signal.reason ?? new DOMException('Interrompido', 'AbortError');
  scanTaint(env, obs.text, round);
  if (obs.signature) session.pageSig.set(tabAfter, obs.signature);

  const before = tabAfter === tabBefore ? sigBefore : undefined;
  const streak = session.loop.record(actionKey(call.name, args), before, obs.signature);
  let note = '';
  if (before !== undefined && obs.signature !== undefined)
    note =
      before === obs.signature
        ? '\nA página não mudou após a ação.'
        : '\nA página mudou após a ação.';
  if (streak >= LOOP_WARN && streak < LOOP_STOP)
    note +=
      '\nAtenção: você repetiu esta ação e a página não mudou. Tente outra abordagem ou pergunte ao usuário.';
  const stop =
    streak >= LOOP_STOP
      ? `Laço detectado: "${intent.summary}" foi repetido ${streak} vezes sem mudar a página.`
      : undefined;

  await deps.log({
    ...base,
    decision,
    reasons: decision === 'confirmed' ? verdict.reasons : [],
    ok: result.ok,
    result: result.text,
  });
  const images = [...(result.images ?? []), ...(obs.images ?? [])];
  return {
    ...result,
    text: `${result.text}${note}`,
    images: images.length ? images : undefined,
    observation: obs.text,
    decision: { kind: decision, reasons: decision === 'confirmed' ? verdict.reasons : undefined },
    stop,
  };
}

async function executeAgentCall(
  env: Env,
  call: ToolCall,
  signal: AbortSignal,
  round: number,
): Promise<CallOutcome> {
  const { tools, session } = env;
  const ctx: ToolContext = { signal, defaultTabId: session.targetTabId, agent: session };
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) return runTool(tools, call, ctx);

  let args: Record<string, unknown>;
  try {
    args = parseToolArguments(call.arguments);
  } catch (err) {
    return { ok: false, text: `Erro: ${errText(err)}` };
  }
  try {
    if (call.name === PLAN_TOOL_NAME) return await handlePlan(env, call, args, signal);
  } catch (err) {
    if (signal.aborted) throw err;
    return { ok: false, text: `Erro: ${errText(err)}` };
  }
  if (tool.risk === 'read') {
    const outcome = await runTool(tools, call, ctx);
    scanTaint(env, outcome.text, round);
    return outcome;
  }
  return handleAction(env, tool, call, args, ctx, round);
}

/**
 * Uma volta do modo agente: observar → decidir → agir → verificar, com plano aprovado, portão de
 * segurança em cada ação, limites de passos e de tempo, detector de laço e registro local.
 */
export async function runAgentTurn(
  opts: AgentTurnOptions,
): Promise<TurnResult & { session: AgentSession }> {
  const deps: AgentDeps = { ...defaultDeps, ...opts.deps };
  const now = opts.now ?? Date.now;
  const { settings } = opts;
  const session = createSession({
    conversationId: opts.conversationId,
    startTab: opts.startTab,
    messages: opts.base,
    maxSteps: settings.agentMaxSteps,
    maxMinutes: settings.agentMaxMinutes,
    now: now(),
  });
  const env: Env = { tools: opts.tools, session, ui: opts.ui, deps, settings, now };

  // Contexto de página anexado pelo usuário também é conteúdo não confiável.
  for (const m of opts.base) {
    if (m.role === 'user' && m.context)
      scanTaint(env, [m.context.text, m.context.selection, m.context.snapshot].join('\n'), 0);
  }

  let round = 0;
  const turn = await runAssistantTurn({
    ...opts,
    mode: 'agent',
    maxRounds: settings.agentMaxSteps,
    beforeRound: (r) => {
      round = r;
      opts.ui.status(statusOf(session, r));
      if (now() > session.deadline)
        return `Tempo limite de ${settings.agentMaxMinutes} min atingido.`;
      return undefined;
    },
    executeCall: (call, ctx) => executeAgentCall(env, call, ctx.signal, round),
  });
  return { ...turn, session };
}

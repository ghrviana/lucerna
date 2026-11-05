import { runAgentTurn, type AgentUi } from '../agent/agentTurn';
import { dropEmptyAssistant, markCancelled, runAssistantTurn } from '../agent/toolLoop';
import { deepseekProvider } from '../llm/deepseek';
import { friendlyError, LlmError } from '../llm/errors';
import { waitForComplete } from '../page/tabs';
import type { ChatMessage } from '../storage/conversations';
import { clipSummary, type ScheduledTask } from '../storage/scheduledTasks';
import type { Settings } from '../storage/settings';
import { AGENT_TOOLS, ALL_TOOLS } from '../tools/registry';

/** Nunca há usuário para aprovar nada: aprova o plano (sem habilitar sites sozinho) e recusa
 * sempre que uma ação pedir confirmação — ela só prossegue se a política já permitir sem perguntar. */
const headlessUi: AgentUi = {
  askPlan: () => Promise.resolve({ approved: true, enableSites: [] }),
  confirm: () => Promise.resolve(false),
  status: () => {},
};

/** Tempo máximo de uma execução de tarefa agendada, em minutos. */
const READ_ONLY_TIMEOUT_MINUTES = 3;
const TAB_LOAD_TIMEOUT_MS = 30_000;

export interface TaskRunOutcome {
  ok: boolean;
  summary: string;
}

const newUserMessage = (content: string): ChatMessage => ({
  id: crypto.randomUUID(),
  role: 'user',
  content,
  createdAt: Date.now(),
});

export function buildPrompt(task: ScheduledTask): string {
  const parts = [
    `Tarefa agendada "${task.name}": verifique a página ${task.url}, que já está aberta numa aba.`,
    task.instruction.trim() ||
      'Resuma o que há de mais importante nela e diga se algo relevante mudou.',
    'Leia a aba com read_tab (ou list_tabs se precisar achar o id dela) antes de responder.',
  ];
  if (task.lastSummary) {
    parts.push(
      `Resposta da verificação anterior, para comparar:\n<verificacao_anterior>\n${task.lastSummary}\n</verificacao_anterior>`,
    );
  } else {
    parts.push('Esta é a primeira verificação desta tarefa; não há nada anterior para comparar.');
  }
  return parts.join('\n\n');
}

/**
 * Abre a página da tarefa numa aba em segundo plano, pede ao modelo que a verifique (só leitura,
 * a menos que `allowActions` esteja ligado) e devolve o resultado. Não lança: falhas voltam como
 * `{ ok: false, summary }`.
 */
export async function runScheduledTask(
  task: ScheduledTask,
  settings: Settings,
): Promise<TaskRunOutcome> {
  let tab: chrome.tabs.Tab | undefined;
  const ctrl = new AbortController();
  const minutes = task.allowActions ? settings.agentMaxMinutes : READ_ONLY_TIMEOUT_MINUTES;
  const timer = setTimeout(() => ctrl.abort(), minutes * 60_000);
  try {
    if (!settings.apiKey) return { ok: false, summary: 'Chave de API não configurada.' };
    tab = await chrome.tabs.create({ url: task.url, active: false });
    if (tab.id === undefined) return { ok: false, summary: 'Não foi possível abrir a página.' };
    await waitForComplete(tab.id, ctrl.signal, TAB_LOAD_TIMEOUT_MS).catch(() => undefined);

    const base = [newUserMessage(buildPrompt(task))];
    const common = {
      base,
      connection: settings,
      systemPrompt: settings.systemPrompt,
      provider: deepseekProvider,
      signal: ctrl.signal,
      onUpdate: () => {},
    };

    const turn = task.allowActions
      ? await runAgentTurn({
          ...common,
          tools: AGENT_TOOLS,
          conversationId: `scheduled:${task.id}`,
          startTab: { id: tab.id, url: task.url },
          settings,
          ui: headlessUi,
        })
      : await runAssistantTurn({ ...common, tools: ALL_TOOLS });

    const messages = markCancelled(dropEmptyAssistant(turn.messages));
    const answer = messages.at(-1)?.content?.trim();
    if (turn.stopReason) return { ok: false, summary: `Interrompida: ${turn.stopReason}` };
    if (!answer) return { ok: false, summary: 'O modelo não devolveu texto.' };
    return { ok: true, summary: clipSummary(answer) };
  } catch (err) {
    const summary = err instanceof LlmError ? friendlyError(err) : errText(err);
    return { ok: false, summary };
  } finally {
    clearTimeout(timer);
    if (tab?.id !== undefined) await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

import { create } from 'zustand';
import {
  runAgentTurn,
  type AgentStatus,
  type AgentUi,
  type ConfirmRequest,
  type PlanDecision,
} from '@/core/agent/agentTurn';
import { matchesDomain } from '@/core/agent/policy';
import {
  dropEmptyAssistant,
  markCancelled,
  MAX_TOOL_ROUNDS,
  runAssistantTurn,
  type TurnResult,
} from '@/core/agent/toolLoop';
import { useI18nStore } from '@/core/i18n/store';
import { translate, type TranslationKey } from '@/core/i18n/translate';
import { normalizeDomain } from '@/core/page/blocklist';
import { abortError } from '@/core/page/tabs';
import { deepseekProvider } from '@/core/llm/deepseek';
import { openAICompatibleProvider } from '@/core/llm/openaiCompatible';
import type { ChatProvider, Usage } from '@/core/llm/types';
import { friendlyError, LlmError } from '@/core/llm/errors';
import { MAX_UPLOAD_BYTES, processImage } from '@/core/page/image';
import { QUICK_PROMPTS, type PendingAsk } from '@/core/page/pending';
import { truncateSmart } from '@/core/page/truncate';
import type { ImageAttachment, PageContext } from '@/core/page/types';
import {
  createConversation,
  deleteConversation,
  listConversations,
  saveConversation,
  titleFromText,
  type ChatMessage,
  type Conversation,
} from '@/core/storage/conversations';
import { addMemory, listMemories } from '@/core/storage/memories';
import { DEFAULT_SETTINGS, getSettings, type Settings } from '@/core/storage/settings';
import {
  createWorkflow,
  deleteWorkflow,
  fillPlaceholders,
  isSlugTaken,
  listWorkflows,
  saveWorkflow,
  slugify,
  type Workflow,
} from '@/core/storage/workflows';
import { MEMORY_TOOLS } from '@/core/tools/memoryTools';
import { AGENT_TOOLS, ALL_TOOLS } from '@/core/tools/registry';
import type { PlanProposal } from '@/core/tools/writeTools';
import {
  activeBrowsingTab,
  captureAnnotated,
  capturePageContext,
  captureScreenshot,
} from '@/core/page/capture';

/** Máximo de imagens por mensagem. */
export const MAX_ATTACHMENTS = 4;

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  streaming: boolean;
  error: string | null;
  needsKey: boolean;
  /** Configurações atuais (Fase 8: provedor/modelo por conversa, medidor de uso). */
  settings: Settings;
  /** Contexto da página/seleção que será enviado com a próxima mensagem. */
  context: PageContext | null;
  contextLoading: boolean;
  /** Imagens que serão enviadas com a próxima mensagem. */
  attachments: ImageAttachment[];
  capturing: boolean;
  /** Aviso não bloqueante (ex.: captura ignorada em domínio bloqueado). */
  notice: string | null;
  /** Tarefa do agente em andamento (null = parado). */
  agentStatus: AgentStatus | null;
  /** Plano esperando aprovação; notEnabled = sites do plano em que o agente ainda não age. */
  pendingPlan: (PlanProposal & { notEnabled: string[] }) | null;
  /** Ação esperando confirmação do usuário. */
  pendingConfirm: ConfirmRequest | null;
  resolvePlan: (approved: boolean, enableSites: boolean) => void;
  resolveConfirm: (approved: boolean) => void;
  /** Workflows salvos (instrução reutilizável, com {{parâmetros}} opcionais). */
  workflows: Workflow[];
  /** Texto (de uma mensagem do usuário) que está virando um workflow novo. */
  saveWorkflowDraft: string | null;
  loadWorkflows: () => Promise<void>;
  openSaveWorkflow: (text: string) => void;
  closeSaveWorkflow: () => void;
  createWorkflowFrom: (
    instruction: string,
    name: string,
    agentMode: boolean,
  ) => Promise<'ok' | 'duplicate'>;
  deleteWorkflowById: (id: string) => Promise<void>;
  runWorkflow: (
    workflow: Workflow,
    values: Record<string, string>,
    opts?: { newConversation?: boolean },
  ) => Promise<void>;
  /** Decisão (nesta sessão do painel; não persistida) de cada proposta de memória já decidida. */
  decidedMemory: Record<string, 'approved' | 'dismissed'>;
  approveMemory: (callId: string, text: string) => Promise<void>;
  dismissMemory: (callId: string) => void;
  setAgentMode: (on: boolean) => Promise<void>;
  /** Provedor/modelo desta conversa (Fase 8); model vazio/undefined = padrão do provedor. */
  setProvider: (provider: 'primary' | 'secondary', model?: string) => Promise<void>;
  init: () => Promise<void>;
  newConversation: () => void;
  select: (id: string) => void;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  send: (text: string, titleHint?: string) => Promise<void>;
  attachPage: () => Promise<void>;
  captureScreenshot: () => Promise<void>;
  captureAnnotated: () => Promise<void>;
  addImages: (files: File[]) => Promise<void>;
  removeAttachment: (id: string) => void;
  setAutoScreenshot: (on: boolean) => Promise<void>;
  setToolsEnabled: (on: boolean) => Promise<void>;
  dismissNotice: () => void;
  setContext: (context: PageContext | null) => void;
  handlePending: (pending: PendingAsk) => Promise<void>;
  regenerate: () => Promise<void>;
  stop: () => void;
  dismissError: () => void;
}

let controller: AbortController | null = null;
let askedTabAccess = false;
let planResolver: ((d: PlanDecision) => void) | null = null;
let confirmResolver: ((ok: boolean) => void) | null = null;

/**
 * Pede acesso de host aos domínios que o usuário acabou de habilitar para o agente. Tem de ser
 * chamado de forma síncrona dentro do clique (gesto do usuário).
 */
function requestSiteAccess(domains: string[]): void {
  if (!domains.length) return;
  const origins = domains.map((d) => `*://${d}/*`);
  void chrome.permissions.request({ origins }).catch(() => false);
}

/** Pede acesso a todos os sites (para ler outras abas); sem isso, só a aba ativa é legível. */
async function requestTabAccess(): Promise<void> {
  const origins = ['<all_urls>'];
  if (await chrome.permissions.contains({ origins }).catch(() => false)) return;
  await chrome.permissions.request({ origins }).catch(() => false);
}

/** Traduz fora de componentes React, usando o idioma atual da loja de i18n. */
const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
  translate(useI18nStore.getState().locale, key, vars);

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : t('errors.captureFailure');

const newMessage = (role: ChatMessage['role'], content = ''): ChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: Date.now(),
});

/** Provedor/conexão desta conversa (Fase 8): padrão (DeepSeek) ou o segundo provedor, se escolhido
 * e configurado; model vazio na conversa = modelo padrão do provedor escolhido. */
function resolveProvider(
  settings: Settings,
  conv: Conversation,
): {
  provider: ChatProvider;
  connection: {
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature: number;
    reasoningEffort?: string;
  };
} {
  const sp = settings.secondaryProvider;
  if (conv.provider === 'secondary' && sp.baseUrl && sp.apiKey) {
    return {
      provider: openAICompatibleProvider,
      connection: {
        baseUrl: sp.baseUrl,
        apiKey: sp.apiKey,
        model: conv.model?.trim() || sp.model,
        temperature: settings.temperature,
        reasoningEffort: sp.reasoningEffort,
      },
    };
  }
  return {
    provider: deepseekProvider,
    connection: {
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: conv.model?.trim() || settings.model,
      temperature: settings.temperature,
    },
  };
}

/** Soma o uso de tokens de uma rodada ao total acumulado da conversa. */
function addUsage(prev: Conversation['usage'], u: Usage | undefined): Conversation['usage'] {
  if (!u) return prev;
  return {
    promptTokens: (prev?.promptTokens ?? 0) + u.promptTokens,
    completionTokens: (prev?.completionTokens ?? 0) + u.completionTokens,
    totalTokens: (prev?.totalTokens ?? 0) + u.totalTokens,
  };
}

export const useChat = create<ChatState>((set, get) => {
  /** Atualiza uma conversa na lista (mantendo a ordem por atualização). */
  const upsert = (conv: Conversation) =>
    set((s) => ({
      conversations: [conv, ...s.conversations.filter((c) => c.id !== conv.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt,
      ),
    }));

  const activeConv = () => get().conversations.find((c) => c.id === get().activeId);

  /** Executa uma captura mostrando o estado de carregamento e convertendo falhas em erro visível. */
  async function attach(action: () => Promise<void>) {
    if (get().capturing) return;
    set({ capturing: true, error: null });
    try {
      await action();
    } catch (err) {
      set({ error: errorText(err) });
    } finally {
      set({ capturing: false });
    }
  }

  /** Gera a resposta do assistente para o histórico atual da conversa `convId`. */
  async function generate(convId: string) {
    const settings = await getSettings();
    const base = get().conversations.find((c) => c.id === convId);
    if (!base) return;
    const { provider, connection } = resolveProvider(settings, base);
    if (!connection.apiKey) {
      set({
        needsKey: true,
        error: t('app.configureApiKey'),
      });
      return;
    }

    set({ streaming: true, error: null, needsKey: false, settings });

    const ctrl = new AbortController();
    controller = ctrl;
    let latest = base.messages;
    let turn: TurnResult | undefined;
    const memoryTool = settings.memoryEnabled;
    const memories = memoryTool ? (await listMemories()).map((m) => m.text) : [];
    const common = {
      base: base.messages,
      connection,
      systemPrompt: settings.systemPrompt,
      provider,
      signal: ctrl.signal,
      promptExtras: { memoryTool, memories },
      onUpdate: (messages: ChatMessage[]) => {
        latest = messages;
        upsert({ ...base, messages });
      },
    };
    try {
      if (base.agentMode) {
        const startTab = await activeBrowsingTab();
        if (startTab?.id === undefined) throw new Error(t('errors.noActiveTab'));
        turn = await runAgentTurn({
          ...common,
          tools: memoryTool ? [...AGENT_TOOLS, ...MEMORY_TOOLS] : AGENT_TOOLS,
          conversationId: base.id,
          startTab: { id: startTab.id, url: startTab.url },
          settings,
          ui: agentUi,
        });
      } else {
        const readTools = base.toolsEnabled === false ? [] : ALL_TOOLS;
        turn = await runAssistantTurn({
          ...common,
          tools: memoryTool ? [...readTools, ...MEMORY_TOOLS] : readTools,
        });
      }
      const rounds = base.agentMode ? settings.agentMaxSteps : MAX_TOOL_ROUNDS;
      if (turn.stopReason) {
        set({ notice: t('notices.interrupted', { reason: turn.stopReason }) });
      } else if (turn.hitLimit) {
        set({ error: t('errors.toolLimitReached', { rounds }) });
      } else if (!turn.messages.at(-1)?.content) {
        set({ error: t('errors.noFinalText') });
      }
    } catch (err) {
      if (!ctrl.signal.aborted) {
        console.error('Lucerna: falha ao gerar resposta', err);
        if (err instanceof LlmError && err.detail) {
          console.error('Lucerna: resposta bruta do provedor (debug)', err.detail);
        }
        set({ error: err instanceof LlmError ? friendlyError(err) : errorText(err) });
      }
    } finally {
      if (controller === ctrl) controller = null;
      planResolver = null;
      confirmResolver = null;
      set({ agentStatus: null, pendingPlan: null, pendingConfirm: null });
      // Descarta balões vazios (erro ou parada imediata); o que já foi gerado fica salvo.
      const conv: Conversation = {
        ...base,
        messages: markCancelled(dropEmptyAssistant(latest)),
        usage: addUsage(base.usage, turn?.usage),
        updatedAt: Date.now(),
      };
      upsert(conv);
      await saveConversation(conv);
      set({ streaming: false });
    }
  }

  /** Ponte entre o loop do agente e os cartões de plano/confirmação do painel. */
  const agentUi: AgentUi = {
    askPlan: (plan, signal) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) return reject(abortError(signal));
        const onAbort = () => {
          planResolver = null;
          set({ pendingPlan: null });
          reject(abortError(signal));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        planResolver = (d) => {
          signal.removeEventListener('abort', onAbort);
          planResolver = null;
          resolve(d);
        };
        void getSettings().then((s) => {
          const notEnabled = plan.sites
            .map(normalizeDomain)
            .filter((d) => d && !matchesDomain(d, s.agentAllowedDomains));
          if (planResolver) set({ pendingPlan: { ...plan, notEnabled } });
        });
      }),
    confirm: (req, signal) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) return reject(abortError(signal));
        const onAbort = () => {
          confirmResolver = null;
          set({ pendingConfirm: null });
          reject(abortError(signal));
        };
        signal.addEventListener('abort', onAbort, { once: true });
        confirmResolver = (ok) => {
          signal.removeEventListener('abort', onAbort);
          confirmResolver = null;
          resolve(ok);
        };
        set({ pendingConfirm: req });
      }),
    status: (agentStatus) => set({ agentStatus }),
  };

  return {
    conversations: [],
    activeId: null,
    streaming: false,
    error: null,
    needsKey: false,
    settings: DEFAULT_SETTINGS,
    context: null,
    contextLoading: false,
    attachments: [],
    capturing: false,
    notice: null,
    agentStatus: null,
    pendingPlan: null,
    pendingConfirm: null,
    workflows: [],
    saveWorkflowDraft: null,
    decidedMemory: {},
    dismissError: () => set({ error: null }),

    resolvePlan(approved, enableSites) {
      const plan = get().pendingPlan;
      if (!plan || !planResolver) return;
      const sites = approved && enableSites ? plan.notEnabled : [];
      requestSiteAccess(sites); // ainda dentro do clique
      set({ pendingPlan: null });
      planResolver({ approved, enableSites: sites });
    },

    resolveConfirm(approved) {
      const req = get().pendingConfirm;
      if (!req || !confirmResolver) return;
      if (approved && req.verdict.enableDomain) requestSiteAccess([req.verdict.enableDomain]);
      set({ pendingConfirm: null });
      confirmResolver(approved);
    },

    async setAgentMode(on) {
      if (!activeConv()) get().newConversation();
      const conv = activeConv();
      if (!conv || get().streaming) return;
      // Agir em outras abas e sites exige acesso a sites; o pedido precisa deste clique.
      if (on) await requestTabAccess();
      const updated = { ...conv, agentMode: on };
      upsert(updated);
      await saveConversation(updated);
    },

    async setProvider(provider, model) {
      if (!activeConv()) get().newConversation();
      const conv = activeConv();
      if (!conv || get().streaming) return;
      const updated: Conversation = { ...conv, provider, model: model?.trim() || undefined };
      upsert(updated);
      await saveConversation(updated);
    },
    dismissNotice: () => set({ notice: null }),

    async init() {
      const conversations = await listConversations();
      set({ conversations, activeId: conversations[0]?.id ?? null });
      const settings = await getSettings();
      set({ needsKey: !settings.apiKey, settings });
      await get().loadWorkflows();
    },

    async loadWorkflows() {
      set({ workflows: await listWorkflows() });
    },

    openSaveWorkflow: (text) => set({ saveWorkflowDraft: text }),
    closeSaveWorkflow: () => set({ saveWorkflowDraft: null }),

    async createWorkflowFrom(instruction, name, agentMode) {
      if (isSlugTaken(get().workflows, slugify(name))) return 'duplicate';
      const w = createWorkflow({ name, instruction, agentMode });
      await saveWorkflow(w);
      set((s) => ({ workflows: [w, ...s.workflows] }));
      return 'ok';
    },

    async deleteWorkflowById(id) {
      await deleteWorkflow(id);
      set((s) => ({ workflows: s.workflows.filter((w) => w.id !== id) }));
    },

    async runWorkflow(workflow, values, opts = {}) {
      const text = fillPlaceholders(workflow.instruction, values);
      if (opts.newConversation !== false) get().newConversation();
      if (workflow.agentMode) await get().setAgentMode(true);
      await get().send(text, workflow.name);
    },

    // Decisão fica só no estado do painel (não na conversa): gravar a decisão dentro de
    // Conversation.messages correria o risco de perdê-la se uma resposta nova ainda estivesse
    // sendo salva por cima no `finally` de generate() (leitura-modificação-escrita do objeto
    // inteiro). addMemory já deduplica por texto exato, então reabrir o painel e aprovar de novo
    // não duplica.
    async approveMemory(callId, text) {
      await addMemory(text);
      set((s) => ({ decidedMemory: { ...s.decidedMemory, [callId]: 'approved' } }));
    },

    dismissMemory(callId) {
      set((s) => ({ decidedMemory: { ...s.decidedMemory, [callId]: 'dismissed' } }));
    },

    newConversation() {
      get().stop();
      // Reaproveita uma conversa ainda vazia em vez de criar várias.
      const empty = get().conversations.find((c) => c.messages.length === 0);
      if (empty) return set({ activeId: empty.id, error: null });
      const conv = createConversation();
      upsert(conv);
      set({ activeId: conv.id, error: null });
    },

    select(id) {
      get().stop();
      set({ activeId: id, error: null });
    },

    async rename(id, title) {
      const conv = get().conversations.find((c) => c.id === id);
      const clean = title.trim();
      if (!conv || !clean) return;
      const updated = { ...conv, title: clean };
      set((s) => ({ conversations: s.conversations.map((c) => (c.id === id ? updated : c)) }));
      await saveConversation(updated);
    },

    async remove(id) {
      if (get().activeId === id) get().stop();
      await deleteConversation(id);
      const conversations = get().conversations.filter((c) => c.id !== id);
      set({
        conversations,
        activeId: get().activeId === id ? (conversations[0]?.id ?? null) : get().activeId,
      });
    },

    async send(text, titleHint) {
      const trimmed = text.trim();
      if (!trimmed || get().streaming) return;
      let conv = activeConv();
      // Uma vez por sessão do painel, no gesto de enviar: libera a leitura de outras abas.
      if ((conv?.toolsEnabled !== false || conv?.agentMode) && !askedTabAccess) {
        askedTabAccess = true;
        await requestTabAccess();
      }
      if (!conv) {
        conv = createConversation();
        set({ activeId: conv.id });
      }
      const isFirst = conv.messages.length === 0;
      let images = get().attachments;
      // Screenshot automático da conversa: captura um novo, salvo se já há captura da aba anexada.
      if (conv.autoScreenshot && !images.some((i) => i.kind !== 'upload')) {
        set({ capturing: true });
        try {
          images = [...images, await captureScreenshot()];
        } catch (err) {
          set({ notice: t('notices.autoScreenshotSkipped', { error: errorText(err) }) });
        } finally {
          set({ capturing: false });
        }
      }
      const { context } = get();
      const userMessage: ChatMessage = {
        ...newMessage('user', trimmed),
        context: context ?? undefined,
        images: images.length ? images : undefined,
      };
      const next: Conversation = {
        ...conv,
        title: isFirst ? titleFromText(titleHint ?? trimmed) : conv.title,
        updatedAt: Date.now(),
        messages: [...conv.messages, userMessage],
      };
      set({ context: null, attachments: [] });
      upsert(next);
      await saveConversation(next);
      await generate(next.id);
    },

    async regenerate() {
      const conv = activeConv();
      if (!conv || get().streaming) return;
      const msgs = [...conv.messages];
      // Uma resposta pode ter várias mensagens do assistente (rodadas de ferramentas).
      while (msgs.at(-1)?.role === 'assistant') msgs.pop();
      if (msgs.at(-1)?.role !== 'user') return;
      upsert({ ...conv, messages: msgs });
      await generate(conv.id);
    },

    stop() {
      controller?.abort();
    },

    setContext: (context) => set({ context }),

    async attachPage() {
      set({ contextLoading: true, error: null });
      try {
        set({ context: await capturePageContext() });
      } catch (err) {
        set({ error: err instanceof Error ? err.message : t('errors.readPageFailure') });
      } finally {
        set({ contextLoading: false });
      }
    },

    async captureScreenshot() {
      await attach(async () => {
        const image = await captureScreenshot();
        set((s) => ({ attachments: [...s.attachments, image] }));
      });
    },

    async captureAnnotated() {
      await attach(async () => {
        const { image, context } = await captureAnnotated();
        set((s) => ({
          attachments: [...s.attachments, image],
          // Mantém o texto/seleção já anexados e acrescenta a lista de elementos.
          context: s.context ? { ...s.context, snapshot: context.snapshot } : context,
        }));
      });
    },

    async addImages(files) {
      const room = MAX_ATTACHMENTS - get().attachments.length;
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;
      if (images.length > room)
        set({ notice: t('notices.maxAttachments', { max: MAX_ATTACHMENTS }) });
      await attach(async () => {
        for (const file of images.slice(0, Math.max(0, room))) {
          if (file.size > MAX_UPLOAD_BYTES) {
            set({ notice: t('notices.imageTooLarge', { name: file.name }) });
            continue;
          }
          const image = await processImage(file, { kind: 'upload' });
          set((s) => ({ attachments: [...s.attachments, image] }));
        }
      });
    },

    removeAttachment(id) {
      set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) }));
    },

    async setAutoScreenshot(on) {
      if (!activeConv()) get().newConversation();
      const conv = activeConv();
      if (!conv) return;
      const updated = { ...conv, autoScreenshot: on };
      upsert(updated);
      await saveConversation(updated);
    },

    async setToolsEnabled(on) {
      if (!activeConv()) get().newConversation();
      const conv = activeConv();
      if (!conv) return;
      // Ler outras abas exige acesso a sites; o pedido precisa vir de um gesto do usuário (este clique).
      if (on) await requestTabAccess();
      const updated = { ...conv, toolsEnabled: on };
      upsert(updated);
      await saveConversation(updated);
    },

    async handlePending(pending) {
      const t = truncateSmart(pending.text);
      const context: PageContext = {
        title: pending.title,
        url: pending.url,
        text: '',
        selection: t.text,
        truncated: t.truncated,
        originalLength: t.originalLength,
      };
      if (pending.action === 'ask') {
        set({ context });
        return;
      }
      // Ações rápidas começam uma conversa nova e enviam o prompt na hora.
      get().newConversation();
      for (let i = 0; i < 40 && get().streaming; i++) await new Promise((r) => setTimeout(r, 50));
      set({ context });
      const labels = { summarize: 'Resumo', translate: 'Tradução', explain: 'Explicação' };
      await get().send(QUICK_PROMPTS[pending.action], `${labels[pending.action]}: ${pending.text}`);
    },
  };
});

import { parseKey } from '../page/actions';
import { findTab, injectAndAsk, readableTab, type ReadableTab } from '../page/capture';
import { navigateAndWait, sleep, waitForComplete, waitIfNavigating } from '../page/tabs';
import {
  ACT_MESSAGE,
  DESCRIBE_MESSAGE,
  SETTLE_MESSAGE,
  type ActRequest,
  type ActResponse,
  type DescribeResponse,
  type ElementInfo,
  type ScrollDirection,
} from '../page/types';
import {
  optionalBool,
  optionalInt,
  optionalNumber,
  optionalString,
  optionalTabId,
  requiredInt,
  requiredString,
  requiredTabId,
  stringList,
  ToolArgError,
} from './args';
import type { ActionIntent, Tool, ToolContext } from './types';

/**
 * Ferramentas de escrita do modo agente. Nunca rodam direto: o loop do agente passa cada chamada
 * pelo portão de segurança (intent → política → confirmação) antes de `execute`.
 */

export const PLAN_TOOL_NAME = 'propose_plan';
const MAX_WAIT_SECONDS = 10;

const ID_PROP = {
  type: 'integer',
  description: 'Id do elemento no snapshot MAIS RECENTE (get_page_snapshot ou observação).',
};
const TAB_PROP = { type: 'integer', description: 'Id da aba. Padrão: a aba em que o agente está.' };
const REASON_PROP = {
  type: 'string',
  description: 'Por que esta ação serve ao pedido do usuário (curto). Aparece nas confirmações.',
};

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties: { ...properties, reason: REASON_PROP },
  required,
  additionalProperties: false,
});

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const labelOf = (el: ElementInfo) => `${el.role} "${clip(el.name || el.text || el.tag, 60)}"`;

function tabIdFor(args: Record<string, unknown>, ctx: ToolContext): number | undefined {
  return optionalTabId(args) ?? ctx.agent?.targetTabId ?? ctx.defaultTabId;
}

/** Aba da ação, já validada (http/file, fora dos domínios sem captura). */
const pageTab = (args: Record<string, unknown>, ctx: ToolContext) =>
  readableTab(tabIdFor(args, ctx));

async function describe(tab: ReadableTab, id?: number): Promise<ElementInfo | undefined> {
  const res = await injectAndAsk<DescribeResponse>(tab, { type: DESCRIBE_MESSAGE, id });
  if (!res.ok) {
    if (id === undefined) return undefined;
    throw new ToolArgError(res.error);
  }
  return res.data;
}

async function act(tab: ReadableTab, req: ActRequest): Promise<ActResponse & { ok: true }> {
  let res: ActResponse | undefined;
  try {
    res = await injectAndAsk<ActResponse>(tab, { type: ACT_MESSAGE, ...req });
  } catch (err) {
    // O clique pode ter disparado uma navegação antes da resposta chegar.
    const now = await chrome.tabs.get(tab.id).catch(() => undefined);
    if (now?.status === 'loading')
      return { ok: true, message: 'Ação enviada; a página começou a carregar.' };
    throw err;
  }
  if (!res.ok) throw new ToolArgError(res.error);
  return res;
}

/** Depois de agir: espera navegação e o DOM assentar (melhor esforço). */
async function settle(tab: ReadableTab, signal: AbortSignal): Promise<void> {
  await waitIfNavigating(tab.id, signal);
  const fresh = await chrome.tabs.get(tab.id).catch(() => undefined);
  if (!fresh?.url) return;
  await injectAndAsk(
    { ...tab, url: fresh.url },
    { type: SETTLE_MESSAGE, quietMs: 300, maxMs: 2000 },
  ).catch(() => {});
}

function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `https://${url.replace(/^\/+/, '')}`;
}

const click: Tool = {
  name: 'click',
  description:
    'Clica num elemento (link, botão, caixa de marcar...) pelo id do snapshot mais recente. Depois da ação você recebe a página atualizada.',
  jsonSchema: schema({ id: ID_PROP, tabId: TAB_PROP }, ['id']),
  risk: 'write',
  async intent(args, ctx) {
    const tab = await pageTab(args, ctx);
    const element = await describe(tab, requiredInt(args, 'id'));
    if (!element) throw new ToolArgError('Elemento não encontrado.');
    return {
      kind: 'click',
      summary: `Clicar em ${labelOf(element)}`,
      tabId: tab.id,
      url: tab.url,
      element,
      destination: element.href,
    };
  },
  async execute(args, ctx) {
    const tab = await pageTab(args, ctx);
    const res = await act(tab, { action: 'click', id: requiredInt(args, 'id') });
    await settle(tab, ctx.signal);
    return { text: res.message };
  },
};

const typeTool: Tool = {
  name: 'type',
  description:
    'Digita texto num campo (substitui o conteúdo atual). Com submit=true, pressiona Enter em seguida. Nunca use em campos de senha, 2FA ou cartão: peça ao usuário.',
  jsonSchema: schema(
    {
      id: ID_PROP,
      text: { type: 'string', description: 'Texto a digitar.' },
      submit: { type: 'boolean', description: 'Pressionar Enter depois (padrão: false).' },
      tabId: TAB_PROP,
    },
    ['id', 'text'],
  ),
  risk: 'write',
  async intent(args, ctx) {
    const tab = await pageTab(args, ctx);
    const element = await describe(tab, requiredInt(args, 'id'));
    if (!element) throw new ToolArgError('Elemento não encontrado.');
    const text = requiredString(args, 'text');
    const submit = optionalBool(args, 'submit');
    return {
      kind: 'type',
      summary: `Digitar "${clip(text)}" em ${labelOf(element)}${submit ? ' e pressionar Enter' : ''}`,
      tabId: tab.id,
      url: tab.url,
      element,
      text,
      submit,
    };
  },
  async execute(args, ctx) {
    const tab = await pageTab(args, ctx);
    const res = await act(tab, {
      action: 'type',
      id: requiredInt(args, 'id'),
      text: requiredString(args, 'text'),
      submit: optionalBool(args, 'submit'),
    });
    await settle(tab, ctx.signal);
    return { text: res.message };
  },
};

const pressKey: Tool = {
  name: 'press_key',
  description:
    'Pressiona uma tecla (Enter, Tab, Shift+Tab, Escape, Backspace, setas, PageDown, Space...) no elemento indicado ou no que tem o foco.',
  jsonSchema: schema(
    { key: { type: 'string', description: 'Tecla, ex.: "Enter".' }, id: ID_PROP, tabId: TAB_PROP },
    ['key'],
  ),
  risk: 'write',
  async intent(args, ctx) {
    const tab = await pageTab(args, ctx);
    const key = requiredString(args, 'key');
    parseKey(key); // valida antes de pedir confirmação
    const id = optionalInt(args, 'id');
    const element = await describe(tab, id);
    return {
      kind: 'press_key',
      summary: `Pressionar ${key}${element ? ` em ${labelOf(element)}` : ''}`,
      tabId: tab.id,
      url: tab.url,
      element,
      key,
    };
  },
  async execute(args, ctx) {
    const tab = await pageTab(args, ctx);
    const res = await act(tab, {
      action: 'press_key',
      key: requiredString(args, 'key'),
      id: optionalInt(args, 'id'),
    });
    await settle(tab, ctx.signal);
    return { text: res.message };
  },
};

const selectOption: Tool = {
  name: 'select_option',
  description: 'Escolhe uma opção de um <select> pelo texto ou valor da opção.',
  jsonSchema: schema(
    {
      id: ID_PROP,
      option: { type: 'string', description: 'Texto (ou valor) da opção.' },
      tabId: TAB_PROP,
    },
    ['id', 'option'],
  ),
  risk: 'write',
  async intent(args, ctx) {
    const tab = await pageTab(args, ctx);
    const element = await describe(tab, requiredInt(args, 'id'));
    if (!element) throw new ToolArgError('Elemento não encontrado.');
    const option = requiredString(args, 'option');
    return {
      kind: 'select_option',
      summary: `Escolher "${clip(option)}" em ${labelOf(element)}`,
      tabId: tab.id,
      url: tab.url,
      element,
      text: option,
    };
  },
  async execute(args, ctx) {
    const tab = await pageTab(args, ctx);
    const res = await act(tab, {
      action: 'select_option',
      id: requiredInt(args, 'id'),
      option: requiredString(args, 'option'),
    });
    await settle(tab, ctx.signal);
    return { text: res.message };
  },
};

const DIRECTIONS: ScrollDirection[] = ['up', 'down', 'left', 'right'];

const scroll: Tool = {
  name: 'scroll',
  description:
    'Rola a página (direction + amount em telas, padrão 0,8) ou rola até um elemento (id sem direction). Com id e direction, rola dentro daquele contêiner.',
  jsonSchema: schema({
    direction: { type: 'string', enum: DIRECTIONS },
    amount: { type: 'number', description: 'Quantas telas (0,1 a 10). Padrão: 0,8.' },
    id: ID_PROP,
    tabId: TAB_PROP,
  }),
  risk: 'write',
  async intent(args, ctx) {
    const tab = await pageTab(args, ctx);
    const id = optionalInt(args, 'id');
    const element = id === undefined ? undefined : await describe(tab, id);
    const dir = optionalString(args, 'direction') ?? (element ? '' : 'down');
    return {
      kind: 'scroll',
      summary: element && !dir ? `Rolar até ${labelOf(element)}` : `Rolar para ${dir}`,
      tabId: tab.id,
      url: tab.url,
      element,
    };
  },
  async execute(args, ctx) {
    const tab = await pageTab(args, ctx);
    const direction = optionalString(args, 'direction');
    if (direction && !DIRECTIONS.includes(direction as ScrollDirection))
      throw new ToolArgError('direction deve ser up, down, left ou right.');
    const res = await act(tab, {
      action: 'scroll',
      id: optionalInt(args, 'id'),
      direction: direction as ScrollDirection | undefined,
      amount: optionalNumber(args, 'amount'),
    });
    await settle(tab, ctx.signal);
    return { text: res.message };
  },
};

const wait: Tool = {
  name: 'wait',
  description: `Espera alguns segundos (máx. ${MAX_WAIT_SECONDS}) para a página carregar ou atualizar.`,
  jsonSchema: schema({ seconds: { type: 'number', description: 'Segundos (0,5 a 10).' } }, [
    'seconds',
  ]),
  risk: 'write',
  async intent(args) {
    const s = Math.min(MAX_WAIT_SECONDS, Math.max(0.5, optionalNumber(args, 'seconds') ?? 1));
    return { kind: 'wait', summary: `Esperar ${s} s` };
  },
  async execute(args, ctx) {
    const s = Math.min(MAX_WAIT_SECONDS, Math.max(0.5, optionalNumber(args, 'seconds') ?? 1));
    await sleep(s * 1000, ctx.signal);
    return { text: `Esperei ${s} s.` };
  },
};

/** Aba para navegação: não exige página legível (ex.: nova guia). */
async function anyTab(args: Record<string, unknown>, ctx: ToolContext) {
  const tab = await findTab(tabIdFor(args, ctx));
  return tab as chrome.tabs.Tab & { id: number };
}

async function tabSummary(tabId: number): Promise<string> {
  const t = await chrome.tabs.get(tabId).catch(() => undefined);
  return t ? `Aba [${tabId}]: ${t.title ?? ''} — ${t.url ?? ''}` : `Aba [${tabId}].`;
}

const navigate: Tool = {
  name: 'navigate',
  description: 'Abre um endereço (http/https) na aba em que o agente está.',
  jsonSchema: schema({ url: { type: 'string' }, tabId: TAB_PROP }, ['url']),
  risk: 'write',
  async intent(args, ctx) {
    const tab = await anyTab(args, ctx);
    const url = normalizeUrl(requiredString(args, 'url'));
    return {
      kind: 'navigate',
      summary: `Abrir ${clip(url, 120)}`,
      tabId: tab.id,
      url: tab.url,
      destination: url,
    };
  },
  async execute(args, ctx) {
    const tab = await anyTab(args, ctx);
    const url = normalizeUrl(requiredString(args, 'url'));
    await navigateAndWait(tab.id, () => chrome.tabs.update(tab.id, { url }), ctx.signal);
    return { text: `Página aberta. ${await tabSummary(tab.id)}` };
  },
};

const goBack: Tool = {
  name: 'go_back',
  description: 'Volta para a página anterior do histórico da aba.',
  jsonSchema: schema({ tabId: TAB_PROP }),
  risk: 'write',
  async intent(args, ctx) {
    const tab = await anyTab(args, ctx);
    return { kind: 'go_back', summary: 'Voltar à página anterior', tabId: tab.id, url: tab.url };
  },
  async execute(args, ctx) {
    const tab = await anyTab(args, ctx);
    await navigateAndWait(tab.id, () => chrome.tabs.goBack(tab.id), ctx.signal);
    return { text: `Voltei. ${await tabSummary(tab.id)}` };
  },
};

const openTab: Tool = {
  name: 'open_tab',
  description: 'Abre um endereço (http/https) numa aba nova, que passa a ser a aba do agente.',
  jsonSchema: schema({ url: { type: 'string' } }, ['url']),
  risk: 'write',
  async intent(args) {
    const url = normalizeUrl(requiredString(args, 'url'));
    return { kind: 'open_tab', summary: `Abrir ${clip(url, 120)} numa aba nova`, destination: url };
  },
  async execute(args, ctx) {
    const url = normalizeUrl(requiredString(args, 'url'));
    const current = await anyTab({}, ctx).catch(() => undefined);
    const tab = await chrome.tabs.create({ url, active: true, windowId: current?.windowId });
    if (tab.id === undefined) throw new Error('Não foi possível abrir a aba.');
    ctx.agent?.openedTabIds.add(tab.id);
    ctx.agent?.setTarget(tab.id);
    await sleep(200, ctx.signal);
    await waitForComplete(tab.id, ctx.signal);
    return { text: `Aba nova aberta. ${await tabSummary(tab.id)}` };
  },
};

const switchTab: Tool = {
  name: 'switch_tab',
  description: 'Passa a trabalhar em outra aba (de list_tabs) e a deixa visível.',
  jsonSchema: schema({ tabId: { type: 'integer', description: 'Id da aba (de list_tabs).' } }, [
    'tabId',
  ]),
  risk: 'write',
  async intent(args) {
    const tab = await findTab(requiredTabId(args));
    return {
      kind: 'switch_tab',
      summary: `Ir para a aba [${tab.id}] ${clip(tab.title ?? '', 60)}`,
      tabId: tab.id,
      url: tab.url,
    };
  },
  async execute(args, ctx) {
    const id = requiredTabId(args);
    await chrome.tabs.update(id, { active: true });
    ctx.agent?.setTarget(id);
    return { text: `Agora na ${await tabSummary(id)}` };
  },
};

const closeTab: Tool = {
  name: 'close_tab',
  description: 'Fecha uma aba. Fechar abas que você não abriu pede confirmação do usuário.',
  jsonSchema: schema({ tabId: { type: 'integer', description: 'Id da aba (de list_tabs).' } }, [
    'tabId',
  ]),
  risk: 'write',
  async intent(args, ctx) {
    const tab = await findTab(requiredTabId(args));
    return {
      kind: 'close_tab',
      summary: `Fechar a aba [${tab.id}] ${clip(tab.title ?? '', 60)}`,
      tabId: tab.id,
      url: tab.url,
      tabOpenedByAgent: ctx.agent?.openedTabIds.has(tab.id as number) ?? false,
    };
  },
  async execute(args, ctx) {
    const id = requiredTabId(args);
    const tab = await chrome.tabs.get(id);
    await chrome.tabs.remove(id);
    if (ctx.agent && ctx.agent.targetTabId === id) {
      const [next] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
      if (next?.id !== undefined) ctx.agent.setTarget(next.id);
    }
    return { text: `Aba [${id}] fechada.` };
  },
};

export interface PlanProposal {
  goal: string;
  steps: string[];
  sites: string[];
}

export function parsePlan(args: Record<string, unknown>): PlanProposal {
  const goal = optionalString(args, 'goal') ?? '';
  const steps = stringList(args, 'steps');
  if (!steps.length) throw new ToolArgError('steps deve listar os passos do plano.');
  return { goal, steps: steps.slice(0, 20), sites: stringList(args, 'sites').slice(0, 10) };
}

/** Tratada pelo loop do agente (mostra o plano e espera a aprovação); nunca executada direto. */
const proposePlan: Tool = {
  name: PLAN_TOOL_NAME,
  description:
    'Mostra ao usuário o plano da tarefa e espera a aprovação. Obrigatório antes de qualquer ação; chame de novo se o plano mudar.',
  jsonSchema: {
    type: 'object',
    properties: {
      goal: { type: 'string', description: 'O que o usuário pediu, em uma frase.' },
      steps: { type: 'array', items: { type: 'string' }, description: 'Passos, em ordem.' },
      sites: {
        type: 'array',
        items: { type: 'string' },
        description: 'Domínios em que você vai agir (ex.: "pt.wikipedia.org").',
      },
    },
    required: ['goal', 'steps', 'sites'],
    additionalProperties: false,
  },
  risk: 'write',
  async execute() {
    throw new Error('propose_plan é tratado pelo loop do agente.');
  },
};

export const WRITE_TOOLS: Tool[] = [
  proposePlan,
  click,
  typeTool,
  pressKey,
  selectOption,
  scroll,
  wait,
  navigate,
  goBack,
  openTab,
  switchTab,
  closeTab,
];

export type { ActionIntent };

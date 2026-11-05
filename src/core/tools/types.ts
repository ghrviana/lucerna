import type { ElementInfo, ImageAttachment } from '../page/types';

export type ToolRisk = 'read' | 'write' | 'sensitive';

/** Estado do modo agente visível às ferramentas de escrita. */
export interface AgentToolContext {
  /** Aba em que o agente está trabalhando (padrão quando a ferramenta não recebe tabId). */
  targetTabId: number;
  /** Abas abertas pelo próprio agente nesta tarefa (fechá-las não pede confirmação). */
  openedTabIds: Set<number>;
  setTarget(tabId: number): void;
}

export interface ToolContext {
  signal: AbortSignal;
  /** Aba usada quando o argumento tabId é omitido (sem isto: a aba ativa). */
  defaultTabId?: number;
  agent?: AgentToolContext;
}

/** Resultado de uma ferramenta, devolvido ao modelo como mensagem `tool`. */
export interface ToolResult {
  text: string;
  /** Imagens (ex.: screenshots). A API só aceita imagens em mensagens do usuário. */
  images?: ImageAttachment[];
}

export type ActionKind =
  | 'click'
  | 'type'
  | 'press_key'
  | 'select_option'
  | 'scroll'
  | 'wait'
  | 'navigate'
  | 'go_back'
  | 'open_tab'
  | 'switch_tab'
  | 'close_tab';

/** Descrição de uma ação antes de executá-la, avaliada pela política de segurança. */
export interface ActionIntent {
  kind: ActionKind;
  /** Frase legível para o usuário: o que será feito. */
  summary: string;
  tabId?: number;
  /** URL atual da aba afetada. */
  url?: string;
  element?: ElementInfo;
  /** Texto a digitar (type) ou opção (select_option). */
  text?: string;
  key?: string;
  submit?: boolean;
  /** Para onde a ação leva (navigate, open_tab ou link clicado). */
  destination?: string;
  /** close_tab: a aba foi aberta pelo agente nesta tarefa. */
  tabOpenedByAgent?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  /** JSON Schema dos argumentos. */
  jsonSchema: Record<string, unknown>;
  risk: ToolRisk;
  /** Só ferramentas de escrita: descreve a ação para o portão de segurança, sem executá-la. */
  intent?(args: Record<string, unknown>, ctx: ToolContext): Promise<ActionIntent>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/** Decisão registrada numa chamada do modo agente (mostrada no chat e no registro). */
export type ActionDecision =
  'auto' | 'confirmed' | 'refused' | 'denied' | 'cancelled' | 'plan_approved' | 'plan_refused';

/** Resultado de uma chamada, como fica salvo na conversa. */
export interface ToolOutcome {
  ok: boolean;
  text: string;
  images?: ImageAttachment[];
  /** Observação da página após uma ação (snapshot); só as mais recentes vão ao modelo. */
  observation?: string;
  decision?: { kind: ActionDecision; reasons?: string[] };
}

/** Definição no formato de function calling da API. */
export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export function toToolSpec(tool: Tool): ToolSpec {
  return {
    type: 'function',
    function: { name: tool.name, description: tool.description, parameters: tool.jsonSchema },
  };
}

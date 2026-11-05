import type { ChatMessage } from '../storage/conversations';
import type { AgentToolContext } from '../tools/types';
import type { PlanProposal } from '../tools/writeTools';
import { LoopGuard } from './loopGuard';
import { hostOf, type PolicySession } from './policy';

/** Estado de uma tarefa do modo agente (uma volta: do pedido do usuário até a resposta final). */
export interface AgentSession extends PolicySession, AgentToolContext {
  conversationId: string;
  startedAt: number;
  deadline: number;
  maxSteps: number;
  /** Ações executadas (depois do portão). */
  actions: number;
  plan?: PlanProposal;
  loop: LoopGuard;
  /** Assinatura da página (por aba) na última observação. */
  pageSig: Map<number, string>;
}

/** O que o usuário digitou na conversa. Contexto de página anexado não conta: é dado não confiável. */
export function requestTextOf(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
}

export function createSession(opts: {
  conversationId: string;
  startTab: { id: number; url?: string };
  messages: ChatMessage[];
  maxSteps: number;
  maxMinutes: number;
  now: number;
}): AgentSession {
  return {
    conversationId: opts.conversationId,
    startDomain: hostOf(opts.startTab.url),
    requestText: requestTextOf(opts.messages),
    planApproved: false,
    scopeDomains: [],
    targetTabId: opts.startTab.id,
    openedTabIds: new Set(),
    setTarget(tabId: number) {
      this.targetTabId = tabId;
    },
    startedAt: opts.now,
    deadline: opts.now + opts.maxMinutes * 60_000,
    maxSteps: opts.maxSteps,
    actions: 0,
    loop: new LoopGuard(),
    pageSig: new Map(),
  };
}

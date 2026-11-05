import { useI18nStore } from '../i18n/store';
import { translate } from '../i18n/translate';
import type { ImageAttachment, PageContext } from '../page/types';
import type { ToolOutcome } from '../tools/types';
import { db } from './db';

const newConversationTitle = () =>
  translate(useI18nStore.getState().locale, 'conversations.newTitle');

/** Chamada de ferramenta feita pelo assistente, com o resultado (ausente = não concluída). */
export interface ToolCallRecord {
  id: string;
  name: string;
  /** JSON dos argumentos, como o modelo enviou. */
  arguments: string;
  result?: ToolOutcome;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Raciocínio do modelo (thinking). Guardado para fases com ferramentas (ver docs/deepseek-notes.md). */
  reasoningContent?: string;
  /** Ferramentas chamadas nesta resposta (os resultados seguem para o modelo na mesma volta). */
  toolCalls?: ToolCallRecord[];
  /** Página/seleção anexada a esta mensagem (enviada ao modelo dentro de delimitadores). */
  context?: PageContext;
  /** Imagens anexadas (screenshots, anotados ou enviados pelo usuário). */
  images?: ImageAttachment[];
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  /** Captura um screenshot novo a cada mensagem enviada nesta conversa. */
  autoScreenshot?: boolean;
  /** Ferramentas de leitura (abas, PDF, tabelas...) ligadas; ausente = ligadas. */
  toolsEnabled?: boolean;
  /** Modo agente: o modelo pode clicar, digitar e navegar (com o portão de segurança). */
  agentMode?: boolean;
  /** Provedor usado nesta conversa (Fase 8); ausente = provedor padrão. */
  provider?: 'primary' | 'secondary';
  /** Modelo usado nesta conversa; ausente = o modelo padrão do provedor escolhido. */
  model?: string;
  /** Soma dos tokens usados nesta conversa (Fase 8, medidor de uso). */
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export function createConversation(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: newConversationTitle(),
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

/** Mais recentes primeiro. */
export async function listConversations(): Promise<Conversation[]> {
  return (await (await db()).getAllFromIndex('conversations', 'updatedAt')).reverse();
}

export async function saveConversation(conv: Conversation): Promise<void> {
  await (await db()).put('conversations', conv);
}

export async function deleteConversation(id: string): Promise<void> {
  await (await db()).delete('conversations', id);
}

/** Busca por título ou conteúdo das mensagens (sem diferenciar maiúsculas/acentos). */
export function filterConversations(list: Conversation[], query: string): Conversation[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = norm(query.trim());
  if (!q) return list;
  return list.filter(
    (c) => norm(c.title).includes(q) || c.messages.some((m) => norm(m.content).includes(q)),
  );
}

export function titleFromText(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 40 ? `${t.slice(0, 40)}…` : t || newConversationTitle();
}

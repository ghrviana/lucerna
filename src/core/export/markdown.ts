import type { ChatMessage, Conversation } from '../storage/conversations';

const MAX_ARG_TEXT = 200;
const MAX_RESULT_TEXT = 300;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function quoteBlock(text: string): string {
  return text
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
}

function summarizeArgs(raw: string): string {
  try {
    const value = JSON.parse(raw || '{}') as unknown;
    if (typeof value !== 'object' || value === null) return clip(raw, MAX_ARG_TEXT);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value))
      out[k] = typeof v === 'string' ? clip(v, MAX_ARG_TEXT) : v;
    return JSON.stringify(out);
  } catch {
    return clip(raw, MAX_ARG_TEXT);
  }
}

function toolCallsToMarkdown(calls: ChatMessage['toolCalls']): string | undefined {
  if (!calls?.length) return undefined;
  const lines = calls.map((c) => {
    const args = summarizeArgs(c.arguments);
    const result = c.result ? clip(c.result.text, MAX_RESULT_TEXT) : '(sem resultado)';
    return `- 🔧 \`${c.name}\`(${args}) → ${result.replace(/\n/g, ' ')}`;
  });
  return ['**Ferramentas:**', ...lines].join('\n');
}

function messageToMarkdown(m: ChatMessage): string {
  const who = m.role === 'user' ? 'Você' : 'Lucerna';
  const time = new Date(m.createdAt).toLocaleString('pt-BR');
  const parts = [`## ${who} — ${time}`];
  if (m.content.trim()) parts.push(m.content);
  if (m.context?.text) {
    const label = m.context.title || m.context.url || 'página';
    parts.push(`> **Contexto da página** (${label}):\n>\n${quoteBlock(m.context.text)}`);
  }
  if (m.context?.selection) parts.push(`> **Seleção:** ${m.context.selection}`);
  if (m.images?.length) {
    parts.push(`_${m.images.length} imagem(ns) anexada(s) (não incluídas neste arquivo)._`);
  }
  const tools = toolCallsToMarkdown(m.toolCalls);
  if (tools) parts.push(tools);
  return parts.join('\n\n');
}

/** Exporta uma conversa inteira em markdown legível (sem imagens, que ficam só anotadas). */
export function conversationToMarkdown(conv: Conversation): string {
  const header = [`# ${conv.title}`, `_Exportado em ${new Date().toLocaleString('pt-BR')}_`].join(
    '\n',
  );
  if (!conv.messages.length) return `${header}\n\n_Conversa vazia._\n`;
  return `${header}\n\n${conv.messages.map(messageToMarkdown).join('\n\n---\n\n')}\n`;
}

/** Nome de arquivo seguro a partir do título da conversa, com a data de hoje. */
export function conversationFilename(title: string): string {
  const slug =
    title
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'conversa';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${date}.md`;
}

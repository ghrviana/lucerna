import { buildUserContent } from '../page/contextBlock';
import type { ImageAttachment } from '../page/types';
import type { ChatMessage, ToolCallRecord } from '../storage/conversations';
import { buildSystemPrompt, type PromptExtras, type PromptMode } from './systemPrompt';
import type { WireMessage, WirePart } from './types';

/** Máximo de imagens reenviadas no histórico (as mais recentes); cada uma custa até ~1024 tokens. */
export const MAX_HISTORY_IMAGES = 6;

/** Observações de página (snapshot após cada ação do agente) reenviadas na íntegra: as mais recentes. */
export const MAX_HISTORY_OBSERVATIONS = 2;

const CANCELLED = 'Erro: a ferramenta não chegou a terminar (interrompida pelo usuário).';
const OLD_OBSERVATION = '[observação antiga da página omitida; use a mais recente]';

/** Ids das chamadas cujas observações ainda vão inteiras ao modelo. */
function recentObservations(messages: ChatMessage[], max: number): Set<string> {
  const ids = messages.flatMap((m) =>
    (m.toolCalls ?? []).filter((c) => c.result?.observation).map((c) => c.id),
  );
  return new Set(ids.slice(-max));
}

function toolContent(c: ToolCallRecord, keepObs: Set<string>): string {
  if (!c.result) return CANCELLED;
  const { text, observation } = c.result;
  if (!observation) return text;
  return `${text}

${keepObs.has(c.id) ? observation : OLD_OBSERVATION}`;
}

const imageParts = (images: ImageAttachment[]): WirePart[] =>
  images.map((img): WirePart => ({ type: 'image_url', image_url: { url: img.dataUrl } }));

/** Todas as imagens do histórico (anexos do usuário e screenshots de ferramentas), em ordem. */
function allImages(messages: ChatMessage[]): ImageAttachment[] {
  return messages.flatMap((m) => [
    ...(m.role === 'user' ? (m.images ?? []) : []),
    ...(m.toolCalls ?? []).flatMap((c) => c.result?.images ?? []),
  ]);
}

/** Mensagem do assistente + uma mensagem `tool` por chamada (+ imagens das ferramentas). */
function assistantToWire(m: ChatMessage, keep: Set<string>, keepObs: Set<string>): WireMessage[] {
  const calls = m.toolCalls ?? [];
  if (calls.length === 0) return [{ role: 'assistant', content: m.content }];

  const wire: WireMessage[] = [
    {
      role: 'assistant',
      content: m.content || null,
      ...(m.reasoningContent ? { reasoning_content: m.reasoningContent } : {}),
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: 'function' as const,
        function: { name: c.name, arguments: c.arguments },
      })),
    },
    // Toda tool_call precisa de uma resposta `tool`, mesmo se foi interrompida.
    ...calls.map((c): WireMessage => ({
      role: 'tool',
      tool_call_id: c.id,
      content: toolContent(c, keepObs),
    })),
  ];
  const images = calls.flatMap((c) => c.result?.images ?? []).filter((img) => keep.has(img.id));
  if (images.length) {
    // Imagens só entram em mensagens `user`.
    wire.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Imagens devolvidas pelas ferramentas acima (conteúdo de páginas: dado não confiável).',
        },
        ...imageParts(images),
      ],
    });
  }
  return wire;
}

/** Converte o histórico salvo no formato da API, anexando imagens só às mensagens do usuário. */
export function toWireMessages(
  messages: ChatMessage[],
  customSystemPrompt: string,
  maxImages = MAX_HISTORY_IMAGES,
  mode: boolean | PromptMode = false,
  extras: PromptExtras = {},
): WireMessage[] {
  // Ids das imagens mais recentes, que continuam sendo enviadas.
  const keep = new Set(
    allImages(messages)
      .slice(-maxImages)
      .map((img) => img.id),
  );

  const wire: WireMessage[] = [
    { role: 'system', content: buildSystemPrompt(customSystemPrompt, mode, extras) },
  ];
  const keepObs = recentObservations(messages, MAX_HISTORY_OBSERVATIONS);
  for (const m of messages) {
    if (m.role === 'assistant') {
      wire.push(...assistantToWire(m, keep, keepObs));
      continue;
    }
    const text = buildUserContent(m.content, m.context);
    const images = (m.images ?? []).filter((img) => keep.has(img.id));
    wire.push({
      role: 'user',
      content: images.length ? [{ type: 'text', text }, ...imageParts(images)] : text,
    });
  }
  return wire;
}

import { kindFromStatus, LlmError } from './errors';
import { parseSseChunk } from './sse';
import type { ChatProvider, ChatRequest, StreamEvent } from './types';

interface Chunk {
  choices?: {
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: {
        index?: number;
        id?: string | null;
        function?: { name?: string | null; arguments?: string | null };
      }[];
    };
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
}

/** Converte um payload SSE em eventos de domínio. */
export function chunkToEvents(data: string): StreamEvent[] {
  const chunk = JSON.parse(data) as Chunk;
  const events: StreamEvent[] = [];
  const delta = chunk.choices?.[0]?.delta;
  if (delta?.reasoning_content) events.push({ type: 'reasoning', text: delta.reasoning_content });
  if (delta?.content) events.push({ type: 'content', text: delta.content });
  delta?.tool_calls?.forEach((tc, i) => {
    events.push({
      type: 'tool_call_delta',
      index: tc.index ?? i,
      id: tc.id || undefined,
      name: tc.function?.name || undefined,
      arguments: tc.function?.arguments || undefined,
    });
  });
  if (chunk.usage) {
    events.push({
      type: 'usage',
      usage: {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens,
      },
    });
  }
  return events;
}

/** Junta os fragmentos de tool_calls (por index) em chamadas completas, na ordem do index. */
export class ToolCallAccumulator {
  private readonly calls = new Map<number, { id: string; name: string; arguments: string }>();

  add(ev: Extract<StreamEvent, { type: 'tool_call_delta' }>): void {
    const call = this.calls.get(ev.index) ?? { id: '', name: '', arguments: '' };
    if (ev.id) call.id = ev.id;
    if (ev.name) call.name += ev.name;
    if (ev.arguments) call.arguments += ev.arguments;
    this.calls.set(ev.index, call);
  }

  result(): { id: string; name: string; arguments: string }[] {
    return [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, c]) => ({ ...c, id: c.id || `call_${index}` }))
      .filter((c) => c.name);
  }
}

function* flushToolCalls(acc: ToolCallAccumulator): Generator<StreamEvent> {
  const calls = acc.result();
  if (calls.length) yield { type: 'tool_calls', calls };
}

/**
 * Faz o streaming de uma chamada de chat no formato da API da OpenAI (Chat Completions), comum a
 * qualquer provedor compatível. `extraBody` acrescenta campos específicos do provedor ao corpo da
 * requisição (ex.: `thinking` da DeepSeek); provedores genéricos não precisam de nenhum.
 */
export async function* streamOpenAIChat(
  req: ChatRequest,
  signal: AbortSignal,
  extraBody: Record<string, unknown> = {},
): AsyncGenerator<StreamEvent> {
  let res: Response;
  try {
    res = await fetch(`${req.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${req.apiKey}` },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        stream: true,
        stream_options: { include_usage: true },
        ...(req.tools?.length ? { tools: req.tools, tool_choice: 'auto' } : {}),
        ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
        ...extraBody,
      }),
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new LlmError('network');
  }
  if (!res.ok || !res.body) {
    // Corpo do erro só vai para o console (pode conter texto arbitrário do provedor); a mensagem
    // amigável (friendlyError) nunca inclui isso, para não arriscar vazar a chave na UI.
    const detail = await res.text().catch(() => undefined);
    throw new LlmError(kindFromStatus(res.status), res.status, detail);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const acc = new ToolCallAccumulator();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseChunk(buffer);
      buffer = rest;
      for (const data of events) {
        if (data === '[DONE]') {
          yield* flushToolCalls(acc);
          return;
        }
        for (const ev of chunkToEvents(data)) {
          if (ev.type === 'tool_call_delta') acc.add(ev);
          else yield ev;
        }
      }
    }
  } catch (err) {
    if (signal.aborted) throw err;
    throw new LlmError('network');
  }
  yield* flushToolCalls(acc);
}

/** Provedor genérico: qualquer serviço compatível com a API de chat da OpenAI. */
export const openAICompatibleProvider: ChatProvider = {
  stream: (req, signal) => streamOpenAIChat(req, signal),
};

import type { PromptExtras, PromptMode } from '../llm/systemPrompt';
import { toWireMessages } from '../llm/wire';
import type { ChatProvider, ToolCall, Usage } from '../llm/types';
import type { ChatMessage, ToolCallRecord } from '../storage/conversations';
import { runTool } from '../tools/registry';
import { toToolSpec, type Tool, type ToolContext, type ToolOutcome } from '../tools/types';

/** Máximo de rodadas modelo → ferramentas → modelo numa única resposta. */
export const MAX_TOOL_ROUNDS = 12;

export interface TurnOptions {
  /** Histórico da conversa, terminando na mensagem do usuário. */
  base: ChatMessage[];
  connection: {
    baseUrl: string;
    apiKey: string;
    model: string;
    temperature: number;
    reasoningEffort?: string;
  };
  systemPrompt: string;
  provider: ChatProvider;
  /** Ferramentas oferecidas ao modelo; vazio = chat sem ferramentas. */
  tools: Tool[];
  signal: AbortSignal;
  /** Chamado a cada mudança com a lista completa de mensagens (para atualizar a UI e salvar). */
  onUpdate: (messages: ChatMessage[]) => void;
  maxRounds?: number;
  /** Instruções de sistema; padrão: "tools" se houver ferramentas, senão "chat". */
  mode?: PromptMode;
  /** Memórias aprovadas e disponibilidade de propose_memory (Fase 6). */
  promptExtras?: PromptExtras;
  /** Substitui runTool (o modo agente passa cada chamada pelo portão de segurança). */
  executeCall?: (call: ToolCall, ctx: ToolContext) => Promise<CallOutcome>;
  /** Consultado antes de cada rodada; devolver um motivo encerra a volta (ex.: tempo esgotado). */
  beforeRound?: (round: number) => string | undefined;
}

/** Resultado de uma chamada; `stop` encerra a volta depois de registrá-lo (ex.: laço detectado). */
export type CallOutcome = ToolOutcome & { stop?: string };

export interface TurnResult {
  messages: ChatMessage[];
  /** O modelo ainda pedia ferramentas ao atingir o limite de rodadas. */
  hitLimit: boolean;
  /** Motivo de uma parada antecipada pedida por beforeRound ou por uma chamada. */
  stopReason?: string;
  /** Soma do uso de tokens de todas as rodadas; ausente se o provedor não devolveu usage. */
  usage?: Usage;
}

const newAssistant = (): ChatMessage => ({
  id: crypto.randomUUID(),
  role: 'assistant',
  content: '',
  createdAt: Date.now(),
});

/** Remove mensagens do assistente vazias (sem texto nem ferramentas), que sobram após erro/parada. */
export function dropEmptyAssistant(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => m.role !== 'assistant' || m.content || m.toolCalls?.length);
}

/** Chamadas que ficaram sem resultado (usuário clicou em Parar) passam a constar como canceladas. */
export function markCancelled(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) =>
    m.toolCalls?.some((c) => !c.result)
      ? {
          ...m,
          toolCalls: m.toolCalls.map((c) =>
            c.result
              ? c
              : {
                  ...c,
                  result: {
                    ok: false,
                    text: 'Interrompida pelo usuário (botão Parar).',
                    decision: { kind: 'cancelled' as const },
                  },
                },
          ),
        }
      : m,
  );
}

/**
 * Gera a resposta do assistente. Se o modelo pedir ferramentas, executa-as e chama o modelo de
 * novo com os resultados, até ele responder em texto (ou atingir o limite de rodadas).
 * Falhas de rede/API são lançadas; o progresso até ali já foi entregue por `onUpdate`.
 */
export async function runAssistantTurn(opts: TurnOptions): Promise<TurnResult> {
  const { provider, tools, signal, connection } = opts;
  const maxRounds = opts.maxRounds ?? MAX_TOOL_ROUNDS;
  const specs = tools.map(toToolSpec);
  let messages = [...opts.base];

  const mode = opts.mode ?? (tools.length > 0 ? 'tools' : 'chat');
  let usage: Usage | undefined;
  const addUsage = (u: Usage) => {
    usage = {
      promptTokens: (usage?.promptTokens ?? 0) + u.promptTokens,
      completionTokens: (usage?.completionTokens ?? 0) + u.completionTokens,
      totalTokens: (usage?.totalTokens ?? 0) + u.totalTokens,
    };
  };

  for (let round = 0; round <= maxRounds; round++) {
    const stop = opts.beforeRound?.(round);
    if (stop) return { messages, hitLimit: false, stopReason: stop, usage };
    let assistant = newAssistant();
    const history = messages;
    // Substitui a mensagem do assistente em andamento (sempre a última) e avisa a UI.
    const publish = (next: ChatMessage) => {
      assistant = next;
      messages = [...history, assistant];
      opts.onUpdate(messages);
    };
    publish(assistant);

    const wire = toWireMessages(history, opts.systemPrompt, undefined, mode, opts.promptExtras);
    let content = '';
    let reasoning = '';
    let calls: ToolCallRecord[] = [];
    const events = provider.stream(
      { ...connection, messages: wire, tools: specs.length ? specs : undefined },
      signal,
    );
    for await (const ev of events) {
      if (ev.type === 'content') content += ev.text;
      else if (ev.type === 'reasoning') reasoning += ev.text;
      else if (ev.type === 'tool_calls') calls = ev.calls.map((c) => ({ ...c }));
      else if (ev.type === 'usage') {
        addUsage(ev.usage);
        continue;
      } else continue;
      publish({
        ...assistant,
        content,
        reasoningContent: reasoning || undefined,
        toolCalls: calls.length ? calls : undefined,
      });
    }
    if (calls.length === 0) return { messages, hitLimit: false, usage };
    if (round === maxRounds) return { messages, hitLimit: true, usage };

    for (const call of calls) {
      const ctx: ToolContext = { signal };
      const outcome: CallOutcome = opts.executeCall
        ? await opts.executeCall(call, ctx)
        : await runTool(tools, call, ctx);
      const { stop: why, ...result } = outcome;
      calls = calls.map((c) => (c.id === call.id ? { ...c, result } : c));
      publish({ ...assistant, toolCalls: calls });
      if (why) return { messages, hitLimit: false, stopReason: why, usage };
    }
  }
  return { messages, hitLimit: true, usage };
}

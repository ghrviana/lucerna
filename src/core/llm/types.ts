import type { ToolSpec } from '../tools/types';

export type WirePart =
  { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

/** Chamada de ferramenta pedida pelo modelo (argumentos como string JSON, como na API). */
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface WireToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type WireMessage =
  | { role: 'system'; content: string }
  /** Imagens só são aceitas em mensagens `user` (formato de partes). */
  | { role: 'user'; content: string | WirePart[] }
  | {
      role: 'assistant';
      content: string | null;
      reasoning_content?: string;
      tool_calls?: WireToolCall[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  messages: WireMessage[];
  tools?: ToolSpec[];
  /**
   * `reasoning_effort` (modelos de raciocínio compatíveis com a OpenAI). Alguns desses modelos só
   * aceitam function calling via Chat Completions com `reasoning_effort: "none"` (ex.: gpt-6-luna,
   * confirmado em developers.openai.com); sem isso, a API recusa a requisição (400) sempre que
   * `tools` é enviado, mesmo com `tool_choice: "auto"`. Vazio/ausente = não envia o campo.
   */
  reasoningEffort?: string;
}

export type StreamEvent =
  | { type: 'content'; text: string }
  | { type: 'reasoning'; text: string }
  /** Fragmento de uma chamada de ferramenta (acumulado pelo provedor em `tool_calls`). */
  | { type: 'tool_call_delta'; index: number; id?: string; name?: string; arguments?: string }
  /** Chamadas de ferramenta completas, emitido uma vez ao fim do stream. */
  | { type: 'tool_calls'; calls: ToolCall[] }
  | { type: 'usage'; usage: Usage };

/** Provedor de LLM. DeepSeek é a primeira implementação; outros compatíveis com OpenAI virão depois. */
export interface ChatProvider {
  stream(req: ChatRequest, signal: AbortSignal): AsyncGenerator<StreamEvent>;
}

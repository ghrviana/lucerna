import { describe, expect, it } from 'vitest';
import { ToolCallAccumulator, chunkToEvents, deepseekProvider } from '../llm/deepseek';
import type { ChatProvider, ChatRequest, StreamEvent } from '../llm/types';
import type { ChatMessage } from '../storage/conversations';
import type { Tool } from '../tools/types';
import { dropEmptyAssistant, markCancelled, runAssistantTurn } from './toolLoop';

const connection = { baseUrl: 'https://x.test', apiKey: 'k', model: 'm', temperature: 1 };
const userMsg: ChatMessage = { id: 'u', role: 'user', content: 'compare', createdAt: 0 };

/** Provedor falso: cada chamada a stream() consome o próximo roteiro e registra a requisição. */
function fakeProvider(script: StreamEvent[][]) {
  const requests: ChatRequest[] = [];
  const provider: ChatProvider = {
    async *stream(req) {
      requests.push(req);
      const events = script[requests.length - 1] ?? [];
      for (const e of events) yield e;
    },
  };
  return { provider, requests };
}

const echoTool = (
  run: Tool['execute'] = async (a) => ({ text: `ok ${JSON.stringify(a)}` }),
): Tool => ({
  name: 'echo',
  description: 'ecoa',
  jsonSchema: { type: 'object', properties: {} },
  risk: 'read',
  execute: run,
});

const base = (provider: ChatProvider, tools: Tool[], extra = {}) => ({
  base: [userMsg],
  connection,
  systemPrompt: '',
  provider,
  tools,
  signal: new AbortController().signal,
  onUpdate: () => {},
  ...extra,
});

describe('runAssistantTurn', () => {
  it('repassa promptExtras ao montar o prompt de sistema enviado ao provedor', async () => {
    const { provider, requests } = fakeProvider([[{ type: 'content', text: 'Oi' }]]);
    await runAssistantTurn(
      base(provider, [], { promptExtras: { memories: ['gosta de respostas curtas'] } }),
    );
    const system = requests[0]?.messages[0];
    expect(system?.role).toBe('system');
    expect(system?.content).toContain('gosta de respostas curtas');
  });

  it('sem ferramentas pedidas: uma rodada, texto final, sem tools na requisição vazia', async () => {
    const { provider, requests } = fakeProvider([[{ type: 'content', text: 'Oi' }]]);
    const turn = await runAssistantTurn(base(provider, []));
    expect(turn.hitLimit).toBe(false);
    expect(turn.messages.at(-1)?.content).toBe('Oi');
    expect(requests[0]?.tools).toBeUndefined();
  });

  it('soma o usage de todas as rodadas (Fase 8, medidor de uso)', async () => {
    const { provider } = fakeProvider([
      [
        { type: 'tool_calls', calls: [{ id: 'c1', name: 'echo', arguments: '{}' }] },
        { type: 'usage', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
      ],
      [
        { type: 'content', text: 'Pronto' },
        { type: 'usage', usage: { promptTokens: 20, completionTokens: 8, totalTokens: 28 } },
      ],
    ]);
    const turn = await runAssistantTurn(base(provider, [echoTool()]));
    expect(turn.usage).toEqual({ promptTokens: 30, completionTokens: 13, totalTokens: 43 });
  });

  it('sem eventos de usage do provedor, turn.usage fica undefined', async () => {
    const { provider } = fakeProvider([[{ type: 'content', text: 'Oi' }]]);
    const turn = await runAssistantTurn(base(provider, []));
    expect(turn.usage).toBeUndefined();
  });

  it('executa a ferramenta e devolve o resultado ao modelo na rodada seguinte', async () => {
    const { provider, requests } = fakeProvider([
      [{ type: 'tool_calls', calls: [{ id: 'c1', name: 'echo', arguments: '{"a":1}' }] }],
      [{ type: 'content', text: 'Pronto' }],
    ]);
    const turn = await runAssistantTurn(base(provider, [echoTool()]));

    expect(turn.messages).toHaveLength(3);
    expect(turn.messages[1]?.toolCalls?.[0]?.result).toEqual({
      ok: true,
      text: 'ok {"a":1}',
      images: undefined,
    });
    expect(turn.messages[2]?.content).toBe('Pronto');
    expect(requests[0]?.tools?.[0]?.function.name).toBe('echo');

    const second = requests[1]?.messages ?? [];
    const assistant = second.find((m) => m.role === 'assistant');
    expect(assistant && 'tool_calls' in assistant && assistant.tool_calls?.[0]?.id).toBe('c1');
    expect(second.at(-1)).toEqual({ role: 'tool', tool_call_id: 'c1', content: 'ok {"a":1}' });
  });

  it('erro da ferramenta, argumentos inválidos e ferramenta desconhecida viram resultado de erro', async () => {
    const boom = echoTool(async () => {
      throw new Error('sem permissão');
    });
    const { provider } = fakeProvider([
      [
        {
          type: 'tool_calls',
          calls: [
            { id: 'a', name: 'echo', arguments: '{}' },
            { id: 'b', name: 'echo', arguments: '{quebrado' },
            { id: 'c', name: 'nada', arguments: '{}' },
          ],
        },
      ],
      [{ type: 'content', text: 'Não consegui' }],
    ]);
    const turn = await runAssistantTurn(base(provider, [boom]));
    const results = turn.messages[1]?.toolCalls?.map((c) => c.result);
    expect(results?.map((r) => r?.ok)).toEqual([false, false, false]);
    expect(results?.[0]?.text).toBe('Erro: sem permissão');
    expect(results?.[1]?.text).toContain('JSON válido');
    expect(results?.[2]?.text).toContain('ferramenta desconhecida');
    expect(turn.messages.at(-1)?.content).toBe('Não consegui');
  });

  it('para no limite de rodadas', async () => {
    const call: StreamEvent = {
      type: 'tool_calls',
      calls: [{ id: 'c', name: 'echo', arguments: '{}' }],
    };
    const { provider, requests } = fakeProvider([[call], [call], [call], [call]]);
    const turn = await runAssistantTurn(base(provider, [echoTool()], { maxRounds: 2 }));
    expect(turn.hitLimit).toBe(true);
    expect(requests).toHaveLength(3);
  });

  it('interrompido durante a ferramenta: lança e o histórico ainda é válido para a API', async () => {
    const ctrl = new AbortController();
    const slow = echoTool(async () => {
      ctrl.abort();
      throw new Error('abortada');
    });
    const { provider } = fakeProvider([
      [{ type: 'tool_calls', calls: [{ id: 'c1', name: 'echo', arguments: '{}' }] }],
    ]);
    let latest: ChatMessage[] = [];
    await expect(
      runAssistantTurn(
        base(provider, [slow], {
          signal: ctrl.signal,
          onUpdate: (m: ChatMessage[]) => (latest = m),
        }),
      ),
    ).rejects.toThrow();
    const kept = dropEmptyAssistant(latest);
    expect(kept.at(-1)?.toolCalls?.[0]?.result).toBeUndefined();
    expect(markCancelled(kept).at(-1)?.toolCalls?.[0]?.result).toMatchObject({
      ok: false,
      decision: { kind: 'cancelled' },
    });
  });
});

describe('deltas de tool_calls', () => {
  it('chunkToEvents converte deltas', () => {
    const data = JSON.stringify({
      choices: [
        {
          delta: {
            tool_calls: [{ index: 0, id: 'c1', function: { name: 'read_tab', arguments: '{"ta' } }],
          },
        },
      ],
    });
    expect(chunkToEvents(data)).toEqual([
      { type: 'tool_call_delta', index: 0, id: 'c1', name: 'read_tab', arguments: '{"ta' },
    ]);
  });

  it('acumula fragmentos por index, na ordem, e cria id quando falta', () => {
    const acc = new ToolCallAccumulator();
    acc.add({ type: 'tool_call_delta', index: 1, id: 'b', name: 'list_tabs', arguments: '{}' });
    acc.add({ type: 'tool_call_delta', index: 0, id: 'a', name: 'read_', arguments: '{"tab' });
    acc.add({ type: 'tool_call_delta', index: 0, name: 'tab', arguments: 'Id":3}' });
    acc.add({ type: 'tool_call_delta', index: 2, name: 'x' });
    expect(acc.result()).toEqual([
      { id: 'a', name: 'read_tab', arguments: '{"tabId":3}' },
      { id: 'b', name: 'list_tabs', arguments: '{}' },
      { id: 'call_2', name: 'x', arguments: '' },
    ]);
  });

  it('o provedor emite tool_calls completas ao fim do stream SSE', async () => {
    const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
    const body = [
      sse({
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: 'c1', function: { name: 'read_tab', arguments: '' } }],
            },
          },
        ],
      }),
      sse({
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"tabId"' } }] } }],
      }),
      sse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ':7}' } }] } }] }),
      'data: [DONE]\n\n',
    ];
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(c) {
        body.forEach((p) => c.enqueue(enc.encode(p)));
        c.close();
      },
    });
    const fetchMock = async (_url: string, init: { body: string }) => {
      const sent = JSON.parse(init.body) as { tools?: unknown[]; tool_choice?: string };
      expect(sent.tools).toHaveLength(1);
      expect(sent.tool_choice).toBe('auto');
      return new Response(stream);
    };
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const out: StreamEvent[] = [];
      const req: ChatRequest = {
        ...connection,
        messages: [],
        tools: [
          { type: 'function', function: { name: 'read_tab', description: '', parameters: {} } },
        ],
      };
      for await (const e of deepseekProvider.stream(req, new AbortController().signal)) out.push(e);
      expect(out).toEqual([
        { type: 'tool_calls', calls: [{ id: 'c1', name: 'read_tab', arguments: '{"tabId":7}' }] },
      ]);
    } finally {
      globalThis.fetch = original;
    }
  });
});

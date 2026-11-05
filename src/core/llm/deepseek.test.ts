import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunkToEvents, deepseekProvider } from './deepseek';
import { friendlyError, kindFromStatus, LlmError } from './errors';

const req = {
  baseUrl: 'https://x.test/',
  apiKey: 'sk-secret',
  model: 'm',
  temperature: 1,
  messages: [],
};

function sseResponse(parts: string[], status = 200): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    start(c) {
      parts.forEach((p) => c.enqueue(enc.encode(p)));
      c.close();
    },
  });
  return new Response(body, { status });
}

afterEach(() => vi.unstubAllGlobals());

describe('chunkToEvents', () => {
  it('extrai conteúdo, raciocínio e usage', () => {
    const data = JSON.stringify({
      choices: [{ delta: { content: 'oi', reasoning_content: 'hm' } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });
    expect(chunkToEvents(data)).toEqual([
      { type: 'reasoning', text: 'hm' },
      { type: 'content', text: 'oi' },
      { type: 'usage', usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } },
    ]);
  });
});

describe('deepseekProvider.stream', () => {
  it('emite eventos mesmo com chunks partidos no meio', async () => {
    const line = 'data: {"choices":[{"delta":{"content":"ola"}}]}\n\n';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(sseResponse([line.slice(0, 20), line.slice(20), 'data: [DONE]\n\n'])),
    );
    const out: unknown[] = [];
    for await (const e of deepseekProvider.stream(req, new AbortController().signal)) out.push(e);
    expect(out).toEqual([{ type: 'content', text: 'ola' }]);
  });

  it('mapeia status HTTP para erro amigável sem vazar a chave', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"error":"sk-secret"}', { status: 401 })),
    );
    const run = async () => {
      for await (const e of deepseekProvider.stream(req, new AbortController().signal)) void e;
    };
    const err = await run().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(friendlyError(err)).not.toContain('sk-secret');
    expect((err as LlmError).kind).toBe('auth');
  });

  it('falha de rede vira erro de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const run = async () => {
      for await (const e of deepseekProvider.stream(req, new AbortController().signal)) void e;
    };
    expect(((await run().catch((e: unknown) => e)) as LlmError).kind).toBe('network');
  });
});

describe('kindFromStatus', () => {
  it.each([
    [401, 'auth'],
    [402, 'balance'],
    [429, 'rate_limit'],
    [400, 'invalid_request'],
    [503, 'server'],
    [418, 'unknown'],
  ])('%i -> %s', (status, kind) => expect(kindFromStatus(status)).toBe(kind));
});

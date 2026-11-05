import { afterEach, describe, expect, it, vi } from 'vitest';
import { LlmError } from './errors';
import { openAICompatibleProvider } from './openaiCompatible';

const req = {
  baseUrl: 'https://x.test/',
  apiKey: 'sk-secret',
  model: 'm',
  temperature: 1,
  messages: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('openAICompatibleProvider.stream', () => {
  it('não manda campos específicos da DeepSeek (ex.: thinking) no corpo', async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode('data: [DONE]\n\n'));
        c.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    for await (const e of openAICompatibleProvider.stream(req, new AbortController().signal))
      void e;

    const sent = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body) as Record<
      string,
      unknown
    >;
    expect(sent.thinking).toBeUndefined();
    expect(sent.reasoning_effort).toBeUndefined();
    expect(sent.model).toBe('m');
    expect(sent.stream_options).toEqual({ include_usage: true });
  });

  it('manda reasoning_effort quando configurado (necessário p/ function calling em alguns modelos de raciocínio, ex.: gpt-6-luna)', async () => {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode('data: [DONE]\n\n'));
        c.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    for await (const e of openAICompatibleProvider.stream(
      { ...req, reasoningEffort: 'none' },
      new AbortController().signal,
    ))
      void e;

    const sent = JSON.parse((fetchMock.mock.calls[0]?.[1] as { body: string }).body) as Record<
      string,
      unknown
    >;
    expect(sent.reasoning_effort).toBe('none');
  });

  it('em erro, guarda o corpo bruto da resposta em LlmError.detail (só para log, não para a UI)', async () => {
    const msg = 'Unsupported value: tools requires reasoning_effort=none for this model';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: msg } }), {
          status: 400,
        }),
      ),
    );
    const run = async () => {
      for await (const e of openAICompatibleProvider.stream(req, new AbortController().signal))
        void e;
    };
    const err = await run().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).kind).toBe('invalid_request');
    expect((err as LlmError).detail).toContain(msg);
  });
});

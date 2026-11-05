import { describe, expect, it } from 'vitest';
import { clipResult, MAX_TOOL_RESULT_CHARS, parseToolArguments, runTool } from './registry';
import { ToolArgError } from './args';
import type { Tool, ToolContext } from './types';

const ctx: ToolContext = { signal: new AbortController().signal };

function fakeTool(over: Partial<Tool> = {}): Tool {
  return {
    name: 'fake_tool',
    description: 'd',
    jsonSchema: { type: 'object', properties: {} },
    risk: 'read',
    execute: async () => ({ text: 'ok' }),
    ...over,
  };
}

describe('parseToolArguments', () => {
  it('string vazia (ou só espaços) vira objeto vazio', () => {
    expect(parseToolArguments('')).toEqual({});
    expect(parseToolArguments('   ')).toEqual({});
  });
  it('JSON de objeto válido é interpretado', () => {
    expect(parseToolArguments('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' });
  });
  it('JSON inválido lança ToolArgError (modelo pode truncar/errar a sintaxe)', () => {
    expect(() => parseToolArguments('{a:1')).toThrow(ToolArgError);
  });
  it('JSON válido mas não-objeto (array, string, número, null) lança ToolArgError', () => {
    expect(() => parseToolArguments('[1,2]')).toThrow(ToolArgError);
    expect(() => parseToolArguments('"x"')).toThrow(ToolArgError);
    expect(() => parseToolArguments('42')).toThrow(ToolArgError);
    expect(() => parseToolArguments('null')).toThrow(ToolArgError);
  });
});

describe('clipResult', () => {
  it('texto dentro do limite não muda', () => {
    expect(clipResult('abc')).toBe('abc');
  });
  it('texto acima do limite é cortado com marcador', () => {
    const big = 'x'.repeat(MAX_TOOL_RESULT_CHARS + 100);
    const clipped = clipResult(big);
    expect(clipped.length).toBeLessThan(big.length);
    expect(clipped).toContain('[resultado truncado]');
    expect(clipped.startsWith('x'.repeat(MAX_TOOL_RESULT_CHARS))).toBe(true);
  });
});

describe('runTool', () => {
  it('ferramenta desconhecida devolve erro ao modelo (não lança) listando as disponíveis', async () => {
    const out = await runTool(
      [fakeTool({ name: 'a' }), fakeTool({ name: 'b' })],
      {
        name: 'c',
        arguments: '{}',
      },
      ctx,
    );
    expect(out.ok).toBe(false);
    expect(out.text).toContain('c');
    expect(out.text).toContain('a');
    expect(out.text).toContain('b');
  });

  it('executa a ferramenta com os argumentos interpretados e devolve o resultado', async () => {
    let received: Record<string, unknown> | undefined;
    const tool = fakeTool({
      execute: async (args) => {
        received = args;
        return { text: 'resultado' };
      },
    });
    const out = await runTool([tool], { name: 'fake_tool', arguments: '{"x":1}' }, ctx);
    expect(out).toEqual({ ok: true, text: 'resultado', images: undefined });
    expect(received).toEqual({ x: 1 });
  });

  it('corta o texto do resultado acima do limite', async () => {
    const big = 'y'.repeat(MAX_TOOL_RESULT_CHARS + 50);
    const tool = fakeTool({ execute: async () => ({ text: big }) });
    const out = await runTool([tool], { name: 'fake_tool', arguments: '{}' }, ctx);
    expect(out.ok).toBe(true);
    expect(out.text.length).toBeLessThan(big.length);
  });

  it('argumentos inválidos (JSON quebrado) viram erro ao modelo, sem lançar', async () => {
    const tool = fakeTool();
    const out = await runTool([tool], { name: 'fake_tool', arguments: '{bad' }, ctx);
    expect(out.ok).toBe(false);
    expect(out.text).toContain('JSON');
  });

  it('exceção da ferramenta vira erro ao modelo, sem lançar', async () => {
    const tool = fakeTool({
      execute: async () => {
        throw new Error('deu ruim');
      },
    });
    const out = await runTool([tool], { name: 'fake_tool', arguments: '{}' }, ctx);
    expect(out.ok).toBe(false);
    expect(out.text).toContain('deu ruim');
  });

  it('exceção com o sinal já abortado é relançada (não vira resultado)', async () => {
    const abortedCtx: ToolContext = { signal: AbortSignal.abort() };
    const tool = fakeTool({
      execute: async () => {
        throw new Error('abortado');
      },
    });
    await expect(
      runTool([tool], { name: 'fake_tool', arguments: '{}' }, abortedCtx),
    ).rejects.toThrow('abortado');
  });
});

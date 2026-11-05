import { describe, expect, it } from 'vitest';
import { ToolArgError } from './args';
import { MEMORY_TOOLS, PROPOSE_MEMORY_TOOL_NAME, proposeMemory } from './memoryTools';
import type { ToolContext } from './types';

const ctx: ToolContext = { signal: new AbortController().signal };

describe('propose_memory', () => {
  it('tem risk "read" (não passa pela política/observação do modo agente)', () => {
    expect(proposeMemory.risk).toBe('read');
    expect(proposeMemory.name).toBe(PROPOSE_MEMORY_TOOL_NAME);
  });

  it('exige "text" no schema', () => {
    const schema = proposeMemory.jsonSchema as { required: string[] };
    expect(schema.required).toEqual(['text']);
  });

  it('devolve um texto neutro para o modelo e não grava nada (só registra a proposta)', async () => {
    const result = await proposeMemory.execute(
      { text: 'Usuário prefere respostas concisas.' },
      ctx,
    );
    expect(result.text).toMatch(/aguardando decisão/);
  });

  it('lança ToolArgError para texto vazio ou só espaços', async () => {
    await expect(proposeMemory.execute({ text: '' }, ctx)).rejects.toBeInstanceOf(ToolArgError);
    await expect(proposeMemory.execute({ text: '   ' }, ctx)).rejects.toBeInstanceOf(ToolArgError);
  });

  it('lança ToolArgError quando "text" falta', async () => {
    await expect(proposeMemory.execute({}, ctx)).rejects.toBeInstanceOf(ToolArgError);
  });

  it('MEMORY_TOOLS contém só propose_memory', () => {
    expect(MEMORY_TOOLS.map((t) => t.name)).toEqual([PROPOSE_MEMORY_TOOL_NAME]);
  });
});

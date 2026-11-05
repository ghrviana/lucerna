import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addMemory, clearMemories, deleteMemory, listMemories, updateMemory } from './memories';

describe('memórias', () => {
  it('grava, lista do mais recente e deduplica por texto exato', async () => {
    const a = await addMemory('Usuário prefere respostas concisas.');
    await new Promise((r) => setTimeout(r, 2));
    const b = await addMemory('Usuário trabalha com química.');
    expect((await listMemories()).map((m) => m.id)).toEqual([b.id, a.id]);

    const dup = await addMemory('  Usuário prefere respostas concisas.  '.trim());
    expect(dup.id).toBe(a.id);
    expect(await listMemories()).toHaveLength(2);
  });

  it('edita e apaga', async () => {
    const m = await addMemory('texto original');
    await updateMemory(m.id, 'texto editado');
    expect((await listMemories()).find((x) => x.id === m.id)?.text).toBe('texto editado');

    await deleteMemory(m.id);
    expect((await listMemories()).find((x) => x.id === m.id)).toBeUndefined();
  });

  it('clearMemories apaga tudo', async () => {
    await addMemory('a');
    await addMemory('b');
    await clearMemories();
    expect(await listMemories()).toEqual([]);
  });
});

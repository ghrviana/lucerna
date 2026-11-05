import { db } from './db';

/** Um fato/preferência que o usuário aprovou guardar (ver propose_memory, Fase 6). */
export interface MemoryEntry {
  id: string;
  text: string;
  createdAt: number;
}

/** Entradas mantidas; as mais antigas são apagadas. */
export const MAX_MEMORY_ENTRIES = 500;

/** Mais recentes primeiro. */
export async function listMemories(): Promise<MemoryEntry[]> {
  return (await (await db()).getAllFromIndex('memories', 'createdAt')).reverse();
}

/** Grava (sem duplicar um texto já salvo) e poda o excesso além de MAX_MEMORY_ENTRIES. */
export async function addMemory(text: string): Promise<MemoryEntry> {
  const clean = text.trim();
  const d = await db();
  const existing = (await d.getAll('memories')).find((m) => m.text === clean);
  if (existing) return existing;

  const entry: MemoryEntry = { id: crypto.randomUUID(), text: clean, createdAt: Date.now() };
  await d.put('memories', entry);

  const tx = d.transaction('memories', 'readwrite');
  let cursor = await tx.store.index('createdAt').openCursor();
  const total = await tx.store.count();
  let toDelete = total - MAX_MEMORY_ENTRIES;
  while (cursor && toDelete > 0) {
    await cursor.delete();
    toDelete--;
    cursor = await cursor.continue();
  }
  await tx.done;
  return entry;
}

export async function updateMemory(id: string, text: string): Promise<void> {
  const d = await db();
  const current = await d.get('memories', id);
  if (!current) return;
  await d.put('memories', { ...current, text: text.trim() });
}

export async function deleteMemory(id: string): Promise<void> {
  await (await db()).delete('memories', id);
}

export async function clearMemories(): Promise<void> {
  await (await db()).clear('memories');
}

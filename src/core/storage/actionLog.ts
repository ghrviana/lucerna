import type { ActionDecision } from '../tools/types';
import { db } from './db';

/** Uma ação (ou plano) do modo agente, como fica no registro local consultável pelo usuário. */
export interface ActionLogEntry {
  id: string;
  ts: number;
  conversationId: string;
  tabId?: number;
  url?: string;
  domain?: string;
  tool: string;
  /** Argumentos (JSON) com textos longos encurtados. */
  args: string;
  summary: string;
  decision: ActionDecision;
  reasons: string[];
  ok?: boolean;
  /** Resultado resumido. */
  result?: string;
}

/** Entradas mantidas; as mais antigas são apagadas. */
export const MAX_LOG_ENTRIES = 2000;
const MAX_ARG_TEXT = 200;
const MAX_RESULT = 300;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Encurta valores de texto dos argumentos antes de gravar. */
export function sanitizeArgs(raw: string): string {
  try {
    const value = JSON.parse(raw || '{}') as unknown;
    if (typeof value !== 'object' || value === null) return clip(raw, MAX_ARG_TEXT);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value))
      out[k] = typeof v === 'string' ? clip(v, MAX_ARG_TEXT) : v;
    return JSON.stringify(out);
  } catch {
    return clip(raw, MAX_ARG_TEXT);
  }
}

export function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname || undefined;
  } catch {
    return undefined;
  }
}

export type NewLogEntry = Omit<ActionLogEntry, 'id' | 'ts' | 'domain'> & { ts?: number };

export async function addLogEntry(entry: NewLogEntry): Promise<ActionLogEntry> {
  const full: ActionLogEntry = {
    ...entry,
    id: crypto.randomUUID(),
    ts: entry.ts ?? Date.now(),
    domain: domainOf(entry.url),
    args: sanitizeArgs(entry.args),
    result: entry.result === undefined ? undefined : clip(entry.result, MAX_RESULT),
  };
  const d = await db();
  await d.put('actionLog', full);
  const count = await d.count('actionLog');
  if (count > MAX_LOG_ENTRIES) {
    const tx = d.transaction('actionLog', 'readwrite');
    let cursor = await tx.store.index('ts').openCursor();
    for (let extra = count - MAX_LOG_ENTRIES; cursor && extra > 0; extra--) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
  return full;
}

/** Mais recentes primeiro. */
export async function listLog(): Promise<ActionLogEntry[]> {
  return (await (await db()).getAllFromIndex('actionLog', 'ts')).reverse();
}

export async function clearLog(): Promise<void> {
  await (await db()).clear('actionLog');
}

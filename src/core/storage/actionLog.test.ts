import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { addLogEntry, clearLog, listLog, sanitizeArgs } from './actionLog';
import { createConversation, listConversations } from './conversations';
import { DB_NAME } from './db';

describe('IndexedDB v1 → v2', () => {
  it('a migração cria o registro de ações e preserva as conversas', async () => {
    // Banco como a Fase 4 deixou (versão 1, só conversas).
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore('conversations', { keyPath: 'id' }).createIndex(
          'updatedAt',
          'updatedAt',
        );
      },
    });
    await v1.put('conversations', { ...createConversation(), title: 'Antiga' });
    v1.close();

    expect((await listConversations()).map((c) => c.title)).toEqual(['Antiga']);
    expect(await listLog()).toEqual([]);
  });
});

describe('registro de ações', () => {
  it('grava (domínio, args encurtados), lista do mais recente e limpa', async () => {
    await addLogEntry({
      ts: 1,
      conversationId: 'c',
      url: 'https://loja.test/f',
      tool: 'type',
      args: JSON.stringify({ id: 2, text: 'x'.repeat(500) }),
      summary: 'Digitar',
      decision: 'confirmed',
      reasons: ['Envia um formulário'],
      ok: true,
      result: 'r'.repeat(400),
    });
    await addLogEntry({
      ts: 2,
      conversationId: 'c',
      tool: 'click',
      args: '{}',
      summary: 'Clicar',
      decision: 'denied',
      reasons: [],
    });
    const log = await listLog();
    expect(log.map((e) => e.tool)).toEqual(['click', 'type']);
    expect(log[1]?.domain).toBe('loja.test');
    expect((JSON.parse(log[1]!.args) as { text: string }).text.length).toBe(200);
    expect(log[1]?.result?.length).toBe(300);
    await clearLog();
    expect(await listLog()).toEqual([]);
  });

  it('sanitizeArgs tolera JSON inválido', () => {
    expect(sanitizeArgs('{quebrado')).toBe('{quebrado');
  });
});

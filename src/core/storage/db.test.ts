import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { listLog } from './actionLog';
import { createConversation, listConversations } from './conversations';
import { DB_NAME } from './db';
import { listMemories } from './memories';
import { listWorkflows } from './workflows';

describe('IndexedDB v2 → v3', () => {
  it('a migração cria workflows e memórias, preservando conversas e registro de ações', async () => {
    // Banco como a Fase 5 deixou (versão 2: conversas + registro de ações).
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(d) {
        d.createObjectStore('conversations', { keyPath: 'id' }).createIndex(
          'updatedAt',
          'updatedAt',
        );
        d.createObjectStore('actionLog', { keyPath: 'id' }).createIndex('ts', 'ts');
      },
    });
    await v2.put('conversations', { ...createConversation(), title: 'Antiga' });
    await v2.put('actionLog', {
      id: 'a1',
      ts: 1,
      conversationId: 'c',
      tool: 'click',
      args: '{}',
      summary: 'Clicar',
      decision: 'auto',
      reasons: [],
    });
    v2.close();

    expect((await listConversations()).map((c) => c.title)).toEqual(['Antiga']);
    expect(await listLog()).toHaveLength(1);
    expect(await listWorkflows()).toEqual([]);
    expect(await listMemories()).toEqual([]);
  });
});

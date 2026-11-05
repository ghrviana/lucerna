import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { DB_NAME } from './db';
import { listScheduledTasks } from './scheduledTasks';
import { listTaskRuns } from './taskRuns';
import { createWorkflow, listWorkflows } from './workflows';

// Em arquivo separado de db.test.ts: o singleton de db() já teria aberto o banco na versão atual
// ao rodar a migração v2→v3 naquele arquivo, impedindo reabri-lo numa versão anterior aqui.
describe('IndexedDB v3 → v4', () => {
  it('a migração cria as tarefas agendadas e o histórico delas, preservando workflows', async () => {
    // Banco como a Fase 6 deixou (versão 3: + workflows e memórias).
    const v3 = await openDB(DB_NAME, 3, {
      upgrade(d) {
        d.createObjectStore('conversations', { keyPath: 'id' }).createIndex(
          'updatedAt',
          'updatedAt',
        );
        d.createObjectStore('actionLog', { keyPath: 'id' }).createIndex('ts', 'ts');
        d.createObjectStore('workflows', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
        d.createObjectStore('memories', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      },
    });
    await v3.put('workflows', createWorkflow({ name: 'Resumo', instruction: 'resuma' }));
    v3.close();

    expect((await listWorkflows()).map((w) => w.name)).toEqual(['Resumo']);
    expect(await listScheduledTasks()).toEqual([]);
    expect(await listTaskRuns()).toEqual([]);
  });
});

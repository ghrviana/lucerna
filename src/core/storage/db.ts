import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ActionLogEntry } from './actionLog';
import type { Conversation } from './conversations';
import type { MemoryEntry } from './memories';
import type { ScheduledTask } from './scheduledTasks';
import type { TaskRunEntry } from './taskRuns';
import type { Workflow } from './workflows';

export const DB_NAME = 'pagemate';
export const DB_VERSION = 4;

export interface Schema extends DBSchema {
  conversations: { key: string; value: Conversation; indexes: { updatedAt: number } };
  /** v2 (Fase 5): registro local das ações do modo agente. */
  actionLog: { key: string; value: ActionLogEntry; indexes: { ts: number } };
  /** v3 (Fase 6): workflows salvos e memórias aprovadas pelo usuário. */
  workflows: { key: string; value: Workflow; indexes: { updatedAt: number } };
  memories: { key: string; value: MemoryEntry; indexes: { createdAt: number } };
  /** v4 (Fase 7): tarefas agendadas e o histórico de execuções delas. */
  scheduledTasks: { key: string; value: ScheduledTask; indexes: { updatedAt: number } };
  taskRuns: { key: string; value: TaskRunEntry; indexes: { ts: number } };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | undefined;

/** Abre (e migra) o banco. Cada versão só cria o que falta, preservando os dados anteriores. */
export function db(): Promise<IDBPDatabase<Schema>> {
  dbPromise ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('conversations', { keyPath: 'id' }).createIndex(
          'updatedAt',
          'updatedAt',
        );
      }
      if (oldVersion < 2) {
        d.createObjectStore('actionLog', { keyPath: 'id' }).createIndex('ts', 'ts');
      }
      if (oldVersion < 3) {
        d.createObjectStore('workflows', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
        d.createObjectStore('memories', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      }
      if (oldVersion < 4) {
        d.createObjectStore('scheduledTasks', { keyPath: 'id' }).createIndex(
          'updatedAt',
          'updatedAt',
        );
        d.createObjectStore('taskRuns', { keyPath: 'id' }).createIndex('ts', 'ts');
      }
    },
  });
  return dbPromise;
}

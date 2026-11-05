import { db } from './db';

/** Uma execução de uma tarefa agendada (Fase 7), para o histórico consultável pelo usuário. */
export interface TaskRunEntry {
  id: string;
  taskId: string;
  ts: number;
  ok: boolean;
  /** Resumo da resposta do modelo, ou da falha. */
  summary: string;
}

/** Entradas mantidas; as mais antigas são apagadas. */
export const MAX_TASK_RUN_ENTRIES = 500;
const MAX_SUMMARY_CHARS = 1000;

const clip = (s: string) =>
  s.length > MAX_SUMMARY_CHARS ? `${s.slice(0, MAX_SUMMARY_CHARS)}…` : s;

export async function addTaskRun(entry: Omit<TaskRunEntry, 'id' | 'ts'>): Promise<TaskRunEntry> {
  const full: TaskRunEntry = {
    ...entry,
    id: crypto.randomUUID(),
    ts: Date.now(),
    summary: clip(entry.summary),
  };
  const d = await db();
  await d.put('taskRuns', full);
  const count = await d.count('taskRuns');
  if (count > MAX_TASK_RUN_ENTRIES) {
    const tx = d.transaction('taskRuns', 'readwrite');
    let cursor = await tx.store.index('ts').openCursor();
    for (let extra = count - MAX_TASK_RUN_ENTRIES; cursor && extra > 0; extra--) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
  return full;
}

/** Mais recentes primeiro; sem `taskId`, devolve o histórico de todas as tarefas. */
export async function listTaskRuns(taskId?: string): Promise<TaskRunEntry[]> {
  const all = (await (await db()).getAllFromIndex('taskRuns', 'ts')).reverse();
  return taskId ? all.filter((r) => r.taskId === taskId) : all;
}

export async function deleteTaskRuns(taskId: string): Promise<void> {
  const d = await db();
  const tx = d.transaction('taskRuns', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.taskId === taskId) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

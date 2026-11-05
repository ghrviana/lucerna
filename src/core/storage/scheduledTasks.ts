import { db } from './db';

/**
 * Tarefa agendada (Fase 7): verifica uma página de tempos em tempos e notifica o resultado.
 * Roda em `src/core/tasks/runner.ts`, disparada por um chrome.alarms a partir do background.
 */
export interface ScheduledTask {
  id: string;
  name: string;
  url: string;
  /** Pedido ao modelo em cada execução; vazio = "resuma a página e diga o que mudou". */
  instruction: string;
  /** De quanto em quanto tempo verificar, em horas (1 a 168 = 7 dias). */
  intervalHours: number;
  /** Deixa o modelo usar ferramentas de escrita (clicar, digitar...) nesta tarefa; ações sensíveis
   * ou fora do site permitido continuam sendo recusadas, pois não há usuário para confirmar. */
  allowActions: boolean;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  /** Só para mostrar na interface; o agendamento real é o chrome.alarms periódico. */
  nextRunAt?: number;
  lastOk?: boolean;
  /** Resposta do modelo na última execução (resumida), usada como referência na próxima. */
  lastSummary?: string;
}

/** Entradas mantidas; as mais antigas são apagadas. */
export const MIN_INTERVAL_HOURS = 1;
export const MAX_INTERVAL_HOURS = 168;
const MAX_LAST_SUMMARY_CHARS = 2000;

export function clipSummary(text: string): string {
  return text.length > MAX_LAST_SUMMARY_CHARS ? `${text.slice(0, MAX_LAST_SUMMARY_CHARS)}…` : text;
}

function clampInterval(v: number): number {
  const n = Math.round(v);
  return Number.isFinite(n) ? Math.min(MAX_INTERVAL_HOURS, Math.max(MIN_INTERVAL_HOURS, n)) : 24;
}

export function createScheduledTask(data: {
  name: string;
  url: string;
  instruction?: string;
  intervalHours: number;
  allowActions?: boolean;
}): ScheduledTask {
  const now = Date.now();
  const intervalHours = clampInterval(data.intervalHours);
  return {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    url: data.url.trim(),
    instruction: data.instruction?.trim() ?? '',
    intervalHours,
    allowActions: data.allowActions ?? false,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    nextRunAt: now + intervalHours * 3_600_000,
  };
}

/** Mais recentes primeiro (por atualização). */
export async function listScheduledTasks(): Promise<ScheduledTask[]> {
  return (await (await db()).getAllFromIndex('scheduledTasks', 'updatedAt')).reverse();
}

export async function getScheduledTask(id: string): Promise<ScheduledTask | undefined> {
  return (await db()).get('scheduledTasks', id);
}

export async function saveScheduledTask(task: ScheduledTask): Promise<ScheduledTask> {
  const clean: ScheduledTask = { ...task, intervalHours: clampInterval(task.intervalHours) };
  await (await db()).put('scheduledTasks', clean);
  return clean;
}

export async function deleteScheduledTask(id: string): Promise<void> {
  await (await db()).delete('scheduledTasks', id);
}

export async function setScheduledTaskEnabled(
  task: ScheduledTask,
  enabled: boolean,
): Promise<ScheduledTask> {
  return saveScheduledTask({ ...task, enabled, updatedAt: Date.now() });
}

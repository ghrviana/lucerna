import type { ScheduledTask } from '../storage/scheduledTasks';

/** Prefixo dos nomes de alarme (chrome.alarms), para distinguir de outros alarmes futuros. */
const PREFIX = 'lucerna-task-';

/** Prefixo antigo (rename PageMate -> Lucerna, ver docs/decisions.md): sem migração automática de
 * dados, um alarme criado com esse prefixo nunca mais é reconhecido por `taskIdFromAlarm`. */
const LEGACY_PREFIX = 'pagemate-task-';

export const alarmName = (taskId: string): string => `${PREFIX}${taskId}`;

export const taskIdFromAlarm = (alarmNameValue: string): string | undefined =>
  alarmNameValue.startsWith(PREFIX) ? alarmNameValue.slice(PREFIX.length) : undefined;

/** (Re)agenda o alarme periódico de uma tarefa; chamar sempre que ela for salva. */
export async function scheduleTaskAlarm(task: ScheduledTask): Promise<void> {
  await chrome.alarms.clear(alarmName(task.id));
  if (!task.enabled) return;
  await chrome.alarms.create(alarmName(task.id), {
    delayInMinutes: task.intervalHours * 60,
    periodInMinutes: task.intervalHours * 60,
  });
}

export async function clearTaskAlarm(taskId: string): Promise<void> {
  await chrome.alarms.clear(alarmName(taskId));
}

/** Garante que toda tarefa ligada tenha um alarme (ex.: reinício do navegador). */
export async function syncAllTaskAlarms(tasks: ScheduledTask[]): Promise<void> {
  const alarms = await chrome.alarms.getAll();
  const known = new Set(alarms.map((a) => a.name));
  for (const task of tasks) {
    if (task.enabled && !known.has(alarmName(task.id))) await scheduleTaskAlarm(task);
    if (!task.enabled && known.has(alarmName(task.id))) await clearTaskAlarm(task.id);
  }
  // Limpeza única do rename: alarmes antigos nunca mais batem com `taskIdFromAlarm` e ficariam
  // disparando à toa para sempre; o alarme correto já foi recriado acima para toda tarefa ligada.
  for (const a of alarms) {
    if (a.name.startsWith(LEGACY_PREFIX)) await chrome.alarms.clear(a.name);
  }
}

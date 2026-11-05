import { runScheduledTask, type TaskRunOutcome } from './runner';
import { getSettings } from '../storage/settings';
import { getScheduledTask, saveScheduledTask, type ScheduledTask } from '../storage/scheduledTasks';
import { addTaskRun } from '../storage/taskRuns';

function notify(task: ScheduledTask, outcome: TaskRunOutcome): void {
  chrome.notifications.create(`lucerna-task-${task.id}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icon/128.png'),
    title: outcome.ok ? `Lucerna: ${task.name}` : `Lucerna: ${task.name} (falhou)`,
    message: outcome.summary.slice(0, 200) || '(sem resposta)',
  });
}

/**
 * Roda uma tarefa agendada pelo id, grava o histórico e notifica o resultado. Chamada pelo
 * background quando o alarme dispara; não lança (falhas já viram execuções com ok=false).
 */
export async function executeScheduledTask(
  taskId: string,
  deps: { notify?: typeof notify; run?: typeof runScheduledTask } = {},
): Promise<void> {
  const task = await getScheduledTask(taskId);
  if (!task || !task.enabled) return;

  const settings = await getSettings();
  const outcome = await (deps.run ?? runScheduledTask)(task, settings);
  await addTaskRun({ taskId: task.id, ok: outcome.ok, summary: outcome.summary });

  const now = Date.now();
  await saveScheduledTask({
    ...task,
    lastRunAt: now,
    nextRunAt: now + task.intervalHours * 3_600_000,
    lastOk: outcome.ok,
    lastSummary: outcome.ok ? outcome.summary : task.lastSummary,
  });
  (deps.notify ?? notify)(task, outcome);
}

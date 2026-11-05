import { useEffect, useState } from 'react';
import { useT } from '@/core/i18n/store';
import {
  createScheduledTask,
  deleteScheduledTask,
  listScheduledTasks,
  MAX_INTERVAL_HOURS,
  MIN_INTERVAL_HOURS,
  saveScheduledTask,
  setScheduledTaskEnabled,
  type ScheduledTask,
} from '@/core/storage/scheduledTasks';
import { clearTaskAlarm, scheduleTaskAlarm } from '@/core/tasks/alarms';
import { deleteTaskRuns, listTaskRuns, type TaskRunEntry } from '@/core/storage/taskRuns';

const input = 'w-full rounded border border-neutral-300 px-2 py-1 text-sm';

/** Pede acesso a todos os sites (precisa de um gesto do usuário: este clique em Criar/Salvar). */
async function requestTabAccess(): Promise<boolean> {
  const origins = ['<all_urls>'];
  if (await chrome.permissions.contains({ origins }).catch(() => false)) return true;
  return chrome.permissions.request({ origins }).catch(() => false);
}

function fmtDate(ts: number | undefined): string {
  return ts ? new Date(ts).toLocaleString() : '—';
}

/** Histórico de execuções de uma tarefa (10 mais recentes). */
function TaskHistory({ taskId }: { taskId: string }) {
  const t = useT();
  const [runs, setRuns] = useState<TaskRunEntry[] | null>(null);
  useEffect(() => {
    void listTaskRuns(taskId).then((r) => setRuns(r.slice(0, 10)));
  }, [taskId]);
  if (!runs) return null;
  if (runs.length === 0) return <p className="text-xs text-neutral-500">{t('tasks.noRuns')}</p>;
  return (
    <ul className="space-y-1 text-xs">
      {runs.map((r) => (
        <li key={r.id} className={r.ok ? 'text-neutral-600' : 'text-red-700'}>
          {fmtDate(r.ts)} — {r.summary || t('tasks.noResponse')}
        </li>
      ))}
    </ul>
  );
}

/** Lista/cria tarefas agendadas: verificar uma página de tempos em tempos e notificar o resultado. */
export function ScheduledTasks() {
  const t = useT();
  const [items, setItems] = useState<ScheduledTask[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [instruction, setInstruction] = useState('');
  const [intervalHours, setIntervalHours] = useState(24);
  const [allowActions, setAllowActions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => void listScheduledTasks().then(setItems);
  useEffect(load, []);

  const create = async () => {
    setError(null);
    if (!name.trim() || !url.trim()) return;
    if (!/^https?:\/\//i.test(url.trim())) {
      setError(t('tasks.urlError'));
      return;
    }
    if (!(await requestTabAccess())) {
      setError(t('tasks.permissionError'));
      return;
    }
    const task = createScheduledTask({ name, url, instruction, intervalHours, allowActions });
    await saveScheduledTask(task);
    await scheduleTaskAlarm(task);
    setName('');
    setUrl('');
    setInstruction('');
    setIntervalHours(24);
    setAllowActions(false);
    load();
  };

  const toggleEnabled = async (task: ScheduledTask) => {
    const updated = await setScheduledTaskEnabled(task, !task.enabled);
    await scheduleTaskAlarm(updated);
    load();
  };

  const remove = async (task: ScheduledTask) => {
    if (!confirm(t('tasks.confirmDelete', { name: task.name }))) return;
    await clearTaskAlarm(task.id);
    await deleteScheduledTask(task.id);
    await deleteTaskRuns(task.id);
    load();
  };

  return (
    <section id="tarefas" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('tasks.title')}</h2>
        <button className="btn border border-neutral-300 text-xs" onClick={load}>
          {t('common.update')}
        </button>
      </div>
      <p className="text-xs text-neutral-500">{t('tasks.hint')}</p>

      <div className="space-y-2 rounded-lg border border-neutral-200 p-3">
        <input
          className={input}
          placeholder={t('tasks.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={input}
          placeholder="https://exemplo.com/produto"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <textarea
          className={input}
          rows={2}
          placeholder={t('tasks.instructionPlaceholder')}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs">
            {t('tasks.every')}
            <input
              className="w-16 rounded border border-neutral-300 px-1 py-0.5"
              type="number"
              min={MIN_INTERVAL_HOURS}
              max={MAX_INTERVAL_HOURS}
              value={intervalHours}
              onChange={(e) => setIntervalHours(Number(e.target.value))}
            />
            {t('tasks.hours')}
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={allowActions}
              onChange={(e) => setAllowActions(e.target.checked)}
            />
            {t('tasks.allowActions')}
          </label>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <button className="btn-primary text-xs" onClick={() => void create()}>
          {t('tasks.create')}
        </button>
      </div>

      {items === null ? null : items.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('tasks.none')}</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm">
          {items.map((task) => (
            <li key={task.id} className="space-y-1 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {task.name}{' '}
                    {task.allowActions && (
                      <span
                        role="img"
                        aria-label={t('tasks.allowActions')}
                        title={t('tasks.allowActions')}
                        className="text-violet-700"
                      >
                        🤖
                      </span>
                    )}
                    {!task.enabled && (
                      <span className="ml-1 text-neutral-400">{t('tasks.disabled')}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-neutral-500">{task.url}</p>
                  <p className="text-xs text-neutral-500">
                    {t('tasks.lastRun', {
                      hours: task.intervalHours,
                      date: fmtDate(task.lastRunAt),
                    })}
                    {task.lastRunAt && !task.lastOk && (
                      <span className="text-red-700">{t('tasks.failed')}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    className="btn border border-neutral-300"
                    onClick={() => setExpanded((id) => (id === task.id ? null : task.id))}
                  >
                    {t('tasks.history')}
                  </button>
                  <button
                    className="btn border border-neutral-300"
                    onClick={() => void toggleEnabled(task)}
                  >
                    {task.enabled ? t('tasks.disable') : t('tasks.enable')}
                  </button>
                  <button
                    className="btn border border-red-300 text-red-700"
                    onClick={() => void remove(task)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
              {expanded === task.id && <TaskHistory taskId={task.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

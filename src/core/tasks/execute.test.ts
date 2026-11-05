import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, saveSettings } from '../storage/settings';
import {
  createScheduledTask,
  getScheduledTask,
  saveScheduledTask,
} from '../storage/scheduledTasks';
import { listTaskRuns } from '../storage/taskRuns';
import { executeScheduledTask } from './execute';

/** chrome.storage.local falso, só o suficiente para getSettings/saveSettings. */
function stubStorageLocal(): void {
  const store = new Map<string, unknown>();
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store.get(key) }),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        },
      },
    },
  });
}

describe('executeScheduledTask', () => {
  beforeEach(stubStorageLocal);

  it('não faz nada se a tarefa não existe ou está desligada', async () => {
    let notified = 0;
    await executeScheduledTask('nada', { notify: () => notified++ });
    expect(notified).toBe(0);

    const off = createScheduledTask({ name: 'x', url: 'https://x.test', intervalHours: 24 });
    await saveScheduledTask({ ...off, enabled: false });
    await executeScheduledTask(off.id, { notify: () => notified++ });
    expect(notified).toBe(0);
    expect(await listTaskRuns(off.id)).toEqual([]);
  });

  it('roda, grava o histórico, atualiza a tarefa e notifica (sucesso)', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, apiKey: 'k' });
    const task = createScheduledTask({ name: 'Preço', url: 'https://x.test', intervalHours: 6 });
    await saveScheduledTask(task);

    const notifications: { ok: boolean }[] = [];
    await executeScheduledTask(task.id, {
      run: async () => ({ ok: true, summary: 'Sem mudanças relevantes.' }),
      notify: (_t, outcome) => notifications.push(outcome),
    });

    expect(notifications).toEqual([{ ok: true, summary: 'Sem mudanças relevantes.' }]);
    const runs = await listTaskRuns(task.id);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ ok: true, summary: 'Sem mudanças relevantes.' });

    const updated = await getScheduledTask(task.id);
    expect(updated?.lastOk).toBe(true);
    expect(updated?.lastSummary).toBe('Sem mudanças relevantes.');
    expect(updated?.lastRunAt).toBeTypeOf('number');
    expect(updated?.nextRunAt).toBeGreaterThan(updated!.lastRunAt!);
  });

  it('numa falha, preserva o último resumo bom (para comparar na próxima tentativa)', async () => {
    const task = {
      ...createScheduledTask({ name: 'Preço', url: 'https://x.test', intervalHours: 6 }),
      lastSummary: 'Preço anterior: R$ 700.',
    };
    await saveScheduledTask(task);

    await executeScheduledTask(task.id, {
      run: async () => ({ ok: false, summary: 'Erro: tempo esgotado.' }),
      notify: () => {},
    });

    const updated = await getScheduledTask(task.id);
    expect(updated?.lastOk).toBe(false);
    expect(updated?.lastSummary).toBe('Preço anterior: R$ 700.');
    expect((await listTaskRuns(task.id))[0]).toMatchObject({
      ok: false,
      summary: 'Erro: tempo esgotado.',
    });
  });
});

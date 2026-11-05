import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  createScheduledTask,
  deleteScheduledTask,
  getScheduledTask,
  listScheduledTasks,
  MAX_INTERVAL_HOURS,
  MIN_INTERVAL_HOURS,
  saveScheduledTask,
  setScheduledTaskEnabled,
} from './scheduledTasks';

describe('tarefas agendadas', () => {
  it('cria com padrões (ligada, intervalo dentro dos limites) e lista do mais recente', async () => {
    const a = createScheduledTask({ name: 'Preço', url: 'https://x.test', intervalHours: 24 });
    expect(a.enabled).toBe(true);
    expect(a.allowActions).toBe(false);
    await saveScheduledTask(a);
    await new Promise((r) => setTimeout(r, 2));
    const b = createScheduledTask({ name: 'Edital', url: 'https://y.test', intervalHours: 6 });
    await saveScheduledTask(b);

    expect((await listScheduledTasks()).map((t) => t.id)).toEqual([b.id, a.id]);
  });

  it('o intervalo fica entre 1 e 168 horas', () => {
    expect(
      createScheduledTask({ name: 'a', url: 'https://x.test', intervalHours: 0 }).intervalHours,
    ).toBe(MIN_INTERVAL_HOURS);
    expect(
      createScheduledTask({ name: 'a', url: 'https://x.test', intervalHours: 9000 }).intervalHours,
    ).toBe(MAX_INTERVAL_HOURS);
  });

  it('lê, atualiza e apaga pelo id', async () => {
    const t = createScheduledTask({ name: 'Preço', url: 'https://x.test', intervalHours: 24 });
    await saveScheduledTask(t);
    expect((await getScheduledTask(t.id))?.name).toBe('Preço');

    const updated = await setScheduledTaskEnabled(t, false);
    expect(updated.enabled).toBe(false);
    expect((await getScheduledTask(t.id))?.enabled).toBe(false);

    await deleteScheduledTask(t.id);
    expect(await getScheduledTask(t.id)).toBeUndefined();
  });
});

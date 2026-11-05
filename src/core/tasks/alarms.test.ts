import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createScheduledTask } from '../storage/scheduledTasks';
import {
  alarmName,
  clearTaskAlarm,
  scheduleTaskAlarm,
  syncAllTaskAlarms,
  taskIdFromAlarm,
} from './alarms';

describe('alarmName / taskIdFromAlarm', () => {
  it('é reversível', () => {
    expect(taskIdFromAlarm(alarmName('abc-123'))).toBe('abc-123');
  });

  it('ignora alarmes de outro prefixo', () => {
    expect(taskIdFromAlarm('outro-alarme')).toBeUndefined();
  });
});

describe('scheduleTaskAlarm / clearTaskAlarm / syncAllTaskAlarms', () => {
  const create = vi.fn();
  const clear = vi.fn();
  const getAll = vi.fn();

  beforeEach(() => {
    create.mockReset();
    clear.mockReset().mockResolvedValue(true);
    getAll.mockReset().mockResolvedValue([]);
    vi.stubGlobal('chrome', { alarms: { create, clear, getAll } });
  });

  it('cria um alarme periódico com o intervalo da tarefa, em minutos', async () => {
    const task = createScheduledTask({ name: 'x', url: 'https://x.test', intervalHours: 2 });
    await scheduleTaskAlarm(task);
    expect(clear).toHaveBeenCalledWith(alarmName(task.id));
    expect(create).toHaveBeenCalledWith(alarmName(task.id), {
      delayInMinutes: 120,
      periodInMinutes: 120,
    });
  });

  it('tarefa desligada: só limpa o alarme, não cria', async () => {
    const task = {
      ...createScheduledTask({ name: 'x', url: 'https://x.test', intervalHours: 2 }),
      enabled: false,
    };
    await scheduleTaskAlarm(task);
    expect(clear).toHaveBeenCalledWith(alarmName(task.id));
    expect(create).not.toHaveBeenCalled();
  });

  it('clearTaskAlarm limpa pelo id', async () => {
    await clearTaskAlarm('abc');
    expect(clear).toHaveBeenCalledWith(alarmName('abc'));
  });

  it('syncAllTaskAlarms cria o que falta e limpa o que não devia existir', async () => {
    const on = createScheduledTask({ name: 'on', url: 'https://x.test', intervalHours: 1 });
    const off = {
      ...createScheduledTask({ name: 'off', url: 'https://y.test', intervalHours: 1 }),
      enabled: false,
    };
    getAll.mockResolvedValue([{ name: alarmName(off.id) }]);

    await syncAllTaskAlarms([on, off]);

    expect(create).toHaveBeenCalledWith(alarmName(on.id), expect.anything());
    expect(clear).toHaveBeenCalledWith(alarmName(off.id));
  });
});

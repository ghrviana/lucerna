import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addTaskRun, deleteTaskRuns, listTaskRuns } from './taskRuns';

describe('histórico de execuções de tarefas agendadas', () => {
  it('grava e lista do mais recente, por tarefa ou de todas', async () => {
    await addTaskRun({ taskId: 'a', ok: true, summary: 'sem mudanças' });
    await new Promise((r) => setTimeout(r, 2));
    await addTaskRun({ taskId: 'b', ok: false, summary: 'falhou' });

    expect(await listTaskRuns('a')).toHaveLength(1);
    expect(await listTaskRuns('b')).toHaveLength(1);
    expect(await listTaskRuns()).toHaveLength(2);
    expect((await listTaskRuns()).at(0)?.taskId).toBe('b');
  });

  it('encurta resumos longos', async () => {
    const run = await addTaskRun({ taskId: 'a', ok: true, summary: 'x'.repeat(2000) });
    expect(run.summary.length).toBeLessThan(2000);
    expect(run.summary.endsWith('…')).toBe(true);
  });

  it('deleteTaskRuns apaga só o histórico da tarefa indicada', async () => {
    await addTaskRun({ taskId: 'x', ok: true, summary: '1' });
    await addTaskRun({ taskId: 'y', ok: true, summary: '2' });
    await deleteTaskRuns('x');
    expect(await listTaskRuns('x')).toEqual([]);
    expect(await listTaskRuns('y')).toHaveLength(1);
  });
});

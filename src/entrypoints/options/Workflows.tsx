import { useEffect, useState } from 'react';
import { useT } from '@/core/i18n/store';
import {
  deleteWorkflow,
  filterWorkflows,
  isSlugTaken,
  listWorkflows,
  saveWorkflow,
  slugify,
  type Workflow,
} from '@/core/storage/workflows';

/** Lista os workflows salvos (editar nome/instrução/modo agente, apagar). */
export function Workflows() {
  const t = useT();
  const [items, setItems] = useState<Workflow[] | null>(null);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftInstruction, setDraftInstruction] = useState('');
  const [draftAgentMode, setDraftAgentMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => void listWorkflows().then(setItems);
  useEffect(load, []);

  const startEdit = (w: Workflow) => {
    setEditingId(w.id);
    setDraftName(w.name);
    setDraftInstruction(w.instruction);
    setDraftAgentMode(w.agentMode);
    setError(null);
  };

  const commit = async () => {
    const current = (items ?? []).find((w) => w.id === editingId);
    if (!current || !draftName.trim() || !draftInstruction.trim()) return;
    if (isSlugTaken(items ?? [], slugify(draftName), current.id)) {
      setError(t('workflows.duplicate'));
      return;
    }
    await saveWorkflow({
      ...current,
      name: draftName.trim(),
      instruction: draftInstruction,
      agentMode: draftAgentMode,
      updatedAt: Date.now(),
    });
    setEditingId(null);
    load();
  };

  const remove = async (w: Workflow) => {
    if (!confirm(t('workflowList.confirmDelete', { name: w.name }))) return;
    await deleteWorkflow(w.id);
    load();
  };

  const shown = filterWorkflows(items ?? [], filter);

  return (
    <section id="workflows" className="space-y-2">
      <h2 className="text-lg font-semibold">{t('workflows.title')}</h2>
      <p className="text-xs text-neutral-500">{t('workflows.hint')}</p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          placeholder={t('workflows.filter')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="btn border border-neutral-300" onClick={load}>
          {t('common.update')}
        </button>
      </div>
      {items === null ? null : shown.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('workflows.none')}</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm">
          {shown.map((w) =>
            editingId === w.id ? (
              <li key={w.id} className="space-y-2 px-3 py-2">
                <input
                  className="w-full rounded border border-neutral-300 px-2 py-1"
                  aria-label={t('workflows.nameLabel')}
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                />
                <textarea
                  className="w-full rounded border border-neutral-300 px-2 py-1"
                  aria-label={t('workflows.instructionLabel')}
                  rows={3}
                  value={draftInstruction}
                  onChange={(e) => setDraftInstruction(e.target.value)}
                />
                <label className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={draftAgentMode}
                    onChange={(e) => setDraftAgentMode(e.target.checked)}
                  />
                  {t('workflows.agentMode')}
                </label>
                {error && <p className="text-xs text-red-700">{error}</p>}
                <div className="flex gap-2">
                  <button className="btn-primary text-xs" onClick={() => void commit()}>
                    {t('common.save')}
                  </button>
                  <button
                    className="btn border border-neutral-300 text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </li>
            ) : (
              <li key={w.id} className="flex items-start justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    /{slugify(w.name)}
                    {w.agentMode && (
                      <span
                        role="img"
                        aria-label={t('workflows.agentMode')}
                        title={t('workflows.agentMode')}
                        className="ml-1 text-violet-700"
                      >
                        🤖
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-neutral-600">{w.instruction}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="btn border border-neutral-300" onClick={() => startEdit(w)}>
                    {t('common.edit')}
                  </button>
                  <button
                    className="btn border border-red-300 text-red-700"
                    onClick={() => void remove(w)}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useT } from '@/core/i18n/store';
import {
  clearMemories,
  deleteMemory,
  listMemories,
  updateMemory,
  type MemoryEntry,
} from '@/core/storage/memories';

/** Lista as memórias aprovadas (editar texto, apagar, limpar tudo). */
export function Memories() {
  const t = useT();
  const [items, setItems] = useState<MemoryEntry[] | null>(null);
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const load = () => void listMemories().then(setItems);
  useEffect(load, []);

  const commit = async () => {
    if (!editingId || !draft.trim()) return;
    await updateMemory(editingId, draft);
    setEditingId(null);
    load();
  };

  const remove = async (m: MemoryEntry) => {
    if (!confirm(t('memories.confirmDelete'))) return;
    await deleteMemory(m.id);
    load();
  };

  const clear = async () => {
    if (!confirm(t('memories.confirmClear'))) return;
    await clearMemories();
    load();
  };

  const q = filter.trim().toLowerCase();
  const shown = (items ?? []).filter((m) => !q || m.text.toLowerCase().includes(q));

  return (
    <section id="memorias" className="space-y-2">
      <h2 className="text-lg font-semibold">{t('memories.title')}</h2>
      <p className="text-xs text-neutral-500">{t('memories.hint')}</p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          placeholder={t('memories.filter')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="btn border border-neutral-300" onClick={load}>
          {t('common.update')}
        </button>
        <button className="btn border border-red-300 text-red-700" onClick={() => void clear()}>
          {t('memories.clearAll')}
        </button>
      </div>
      {items === null ? null : shown.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('memories.none')}</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm">
          {shown.map((m) =>
            editingId === m.id ? (
              <li key={m.id} className="space-y-2 px-3 py-2">
                <textarea
                  className="w-full rounded border border-neutral-300 px-2 py-1"
                  aria-label={t('memories.textLabel')}
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
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
              <li key={m.id} className="flex items-start justify-between gap-2 px-3 py-2">
                <p className="min-w-0">{m.text}</p>
                <div className="flex shrink-0 gap-2">
                  <button
                    className="btn border border-neutral-300"
                    onClick={() => {
                      setEditingId(m.id);
                      setDraft(m.text);
                    }}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    className="btn border border-red-300 text-red-700"
                    onClick={() => void remove(m)}
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

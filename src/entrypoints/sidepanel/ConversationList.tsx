import { useMemo, useState } from 'react';
import { useT } from '@/core/i18n/store';
import { filterConversations } from '@/core/storage/conversations';
import { useChat } from './chatStore';

export function ConversationList({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { conversations, activeId, select, rename, remove } = useChat();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const shown = useMemo(() => filterConversations(conversations, query), [conversations, query]);

  const commit = async () => {
    if (editing) await rename(editing, draft);
    setEditing(null);
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-neutral-900">
      <div className="flex gap-2 border-b border-neutral-200 p-2 dark:border-neutral-700">
        <input
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 outline-none focus:border-indigo-500"
          type="search"
          placeholder={t('convList.search')}
          aria-label={t('convList.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 && (
          <li className="p-4 text-center text-sm text-neutral-500">
            {query ? t('convList.noneFound') : t('convList.noneYet')}
          </li>
        )}
        {shown.map((c) => {
          const renameLabel = t('convList.renameLabel', { title: c.title });
          const deleteLabel = t('convList.deleteLabel', { title: c.title });
          return (
            <li
              key={c.id}
              className={`flex items-center gap-1 border-b border-neutral-100 px-2 py-1.5 dark:border-neutral-800 ${c.id === activeId ? 'bg-indigo-50' : ''}`}
            >
              {editing === c.id ? (
                <input
                  className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1"
                  value={draft}
                  autoFocus
                  aria-label={t('convList.newTitleLabel')}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => void commit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commit();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <button
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => {
                    select(c.id);
                    onClose();
                  }}
                >
                  {c.title}
                </button>
              )}
              <button
                className="btn"
                aria-label={renameLabel}
                title={renameLabel}
                onClick={() => {
                  setEditing(c.id);
                  setDraft(c.title);
                }}
              >
                ✎
              </button>
              <button
                className="btn"
                aria-label={deleteLabel}
                title={deleteLabel}
                onClick={() => {
                  if (confirm(t('convList.confirmDelete', { title: c.title }))) void remove(c.id);
                }}
              >
                🗑
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

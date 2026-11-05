import { useMemo, useState } from 'react';
import { useT } from '@/core/i18n/store';
import { extractPlaceholders, filterWorkflows, type Workflow } from '@/core/storage/workflows';
import { useChat } from './chatStore';
import { WorkflowParamsForm } from './WorkflowParamsForm';

export function WorkflowList({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { workflows, deleteWorkflowById, runWorkflow } = useChat();
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState<Workflow | null>(null);
  const shown = useMemo(() => filterWorkflows(workflows, query), [workflows, query]);

  const run = (w: Workflow) => {
    if (extractPlaceholders(w.instruction).length > 0) {
      setRunning(w);
      return;
    }
    void runWorkflow(w, {});
    onClose();
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-neutral-900">
      <div className="flex gap-2 border-b border-neutral-200 p-2 dark:border-neutral-700">
        <input
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 outline-none focus:border-indigo-500"
          type="search"
          placeholder={t('workflowList.search')}
          aria-label={t('workflowList.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
      {running ? (
        <div className="p-2">
          <WorkflowParamsForm
            workflow={running}
            onCancel={() => setRunning(null)}
            onSubmit={(values) => {
              void runWorkflow(running, values);
              setRunning(null);
              onClose();
            }}
          />
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 && (
            <li className="p-4 text-center text-sm text-neutral-500">
              {query ? t('workflowList.noneFound') : t('workflowList.noneYet')}
            </li>
          )}
          {shown.map((w) => {
            const deleteLabel = t('workflowList.deleteLabel', { name: w.name });
            const agentModeLabel = t('workflows.agentMode');
            return (
              <li
                key={w.id}
                className="flex items-center gap-1 border-b border-neutral-100 px-2 py-1.5 dark:border-neutral-800"
              >
                <button className="min-w-0 flex-1 truncate text-left" onClick={() => run(w)}>
                  {w.name}
                  {w.agentMode && (
                    <span
                      role="img"
                      aria-label={agentModeLabel}
                      title={agentModeLabel}
                      className="ml-1 text-xs text-violet-700"
                    >
                      🤖
                    </span>
                  )}
                </button>
                <button
                  className="btn"
                  aria-label={deleteLabel}
                  title={deleteLabel}
                  onClick={() => {
                    if (confirm(t('workflowList.confirmDelete', { name: w.name })))
                      void deleteWorkflowById(w.id);
                  }}
                >
                  🗑
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-neutral-200 p-2 text-center dark:border-neutral-700">
        <button
          className="text-xs text-indigo-700 underline dark:text-indigo-400"
          onClick={() => {
            void chrome.tabs.create({ url: chrome.runtime.getURL('/options.html#workflows') });
          }}
        >
          {t('workflowList.manage')}
        </button>
      </div>
    </div>
  );
}

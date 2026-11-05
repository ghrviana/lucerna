import { useState } from 'react';
import { useT } from '@/core/i18n/store';
import { extractPlaceholders, type Workflow } from '@/core/storage/workflows';

/** Pede o valor de cada {{placeholder}} de um workflow antes de executá-lo. */
export function WorkflowParamsForm({
  workflow,
  onSubmit,
  onCancel,
}: {
  workflow: Workflow;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const placeholders = extractPlaceholders(workflow.instruction);
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-2 rounded-lg border border-neutral-300 bg-neutral-50 p-2 text-sm dark:border-neutral-600"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      <p className="font-medium">{workflow.name}</p>
      {placeholders.map((p) => (
        <label key={p} className="block text-xs">
          {p}
          <input
            className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
            autoFocus={p === placeholders[0]}
            value={values[p] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [p]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-xs">
          {t('workflowParams.run')}
        </button>
        <button type="button" className="btn border border-neutral-300 text-xs" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

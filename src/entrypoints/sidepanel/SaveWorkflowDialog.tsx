import { useState } from 'react';
import { useT } from '@/core/i18n/store';
import { useChat } from './chatStore';

/**
 * Formulário para transformar o texto de uma mensagem num workflow reutilizável. O App monta este
 * componente com `key={draft}`, então ele remonta (com os campos zerados) sempre que um rascunho
 * novo chega — ex.: "Salvar como workflow" em outra mensagem enquanto o formulário já está aberto.
 */
export function SaveWorkflowDialog() {
  const t = useT();
  const draft = useChat((s) => s.saveWorkflowDraft);
  const close = useChat((s) => s.closeSaveWorkflow);
  const create = useChat((s) => s.createWorkflowFrom);
  const [name, setName] = useState('');
  const [instruction, setInstruction] = useState(draft ?? '');
  const [agentMode, setAgentMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (draft === null) return null;

  const submit = async () => {
    if (!name.trim() || !instruction.trim()) return;
    const result = await create(instruction, name, agentMode);
    if (result === 'duplicate') {
      setError(t('workflowDialog.duplicate'));
      return;
    }
    setName('');
    setInstruction('');
    setAgentMode(false);
    setError(null);
    close();
  };

  return (
    <section
      aria-label={t('workflowDialog.title')}
      className="mx-2 mb-2 space-y-2 rounded-lg border border-indigo-300 bg-indigo-50 p-3 text-sm"
    >
      <h2 className="font-semibold">{t('workflowDialog.title')}</h2>
      <label className="block text-xs">
        {t('workflowDialog.name')}
        <input
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </label>
      <label className="block text-xs">
        {t('workflowDialog.instruction')}
        <textarea
          className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
          rows={3}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />
        <span className="mt-0.5 block text-neutral-500">{t('workflowDialog.placeholderHint')}</span>
      </label>
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={agentMode}
          onChange={(e) => setAgentMode(e.target.checked)}
        />
        {t('workflowDialog.agentMode')}
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          className="btn-primary text-xs"
          disabled={!name.trim() || !instruction.trim()}
          onClick={() => void submit()}
        >
          {t('common.save')}
        </button>
        <button className="btn border border-neutral-300 text-xs" onClick={close}>
          {t('common.cancel')}
        </button>
      </div>
    </section>
  );
}

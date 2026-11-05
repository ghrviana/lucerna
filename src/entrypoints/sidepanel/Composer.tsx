import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { useT } from '@/core/i18n/store';
import { QUICK_PROMPTS } from '@/core/page/pending';
import { extractPlaceholders, parseSlashCommand, type Workflow } from '@/core/storage/workflows';
import { ContextCard } from './ContextCard';
import { Thumbnails } from './Thumbnails';
import { WorkflowParamsForm } from './WorkflowParamsForm';
import { MAX_ATTACHMENTS, useChat } from './chatStore';

const QUICK: {
  key: keyof typeof QUICK_PROMPTS;
  labelKey: 'composer.summarize' | 'composer.translate' | 'composer.explain';
}[] = [
  { key: 'summarize', labelKey: 'composer.summarize' },
  { key: 'translate', labelKey: 'composer.translate' },
  { key: 'explain', labelKey: 'composer.explain' },
];

const tool = 'btn border border-neutral-300 text-xs disabled:opacity-50 dark:border-neutral-600';

export function Composer() {
  const t = useT();
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [slashError, setSlashError] = useState<string | null>(null);
  const [paramWorkflow, setParamWorkflow] = useState<Workflow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const chat = useChat();
  const { send, stop, streaming, context, attachments, capturing, contextLoading, workflows } =
    chat;
  const auto = useChat((s) => s.conversations.find((c) => c.id === s.activeId)?.autoScreenshot);
  const toolsOn = useChat(
    (s) => s.conversations.find((c) => c.id === s.activeId)?.toolsEnabled !== false,
  );
  const agentOn = useChat((s) => !!s.conversations.find((c) => c.id === s.activeId)?.agentMode);
  const busy = capturing || contextLoading || streaming;
  const full = attachments.length >= MAX_ATTACHMENTS;

  const submit = () => {
    if (!text.trim() || streaming || capturing) return;
    const parsed = parseSlashCommand(text, workflows);
    if (parsed?.kind === 'error') {
      setSlashError(parsed.message);
      return;
    }
    setSlashError(null);
    if (parsed?.kind === 'ok') {
      const placeholders = extractPlaceholders(parsed.workflow.instruction);
      if (placeholders.length > 1) {
        setParamWorkflow(parsed.workflow);
        setText('');
        return;
      }
      const [only] = placeholders;
      const values = only ? { [only]: parsed.rest } : {};
      void chat.runWorkflow(parsed.workflow, values, { newConversation: false });
      setText('');
      return;
    }
    void send(text);
    setText('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  const quick = (key: keyof typeof QUICK_PROMPTS, label: string) =>
    void send(
      QUICK_PROMPTS[key],
      t('composer.forLabel', {
        label,
        subject: context?.title || context?.selection || t('common.page'),
      }),
    );

  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return; // texto normal: comportamento padrão
    e.preventDefault();
    void chat.addImages(files);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void chat.addImages(Array.from(e.dataTransfer.files));
  };

  return (
    <div
      className={`border-t p-2 ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 dark:border-neutral-700'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {/* Parte de cima rola sozinha: o chat sempre mantém espaço e a caixa de texto fica visível. */}
      <div className="max-h-[34vh] overflow-y-auto">
        {context && (
          <>
            <ContextCard context={context} />
            {!streaming && (
              <div className="mb-2 flex gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q.key}
                    className="rounded-full border border-indigo-300 px-3 py-0.5 text-xs text-indigo-700 hover:bg-indigo-50"
                    onClick={() => quick(q.key, t(q.labelKey))}
                  >
                    {t(q.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {attachments.length > 0 && (
          <div className="mb-2">
            <Thumbnails images={attachments} onRemove={chat.removeAttachment} />
          </div>
        )}

        <div className="mb-2 space-y-2">
          <div className="flex flex-nowrap items-center gap-1 overflow-x-auto">
            {!context && (
              <button
                className={tool}
                disabled={busy}
                title={t('composer.pageTitle')}
                onClick={() => void chat.attachPage()}
              >
                {contextLoading ? t('composer.reading') : t('composer.page')}
              </button>
            )}
            <button
              className={tool}
              disabled={busy || full}
              title={t('composer.screenshotTitle')}
              onClick={() => void chat.captureScreenshot()}
            >
              {capturing ? t('composer.capturing') : t('composer.screenshot')}
            </button>
            <button
              className={tool}
              disabled={busy || full}
              title={t('composer.annotatedTitle')}
              onClick={() => void chat.captureAnnotated()}
            >
              {t('composer.annotated')}
            </button>
            <button
              className={tool}
              disabled={busy || full}
              title={t('composer.imageTitle')}
              onClick={() => fileInput.current?.click()}
            >
              {t('composer.image')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                void chat.addImages(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-100 pt-2 dark:border-neutral-800">
            <label
              className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400"
              title={t('composer.autoScreenshotTitle')}
            >
              <input
                type="checkbox"
                checked={!!auto}
                onChange={(e) => void chat.setAutoScreenshot(e.target.checked)}
              />
              {t('composer.autoScreenshot')}
            </label>
            <label
              className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400"
              title={t('composer.toolsTitle')}
            >
              <input
                type="checkbox"
                checked={toolsOn || agentOn}
                disabled={agentOn}
                onChange={(e) => void chat.setToolsEnabled(e.target.checked)}
              />
              {t('composer.tools')}
            </label>
            <label
              className="flex items-center gap-1 text-xs font-medium text-violet-800 dark:text-violet-400"
              title={t('composer.agentModeTitle')}
            >
              <input
                type="checkbox"
                checked={agentOn}
                disabled={streaming}
                onChange={(e) => void chat.setAgentMode(e.target.checked)}
              />
              {t('composer.agentMode')}
            </label>
          </div>
        </div>
      </div>

      {slashError && <p className="mb-1 text-xs text-red-700 dark:text-red-400">{slashError}</p>}
      {paramWorkflow ? (
        <WorkflowParamsForm
          workflow={paramWorkflow}
          onCancel={() => setParamWorkflow(null)}
          onSubmit={(values) => {
            void chat.runWorkflow(paramWorkflow, values, { newConversation: false });
            setParamWorkflow(null);
          }}
        />
      ) : (
        <div className="flex items-end gap-2">
          <textarea
            className="max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-indigo-500 dark:border-neutral-600"
            rows={2}
            placeholder={agentOn ? t('composer.placeholderAgent') : t('composer.placeholderChat')}
            aria-label={t('composer.messageLabel')}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSlashError(null);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          {streaming ? (
            <button className="btn-primary bg-red-600" onClick={stop}>
              {t('composer.stop')}
            </button>
          ) : (
            <button className="btn-primary" disabled={!text.trim() || capturing} onClick={submit}>
              {t('composer.send')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

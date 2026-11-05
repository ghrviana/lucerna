import { memo, useRef, useState, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import { useT } from '@/core/i18n/store';
import type { TranslationKey } from '@/core/i18n/translate';
import type { ChatMessage, ToolCallRecord } from '@/core/storage/conversations';
import { PROPOSE_MEMORY_TOOL_NAME } from '@/core/tools/memoryTools';
import type { ActionDecision } from '@/core/tools/types';
import { WRITE_TOOLS } from '@/core/tools/writeTools';
import { Thumbnails } from './Thumbnails';
import { useChat } from './chatStore';

function CopyButton({ getText, label }: { getText: () => string; label?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(getText());
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <button
      className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      onClick={() => void copy()}
    >
      {done ? t('common.copied') : (label ?? t('common.copy'))}
    </button>
  );
}

function CodeBlock(props: ComponentProps<'pre'>) {
  const t = useT();
  const pre = useRef<HTMLPreElement>(null);
  return (
    <div className="group relative">
      <pre ref={pre} {...props} />
      <div className="absolute right-2 top-2 rounded bg-white/80 px-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 dark:bg-neutral-800/80">
        <CopyButton label={t('message.copyCode')} getText={() => pre.current?.textContent ?? ''} />
      </div>
    </div>
  );
}

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: CodeBlock,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

function prettyArgs(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 1).replace(/\n\s*/g, ' ');
  } catch {
    return raw;
  }
}

const ACTION_NAMES = new Set(WRITE_TOOLS.map((t) => t.name));

const DECISION_KEY: Partial<Record<ActionDecision, TranslationKey>> = {
  confirmed: 'message.decisionConfirmed',
  refused: 'message.decisionRefused',
  denied: 'message.decisionDenied',
  cancelled: 'message.decisionCancelled',
  plan_approved: 'message.decisionPlanApproved',
  plan_refused: 'message.decisionPlanRefused',
};

/** Chamada de ferramenta em bloco recolhível: nome, argumentos e resultado resumido. */
function ToolCallBlock({ call }: { call: ToolCallRecord }) {
  const t = useT();
  const { result } = call;
  const decisionKey = result?.decision ? DECISION_KEY[result.decision.kind] : undefined;
  const decision = decisionKey ? t(decisionKey) : '';
  const status = !result
    ? t('message.toolPending')
    : decision || (result.ok ? t('message.toolOk') : t('message.toolError'));
  const isActionTool = ACTION_NAMES.has(call.name);
  const icon = isActionTool ? '🤖' : '🔧';
  const iconLabel = isActionTool ? t('message.toolActionIcon') : t('message.toolReadIcon');
  const args =
    call.arguments.trim() && call.arguments.trim() !== '{}' ? prettyArgs(call.arguments) : '';
  return (
    <details
      className={`my-1 rounded-lg border px-2 py-1 text-xs ${result && !result.ok ? 'border-red-300 bg-red-50' : 'border-neutral-200 bg-neutral-50'}`}
    >
      <summary className="cursor-pointer truncate">
        <span role="img" aria-label={iconLabel} title={iconLabel}>
          {icon}
        </span>{' '}
        <span className="font-mono">{call.name}</span> {args} <span>{status}</span>
      </summary>
      {result && (
        <div className="mt-1 space-y-1">
          {result.images && <Thumbnails images={result.images} />}
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words">
            {result.text.length > 4000
              ? `${result.text.slice(0, 4000)}${t('message.toolResultMore', { n: result.text.length - 4000 })}`
              : result.text}
          </pre>
          {result.observation && (
            <details>
              <summary className="cursor-pointer text-neutral-500">
                {t('message.observation')}
              </summary>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words">
                {result.observation}
              </pre>
            </details>
          )}
        </div>
      )}
    </details>
  );
}

/** Proposta de propose_memory: só é salva em "memories" quando o usuário aprova. */
function MemoryProposalCard({ call }: { call: ToolCallRecord }) {
  const t = useT();
  const decided = useChat((s) => s.decidedMemory[call.id]);
  const approve = useChat((s) => s.approveMemory);
  const dismiss = useChat((s) => s.dismissMemory);
  let text = '';
  try {
    text = (JSON.parse(call.arguments) as { text?: string }).text ?? '';
  } catch {
    // argumentos inválidos: ignora silenciosamente (não há o que propor).
  }
  if (!text) return null;

  if (decided === 'approved') {
    return (
      <p className="my-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
        {t('message.memorySaved', { text })}
      </p>
    );
  }
  if (decided === 'dismissed') {
    return (
      <p className="my-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-500">
        {t('message.memoryDismissed', { text })}
      </p>
    );
  }
  return (
    <div className="my-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs">
      <p>{t('message.memoryAsk', { text })}</p>
      <div className="mt-1 flex gap-3">
        <button
          className="text-emerald-700 hover:underline"
          onClick={() => void approve(call.id, text)}
        >
          {t('message.memorySave')}
        </button>
        <button className="text-neutral-500 hover:underline" onClick={() => dismiss(call.id)}>
          {t('message.memoryIgnore')}
        </button>
      </div>
    </div>
  );
}

export function Message({
  message,
  canRegenerate,
}: {
  message: ChatMessage;
  canRegenerate: boolean;
}) {
  const t = useT();
  const regenerate = useChat((s) => s.regenerate);
  const openSaveWorkflow = useChat((s) => s.openSaveWorkflow);

  if (message.role === 'user') {
    const contextKindLabel = message.context
      ? message.context.text
        ? t('context.pageText')
        : message.context.snapshot
          ? t('context.interactiveElementsField')
          : t('context.selection')
      : '';
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1">
          {message.images && <Thumbnails images={message.images} />}
          <div className="whitespace-pre-wrap break-words rounded-2xl bg-indigo-600 px-3 py-2 text-white">
            {message.content}
          </div>
          {message.content && (
            <button
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              onClick={() => openSaveWorkflow(message.content)}
            >
              {t('message.saveAsWorkflow')}
            </button>
          )}
          {message.context && (
            <details className="w-full rounded-lg bg-indigo-50 px-2 py-1 text-xs text-neutral-700">
              <summary className="cursor-pointer truncate">
                <span role="img" aria-label={contextKindLabel} title={contextKindLabel}>
                  {message.context.text ? '📄' : message.context.snapshot ? '🎯' : '✂️'}
                </span>{' '}
                {t('message.contextSent', {
                  title: message.context.title || message.context.url,
                })}
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">
                {[message.context.text, message.context.selection, message.context.snapshot]
                  .filter(Boolean)
                  .join('\n\n---\n\n')}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
  if (!message.content && !message.toolCalls?.length) return null;
  return (
    <div>
      {message.toolCalls?.map((call) =>
        call.name === PROPOSE_MEMORY_TOOL_NAME ? (
          <MemoryProposalCard key={call.id} call={call} />
        ) : (
          <ToolCallBlock key={call.id} call={call} />
        ),
      )}
      {message.content && <Markdown text={message.content} />}
      {message.content && (
        <div className="mt-1 flex gap-3">
          <CopyButton getText={() => message.content} />
          {canRegenerate && (
            <button
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              onClick={() => void regenerate()}
            >
              {t('message.regenerate')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

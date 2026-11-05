import { useState } from 'react';
import { useT } from '@/core/i18n/store';
import { MAX_CONTEXT_CHARS } from '@/core/page/truncate';
import type { PageContext } from '@/core/page/types';
import { useChat } from './chatStore';

const fmt = (n: number) => n.toLocaleString();

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Mostra exatamente o que será enviado ao modelo e permite editar ou remover. */
export function ContextCard({ context }: { context: PageContext }) {
  const t = useT();
  const setContext = useChat((s) => s.setContext);
  const [editing, setEditing] = useState(false);
  const chars =
    context.text.length + (context.selection?.length ?? 0) + (context.snapshot?.length ?? 0);
  const elements = context.snapshot
    ? context.snapshot.split('\n').filter((l) => l.startsWith('[')).length
    : 0;
  const kindLabel = context.text
    ? t('context.pageText')
    : context.snapshot
      ? t('context.interactiveElementsField')
      : t('context.selection');
  const removeLabel = t('context.removeLabel');

  return (
    <div className="mb-2 rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-xs">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-neutral-900">
            <span role="img" aria-label={kindLabel} title={kindLabel}>
              {context.text ? '📄' : context.snapshot ? '🎯' : '✂️'}
            </span>{' '}
            {context.title || host(context.url)}
          </div>
          <div className="text-neutral-600">
            {host(context.url)} · {t('context.charCount', { n: fmt(chars) })}
            {context.selection && context.text ? t('context.includesSelection') : ''}
            {!context.text && context.selection && !context.snapshot
              ? t('context.onlySelection')
              : ''}
            {elements > 0 ? t('context.interactiveElements', { n: elements }) : ''}
          </div>
        </div>
        <button className="underline" onClick={() => setEditing((v) => !v)}>
          {editing ? t('common.close') : t('context.view')}
        </button>
        <button aria-label={removeLabel} title={removeLabel} onClick={() => setContext(null)}>
          ✕
        </button>
      </div>

      {context.truncated && (
        <p role="status" className="mt-1 text-amber-800">
          {t('context.longText', {
            total: fmt(context.originalLength),
            limit: fmt(MAX_CONTEXT_CHARS),
          })}
        </p>
      )}

      {editing && (
        <div className="mt-2 space-y-2">
          {context.text && (
            <label className="block">
              <span className="font-medium">{t('context.pageText')}</span>
              <textarea
                className="mt-1 h-40 w-full rounded border border-neutral-300 bg-white p-2"
                maxLength={MAX_CONTEXT_CHARS + 200}
                value={context.text}
                onChange={(e) => setContext({ ...context, text: e.target.value })}
              />
            </label>
          )}
          {context.selection !== undefined && (
            <label className="block">
              <span className="font-medium">{t('context.selection')}</span>
              <textarea
                className="mt-1 h-24 w-full rounded border border-neutral-300 bg-white p-2"
                value={context.selection}
                onChange={(e) => setContext({ ...context, selection: e.target.value })}
              />
            </label>
          )}
          {context.snapshot && (
            <label className="block">
              <span className="font-medium">{t('context.interactiveElementsField')}</span>
              <textarea
                className="mt-1 h-32 w-full rounded border border-neutral-300 bg-white p-2 font-mono"
                value={context.snapshot}
                onChange={(e) => setContext({ ...context, snapshot: e.target.value })}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

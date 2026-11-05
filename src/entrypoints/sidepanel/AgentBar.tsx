import { useEffect, useState } from 'react';
import { useT } from '@/core/i18n/store';
import { useChat } from './chatStore';

const openOptions = (hash = '') =>
  void chrome.tabs.create({ url: chrome.runtime.getURL(`/options.html${hash}`) });

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Faixa do modo agente: estado da tarefa, PARAR sempre visível e aviso de sessão suspeita. */
export function AgentBar() {
  const t = useT();
  const agentMode = useChat((s) => s.conversations.find((c) => c.id === s.activeId)?.agentMode);
  const status = useChat((s) => s.agentStatus);
  const streaming = useChat((s) => s.streaming);
  const stop = useChat((s) => s.stop);
  const running = streaming && !!status;
  const now = useNow(running);
  if (!agentMode) return null;

  const elapsed = status ? Math.max(0, Math.round((now - status.startedAt) / 1000)) : 0;
  return (
    <div className="border-b border-violet-200 bg-violet-50 px-3 py-1.5 text-xs text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">
      <div className="flex items-center gap-2">
        <span className="flex-1">
          {running
            ? t('agentBar.working', {
                round: status.round + 1,
                max: status.maxSteps,
                actions: status.actions,
                sec: elapsed,
              })
            : t('agentBar.idle')}
        </span>
        {running ? (
          <button
            className="rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white hover:bg-red-700"
            onClick={stop}
          >
            {t('agentBar.stop')}
          </button>
        ) : (
          <>
            <button className="underline" onClick={() => openOptions('#agente')}>
              {t('agentBar.sites')}
            </button>
            <button className="underline" onClick={() => openOptions('#registro')}>
              {t('agentBar.log')}
            </button>
          </>
        )}
      </div>
      {status?.tainted && (
        <p role="alert" className="mt-1 rounded bg-amber-100 px-2 py-1 text-amber-900">
          {t('agentBar.tainted', { text: status.tainted })}
        </p>
      )}
    </div>
  );
}

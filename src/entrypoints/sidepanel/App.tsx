import { useEffect, useState } from 'react';
import { conversationFilename, conversationToMarkdown } from '@/core/export/markdown';
import { downloadTextFile } from '@/core/export/download';
import { useI18nStore, useT } from '@/core/i18n/store';
import { PENDING_KEY, type PendingAsk } from '@/core/page/pending';
import { onSettingsChanged } from '@/core/storage/settings';
import { applyTheme, watchTheme } from '@/core/theme';
import { AgentBar } from './AgentBar';
import { AgentCards } from './AgentCards';
import { ChatView } from './ChatView';
import { Composer } from './Composer';
import { ConversationList } from './ConversationList';
import { ProviderPanel } from './ProviderPanel';
import { SaveWorkflowDialog } from './SaveWorkflowDialog';
import { WorkflowList } from './WorkflowList';
import { useChat } from './chatStore';

export function App() {
  const t = useT();
  const [showList, setShowList] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [showProvider, setShowProvider] = useState(false);
  const {
    init,
    newConversation,
    error,
    needsKey,
    dismissError,
    conversations,
    activeId,
    notice,
    dismissNotice,
    saveWorkflowDraft,
  } = useChat();
  const active = conversations.find((c) => c.id === activeId);
  const title = active?.title ?? t('app.title');
  // Mesmo texto em aria-label (leitor de tela) e title (dica visível ao passar o mouse).
  const historyLabel = t('app.history');
  const newConversationLabel = t('app.newConversation');
  const workflowsLabel = t('app.workflows');
  const providerLabel = t('app.provider');
  const exportLabel = t('app.export');
  const settingsLabel = t('app.settings');
  const dismissLabel = t('app.dismissWarning');

  useEffect(() => {
    // Pedidos do menu de contexto chegam por storage.session (o painel pode abrir depois do clique).
    const take = (pending?: PendingAsk) => {
      if (!pending || Date.now() - pending.ts > 30_000) return;
      void chrome.storage.session.remove(PENDING_KEY);
      void useChat.getState().handlePending(pending);
    };
    void init().then(async () => {
      applyTheme(useChat.getState().settings.theme);
      take((await chrome.storage.session.get(PENDING_KEY))[PENDING_KEY] as PendingAsk | undefined);
    });
    void useI18nStore.getState().init();
    const offTheme = watchTheme(() => useChat.getState().settings.theme);
    const onStorage = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'session') take(changes[PENDING_KEY]?.newValue as PendingAsk | undefined);
    };
    chrome.storage.onChanged.addListener(onStorage);
    // O aviso de chave ausente é informativo (sobre o provedor padrão); generate() confere o
    // provedor certo da conversa (padrão ou segundo) antes de cada envio.
    const offSettings = onSettingsChanged((s) => {
      useChat.setState({ needsKey: !s.apiKey, settings: s });
      applyTheme(s.theme);
    });
    return () => {
      chrome.storage.onChanged.removeListener(onStorage);
      offSettings();
      offTheme();
    };
  }, [init]);

  return (
    <div className="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <header className="flex items-center gap-1 border-b border-neutral-200 px-2 py-1.5 dark:border-neutral-700">
        <button
          className="btn"
          aria-label={historyLabel}
          title={historyLabel}
          onClick={() => setShowList((v) => !v)}
        >
          ☰
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
        <button
          className="btn"
          aria-label={newConversationLabel}
          title={newConversationLabel}
          onClick={() => {
            newConversation();
            setShowList(false);
          }}
        >
          ＋
        </button>
        <button
          className="btn"
          aria-label={workflowsLabel}
          title={workflowsLabel}
          onClick={() => setShowWorkflows((v) => !v)}
        >
          ⚡
        </button>
        <button
          className="btn"
          aria-label={providerLabel}
          title={providerLabel}
          onClick={() => setShowProvider((v) => !v)}
        >
          🔌
        </button>
        <button
          className="btn"
          aria-label={exportLabel}
          title={exportLabel}
          disabled={!active?.messages.length}
          onClick={() => {
            if (!active) return;
            downloadTextFile(conversationFilename(active.title), conversationToMarkdown(active));
          }}
        >
          ⬇
        </button>
        <button
          className="btn"
          aria-label={settingsLabel}
          title={settingsLabel}
          onClick={() => void chrome.runtime.openOptionsPage()}
        >
          ⚙
        </button>
      </header>
      <AgentBar />

      {(error || needsKey) && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
        >
          <span className="flex-1">{error ?? t('app.configureApiKey')}</span>
          {needsKey && (
            <button className="underline" onClick={() => void chrome.runtime.openOptionsPage()}>
              {t('app.openSettings')}
            </button>
          )}
          {error && (
            <button aria-label={dismissLabel} title={dismissLabel} onClick={dismissError}>
              ✕
            </button>
          )}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <span className="flex-1">{notice}</span>
          <button aria-label={dismissLabel} title={dismissLabel} onClick={dismissNotice}>
            ✕
          </button>
        </div>
      )}

      <div className="relative min-h-40 flex-1">
        <ChatView />
        {showList && <ConversationList onClose={() => setShowList(false)} />}
        {showWorkflows && <WorkflowList onClose={() => setShowWorkflows(false)} />}
        {showProvider && <ProviderPanel onClose={() => setShowProvider(false)} />}
      </div>
      <AgentCards />
      {saveWorkflowDraft !== null && <SaveWorkflowDialog key={saveWorkflowDraft} />}
      <Composer />
    </div>
  );
}

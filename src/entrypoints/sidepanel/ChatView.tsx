import { useEffect, useRef } from 'react';
import { useT } from '@/core/i18n/store';
import { Message } from './Message';
import { useChat } from './chatStore';

export function ChatView() {
  const t = useT();
  const conv = useChat((s) => s.conversations.find((c) => c.id === s.activeId));
  const streaming = useChat((s) => s.streaming);
  const ref = useRef<HTMLDivElement>(null);
  const messages = conv?.messages;

  // Acompanha o fim da conversa durante o streaming, a menos que o usuário tenha rolado para cima.
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120)
      el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (!messages || messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        {t('chat.empty')}
      </div>
    );
  }

  const lastAssistantId = messages.findLast((m) => m.role === 'assistant')?.id;
  return (
    <div ref={ref} className="h-full space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
      {messages.map((m) => (
        <Message key={m.id} message={m} canRegenerate={!streaming && m.id === lastAssistantId} />
      ))}
      {streaming && messages.at(-1)?.content === '' && !messages.at(-1)?.toolCalls && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('chat.thinking')}</p>
      )}
    </div>
  );
}

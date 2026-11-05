/** Pedido vindo do menu de contexto, repassado do service worker ao painel via storage.session. */
export type AskAction = 'ask' | 'summarize' | 'translate' | 'explain';

export interface PendingAsk {
  action: AskAction;
  text: string;
  title: string;
  url: string;
  ts: number;
}

export const PENDING_KEY = 'pendingAsk';

/** Prompt enviado automaticamente nas ações rápidas (a ação "ask" só anexa a seleção). */
export const QUICK_PROMPTS: Record<Exclude<AskAction, 'ask'>, string> = {
  summarize: 'Resuma o conteúdo fornecido de forma clara e objetiva.',
  translate:
    'Traduza o conteúdo fornecido para português do Brasil (se já estiver em português, traduza para inglês).',
  explain: 'Explique o conteúdo fornecido em linguagem simples, com exemplos se ajudar.',
};

export const MENU_IDS: Record<string, AskAction> = {
  'lucerna-ask': 'ask',
  'lucerna-summarize': 'summarize',
  'lucerna-translate': 'translate',
  'lucerna-explain': 'explain',
};

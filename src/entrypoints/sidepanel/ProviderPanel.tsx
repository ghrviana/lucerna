import { useState } from 'react';
import { useT } from '@/core/i18n/store';
import { estimateCost } from '@/core/llm/usage';
import { useChat } from './chatStore';

const fmtTokens = (n: number) => n.toLocaleString();

/** Provedor/modelo da conversa atual (Fase 8) e o medidor de uso de tokens dela. */
export function ProviderPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const conv = useChat((s) => s.conversations.find((c) => c.id === s.activeId));
  const settings = useChat((s) => s.settings);
  const setProvider = useChat((s) => s.setProvider);
  const sp = settings.secondaryProvider;
  const hasSecondary = !!(sp.baseUrl && sp.apiKey);
  const provider = conv?.provider === 'secondary' && hasSecondary ? 'secondary' : 'primary';
  const [model, setModel] = useState(conv?.model ?? '');

  const usage = conv?.usage;
  const price = provider === 'secondary' ? sp : settings;
  const cost = usage ? estimateCost(usage, price.priceInPerMTok, price.priceOutPerMTok) : undefined;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white dark:bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-200 p-2 dark:border-neutral-700">
        <h2 className="text-sm font-semibold">{t('providerPanel.title')}</h2>
        <button className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto p-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="provider"
            checked={provider === 'primary'}
            onChange={() => void setProvider('primary', model)}
          />
          DeepSeek ({settings.model})
        </label>
        <label className={`flex items-center gap-2 ${hasSecondary ? '' : 'opacity-50'}`}>
          <input
            type="radio"
            name="provider"
            disabled={!hasSecondary}
            checked={provider === 'secondary'}
            onChange={() => void setProvider('secondary', model)}
          />
          {hasSecondary
            ? `${sp.name || t('providerPanel.title')} (${sp.model})`
            : t('providerPanel.secondaryNotConfigured')}
        </label>

        <label className="block">
          <span className="font-medium">{t('options.model')}</span>
          <input
            className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 outline-none focus:border-indigo-500 dark:border-neutral-600 dark:bg-neutral-800"
            placeholder={provider === 'secondary' ? sp.model : settings.model}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            onBlur={() => void setProvider(provider, model)}
          />
        </label>

        <div className="rounded-lg border border-neutral-200 p-2 text-xs text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          {usage
            ? cost !== undefined
              ? t('usage.cost', { tokens: fmtTokens(usage.totalTokens), cost: cost.toFixed(4) })
              : t('usage.tokens', { n: fmtTokens(usage.totalTokens) })
            : t('usage.tokens', { n: 0 })}
        </div>
      </div>
    </div>
  );
}

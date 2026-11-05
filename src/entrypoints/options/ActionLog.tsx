import { useEffect, useState } from 'react';
import { useT } from '@/core/i18n/store';
import type { TranslationKey } from '@/core/i18n/translate';
import { clearLog, listLog, type ActionLogEntry } from '@/core/storage/actionLog';
import type { ActionDecision } from '@/core/tools/types';

const LABEL_KEY: Record<ActionDecision, TranslationKey> = {
  auto: 'actionLog.decisionAuto',
  confirmed: 'actionLog.decisionConfirmed',
  refused: 'actionLog.decisionRefused',
  denied: 'actionLog.decisionDenied',
  cancelled: 'actionLog.decisionCancelled',
  plan_approved: 'actionLog.decisionPlanApproved',
  plan_refused: 'actionLog.decisionPlanRefused',
};

const COLOR: Partial<Record<ActionDecision, string>> = {
  denied: 'text-red-700',
  refused: 'text-amber-700',
  confirmed: 'text-violet-700',
};

/** Registro local de tudo que o agente fez, tentou ou teve bloqueado. */
export function ActionLog() {
  const t = useT();
  const [entries, setEntries] = useState<ActionLogEntry[] | null>(null);
  const [filter, setFilter] = useState('');

  const load = () => void listLog().then(setEntries);
  useEffect(load, []);

  const clear = async () => {
    if (!confirm(t('actionLog.confirmClear'))) return;
    await clearLog();
    load();
  };

  const q = filter.trim().toLowerCase();
  const shown = (entries ?? []).filter(
    (e) =>
      !q ||
      (e.domain ?? '').includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.tool.includes(q),
  );

  return (
    <section id="registro" className="space-y-2">
      <h2 className="text-lg font-semibold">{t('actionLog.title')}</h2>
      <p className="text-xs text-neutral-500">{t('actionLog.hint')}</p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          placeholder={t('actionLog.filter')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="btn border border-neutral-300" onClick={load}>
          {t('common.update')}
        </button>
        <button className="btn border border-red-300 text-red-700" onClick={() => void clear()}>
          {t('common.clear')}
        </button>
      </div>
      {entries === null ? null : shown.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('actionLog.none')}</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm">
          {shown.map((e) => (
            <li key={e.id} className="space-y-0.5 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <time className="text-xs text-neutral-500">{new Date(e.ts).toLocaleString()}</time>
                <span className="font-mono text-xs">{e.tool}</span>
                <span className={`text-xs font-medium ${COLOR[e.decision] ?? 'text-neutral-700'}`}>
                  {t(LABEL_KEY[e.decision])}
                  {e.ok === false && e.decision !== 'denied' && e.decision !== 'refused'
                    ? t('actionLog.failedSuffix')
                    : ''}
                </span>
                {e.domain && <span className="text-xs text-neutral-500">{e.domain}</span>}
              </div>
              <p>{e.summary}</p>
              {e.reasons.length > 0 && (
                <p className="text-xs text-neutral-600">
                  {t('actionLog.reasons', { reasons: e.reasons.join(' ') })}
                </p>
              )}
              {e.result && (
                <p className="text-xs text-neutral-500">
                  {t('actionLog.result', { result: e.result })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

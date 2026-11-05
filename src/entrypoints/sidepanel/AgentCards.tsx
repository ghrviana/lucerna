import { useState } from 'react';
import { hostOf } from '@/core/agent/policy';
import { useT } from '@/core/i18n/store';
import { useChat } from './chatStore';

/** Plano proposto pelo agente: nada é executado antes de o usuário aprovar. */
function PlanCard({
  plan,
}: {
  plan: NonNullable<ReturnType<typeof useChat.getState>['pendingPlan']>;
}) {
  const t = useT();
  const resolve = useChat((s) => s.resolvePlan);
  const [enable, setEnable] = useState(false);
  return (
    <section
      aria-label={t('agentCards.planLabel')}
      className="mx-2 mb-2 rounded-lg border border-violet-300 bg-violet-50 p-3 text-sm"
    >
      <h2 className="font-semibold">{t('agentCards.planTitle')}</h2>
      {plan.goal && <p className="mt-1">{plan.goal}</p>}
      <ol className="mt-1 list-decimal space-y-0.5 pl-5">
        {plan.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {plan.sites.length > 0 && (
        <p className="mt-1 text-xs text-neutral-600">
          {t('agentCards.sites', { sites: plan.sites.join(', ') })}
        </p>
      )}
      {plan.notEnabled.length > 0 && (
        <label className="mt-2 flex items-start gap-1.5 text-xs">
          <input type="checkbox" checked={enable} onChange={(e) => setEnable(e.target.checked)} />
          <span>{t('agentCards.enableSites', { sites: plan.notEnabled.join(', ') })}</span>
        </label>
      )}
      <p className="mt-2 text-xs text-neutral-600">{t('agentCards.sensitiveNotice')}</p>
      <div className="mt-2 flex gap-2">
        <button className="btn-primary" onClick={() => resolve(true, enable)}>
          {t('agentCards.runPlan')}
        </button>
        <button className="btn border border-neutral-300" onClick={() => resolve(false, false)}>
          {t('agentCards.cancel')}
        </button>
      </div>
    </section>
  );
}

/** Confirmação de uma ação: mostra exatamente o que será feito, onde e por quê. */
function ConfirmCard() {
  const t = useT();
  const req = useChat((s) => s.pendingConfirm);
  const resolve = useChat((s) => s.resolveConfirm);
  if (!req) return null;
  const { intent, verdict } = req;
  const site = hostOf(intent.destination) || hostOf(intent.url);
  const tone = verdict.sensitive ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50';
  const approve = verdict.enableDomain
    ? t('agentCards.enableAndAllow', { domain: verdict.enableDomain })
    : t('agentCards.allow');
  return (
    <section
      role="alertdialog"
      aria-label={t('agentCards.confirmLabel')}
      className={`mx-2 mb-2 rounded-lg border p-3 text-sm ${tone}`}
    >
      <h2 className="font-semibold">
        {verdict.sensitive ? t('agentCards.sensitiveTitle') : t('agentCards.confirmTitle')}
      </h2>
      <p className="mt-1">
        <strong>{intent.summary}</strong>
        {site && <span className="text-neutral-600">{t('agentCards.in', { site })}</span>}
      </p>
      {intent.text !== undefined && (
        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-white/70 px-2 py-1 text-xs">
          {intent.text}
        </pre>
      )}
      {intent.destination && intent.kind !== 'click' && (
        <p className="mt-1 break-all text-xs">
          {t('agentCards.destination', { url: intent.destination })}
        </p>
      )}
      <ul className="mt-1 list-disc pl-5 text-xs">
        {verdict.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
      {req.reason && (
        <p className="mt-1 text-xs text-neutral-600">
          {t('agentCards.reason', { reason: req.reason })}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          className={`btn-primary ${verdict.sensitive ? 'bg-red-600' : ''}`}
          onClick={() => resolve(true)}
        >
          {approve}
        </button>
        <button className="btn border border-neutral-300" onClick={() => resolve(false)}>
          {t('agentCards.refuse')}
        </button>
      </div>
    </section>
  );
}

export function AgentCards() {
  const plan = useChat((s) => s.pendingPlan);
  return (
    <>
      {plan && <PlanCard key={JSON.stringify(plan)} plan={plan} />}
      <ConfirmCard />
    </>
  );
}

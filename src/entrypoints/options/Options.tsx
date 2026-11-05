import { useEffect, useState, type ReactNode } from 'react';
import { useI18nStore, useT } from '@/core/i18n/store';
import { LOCALES, type Locale } from '@/core/i18n/translate';
import { parseDomainList } from '@/core/page/blocklist';
import { applyTheme } from '@/core/theme';
import { ActionLog } from './ActionLog';
import { Manual } from './Manual';
import { Memories } from './Memories';
import { ScheduledTasks } from './ScheduledTasks';
import { Workflows } from './Workflows';
import {
  DEFAULT_SETTINGS,
  getSettings,
  saveSettings,
  THEMES,
  type SecondaryProvider,
  type Settings,
  type Theme,
} from '@/core/storage/settings';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

const input =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-indigo-500';

/** Preço opcional (por 1M tokens); campo numérico em branco = sem preço configurado. */
function priceInput(value: number | undefined, onChange: (v: number | undefined) => void) {
  return (
    <input
      className={input}
      type="number"
      min={0}
      step="any"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value.trim() === '' ? undefined : Number(e.target.value))}
    />
  );
}

export function Options() {
  const t = useT();
  const [tab, setTab] = useState<'settings' | 'manual'>('settings');
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [domains, setDomains] = useState('');
  const [allowed, setAllowed] = useState('');
  const [agentBlocked, setAgentBlocked] = useState('');
  const [sensitive, setSensitive] = useState('');

  useEffect(() => {
    void useI18nStore.getState().init();
    void getSettings().then((v) => {
      setS(v);
      setDomains(v.blockedDomains.join('\n'));
      setAllowed(v.agentAllowedDomains.join('\n'));
      setAgentBlocked(v.agentBlockedDomains.join('\n'));
      setSensitive(v.sensitiveDomains.join('\n'));
      setLoaded(true);
      setSaved(true); // nada editado ainda: não conta como "alteração não salva".
      applyTheme(v.theme);
      // Links do painel (#agente, #registro) rolam até a seção.
      setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 0);
    });
  }, []);

  // Avisa com o diálogo nativo do navegador se o usuário tentar sair com alterações não salvas
  // (foi assim que uma sessão anterior perdeu o cadastro do segundo provedor).
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saved) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saved]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
    if (k === 'theme') applyTheme(v as Theme);
  };

  const setSecondary = <K extends keyof SecondaryProvider>(k: K, v: SecondaryProvider[K]) => {
    setS((prev) => ({ ...prev, secondaryProvider: { ...prev.secondaryProvider, [k]: v } }));
    setSaved(false);
  };

  const save = async () => {
    const lists = {
      blockedDomains: parseDomainList(domains),
      agentAllowedDomains: parseDomainList(allowed),
      agentBlockedDomains: parseDomainList(agentBlocked),
      sensitiveDomains: parseDomainList(sensitive),
    };
    await saveSettings({ ...s, ...lists });
    setDomains(lists.blockedDomains.join('\n'));
    setAllowed(lists.agentAllowedDomains.join('\n'));
    setAgentBlocked(lists.agentBlockedDomains.join('\n'));
    setSensitive(lists.sensitiveDomains.join('\n'));
    setSaved(true);
  };

  const domainArea = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <textarea
      className={input}
      rows={3}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setSaved(false);
      }}
    />
  );

  if (!loaded) return null;
  return (
    <div className="flex h-full flex-col bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-xl space-y-5">
          <h1 className="text-xl font-semibold">{t('options.title')}</h1>

          <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
            <button
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                tab === 'settings'
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
              onClick={() => setTab('settings')}
            >
              {t('options.tabSettings')}
            </button>
            <button
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                tab === 'manual'
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
              onClick={() => setTab('manual')}
            >
              {t('options.tabManual')}
            </button>
          </div>

          {tab === 'manual' && <Manual />}
          {tab === 'settings' && (
            <>
              <div className="flex gap-4">
                <Field label={t('options.language')} hint={t('options.languageHint')}>
                  <select
                    className={input}
                    value={s.language}
                    onChange={(e) => set('language', e.target.value as Locale)}
                  >
                    {LOCALES.map((l) => (
                      <option key={l} value={l}>
                        {l === 'pt-BR' ? 'Português (Brasil)' : 'English'}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('options.theme')} hint={t('options.themeHint')}>
                  <select
                    className={input}
                    value={s.theme}
                    onChange={(e) => set('theme', e.target.value as Theme)}
                  >
                    {THEMES.map((th) => (
                      <option key={th} value={th}>
                        {t(
                          th === 'light'
                            ? 'options.themeLight'
                            : th === 'dark'
                              ? 'options.themeDark'
                              : 'options.themeSystem',
                        )}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label={t('options.apiKey')} hint={t('options.apiKeyHint')}>
                <div className="flex gap-2">
                  <input
                    className={input}
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={s.apiKey}
                    onChange={(e) => set('apiKey', e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn border border-neutral-300"
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? t('options.hide') : t('options.show')}
                  </button>
                </div>
              </Field>

              <Field label={t('options.model')} hint={t('options.modelHint')}>
                <input
                  className={input}
                  value={s.model}
                  onChange={(e) => set('model', e.target.value)}
                />
              </Field>

              <Field label={t('options.baseUrl')} hint={t('options.baseUrlHint')}>
                <input
                  className={input}
                  value={s.baseUrl}
                  onChange={(e) => set('baseUrl', e.target.value)}
                />
              </Field>

              <Field
                label={t('options.temperature', { value: s.temperature })}
                hint={t('options.temperatureHint')}
              >
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={s.temperature}
                  onChange={(e) => set('temperature', Number(e.target.value))}
                />
              </Field>

              <Field label={t('options.systemPrompt')} hint={t('options.systemPromptHint')}>
                <textarea
                  className={input}
                  rows={5}
                  value={s.systemPrompt}
                  onChange={(e) => set('systemPrompt', e.target.value)}
                />
              </Field>

              <Field label={t('options.blockedDomains')} hint={t('options.blockedDomainsHint')}>
                <textarea
                  className={input}
                  rows={4}
                  placeholder="meubanco.com.br"
                  value={domains}
                  onChange={(e) => {
                    setDomains(e.target.value);
                    setSaved(false);
                  }}
                />
              </Field>

              <section className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-700">
                <h2 className="text-lg font-semibold">{t('options.pricingTitle')}</h2>
                <p className="text-xs text-neutral-500">{t('options.pricingHint')}</p>
                <div className="flex gap-4">
                  <Field label={t('options.priceIn')}>
                    {priceInput(s.priceInPerMTok, (v) => set('priceInPerMTok', v))}
                  </Field>
                  <Field label={t('options.priceOut')}>
                    {priceInput(s.priceOutPerMTok, (v) => set('priceOutPerMTok', v))}
                  </Field>
                </div>
              </section>

              <section className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-700">
                <h2 className="text-lg font-semibold">{t('options.secondaryProviderTitle')}</h2>
                <p className="text-xs text-neutral-500">{t('options.secondaryProviderHint')}</p>
                <Field label={t('options.providerName')}>
                  <input
                    className={input}
                    value={s.secondaryProvider.name}
                    onChange={(e) => setSecondary('name', e.target.value)}
                  />
                </Field>
                <Field label={t('options.baseUrl')} hint={t('options.secondaryBaseUrlHint')}>
                  <input
                    className={input}
                    value={s.secondaryProvider.baseUrl}
                    onChange={(e) => setSecondary('baseUrl', e.target.value)}
                  />
                </Field>
                <Field label={t('options.apiKey')}>
                  <input
                    className={input}
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={s.secondaryProvider.apiKey}
                    onChange={(e) => setSecondary('apiKey', e.target.value)}
                  />
                </Field>
                <Field label={t('options.model')} hint={t('options.secondaryModelHint')}>
                  <input
                    className={input}
                    value={s.secondaryProvider.model}
                    onChange={(e) => setSecondary('model', e.target.value)}
                  />
                </Field>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.secondaryProvider.reasoningEffort === 'none'}
                    onChange={(e) =>
                      setSecondary('reasoningEffort', e.target.checked ? 'none' : undefined)
                    }
                  />
                  <span>
                    {t('options.reasoningEffort')}
                    <span className="block text-xs text-neutral-500">
                      {t('options.reasoningEffortHint')}
                    </span>
                  </span>
                </label>
                <div className="flex gap-4">
                  <Field label={t('options.priceIn')}>
                    {priceInput(s.secondaryProvider.priceInPerMTok, (v) =>
                      setSecondary('priceInPerMTok', v),
                    )}
                  </Field>
                  <Field label={t('options.priceOut')}>
                    {priceInput(s.secondaryProvider.priceOutPerMTok, (v) =>
                      setSecondary('priceOutPerMTok', v),
                    )}
                  </Field>
                </div>
              </section>

              <section
                id="agente"
                className="space-y-4 border-t border-neutral-200 pt-5 dark:border-neutral-700"
              >
                <h2 className="text-lg font-semibold">{t('options.agentTitle')}</h2>
                <p className="text-xs text-neutral-500">{t('options.agentHint')}</p>
                <Field label={t('options.agentAllowed')} hint={t('options.agentAllowedHint')}>
                  {domainArea(allowed, setAllowed, 'pt.wikipedia.org')}
                </Field>
                <Field label={t('options.agentBlocked')} hint={t('options.agentBlockedHint')}>
                  {domainArea(agentBlocked, setAgentBlocked, 'meubanco.com.br')}
                </Field>
                <Field label={t('options.agentSensitive')} hint={t('options.agentSensitiveHint')}>
                  {domainArea(sensitive, setSensitive, 'minhaloja.com.br')}
                </Field>
                <div className="flex gap-4">
                  <Field label={t('options.agentMaxSteps')} hint={t('options.agentMaxStepsHint')}>
                    <input
                      className={input}
                      type="number"
                      min={5}
                      max={100}
                      value={s.agentMaxSteps}
                      onChange={(e) => set('agentMaxSteps', Number(e.target.value))}
                    />
                  </Field>
                  <Field
                    label={t('options.agentMaxMinutes')}
                    hint={t('options.agentMaxMinutesHint')}
                  >
                    <input
                      className={input}
                      type="number"
                      min={1}
                      max={30}
                      value={s.agentMaxMinutes}
                      onChange={(e) => set('agentMaxMinutes', Number(e.target.value))}
                    />
                  </Field>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.agentScreenshotEachStep}
                    onChange={(e) => set('agentScreenshotEachStep', e.target.checked)}
                  />
                  <span>
                    {t('options.agentScreenshotEachStep')}
                    <span className="block text-xs text-neutral-500">
                      {t('options.agentScreenshotEachStepHint')}
                    </span>
                  </span>
                </label>
              </section>

              <div className="border-t border-neutral-200 pt-5 dark:border-neutral-700">
                <Workflows />
              </div>

              <div className="space-y-2 border-t border-neutral-200 pt-5 dark:border-neutral-700">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.memoryEnabled}
                    onChange={(e) => set('memoryEnabled', e.target.checked)}
                  />
                  <span>
                    {t('options.memoryTitle')}
                    <span className="block text-xs text-neutral-500">
                      {t('options.memoryHint')}
                    </span>
                  </span>
                </label>
                <Memories />
              </div>

              <div className="border-t border-neutral-200 pt-5 dark:border-neutral-700">
                <ScheduledTasks />
              </div>

              <div className="border-t border-neutral-200 pt-5 dark:border-neutral-700">
                <ActionLog />
              </div>
            </>
          )}
        </div>
      </main>
      {tab === 'settings' && (
        <footer className="shrink-0 border-t border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <div className="mx-auto max-w-xl space-y-1">
            <p className="text-xs text-neutral-500">{t('options.saveHint')}</p>
            <div className="flex items-center gap-3">
              <button className="btn-primary" onClick={() => void save()}>
                {t('options.save')}
              </button>
              {saved ? (
                <span role="status" className="text-sm text-green-700 dark:text-green-400">
                  {t('options.saved')}
                </span>
              ) : (
                <span role="status" className="text-sm text-amber-700 dark:text-amber-400">
                  {t('options.unsaved')}
                </span>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

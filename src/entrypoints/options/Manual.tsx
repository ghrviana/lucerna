import { useT } from '@/core/i18n/store';
import type { TranslationKey } from '@/core/i18n/translate';

interface ManualItem {
  /** Alguns itens (ex.: "Ferramentas de leitura") não precisam de subtítulo próprio. */
  title?: TranslationKey;
  body: TranslationKey;
}

interface ManualSection {
  title: TranslationKey;
  items: ManualItem[];
}

const SECTIONS: ManualSection[] = [
  {
    title: 'manual.sectionChat',
    items: [
      { title: 'manual.chatTitle', body: 'manual.chatBody' },
      { title: 'manual.historyTitle', body: 'manual.historyBody' },
      { title: 'manual.shortcutTitle', body: 'manual.shortcutBody' },
    ],
  },
  {
    title: 'manual.sectionContext',
    items: [
      { title: 'manual.pageBtnTitle', body: 'manual.pageBtnBody' },
      { title: 'manual.screenshotBtnTitle', body: 'manual.screenshotBtnBody' },
      { title: 'manual.annotatedBtnTitle', body: 'manual.annotatedBtnBody' },
      { title: 'manual.imageBtnTitle', body: 'manual.imageBtnBody' },
      { title: 'manual.selectionTitle', body: 'manual.selectionBody' },
    ],
  },
  { title: 'manual.sectionTools', items: [{ body: 'manual.toolsBody' }] },
  { title: 'manual.sectionAgent', items: [{ body: 'manual.agentBody' }] },
  { title: 'manual.sectionWorkflows', items: [{ body: 'manual.workflowsBody' }] },
  { title: 'manual.sectionMemory', items: [{ body: 'manual.memoryBody' }] },
  { title: 'manual.sectionExport', items: [{ body: 'manual.exportBody' }] },
  { title: 'manual.sectionTasks', items: [{ body: 'manual.tasksBody' }] },
  { title: 'manual.sectionProviders', items: [{ body: 'manual.providersBody' }] },
  { title: 'manual.sectionPrivacy', items: [{ body: 'manual.privacyBody' }] },
];

/** Manual de uso: só leitura, sem campos nem botão de salvar. */
export function Manual() {
  const t = useT();
  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('manual.intro')}</p>
      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{t(section.title)}</h2>
          <div className="space-y-3">
            {section.items.map((item) => (
              <div key={item.body}>
                {item.title && <h3 className="text-sm font-medium">{t(item.title)}</h3>}
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{t(item.body)}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

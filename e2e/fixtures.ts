import {
  chromium,
  expect,
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import path from 'node:path';
import { FakeLlm } from './fakeLlm';

/** Build de e2e (`wxt build --mode e2e`), com acesso a todos os sites no manifest. */
const EXTENSION = path.resolve('.output/chrome-mv3-e2e');
export const PAGES = 'http://localhost:4173';

interface Fixtures {
  context: BrowserContext;
  worker: Worker;
  extensionId: string;
  llm: FakeLlm;
  /** Aba normal onde o agente vai agir. */
  page: Page;
  /** Painel da Lucerna aberto numa janela popup (fora da janela das abas). */
  panel: Page;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
    });
    await use(context);
    await context.close();
  },
  worker: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker')));
  },
  extensionId: async ({ worker }, use) => {
    await use(worker.url().split('/')[2] as string);
  },
  // eslint-disable-next-line no-empty-pattern
  llm: async ({}, use) => {
    const llm = new FakeLlm();
    await llm.start();
    await use(llm);
    await llm.stop();
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },
  panel: async ({ context, worker, extensionId, llm, page }, use) => {
    await page.bringToFront();
    const opened = context.waitForEvent('page', (p) => p.url().includes('sidepanel.html'));
    await worker.evaluate(
      (url) => chrome.windows.create({ url, type: 'popup', width: 460, height: 900 }),
      `chrome-extension://${extensionId}/sidepanel.html`,
    );
    const panel = await opened;
    await panel.waitForLoadState();
    await setSettings(panel, { baseUrl: llm.url });
    await use(panel);
  },
});

export { expect };

export interface E2ESettings {
  baseUrl?: string;
  agentAllowedDomains?: string[];
  agentScreenshotEachStep?: boolean;
}

/** Grava as configurações da extensão (chave falsa, URL do LLM falso, sites do agente). */
export async function setSettings(panel: Page, s: E2ESettings): Promise<void> {
  await panel.evaluate(async (patch) => {
    const current = ((await chrome.storage.local.get('settings')).settings ?? {}) as object;
    await chrome.storage.local.set({
      settings: {
        apiKey: 'e2e-chave-falsa',
        model: 'fake',
        agentAllowedDomains: ['localhost'],
        agentScreenshotEachStep: false,
        ...current,
        ...patch,
      },
    });
  }, s);
}

export async function readSettings(panel: Page): Promise<Record<string, unknown>> {
  return panel.evaluate(
    async () =>
      ((await chrome.storage.local.get('settings')).settings ?? {}) as Record<string, unknown>,
  );
}

/** Abre a página de teste na aba do agente e a deixa ativa. */
export async function openTestPage(page: Page, file: string): Promise<void> {
  await page.goto(`${PAGES}/agent/${file}`);
  await page.bringToFront();
}

/** Liga o modo agente e envia a tarefa pelo painel. */
export async function sendTask(panel: Page, task: string): Promise<void> {
  const agent = panel.getByLabel('Modo agente (agir no navegador)');
  if (!(await agent.isChecked())) await agent.check();
  const box = panel.getByRole('textbox', { name: 'Mensagem' });
  await box.fill(task);
  await box.press('Enter');
}

export const planCard = (panel: Page) => panel.getByRole('region', { name: 'Plano do agente' });
export const confirmCard = (panel: Page) =>
  panel.getByRole('alertdialog', { name: 'Confirmar ação do agente' });

/** Espera a volta do agente terminar (o botão Enviar volta a aparecer). */
export async function waitIdle(panel: Page): Promise<void> {
  await expect(panel.getByRole('button', { name: 'Enviar' })).toBeVisible({ timeout: 30_000 });
}

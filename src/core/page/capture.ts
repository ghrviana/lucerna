import { isDomainBlocked } from './blocklist';
import { dataUrlToBlob, processImage } from './image';
import { formatSnapshot } from './snapshot';
import {
  EXTRACT_MESSAGE,
  SNAPSHOT_MESSAGE,
  type ExtractResponse,
  type ImageAttachment,
  type PageContext,
  type SnapshotResponse,
} from './types';
import { getSettings } from '../storage/settings';

const CONTENT_SCRIPT = 'extract.js';

/** A captura está desativada para o domínio da aba (configuração do usuário). */
export class CaptureBlockedError extends Error {}

export type ReadableTab = chrome.tabs.Tab & { id: number; url: string };

const isOwnPage = (url?: string) => !!url && url.startsWith(chrome.runtime.getURL(''));

/**
 * Aba ativa da janela do painel. Se o painel estiver aberto como página própria (ex.: testes e2e
 * numa janela popup), usa a aba ativa da última janela normal focada.
 */
export async function activeBrowsingTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined && !isOwnPage(tab.url)) return tab;
  const win = await chrome.windows
    .getLastFocused({ windowTypes: ['normal'] })
    .catch(() => undefined);
  if (win?.id === undefined) return tab;
  const [other] = await chrome.tabs.query({ active: true, windowId: win.id });
  return other ?? tab;
}

/** Aba pedida (por id) ou, sem id, a aba ativa da janela atual. */
export async function findTab(tabId?: number): Promise<chrome.tabs.Tab> {
  if (tabId !== undefined) {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    if (tab?.id === undefined) throw new Error(`Aba ${tabId} não encontrada (use list_tabs).`);
    return tab;
  }
  const tab = await activeBrowsingTab();
  if (tab?.id === undefined) throw new Error('Nenhuma aba ativa encontrada.');
  return tab;
}

/** Páginas internas do Chrome, Web Store etc. não permitem content scripts nem captura. */
function isReadable(url: string | undefined): url is string {
  return (
    !!url && /^(https?|file):/.test(url) && !url.startsWith('https://chromewebstore.google.com')
  );
}

/** Aba (ativa por padrão), já validada: legível e fora da lista de domínios bloqueados. */
export async function readableTab(tabId?: number): Promise<ReadableTab> {
  let tab = await findTab(tabId);
  if (!tab.url) {
    // Sem activeTab nem permissão de host a URL fica oculta: pede acesso amplo (gesto do usuário).
    const ok = await chrome.permissions.request({ origins: ['<all_urls>'] }).catch(() => false);
    if (!ok)
      throw new Error('Permita o acesso aos sites para a Lucerna poder ler a página atual.');
    tab = await findTab(tabId);
  }
  if (!isReadable(tab.url)) {
    throw new Error(
      'Esta página não pode ser lida (páginas internas do Chrome e a Chrome Web Store são bloqueadas).',
    );
  }
  const { blockedDomains } = await getSettings();
  if (isDomainBlocked(tab.url, blockedDomains)) {
    throw new CaptureBlockedError(
      `A captura está desativada para ${new URL(tab.url).hostname} (veja as configurações).`,
    );
  }
  return tab as ReadableTab;
}

/**
 * Executa `action` com o acesso que já existe (activeTab). Se falhar, pede acesso só ao site da
 * aba (precisa de gesto do usuário) e tenta mais uma vez.
 */
async function withSiteAccess<T>(tab: ReadableTab, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (firstErr) {
    console.warn('Lucerna: acesso negado, pedindo permissão do site', firstErr);
    const origin = `${new URL(tab.url).origin}/*`;
    const granted = await chrome.permissions.request({ origins: [origin] }).catch(() => false);
    if (!granted) {
      throw new Error(
        'Sem permissão para ler este site. Permita o acesso quando o Chrome pedir (ou conceda acesso a todos os sites nas configurações da extensão).',
        { cause: firstErr },
      );
    }
    try {
      return await action();
    } catch (err) {
      console.error('Lucerna: falha após a permissão', err);
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Não foi possível acessar o conteúdo desta página. Detalhe: ${detail}`, {
        cause: err,
      });
    }
  }
}

export async function injectAndAsk<R>(
  tab: ReadableTab,
  message: { type: string; [key: string]: unknown },
): Promise<R> {
  await withSiteAccess(tab, () =>
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [CONTENT_SCRIPT] }),
  );
  const res = (await chrome.tabs.sendMessage(tab.id, message).catch(() => undefined)) as
    R | undefined;
  if (!res) throw new Error('A página não respondeu. Recarregue-a e tente de novo.');
  return res;
}

/**
 * Lê o texto principal e a seleção da aba (a ativa, por padrão). `limit`/`offset` controlam o
 * truncamento (ver `extractPageContext`): sem eles, usa o limite padrão do contexto manual.
 */
export async function capturePageContext(
  tabId?: number,
  limit?: number,
  offset?: number,
): Promise<PageContext> {
  const tab = await readableTab(tabId);
  const { blockedDomains } = await getSettings();
  const res = await injectAndAsk<ExtractResponse>(tab, {
    type: EXTRACT_MESSAGE,
    blockedDomains,
    limit,
    offset,
  });
  if (!res.ok) throw new Error(res.error);
  if (!res.data.text && !res.data.selection && !res.data.embeddedPdf)
    throw new Error('Não encontrei texto nesta página.');
  return res.data;
}

/**
 * captureVisibleTab só enxerga a aba ativa da janela: para outra aba, ativa-a, captura e
 * devolve o foco à aba que estava ativa.
 */
async function screenshotBlob(tab: ReadableTab): Promise<Blob> {
  const fresh = await chrome.tabs.get(tab.id);
  let previous: number | undefined;
  if (!fresh.active) {
    previous = (await chrome.tabs.query({ active: true, windowId: tab.windowId }))[0]?.id;
    await chrome.tabs.update(tab.id, { active: true });
    await new Promise((r) => setTimeout(r, 400)); // tempo para a aba pintar
  }
  try {
    const dataUrl = await withSiteAccess(tab, () =>
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }),
    );
    return dataUrlToBlob(dataUrl);
  } finally {
    if (previous !== undefined)
      await chrome.tabs.update(previous, { active: true }).catch(() => {});
  }
}

/** Screenshot da parte visível da aba, reduzido (≤ 1280 px) e comprimido (JPEG ~0,7). */
export async function captureScreenshot(tabId?: number): Promise<ImageAttachment> {
  const tab = await readableTab(tabId);
  return processImage(await screenshotBlob(tab), { kind: 'screenshot' });
}

/**
 * Screenshot anotado (set-of-marks): caixas numeradas sobre os elementos interativos, com os
 * mesmos ids da lista textual devolvida em `context.snapshot`.
 */
export async function captureAnnotated(tabId?: number): Promise<{
  image: ImageAttachment;
  context: PageContext;
}> {
  const tab = await readableTab(tabId);
  const res = await injectAndAsk<SnapshotResponse>(tab, { type: SNAPSHOT_MESSAGE });
  if (!res.ok) throw new Error(res.error);
  const snap = res.data;
  // Snapshot antes do screenshot: a captura pode trocar a aba ativa por instantes.
  const blob = await screenshotBlob(tab);

  const image = await processImage(blob, {
    kind: 'annotated',
    marks: { items: snap.items, viewportWidth: snap.viewport.width },
  });
  const context: PageContext = {
    title: snap.title,
    url: snap.url,
    text: '',
    snapshot: formatSnapshot(snap),
    truncated: false,
    originalLength: 0,
  };
  return { image, context };
}

/** Snapshot textual (lista de elementos interativos) da aba. */
export async function captureSnapshot(tabId?: number): Promise<PageContext> {
  const tab = await readableTab(tabId);
  const res = await injectAndAsk<SnapshotResponse>(tab, { type: SNAPSHOT_MESSAGE });
  if (!res.ok) throw new Error(res.error);
  return {
    title: res.data.title,
    url: res.data.url,
    text: '',
    snapshot: formatSnapshot(res.data),
    truncated: false,
    originalLength: 0,
  };
}

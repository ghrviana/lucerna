import { deepActiveElement, performAction, waitForQuiet } from '@/core/page/actions';
import { describeElement } from '@/core/page/elementInfo';
import { extractPageContext } from '@/core/page/extract';
import { extractLinks } from '@/core/page/links';
import { buildSnapshot } from '@/core/page/snapshot';
import { extractTables } from '@/core/page/tables';
import {
  ACT_MESSAGE,
  DESCRIBE_MESSAGE,
  EXTRACT_MESSAGE,
  LINKS_MESSAGE,
  SETTLE_MESSAGE,
  SNAPSHOT_MESSAGE,
  TABLES_MESSAGE,
  type ActRequest,
  type DescribeResponse,
  type ExtractResponse,
  type LinksResponse,
  type SnapshotResponse,
  type TablesResponse,
} from '@/core/page/types';

declare global {
  interface Window {
    __lucernaExtractReady?: boolean;
    /** Elementos do último snapshot: elements[id - 1]. Usado pelo executor de ações. */
    __lucernaElements?: Element[];
  }
}

function handleExtract(blockedDomains: unknown, limit: unknown, offset: unknown): ExtractResponse {
  try {
    const domains = Array.isArray(blockedDomains) ? blockedDomains.map(String) : [];
    const data = extractPageContext(
      document,
      window,
      domains,
      typeof limit === 'number' ? limit : undefined,
      typeof offset === 'number' ? offset : undefined,
    );
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Não foi possível extrair o texto desta página.' };
  }
}

function handleSnapshot(): SnapshotResponse {
  try {
    const { snapshot, elements } = buildSnapshot(document, window);
    window.__lucernaElements = elements;
    return { ok: true, data: snapshot };
  } catch {
    return { ok: false, error: 'Não foi possível mapear os elementos desta página.' };
  }
}

function handleLinks(): LinksResponse {
  try {
    return {
      ok: true,
      data: { url: location.href, title: document.title, links: extractLinks(document) },
    };
  } catch {
    return { ok: false, error: 'Não foi possível listar os links desta página.' };
  }
}

function handleTables(): TablesResponse {
  try {
    return {
      ok: true,
      data: { url: location.href, title: document.title, tables: extractTables(document) },
    };
  } catch {
    return { ok: false, error: 'Não foi possível ler as tabelas desta página.' };
  }
}

/** Descreve o elemento do último snapshot (ou, sem id, o que tem o foco) para a política. */
function handleDescribe(id: unknown): DescribeResponse {
  if (typeof id === 'number') {
    const el = window.__lucernaElements?.[id - 1];
    if (!window.__lucernaElements)
      return { ok: false, error: 'Não há snapshot desta página. Chame get_page_snapshot antes.' };
    if (!el?.isConnected)
      return {
        ok: false,
        error: `O elemento [${id}] não existe mais. Chame get_page_snapshot e use os ids novos.`,
      };
    return { ok: true, data: describeElement(el, id) };
  }
  const active = deepActiveElement(document);
  if (!active || active === document.body || active === document.documentElement)
    return { ok: false, error: 'Nenhum elemento com foco.' };
  return { ok: true, data: describeElement(active, 0) };
}

// Script "unlisted": não é declarado no manifest (sem permissão de host fixa). O painel o injeta
// sob demanda com chrome.scripting.executeScript.
export default defineUnlistedScript(() => {
  // Evita registrar o listener de novo se o script for injetado mais de uma vez.
  if (window.__lucernaExtractReady) return;
  window.__lucernaExtractReady = true;

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    const msg = (message ?? {}) as { type?: string; [key: string]: unknown };
    switch (msg.type) {
      case EXTRACT_MESSAGE:
        sendResponse(handleExtract(msg.blockedDomains, msg.limit, msg.offset));
        return;
      case SNAPSHOT_MESSAGE:
        sendResponse(handleSnapshot());
        return;
      case LINKS_MESSAGE:
        sendResponse(handleLinks());
        return;
      case TABLES_MESSAGE:
        sendResponse(handleTables());
        return;
      case DESCRIBE_MESSAGE:
        sendResponse(handleDescribe(msg.id));
        return;
      case ACT_MESSAGE:
        sendResponse(
          performAction(msg as unknown as ActRequest, window.__lucernaElements, document),
        );
        return;
      case SETTLE_MESSAGE:
        void waitForQuiet(document, Number(msg.quietMs) || 300, Number(msg.maxMs) || 2000).then(
          () => sendResponse({ ok: true }),
        );
        return true; // resposta assíncrona
    }
  });
});

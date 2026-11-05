import { capturePageContext, readableTab } from './capture';
import { isPdfResource, readPdf } from './pdf';
import { looksLikePdfUrl } from './pdfText';
import { truncateSmart } from './truncate';

export interface TabText {
  title: string;
  url: string;
  text: string;
  selection?: string;
  kind: 'page' | 'pdf';
  truncated: boolean;
  originalLength: number;
  /** Posição (no texto original) a partir de onde o trecho foi omitido ou cortado. */
  omittedFrom?: number;
  /** Só PDFs: total de páginas e as incluídas no texto. */
  pdf?: { totalPages: number; pages: number[] };
}

async function readPdfTab(
  url: string,
  title: string,
  limit: number,
  pages?: string,
): Promise<TabText> {
  const pdf = await readPdf(url, pages);
  const t = truncateSmart(pdf.text, limit);
  if (!pdf.text.replace(/--- página \d+ ---/g, '').trim()) {
    throw new Error('O PDF não tem texto selecionável (pode ser um documento escaneado).');
  }
  return {
    title,
    url,
    text: t.text,
    kind: 'pdf',
    truncated: t.truncated,
    originalLength: t.originalLength,
    pdf: { totalPages: pdf.totalPages, pages: pdf.pages },
  };
}

/**
 * Texto de uma aba (a ativa, se `tabId` for omitido). PDFs abertos no navegador são lidos com o
 * pdf.js; `pages` ("1-5,8") só vale para PDFs. `offset` (páginas comuns, não PDF) continua a
 * leitura a partir do trecho que o truncamento (cabeça+rodapé) tinha omitido — ver
 * `extractPageContext`, que faz o truncamento/a continuação já na extração (só na maior parte da
 * página, para cabeçalho/menu não disputarem espaço com o conteúdo de verdade).
 */
export async function readTabText(
  opts: { tabId?: number; pages?: string; limit?: number; offset?: number } = {},
): Promise<TabText> {
  const limit = opts.limit ?? 40_000;
  const offset = opts.offset ?? 0;
  const tab = await readableTab(opts.tabId);
  if (looksLikePdfUrl(tab.url)) return readPdfTab(tab.url, tab.title ?? tab.url, limit, opts.pages);

  const asPdf = () => readPdfTab(tab.url, tab.title ?? tab.url, limit, opts.pages);
  let page: Awaited<ReturnType<typeof capturePageContext>> | undefined;
  let failure: unknown;
  try {
    page = await capturePageContext(tab.id, limit, offset);
  } catch (err) {
    failure = err;
  }
  // PDFs servidos sem ".pdf" no endereço: o visualizador do Chrome não expõe texto à página. Só
  // checa na primeira leitura: numa continuação já se sabe que a página não é um PDF.
  if (offset === 0 && (!page || page.text.length < 200)) {
    if (page?.embeddedPdf) {
      return readPdfTab(page.embeddedPdf, page.title || tab.title || tab.url, limit, opts.pages);
    }
    if (await isPdfResource(tab.url)) return asPdf();
  }
  if (!page) throw failure;

  return {
    title: page.title,
    url: page.url,
    text: page.text,
    selection: page.selection,
    kind: 'page',
    truncated: page.truncated,
    originalLength: page.originalLength,
    omittedFrom: page.omittedFrom,
  };
}

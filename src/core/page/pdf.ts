import { joinPdfItems, parsePageRange, type PdfTextItem } from './pdfText';

/** Páginas lidas por chamada quando o modelo não pede um intervalo. */
export const DEFAULT_PDF_PAGES = 30;
const MAX_PDF_BYTES = 50 * 1024 * 1024;

export interface PdfText {
  text: string;
  totalPages: number;
  /** Páginas incluídas no texto. */
  pages: number[];
}

async function fetchPdf(url: string): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'include' });
  } catch (err) {
    const hint = url.startsWith('file:')
      ? 'Ative "Permitir acesso a URLs de arquivo" nos detalhes da extensão.'
      : 'Conceda acesso a este site (permissão de host) e tente de novo.';
    throw new Error(`Não foi possível baixar o PDF. ${hint}`, { cause: err });
  }
  if (!res.ok) throw new Error(`Não foi possível baixar o PDF (HTTP ${res.status}).`);
  const size = Number(res.headers.get('content-length') ?? 0);
  if (size > MAX_PDF_BYTES) throw new Error('O PDF passa de 50 MB.');
  return res.arrayBuffer();
}

/**
 * Confere se a URL serve um PDF (endereços sem ".pdf"): Content-Type ou assinatura "%PDF".
 * Usa GET (muitos servidores rejeitam HEAD) e cancela o download após os primeiros bytes.
 */
export async function isPdfResource(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  try {
    const res = await fetch(url, { credentials: 'include', signal: ctrl.signal });
    if (!res.ok) return false;
    if ((res.headers.get('content-type') ?? '').toLowerCase().includes('pdf')) return true;
    const first = await res.body?.getReader().read();
    return new TextDecoder().decode(first?.value?.slice(0, 5)) === '%PDF-';
  } catch {
    return false;
  } finally {
    ctrl.abort();
  }
}

/** Extrai o texto de um PDF aberto no navegador com o pdf.js (carregado só quando preciso). */
export async function readPdf(url: string, pageSpec?: string): Promise<PdfText> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await fetchPdf(url));
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  try {
    const pages = pageSpec
      ? parsePageRange(pageSpec, doc.numPages)
      : Array.from({ length: Math.min(doc.numPages, DEFAULT_PDF_PAGES) }, (_, i) => i + 1);
    if (!pages) {
      throw new Error(`Intervalo de páginas inválido: "${pageSpec}" (o PDF tem ${doc.numPages}).`);
    }
    const parts: string[] = [];
    for (const n of pages) {
      const content = await (await doc.getPage(n)).getTextContent();
      const items = content.items.filter(
        (i): i is (typeof content.items)[number] & PdfTextItem => 'str' in i,
      );
      parts.push(`--- página ${n} ---\n${joinPdfItems(items)}`);
    }
    return { text: parts.join('\n\n'), totalPages: doc.numPages, pages };
  } finally {
    await task.destroy();
  }
}

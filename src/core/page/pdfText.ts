/** Parte do texto de uma página PDF, como devolvida pelo pdf.js (TextItem). */
export interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
}

/** Junta os itens de uma página respeitando as quebras de linha informadas pelo pdf.js. */
export function joinPdfItems(items: PdfTextItem[]): string {
  let out = '';
  for (const item of items) {
    out += item.str;
    if (item.hasEOL) out += '\n';
    else if (item.str && !out.endsWith(' ')) out += ' ';
  }
  return out
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Interpreta "3", "1-5", "1-3,7" em números de página (1..total), sem repetições e em ordem.
 * Devolve null se o texto for inválido ou não cair em nenhuma página existente.
 */
export function parsePageRange(spec: string, total: number): number[] | null {
  const pages = new Set<number>();
  for (const part of spec.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) return null;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : from;
    if (from < 1 || to < from) return null;
    for (let p = from; p <= Math.min(to, total); p++) pages.add(p);
  }
  return pages.size ? [...pages].sort((a, b) => a - b) : null;
}

/** O endereço aponta para um PDF (extensão .pdf no caminho). */
export function looksLikePdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

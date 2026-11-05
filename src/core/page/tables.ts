import type { PageTable } from './types';

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Tabelas de dados da página (ignora vazias e tabelas de layout que contêm outras tabelas). */
export function extractTables(doc: Document): PageTable[] {
  const tables: PageTable[] = [];
  for (const table of Array.from(doc.querySelectorAll('table'))) {
    if (table.querySelector('table')) continue;
    const rows = Array.from(table.rows).map((tr) =>
      Array.from(tr.cells).flatMap((cell) => {
        const text = collapse(cell.textContent ?? '');
        // colspan: repete o valor para manter as colunas alinhadas
        return Array.from({ length: Math.min(cell.colSpan || 1, 20) }, () => text);
      }),
    );
    if (rows.length === 0 || rows.every((r) => r.every((c) => c === ''))) continue;
    const caption = collapse(table.caption?.textContent ?? '');
    tables.push({ index: tables.length + 1, caption: caption || undefined, rows });
  }
  return tables;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function tableToCsv(table: PageTable): string {
  return table.rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

/** JSON: lista de objetos quando a 1ª linha parece um cabeçalho com nomes únicos; senão, matriz. */
export function tableToJson(table: PageTable): string {
  const [head, ...body] = table.rows;
  const unique = head && head.every((h) => h) && new Set(head).size === head.length;
  if (!head || !unique) return JSON.stringify(table.rows);
  return JSON.stringify(
    body.map((row) => Object.fromEntries(head.map((h, i) => [h, row[i] ?? '']))),
  );
}

/** Resumo de uma linha para o modelo escolher qual tabela extrair. */
export function describeTable(t: PageTable): string {
  const cols = Math.max(...t.rows.map((r) => r.length));
  const head = (t.rows[0] ?? []).slice(0, 6).join(' | ');
  return `[${t.index}] ${t.rows.length} linhas × ${cols} colunas${t.caption ? ` — ${t.caption}` : ''}: ${head}`;
}

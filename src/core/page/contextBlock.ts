import type { PageContext } from './types';

export const PAGE_TAG = 'pagina_web';
export const SELECTION_TAG = 'selecao_do_usuario';
export const SNAPSHOT_TAG = 'snapshot_dom';
export const TOOL_DATA_TAG = 'dados_da_pagina';

const TAGS = [PAGE_TAG, SELECTION_TAG, SNAPSHOT_TAG, TOOL_DATA_TAG].join('|');
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

/** Impede que o conteúdo da página feche/abra as tags delimitadoras. */
function sanitize(text: string): string {
  return text.replace(new RegExp(`<(/?)(${TAGS})`, 'gi'), `<${ZERO_WIDTH_SPACE}$1$2`);
}

const attr = (s: string) => sanitize(s).replace(/"/g, "'").replace(/\s+/g, ' ');

/**
 * Monta o conteúdo enviado ao modelo: pergunta do usuário + conteúdo da página dentro de
 * delimitadores. O prompt de sistema manda tratar esses blocos apenas como dados.
 */
export function buildUserContent(text: string, context?: PageContext): string {
  if (!context || (!context.text && !context.selection && !context.snapshot)) return text;
  const parts = [text];
  if (context.text) {
    parts.push(
      `<${PAGE_TAG} url="${attr(context.url)}" titulo="${attr(context.title)}">\n${sanitize(context.text)}\n</${PAGE_TAG}>`,
    );
  }
  if (context.selection) {
    parts.push(`<${SELECTION_TAG}>\n${sanitize(context.selection)}\n</${SELECTION_TAG}>`);
  }
  if (context.snapshot) {
    parts.push(
      `<${SNAPSHOT_TAG} url="${attr(context.url)}">\n${sanitize(context.snapshot)}\n</${SNAPSHOT_TAG}>`,
    );
  }
  return parts.join('\n\n');
}

/**
 * Embrulha dados lidos de uma página por uma ferramenta (texto, links, tabelas...) em
 * delimitadores. Tudo que vem de páginas é não confiável.
 */
export function wrapPageData(body: string, source: { url: string; title: string }): string {
  return `<${TOOL_DATA_TAG} url="${attr(source.url)}" titulo="${attr(source.title)}">
${sanitize(body)}
</${TOOL_DATA_TAG}>`;
}

import {
  captureAnnotated,
  capturePageContext,
  captureScreenshot,
  captureSnapshot,
  injectAndAsk,
  readableTab,
} from '../page/capture';
import { wrapPageData } from '../page/contextBlock';
import { readTabText, type TabText } from '../page/readTab';
import { describeTable, tableToCsv, tableToJson } from '../page/tables';
import {
  LINKS_MESSAGE,
  TABLES_MESSAGE,
  type LinksResponse,
  type TablesResponse,
} from '../page/types';
import {
  optionalBool,
  optionalInt,
  optionalString,
  optionalTabId,
  requiredTabId,
  ToolArgError,
} from './args';
import type { Tool, ToolContext, ToolResult } from './types';

/** tabId do argumento ou, sem ele, a aba padrão do contexto (no modo agente, a aba do agente). */
const tabOf = (args: Record<string, unknown>, ctx: ToolContext) =>
  optionalTabId(args) ?? ctx.defaultTabId;

/** Texto por aba nas ferramentas de leitura: menor que o do contexto manual para caber várias abas. */
export const TAB_TEXT_LIMIT = 20_000;
const MAX_LINKS = 200;
const MAX_TABLE_CHARS = 30_000;

const TAB_ID_PROP = {
  type: 'integer',
  description: 'Id da aba (de list_tabs). Se omitido, usa a aba ativa.',
};

function describeText(t: TabText): string {
  const notes: string[] = [];
  if (t.pdf) {
    const { pages, totalPages } = t.pdf;
    notes.push(`PDF, páginas ${pages[0]}-${pages.at(-1)} de ${totalPages}`);
    if (pages.length < totalPages) notes.push('use o argumento pages para ler outras páginas');
  }
  if (t.truncated) {
    notes.push(`texto truncado (${t.originalLength} caracteres no original)`);
    if (!t.pdf && t.omittedFrom !== undefined) {
      notes.push(`use offset=${t.omittedFrom} para continuar lendo a partir do trecho omitido`);
    }
  }
  return notes.length ? `[${notes.join('; ')}]\n` : '';
}

function textResult(t: TabText): ToolResult {
  const selection = t.selection ? `\nSeleção do usuário:\n${t.selection}\n` : '';
  const body = `${describeText(t)}${t.text}${selection}`;
  return { text: wrapPageData(body, t) };
}

const listTabs: Tool = {
  name: 'list_tabs',
  description:
    'Lista as abas abertas do navegador (id, título, URL, qual está ativa). Use antes de read_tab ' +
    'quando o pedido envolver outras abas ou comparar páginas.',
  jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
  risk: 'read',
  async execute() {
    const tabs = await chrome.tabs.query({});
    const lines = tabs
      .filter((t) => t.id !== undefined)
      .map(
        (t) =>
          `[${t.id}]${t.active ? ' (ativa)' : ''} ${t.title ?? ''} — ${t.url ?? '(URL oculta)'}`,
      );
    const body = lines.length ? lines.join('\n') : 'Nenhuma aba aberta.';
    return { text: wrapPageData(body, { url: '', title: 'abas abertas' }) };
  },
};

function pageTextTool(name: string, description: string, tabRequired: boolean): Tool {
  return {
    name,
    description,
    jsonSchema: {
      type: 'object',
      properties: {
        tabId: tabRequired
          ? { type: 'integer', description: 'Id da aba (de list_tabs).' }
          : TAB_ID_PROP,
        pages: {
          type: 'string',
          description:
            'Só para PDFs: páginas a ler, ex.: "1-5" ou "2,7-9". Padrão: as 30 primeiras.',
        },
        offset: {
          type: 'integer',
          description:
            'Só para páginas (não PDF): posição em caracteres de onde continuar a leitura. Use o ' +
            'valor indicado na nota "texto truncado" para ler o trecho que ficou de fora.',
        },
      },
      required: tabRequired ? ['tabId'] : [],
      additionalProperties: false,
    },
    risk: 'read',
    async execute(args, ctx) {
      const tabId = tabRequired ? requiredTabId(args) : tabOf(args, ctx);
      const text = await readTabText({
        tabId,
        pages: optionalString(args, 'pages'),
        offset: optionalInt(args, 'offset'),
        limit: TAB_TEXT_LIMIT,
      });
      return textResult(text);
    },
  };
}

const readTab = pageTextTool(
  'read_tab',
  'Lê o texto principal de uma aba pelo id, inclusive PDFs abertos no navegador. Para comparar ' +
    'páginas, chame uma vez por aba.',
  true,
);

const getPageText = pageTextTool(
  'get_page_text',
  'Lê o texto principal da aba ativa (ou da aba indicada), inclusive PDFs abertos no navegador.',
  false,
);

const getPageSnapshot: Tool = {
  name: 'get_page_snapshot',
  description:
    'Lista os elementos interativos visíveis da aba (links, botões, campos) com id numérico, papel, ' +
    'nome e estado. Os ids são os mesmos das caixas de take_screenshot com annotated=true.',
  jsonSchema: {
    type: 'object',
    properties: { tabId: TAB_ID_PROP },
    additionalProperties: false,
  },
  risk: 'read',
  async execute(args, ctx) {
    const page = await captureSnapshot(tabOf(args, ctx));
    return { text: wrapPageData(page.snapshot ?? '', page) };
  },
};

const takeScreenshot: Tool = {
  name: 'take_screenshot',
  description:
    'Tira um screenshot da parte visível de uma aba e o devolve como imagem. Com annotated=true, ' +
    'desenha caixas numeradas nos elementos interativos e devolve a lista deles. Se a aba não ' +
    'estiver ativa, ela é ativada por um instante.',
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: TAB_ID_PROP,
      annotated: { type: 'boolean', description: 'Desenhar as caixas numeradas (padrão: false).' },
    },
    additionalProperties: false,
  },
  risk: 'read',
  async execute(args, ctx) {
    const tabId = tabOf(args, ctx);
    if (optionalBool(args, 'annotated')) {
      const { image, context } = await captureAnnotated(tabId);
      return {
        text: `Screenshot anotado anexado (${image.width}×${image.height}).\n${wrapPageData(context.snapshot ?? '', context)}`,
        images: [image],
      };
    }
    const image = await captureScreenshot(tabId);
    return { text: `Screenshot anexado (${image.width}×${image.height}).`, images: [image] };
  },
};

const extractLinksTool: Tool = {
  name: 'extract_links',
  description: `Lista os links da página (texto e URL), até ${MAX_LINKS}. Use "contains" para filtrar por texto ou URL.`,
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: TAB_ID_PROP,
      contains: { type: 'string', description: 'Mantém só links cujo texto ou URL contém isto.' },
    },
    additionalProperties: false,
  },
  risk: 'read',
  async execute(args, ctx) {
    const tab = await readableTab(tabOf(args, ctx));
    const res = await injectAndAsk<LinksResponse>(tab, { type: LINKS_MESSAGE });
    if (!res.ok) throw new Error(res.error);
    const needle = optionalString(args, 'contains')?.toLowerCase();
    const all = needle
      ? res.data.links.filter(
          (l) => l.text.toLowerCase().includes(needle) || l.href.toLowerCase().includes(needle),
        )
      : res.data.links;
    const shown = all.slice(0, MAX_LINKS);
    const lines = shown.map((l) => `- ${l.text || '(sem texto)'} → ${l.href}`);
    const head = `${all.length} link(s)${all.length > shown.length ? `, mostrando ${shown.length}` : ''}.`;
    return { text: wrapPageData(`${head}\n${lines.join('\n')}`, res.data) };
  },
};

const extractTableTool: Tool = {
  name: 'extract_table',
  description:
    'Extrai tabelas HTML da página em CSV ou JSON. Sem "index", lista as tabelas encontradas ' +
    '(se houver só uma, já a devolve).',
  jsonSchema: {
    type: 'object',
    properties: {
      tabId: TAB_ID_PROP,
      index: { type: 'integer', description: 'Número da tabela (1 = primeira).' },
      format: { type: 'string', enum: ['csv', 'json'], description: 'Padrão: csv.' },
    },
    additionalProperties: false,
  },
  risk: 'read',
  async execute(args, ctx) {
    const tab = await readableTab(tabOf(args, ctx));
    const res = await injectAndAsk<TablesResponse>(tab, { type: TABLES_MESSAGE });
    if (!res.ok) throw new Error(res.error);
    const { tables } = res.data;
    if (tables.length === 0) return { text: 'Nenhuma tabela HTML encontrada nesta página.' };

    const index = optionalInt(args, 'index') ?? (tables.length === 1 ? 1 : undefined);
    if (index === undefined) {
      const list = tables.slice(0, 30).map(describeTable).join('\n');
      return {
        text: wrapPageData(`${tables.length} tabelas. Escolha uma com "index":\n${list}`, res.data),
      };
    }
    const table = tables.find((t) => t.index === index);
    if (!table) throw new ToolArgError(`Não existe a tabela ${index} (há ${tables.length}).`);

    const format = optionalString(args, 'format') ?? 'csv';
    if (format !== 'csv' && format !== 'json')
      throw new ToolArgError('format deve ser csv ou json.');
    let out = format === 'json' ? tableToJson(table) : tableToCsv(table);
    let note = '';
    if (out.length > MAX_TABLE_CHARS) {
      out = out.slice(0, MAX_TABLE_CHARS);
      note = `\n[saída truncada em ${MAX_TABLE_CHARS} caracteres; a tabela tem ${table.rows.length} linhas]`;
    }
    return { text: wrapPageData(`${out}${note}`, res.data) };
  },
};

const getSelection: Tool = {
  name: 'get_selection',
  description: 'Devolve o texto que o usuário selecionou na aba (ativa, por padrão).',
  jsonSchema: {
    type: 'object',
    properties: { tabId: TAB_ID_PROP },
    additionalProperties: false,
  },
  risk: 'read',
  async execute(args, ctx) {
    const page = await capturePageContext(tabOf(args, ctx));
    if (!page.selection) return { text: 'Não há texto selecionado nesta aba.' };
    return { text: wrapPageData(page.selection, page) };
  },
};

export const READ_TOOLS: Tool[] = [
  listTabs,
  readTab,
  getPageText,
  getPageSnapshot,
  takeScreenshot,
  extractLinksTool,
  extractTableTool,
  getSelection,
];

import { Readability } from '@mozilla/readability';
import { combineFrameTexts, type FrameText, walkFrames } from './frames';
import { continueTruncated, MAX_CONTEXT_CHARS, truncateSmart } from './truncate';
import type { PageContext } from './types';

/**
 * Abaixo deste tamanho o texto da página (já com o fallback do body) é considerado insuficiente:
 * aí vale a pena olhar dentro dos frames (ex.: sistemas em <frameset>, cujo documento principal
 * não tem corpo de texto). Páginas comuns, com bastante texto próprio, não entram nessa busca —
 * evita misturar texto de anúncios/widgets em iframes de páginas que já têm conteúdo suficiente.
 */
export const MIN_MAIN_TEXT = 200;

// `form` não entra aqui: em sistemas antigos (ex.: E-Fomento/CNPq, baseados em JSP/postback) a
// página inteira — tabelas, resultados, texto de verdade — costuma ficar dentro de um <form>, só
// por causa do postback; removê-lo apagava o próprio conteúdo que se queria ler.
const NOISE_SELECTOR =
  'script, style, noscript, template, nav, aside, footer, header, iframe, svg, ' +
  '[role="navigation"], [role="banner"], [role="complementary"], [aria-hidden="true"], ' +
  '[class*="advert"], [class*="cookie"], [id*="advert"], [id*="cookie"], [class*="sponsor"]';

export function cleanText(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Fallback quando o Readability não reconhece um artigo: texto do body sem navegação e anúncios. */
function fallbackText(doc: Document): string {
  const clone = doc.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(NOISE_SELECTOR).forEach((el) => el.remove());
  return cleanText(clone.textContent ?? '');
}

export function extractMainText(doc: Document): { title: string; text: string } {
  let article: ReturnType<Readability['parse']> | null;
  try {
    // Readability modifica o documento: trabalha em um clone. Usado só para o título: o
    // "artigo principal" que ele isola costuma descartar caixas curtas e estruturadas (tabelas,
    // cabeçalhos de identificação, campos de resultado) que também importam para o modelo.
    article = new Readability(doc.cloneNode(true) as Document).parse();
  } catch {
    article = null;
  }
  const text = fallbackText(doc) || cleanText(article?.textContent ?? '');
  return { title: article?.title || doc.title, text };
}

/** PDF embutido na página (visualizadores baseados em <embed>/<object>/<iframe>). */
export function findEmbeddedPdf(doc: Document): string | undefined {
  const el = doc.querySelector(
    'embed[type="application/pdf"], object[type="application/pdf"], embed[src*=".pdf" i], iframe[src*=".pdf" i]',
  );
  const src = el?.getAttribute('src') ?? el?.getAttribute('data');
  if (!src) return undefined;
  try {
    const url = new URL(src, doc.baseURI);
    return /^https?:|^file:/.test(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function extractPageContext(
  doc: Document,
  win: Window,
  blockedDomains: string[] = [],
  limit = MAX_CONTEXT_CHARS,
  offset = 0,
): PageContext {
  const main = extractMainText(doc);
  const parts: FrameText[] = main.text ? [{ url: '', title: main.title, text: main.text }] : [];
  let inaccessibleFrames = 0;
  // Texto do documento principal escasso: pode ser só a "casca" de um sistema baseado em frames.
  if (main.text.length < MIN_MAIN_TEXT) {
    const frames = walkFrames(doc, extractMainText, blockedDomains);
    parts.push(...frames.parts);
    inaccessibleFrames = frames.inaccessibleFrames;
  }

  let truncated = false;
  let originalLength = 0;
  let omittedFrom: number | undefined;
  let combinedParts: FrameText[] = [];
  if (parts.length) {
    // Só a maior parte (em geral o frame com o conteúdo de verdade) entra no truncamento/na
    // continuação por offset; as demais (cabeçalho, menu — em geral pequenas) entram inteiras,
    // sem disputar espaço com o início/fim dela. Truncar o texto já combinado faria o fim de uma
    // parte grande perder espaço pro começo da próxima (ou vice-versa), dependendo só da ordem em
    // que os frames aparecem no HTML, que não diz nada sobre qual conteúdo importa mais.
    const sorted = [...parts].sort((a, b) => b.text.length - a.text.length);
    const primary = sorted[0] as FrameText;
    const secondary = sorted.slice(1);
    const r =
      offset > 0
        ? continueTruncated(primary.text, offset, limit)
        : truncateSmart(primary.text, limit);
    truncated = r.truncated;
    originalLength = r.originalLength;
    omittedFrom = r.omittedFrom;
    // Numa continuação (offset > 0), as partes secundárias já foram enviadas na primeira leitura:
    // reenviá-las aqui só duplicaria texto no contexto do modelo.
    const secondaryCap = Math.max(1000, Math.floor(limit / 10));
    combinedParts =
      offset > 0
        ? [{ ...primary, text: r.text }]
        : [
            { ...primary, text: r.text },
            ...secondary.map((p) => ({ ...p, text: truncateSmart(p.text, secondaryCap).text })),
          ];
  }

  let text = combineFrameTexts(combinedParts);
  if (inaccessibleFrames) {
    text += `${text ? '\n\n' : ''}[${inaccessibleFrames} frame(s) de outra origem não puderam ser lidos.]`;
  }
  const selection = cleanText(win.getSelection()?.toString() ?? '');
  return {
    title: main.title,
    url: win.location.href,
    text,
    selection: selection || undefined,
    embeddedPdf: findEmbeddedPdf(doc),
    truncated,
    originalLength,
    omittedFrom,
  };
}

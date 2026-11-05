import { isDomainBlocked } from './blocklist';

/**
 * Páginas com frames/iframe como conteúdo real (ex.: sistemas em <frameset>): o documento
 * principal tem pouco ou nenhum texto, que mora dentro dos frames. `iframe.contentDocument` (e o
 * equivalente em `<frame>`) é acessível por uma frame de mesma origem independentemente das
 * permissões da extensão — é a política de mesma origem do navegador, igual ao que `snapshot.ts`
 * já faz para os elementos interativos. Frames de outra origem não podem ser lidos sem injetar um
 * script neles (que exigiria permissão de host para aquela origem); ficam só contados.
 */

const FRAME_SELECTOR = 'iframe, frame';
const MAX_FRAME_DEPTH = 6;

export interface FrameText {
  /** Vazio para o documento principal; URL do frame nos demais. */
  url: string;
  title: string;
  text: string;
}

export interface FrameWalkResult {
  parts: FrameText[];
  /** Frames de outra origem (ou inacessíveis por outro motivo) que não puderam ser lidos. */
  inaccessibleFrames: number;
}

type FrameHost = HTMLIFrameElement | HTMLFrameElement;

/** URL do frame: a do seu próprio `window.location` ou, sem isso, o `src` resolvido. */
function resolveFrameUrl(el: Element, win: Window): string {
  try {
    const href = win.location.href;
    if (href && href !== 'about:blank') return href;
  } catch {
    // Acesso negado (frame de outra origem); cai no fallback abaixo.
  }
  try {
    return new URL(el.getAttribute('src') ?? '', el.ownerDocument.baseURI).href;
  } catch {
    return el.getAttribute('src') ?? '';
  }
}

/** Extrai {title, text} de um documento; injetado para não criar dependência circular com extract.ts. */
export type FrameTextExtractor = (doc: Document) => { title: string; text: string };

function walk(
  doc: Document,
  blocked: string[],
  extractText: FrameTextExtractor,
  depth: number,
  acc: FrameWalkResult,
): void {
  if (depth > MAX_FRAME_DEPTH) return;
  for (const el of Array.from(doc.querySelectorAll(FRAME_SELECTOR))) {
    let inner: Document | null;
    try {
      inner = (el as FrameHost).contentDocument;
    } catch {
      inner = null; // frame de outra origem
    }
    const win = inner?.defaultView;
    if (!inner || !win) {
      acc.inaccessibleFrames++;
      continue;
    }
    const url = resolveFrameUrl(el, win);
    if (isDomainBlocked(url, blocked)) continue; // mesma lista de domínios sem captura, por frame
    const { title, text } = extractText(inner);
    if (text) acc.parts.push({ url, title, text });
    walk(inner, blocked, extractText, depth + 1, acc);
  }
}

/** Texto de cada frame acessível (mesma origem, fora da lista de bloqueio) de um documento. */
export function walkFrames(
  doc: Document,
  extractText: FrameTextExtractor,
  blockedDomains: string[] = [],
): FrameWalkResult {
  const acc: FrameWalkResult = { parts: [], inaccessibleFrames: 0 };
  walk(doc, blockedDomains, extractText, 0, acc);
  return acc;
}

/**
 * Junta o texto da página principal (sem rótulo) com o dos frames (rotulado com a URL de cada
 * um), em ordem. Frames sem texto já não chegam aqui (descartados em `walk`).
 */
export function combineFrameTexts(parts: FrameText[]): string {
  return parts
    .filter((p) => p.text.trim())
    .map((p) => (p.url ? `--- frame: ${p.url} ---\n${p.text}` : p.text))
    .join('\n\n');
}

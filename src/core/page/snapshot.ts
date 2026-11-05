import { fieldKindOf } from './fields';
import type { BBox, Snapshot, SnapshotItem } from './types';

export const MAX_SNAPSHOT_ITEMS = 300;

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'radio',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'combobox',
  'textbox',
  'searchbox',
  'slider',
  'spinbutton',
  'treeitem',
]);

const INPUT_ROLES: Record<string, string> = {
  button: 'button',
  submit: 'button',
  reset: 'button',
  image: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  range: 'slider',
  number: 'spinbutton',
  search: 'searchbox',
};

export interface BuiltSnapshot {
  snapshot: Snapshot;
  /** elements[i] é o elemento do item de id i+1 (usado pelo executor de ações, Fase 5). */
  elements: Element[];
}

/** Checagem por tag: `instanceof` falha para elementos de iframes (outro realm de construtores). */
const isTag = (el: Element, ...tags: string[]) => tags.includes(el.tagName.toLowerCase());

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Texto visível de um elemento, incluindo o alt de imagens internas. */
function textOf(el: Element): string {
  let out = el.textContent ?? '';
  el.querySelectorAll('img[alt]').forEach((img) => {
    out += ` ${img.getAttribute('alt') ?? ''}`;
  });
  return collapse(out);
}

function labelledBy(el: Element): string {
  const ids = el.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
  const root = el.getRootNode() as Document | ShadowRoot;
  return collapse(ids.map((id) => root.getElementById?.(id)?.textContent ?? '').join(' '));
}

export function accessibleName(el: Element): string {
  const byRef = labelledBy(el);
  if (byRef) return clip(byRef, 80);
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return clip(collapse(aria), 80);

  if (isTag(el, 'input', 'select', 'textarea')) {
    const field = el as HTMLInputElement;
    const label = field.labels?.length
      ? collapse(Array.from(field.labels).map(textOf).join(' '))
      : '';
    if (label) return clip(label, 80);
    if (isTag(el, 'input')) {
      if (['button', 'submit', 'reset'].includes(field.type) && field.value)
        return clip(field.value, 80);
      if (field.type === 'image' && field.alt) return clip(field.alt, 80);
    }
    if (field.placeholder) return clip(field.placeholder, 80);
  }
  const text = textOf(el);
  if (text) return clip(text, 80);
  return clip(collapse(el.getAttribute('title') ?? ''), 80);
}

export function roleOf(el: Element): string {
  const explicit = el.getAttribute('role')?.trim().split(/\s+/)[0];
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'button' || tag === 'summary') return 'button';
  if (tag === 'select') return 'combobox';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'input') return INPUT_ROLES[(el as HTMLInputElement).type] ?? 'textbox';
  return 'textbox'; // contenteditable
}

export function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return el.hasAttribute('href');
  if (tag === 'input') return (el as HTMLInputElement).type !== 'hidden';
  if (['button', 'select', 'textarea', 'summary'].includes(tag)) return true;
  const role = el.getAttribute('role')?.trim().split(/\s+/)[0];
  if (role && INTERACTIVE_ROLES.has(role)) return true;
  const ce = el.getAttribute('contenteditable');
  if (ce !== null && ce !== 'false') return true;
  if (el.hasAttribute('onclick')) return true;
  const tab = el.getAttribute('tabindex');
  return tab !== null && Number(tab) >= 0;
}

function stateOf(el: Element, doc: Document): string[] {
  const state: string[] = [];
  const input = el as HTMLInputElement;
  if (input.disabled || el.getAttribute('aria-disabled') === 'true') state.push('disabled');
  if (input.checked || el.getAttribute('aria-checked') === 'true') state.push('checked');
  if (el.getAttribute('aria-expanded') === 'true') state.push('expanded');
  if (el.getAttribute('aria-expanded') === 'false') state.push('collapsed');
  if (el.getAttribute('aria-pressed') === 'true') state.push('pressed');
  if (el.getAttribute('aria-selected') === 'true') state.push('selected');
  if (input.required || el.getAttribute('aria-required') === 'true') state.push('required');
  if (input.readOnly) state.push('readonly');
  if (doc.activeElement === el) state.push('focused');
  return state;
}

/** Valores de campos sensíveis (senha, cartão, códigos) nunca entram no snapshot. */
function isSensitiveField(el: Element): boolean {
  return isTag(el, 'input', 'textarea', 'select') && fieldKindOf(el) !== 'normal';
}

function describe(el: Element, doc: Document, bbox: BBox): SnapshotItem {
  const tag = el.tagName.toLowerCase();
  const name = accessibleName(el);
  const text = textOf(el);
  const item: SnapshotItem = {
    id: 0,
    tag,
    role: roleOf(el),
    name,
    state: stateOf(el, doc),
    bbox,
  };
  if (text && text !== name && !['input', 'select', 'textarea'].includes(tag))
    item.text = clip(text, 80);
  if (isTag(el, 'input')) item.type = (el as HTMLInputElement).type;
  if (isTag(el, 'a')) item.href = clip(el.getAttribute('href') ?? '', 120);

  if (isSensitiveField(el)) {
    item.state.push('sensitive');
  } else if (
    isTag(el, 'input') &&
    !['checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file'].includes(
      (el as HTMLInputElement).type,
    )
  ) {
    const v = (el as HTMLInputElement).value;
    if (v) item.value = clip(v, 60);
  } else if (isTag(el, 'textarea')) {
    const v = (el as HTMLTextAreaElement).value;
    if (v) item.value = clip(v, 60);
  } else if (isTag(el, 'select')) {
    const select = el as HTMLSelectElement;
    item.options = Array.from(select.options)
      .slice(0, 12)
      .map((o) => clip(collapse(o.text), 40));
    const sel = select.selectedOptions[0];
    if (sel) item.value = clip(collapse(sel.text), 40);
  }
  return item;
}

function isVisible(el: Element, win: Window, rect: DOMRect): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = win.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0')
    return false;
  const cv = (el as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  return cv ? cv.call(el, { checkVisibilityCSS: true }) : true;
}

interface Walk {
  found: { el: Element; bbox: BBox; doc: Document }[];
  offscreen: number;
  inaccessibleFrames: number;
}

function walk(
  root: Document | ShadowRoot,
  offset: { x: number; y: number },
  vw: number,
  vh: number,
  acc: Walk,
  depth = 0,
): void {
  const doc = (root.nodeType === 9 ? root : root.ownerDocument) as Document;
  const win = doc.defaultView;
  if (!win || depth > 6) return;

  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.shadowRoot) walk(el.shadowRoot, offset, vw, vh, acc, depth + 1);

    if (isTag(el, 'iframe', 'frame')) {
      let inner: Document | null;
      try {
        inner = (el as HTMLIFrameElement).contentDocument;
      } catch {
        inner = null; // iframe de outra origem
      }
      if (inner) {
        const r = el.getBoundingClientRect();
        walk(inner, { x: offset.x + r.left, y: offset.y + r.top }, vw, vh, acc, depth + 1);
      } else {
        acc.inaccessibleFrames++;
      }
      continue;
    }

    if (!isInteractive(el)) continue;
    const r = el.getBoundingClientRect();
    if (!isVisible(el, win, r)) continue;
    const bbox: BBox = {
      x: Math.round(offset.x + r.left),
      y: Math.round(offset.y + r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
    const inView = bbox.x < vw && bbox.y < vh && bbox.x + bbox.w > 0 && bbox.y + bbox.h > 0;
    if (inView) acc.found.push({ el, bbox, doc });
    else acc.offscreen++;
  }
}

/**
 * Constrói a lista de elementos interativos visíveis na viewport (atravessa shadow DOM aberto e
 * iframes de mesma origem). Os ids são sequenciais na ordem do documento.
 */
export function buildSnapshot(doc: Document, win: Window): BuiltSnapshot {
  const vw = win.innerWidth;
  const vh = win.innerHeight;
  const acc: Walk = { found: [], offscreen: 0, inaccessibleFrames: 0 };
  walk(doc, { x: 0, y: 0 }, vw, vh, acc);

  const truncated = acc.found.length > MAX_SNAPSHOT_ITEMS;
  const kept = acc.found.slice(0, MAX_SNAPSHOT_ITEMS);
  const items = kept.map(({ el, bbox, doc: d }, i) => ({ ...describe(el, d, bbox), id: i + 1 }));
  return {
    snapshot: {
      url: win.location.href,
      title: doc.title,
      viewport: { width: vw, height: vh, dpr: win.devicePixelRatio || 1 },
      items,
      offscreenCount: acc.offscreen + Math.max(0, acc.found.length - kept.length),
      inaccessibleFrames: acc.inaccessibleFrames,
      truncated,
    },
    elements: kept.map((k) => k.el),
  };
}

/** Formato compacto para o modelo, uma linha por elemento: `[id] role "nome" ... (x,y wxh)`. */
export function formatSnapshot(s: Snapshot): string {
  const lines = s.items.map((it) => {
    const parts = [`[${it.id}] ${it.role}`];
    if (it.name) parts.push(`"${it.name}"`);
    if (it.text) parts.push(`texto="${it.text}"`);
    if (it.type && !['text', 'button', 'submit'].includes(it.type)) parts.push(`tipo=${it.type}`);
    if (it.href) parts.push(`href=${it.href}`);
    if (it.value) parts.push(`valor="${it.value}"`);
    if (it.options?.length) parts.push(`opções=[${it.options.join(' | ')}]`);
    if (it.state.length) parts.push(`(${it.state.join(', ')})`);
    parts.push(`@${it.bbox.x},${it.bbox.y} ${it.bbox.w}x${it.bbox.h}`);
    return parts.join(' ');
  });
  const head = `Viewport ${s.viewport.width}x${s.viewport.height} (pixels CSS). ${s.items.length} elementos interativos visíveis.`;
  const notes: string[] = [];
  if (s.offscreenCount)
    notes.push(
      `${s.offscreenCount} elementos fora da viewport não listados (role a página para vê-los).`,
    );
  if (s.inaccessibleFrames)
    notes.push(`${s.inaccessibleFrames} iframe(s) de outra origem não puderam ser lidos.`);
  if (s.truncated) notes.push(`Lista cortada em ${MAX_SNAPSHOT_ITEMS} elementos.`);
  return [head, ...lines, ...notes].join('\n');
}

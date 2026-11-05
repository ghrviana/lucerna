import { defaultSubmitButton } from './elementInfo';
import { fieldKindOf, isContentEditable, isEditable } from './fields';
import { accessibleName, roleOf } from './snapshot';
import type { ActRequest, ActResponse, FieldKind } from './types';

/** Executor de ações do modo agente, no script injetado. Eventos sintéticos (isTrusted = false). */

export class ActionError extends Error {}

const isTag = (el: Element, ...tags: string[]) => tags.includes(el.tagName.toLowerCase());

const KIND_LABEL: Record<Exclude<FieldKind, 'normal'>, string> = {
  password: 'senha',
  otp: 'código de verificação (2FA)',
  card: 'cartão',
};

type Win = Window & typeof globalThis;
const viewOf = (el: Element): Win => (el.ownerDocument.defaultView ?? window) as Win;
const label = (el: Element) => `${roleOf(el)} "${accessibleName(el)}"`;

function resolve(elements: Element[] | undefined, id: number): Element {
  if (!elements) {
    throw new ActionError(
      'Não há snapshot desta página (ela pode ter recarregado). Chame get_page_snapshot e use os ids novos.',
    );
  }
  const el = elements[id - 1];
  if (!el) throw new ActionError(`Não existe o elemento [${id}] no último snapshot.`);
  if (!el.isConnected) {
    throw new ActionError(
      `O elemento [${id}] não está mais na página. Chame get_page_snapshot e use os ids novos.`,
    );
  }
  return el;
}

function ensureEnabled(el: Element, id: number): void {
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true')
    throw new ActionError(`O elemento [${id}] está desabilitado.`);
}

/** Defesa em profundidade: vale mesmo que a política do painel falhe. */
function refuseSensitive(el: Element, id: number): void {
  const kind = fieldKindOf(el);
  if (kind !== 'normal') {
    throw new ActionError(
      `O campo [${id}] é de ${KIND_LABEL[kind]}. A Lucerna nunca preenche esse tipo de campo: peça ao usuário para fazer esta etapa.`,
    );
  }
}

function focus(el: Element): void {
  (el as HTMLElement).focus?.({ preventScroll: true });
}

function center(el: Element): { x: number; y: number } {
  (el as HTMLElement).scrollIntoView?.({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function coveredNote(el: Element, x: number, y: number): string {
  const root = el.getRootNode() as Document | ShadowRoot;
  if (typeof root.elementFromPoint !== 'function') return '';
  const top = root.elementFromPoint(x, y);
  if (!top || top === el || el.contains(top) || top.contains(el)) return '';
  return ` Atenção: o centro do elemento parecia coberto por ${label(top)}; verifique o resultado.`;
}

function click(el: Element): string {
  const win = viewOf(el);
  const { x, y } = center(el);
  const note = coveredNote(el, x, y);
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    button: 0,
  };
  const pointer = typeof win.PointerEvent === 'function';
  const ptr = { ...opts, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  if (pointer) el.dispatchEvent(new win.PointerEvent('pointerdown', ptr));
  el.dispatchEvent(new win.MouseEvent('mousedown', { ...opts, buttons: 1 }));
  focus(el);
  if (pointer) el.dispatchEvent(new win.PointerEvent('pointerup', ptr));
  el.dispatchEvent(new win.MouseEvent('mouseup', opts));
  // click() executa a ação padrão (seguir link, enviar formulário, marcar caixa).
  if (typeof (el as HTMLElement).click === 'function') (el as HTMLElement).click();
  else el.dispatchEvent(new win.MouseEvent('click', opts));
  return `Clique enviado em ${label(el)}.${note}`;
}

/** Setter de `value` do protótipo: o React observa o setter da instância e ignoraria a mudança. */
function nativeValueSetter(el: Element): ((v: string) => void) | undefined {
  for (let p = Object.getPrototypeOf(el) as object | null; p; p = Object.getPrototypeOf(p)) {
    const set = Object.getOwnPropertyDescriptor(p, 'value')?.set;
    if (set) return (v: string) => set.call(el, v);
  }
  return undefined;
}

function fireInput(el: Element, data: string | null): void {
  const win = viewOf(el);
  const init = { bubbles: true, composed: true, inputType: 'insertText', data };
  el.dispatchEvent(
    typeof win.InputEvent === 'function'
      ? new win.InputEvent('input', init)
      : new win.Event('input', init),
  );
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const set = nativeValueSetter(el);
  if (set) set(value);
  else el.value = value;
  fireInput(el, value);
  el.dispatchEvent(new (viewOf(el).Event)('change', { bubbles: true }));
}

function selectContents(el: Element): void {
  const doc = el.ownerDocument;
  const sel = doc.getSelection();
  if (!sel) return;
  const range = doc.createRange();
  range.selectNodeContents(el);
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertIntoEditable(el: Element, text: string): void {
  focus(el);
  selectContents(el);
  let ok: boolean;
  try {
    // execCommand gera os eventos de edição que editores ricos esperam.
    ok = el.ownerDocument.execCommand?.('insertText', false, text) ?? false;
  } catch {
    ok = false;
  }
  if (!ok) {
    el.textContent = text;
    fireInput(el, text);
  }
}

// --- Teclas ---

/** key → [code, keyCode]. */
const NAMED_KEYS: Record<string, [string, number]> = {
  Enter: ['Enter', 13],
  Tab: ['Tab', 9],
  Escape: ['Escape', 27],
  Backspace: ['Backspace', 8],
  Delete: ['Delete', 46],
  ArrowUp: ['ArrowUp', 38],
  ArrowDown: ['ArrowDown', 40],
  ArrowLeft: ['ArrowLeft', 37],
  ArrowRight: ['ArrowRight', 39],
  Home: ['Home', 36],
  End: ['End', 35],
  PageUp: ['PageUp', 33],
  PageDown: ['PageDown', 34],
  ' ': ['Space', 32],
};

const KEY_ALIASES: Record<string, string> = {
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  esc: 'Escape',
  escape: 'Escape',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  up: 'ArrowUp',
  arrowup: 'ArrowUp',
  down: 'ArrowDown',
  arrowdown: 'ArrowDown',
  left: 'ArrowLeft',
  arrowleft: 'ArrowLeft',
  right: 'ArrowRight',
  arrowright: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  space: ' ',
  spacebar: ' ',
};

export interface KeySpec {
  key: string;
  code: string;
  keyCode: number;
  shift: boolean;
}

/** Interpreta "Enter", "esc", "Shift+Tab", "a"... Lança para teclas não suportadas. */
export function parseKey(raw: string): KeySpec {
  let rest = raw.trim();
  let shift = false;
  const m = /^shift\s*\+\s*(.+)$/i.exec(rest);
  if (m?.[1]) {
    shift = true;
    rest = m[1].trim();
  }
  const named = KEY_ALIASES[rest.toLowerCase()] ?? (NAMED_KEYS[rest] ? rest : undefined);
  if (named !== undefined) {
    const [code, keyCode] = NAMED_KEYS[named] as [string, number];
    return { key: named, code, keyCode, shift };
  }
  if ([...rest].length === 1) {
    const upper = rest.toUpperCase();
    const code = /[A-Z]/.test(upper) ? `Key${upper}` : /\d/.test(rest) ? `Digit${rest}` : '';
    return { key: shift ? upper : rest, code, keyCode: upper.charCodeAt(0), shift };
  }
  throw new ActionError(
    `Tecla não suportada: "${raw}". Use Enter, Tab, Shift+Tab, Escape, Backspace, Delete, setas, Home, End, PageUp, PageDown, Space ou um caractere.`,
  );
}

/** Dispara keydown/keypress/keyup. Devolve false se a página cancelou o keydown. */
function dispatchKey(el: Element, k: KeySpec): boolean {
  const win = viewOf(el);
  const init: KeyboardEventInit = {
    key: k.key,
    code: k.code,
    keyCode: k.keyCode,
    which: k.keyCode,
    shiftKey: k.shift,
    bubbles: true,
    cancelable: true,
    composed: true,
  };
  const proceed = el.dispatchEvent(new win.KeyboardEvent('keydown', init));
  if (proceed && (k.key === 'Enter' || k.key.length === 1))
    el.dispatchEvent(new win.KeyboardEvent('keypress', init));
  el.dispatchEvent(new win.KeyboardEvent('keyup', init));
  return proceed;
}

/** Enter: eventos de tecla e, se a página não tratou, a ação padrão (envio do formulário). */
function pressEnter(el: Element): string {
  if (!dispatchKey(el, parseKey('Enter'))) return 'Enter enviado (a página tratou a tecla).';
  if (isTag(el, 'textarea') || isContentEditable(el)) return 'Enter enviado.';
  if (isTag(el, 'button', 'a', 'summary')) {
    (el as HTMLElement).click();
    return `Enter acionou ${label(el)}.`;
  }
  const form = (el as HTMLInputElement).form;
  if (!form) return 'Enter enviado (o campo não está em um formulário).';
  const button = defaultSubmitButton(form);
  if ((button as HTMLButtonElement | null)?.disabled)
    return 'Enter enviado, mas o botão de envio do formulário está desabilitado.';
  if (typeof form.requestSubmit === 'function') form.requestSubmit(button ?? undefined);
  else if (button) button.click();
  else form.submit();
  return 'Enter enviado; formulário submetido.';
}

export function deepActiveElement(doc: Document): Element | null {
  let el: Element | null = doc.activeElement;
  for (let i = 0; i < 10 && el; i++) {
    const inner =
      el.shadowRoot?.activeElement ??
      (isTag(el, 'iframe') ? (el as HTMLIFrameElement).contentDocument?.activeElement : null);
    if (!inner || inner === el) break;
    el = inner;
  }
  return el;
}

const FOCUSABLE =
  'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

function moveFocus(from: Element, backwards: boolean): Element | undefined {
  const doc = from.ownerDocument;
  const all = Array.from(doc.querySelectorAll(FOCUSABLE)).filter(
    (e) => !(e as HTMLButtonElement).disabled,
  );
  if (all.length === 0) return undefined;
  const i = all.indexOf(from);
  const next = backwards ? all[(i <= 0 ? all.length : i) - 1] : all[(i + 1) % all.length];
  if (next) focus(next);
  return next;
}

function pressKey(
  req: { key: string; id?: number },
  elements: Element[] | undefined,
  doc: Document,
) {
  const k = parseKey(req.key);
  const target = req.id ? resolve(elements, req.id) : (deepActiveElement(doc) ?? doc.body);
  if (req.id) focus(target);
  if (k.key === 'Enter') return pressEnter(target);
  if (!dispatchKey(target, k)) return `Tecla ${k.key} enviada (a página tratou a tecla).`;
  if (k.key === 'Tab') {
    const next = moveFocus(target, k.shift);
    return next ? `Foco movido para ${label(next)}.` : 'Tab enviado (nada focável).';
  }
  const win = viewOf(target);
  if (!isEditable(target) && ['PageDown', 'PageUp', ' ', 'Home', 'End'].includes(k.key)) {
    const h = win.innerHeight * 0.8;
    if (k.key === 'Home') win.scrollTo({ top: 0 });
    else if (k.key === 'End') win.scrollTo({ top: doc.documentElement.scrollHeight });
    else win.scrollBy({ top: k.key === 'PageUp' ? -h : h });
  }
  return `Tecla ${k.key === ' ' ? 'Space' : k.key} enviada (evento sintético; alguns sites o ignoram).`;
}

// --- Seleção e rolagem ---

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

function selectOption(el: Element, id: number, option: string): string {
  if (!isTag(el, 'select')) {
    throw new ActionError(
      `O elemento [${id}] não é um <select>. Em listas personalizadas, clique para abrir e depois clique na opção.`,
    );
  }
  refuseSensitive(el, id);
  const select = el as HTMLSelectElement;
  const options = Array.from(select.options);
  const want = norm(option);
  const found =
    options.find((o) => o.value === option) ??
    options.find((o) => norm(o.text) === want) ??
    options.find((o) => want && norm(o.text).includes(want));
  if (!found) {
    const list = options
      .slice(0, 20)
      .map((o) => o.text.trim())
      .join(' | ');
    throw new ActionError(`Opção "${option}" não encontrada em [${id}]. Opções: ${list}`);
  }
  if (found.disabled) throw new ActionError(`A opção "${found.text.trim()}" está desabilitada.`);
  if (select.multiple) found.selected = true;
  else (nativeValueSetter(select) ?? ((v: string) => (select.value = v)))(found.value);
  fireInput(select, null);
  select.dispatchEvent(new (viewOf(select).Event)('change', { bubbles: true }));
  return `Selecionado "${found.text.trim()}" em ${label(el)}.`;
}

function scrollableAncestor(el: Element): Element | null {
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) {
      const o = viewOf(e).getComputedStyle(e);
      if (/(auto|scroll)/.test(`${o.overflowY} ${o.overflowX}`)) return e;
    }
  }
  return null;
}

function scroll(
  req: Extract<ActRequest, { action: 'scroll' }>,
  elements: Element[] | undefined,
  doc: Document,
): string {
  const el = req.id ? resolve(elements, req.id) : undefined;
  if (el && !req.direction) {
    center(el);
    return `Rolado até ${label(el)}.`;
  }
  const win = doc.defaultView as Win;
  const dir = req.direction ?? 'down';
  const amount = Math.min(10, Math.max(0.1, req.amount ?? 0.8));
  const box = el ? scrollableAncestor(el) : null;
  const w = (box ? box.clientWidth : win.innerWidth) * amount;
  const h = (box ? box.clientHeight : win.innerHeight) * amount;
  const delta = {
    left: dir === 'left' ? -w : dir === 'right' ? w : 0,
    top: dir === 'up' ? -h : dir === 'down' ? h : 0,
  };
  (box ?? win).scrollBy(delta);
  if (box) return `Rolado ${dir} dentro de ${label(box)}.`;
  const max = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
  const y = Math.round(win.scrollY);
  const edge = y <= 0 ? ' (topo da página)' : y >= max - 2 ? ' (fim da página)' : '';
  return `Página rolada para ${dir}. Posição vertical ${y} de ${max}${edge}.`;
}

function typeText(el: Element, id: number, text: string, submit: boolean): string {
  refuseSensitive(el, id);
  if (!isEditable(el)) {
    throw new ActionError(
      `O elemento [${id}] (${label(el)}) não é um campo de texto. Para caixas de marcar use click; para <select>, select_option.`,
    );
  }
  ensureEnabled(el, id);
  if ((el as HTMLInputElement).readOnly)
    throw new ActionError(`O campo [${id}] é somente leitura.`);
  center(el);
  focus(el);
  if (isTag(el, 'input', 'textarea')) setValue(el as HTMLInputElement, text);
  else insertIntoEditable(el, text);
  const done = `Texto digitado em ${label(el)}.`;
  return submit ? `${done} ${pressEnter(el)}` : done;
}

/** Executa uma ação sobre os elementos do último snapshot. Nunca lança: erros viram resposta. */
export function performAction(
  req: ActRequest,
  elements: Element[] | undefined,
  doc: Document,
): ActResponse {
  try {
    switch (req.action) {
      case 'click': {
        const el = resolve(elements, req.id);
        ensureEnabled(el, req.id);
        return { ok: true, message: click(el) };
      }
      case 'type':
        return {
          ok: true,
          message: typeText(resolve(elements, req.id), req.id, req.text, !!req.submit),
        };
      case 'press_key':
        return { ok: true, message: pressKey(req, elements, doc) };
      case 'select_option':
        return { ok: true, message: selectOption(resolve(elements, req.id), req.id, req.option) };
      case 'scroll':
        return { ok: true, message: scroll(req, elements, doc) };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: err instanceof ActionError ? msg : `Falha ao executar a ação: ${msg}`,
    };
  }
}

/** Espera o DOM ficar sem mutações por `quietMs` (no máximo `maxMs`). */
export function waitForQuiet(doc: Document, quietMs = 300, maxMs = 2000): Promise<void> {
  return new Promise((done) => {
    const win = doc.defaultView;
    if (!win || typeof win.MutationObserver !== 'function') return done();
    let quiet: ReturnType<typeof setTimeout>;
    const finish = () => {
      observer.disconnect();
      clearTimeout(quiet);
      clearTimeout(hard);
      done();
    };
    const observer = new win.MutationObserver(() => {
      clearTimeout(quiet);
      quiet = setTimeout(finish, quietMs);
    });
    quiet = setTimeout(finish, quietMs);
    const hard = setTimeout(finish, maxMs);
    observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
}

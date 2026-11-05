import { fieldKindOf, isContentEditable, isEditable } from './fields';
import { accessibleName, roleOf } from './snapshot';
import type { ElementInfo } from './types';

/** Checagem por tag: `instanceof` falha para elementos de iframes (outro realm de construtores). */
const isTag = (el: Element, ...tags: string[]) => tags.includes(el.tagName.toLowerCase());

function formOf(el: Element): HTMLFormElement | null {
  return (el as HTMLInputElement).form ?? (el.closest('form') as HTMLFormElement | null);
}

/** Botão que envia o formulário ao ser clicado. */
export function isSubmitControl(el: Element): boolean {
  if (!formOf(el)) return false;
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  if (isTag(el, 'button')) return type === '' || type === 'submit';
  if (isTag(el, 'input')) return type === 'submit' || type === 'image';
  return false;
}

/** Primeiro botão de envio do formulário (o que o Enter aciona). */
export function defaultSubmitButton(form: HTMLFormElement): HTMLElement | null {
  return (Array.from(form.elements).find(isSubmitControl) as HTMLElement | undefined) ?? null;
}

const SEARCH_NAMES = /^(q|query|s|search|busca|pesquisa|k|keywords?|term|search_query|text)$/i;

function isSearchField(el: Element, form: HTMLFormElement | null): boolean {
  if ((el.getAttribute('type') ?? '').toLowerCase() === 'search') return true;
  if (el.getAttribute('role') === 'searchbox') return true;
  if (el.closest('[role="search"], search')) return true;
  if (SEARCH_NAMES.test(el.getAttribute('name') ?? '')) return true;
  return !!form && /(search|busca|pesquisa)/i.test(form.getAttribute('action') ?? '');
}

/** Método efetivo do envio (o atributo formmethod do botão tem precedência). */
function methodOf(el: Element, form: HTMLFormElement): string {
  const override = isSubmitControl(el) ? el.getAttribute('formmethod') : null;
  return (override ?? form.getAttribute('method') ?? 'get').toLowerCase();
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

export function describeElement(el: Element, id: number): ElementInfo {
  const form = formOf(el);
  const info: ElementInfo = {
    id,
    tag: el.tagName.toLowerCase(),
    role: roleOf(el),
    name: accessibleName(el),
    editable: isEditable(el),
    contentEditable: isContentEditable(el),
    fieldKind: fieldKindOf(el),
    isSubmit: isSubmitControl(el),
    isSearch: isSearchField(el, form),
    disabled:
      (el as HTMLButtonElement).disabled === true || el.getAttribute('aria-disabled') === 'true',
  };
  const text = clip(el.textContent ?? '', 80);
  if (text && text !== info.name) info.text = text;
  if (isTag(el, 'input', 'button')) info.type = (el.getAttribute('type') ?? '').toLowerCase();
  if (isTag(el, 'a') && el.hasAttribute('href')) info.href = (el as HTMLAnchorElement).href;
  if (form) {
    const submit = defaultSubmitButton(form);
    info.form = {
      method: methodOf(el, form),
      action: form.action,
      hasPassword: !!form.querySelector('input[type="password" i]'),
      submitLabel: submit ? accessibleName(submit) : undefined,
    };
  }
  return info;
}

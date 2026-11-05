import type { FieldKind } from './types';

/** Checagem por tag: `instanceof` falha para elementos de iframes (outro realm de construtores). */
const isTag = (el: Element, ...tags: string[]) => tags.includes(el.tagName.toLowerCase());

/** "user_password", "cardNumber" → "user password", "card number" (para casar palavras inteiras). */
export function normalizeHint(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[_\-.[\]:]+/g, ' ')
    .toLowerCase();
}

const PASSWORD_HINT = /\b(senha|password|passwd|passcode|pwd|contrasena)\b/;
const OTP_HINT =
  /\b(otp|2fa|mfa|totp|one time|codigo de (verificacao|acesso|autenticacao)|verification code|auth(entication)? code|token)\b/;
const CARD_HINT =
  /\b(cvv2?|cvc|card number|cardnumber|cc number|ccnumber|numero do cartao|cartao de credito|credit card|security code|codigo de seguranca|validade do cartao|card expiry|expiry date|exp date)\b/;

/** Textos que descrevem o campo: nome, id, autocomplete, aria-label, placeholder e rótulos. */
function fieldHints(el: Element): string {
  const attrs = ['name', 'id', 'autocomplete', 'aria-label', 'placeholder', 'title'];
  const parts = attrs.map((a) => el.getAttribute(a) ?? '');
  const labels = (el as HTMLInputElement).labels;
  if (labels) parts.push(...Array.from(labels).map((l) => l.textContent ?? ''));
  return normalizeHint(parts.join(' '));
}

/** Classifica campos de senha, códigos (2FA/OTP) e cartão. Os demais são "normal". */
export function fieldKindOf(el: Element): FieldKind {
  if (!isTag(el, 'input', 'textarea', 'select') && !el.hasAttribute('contenteditable'))
    return 'normal';
  const type = (el.getAttribute('type') ?? '').toLowerCase();
  const ac = (el.getAttribute('autocomplete') ?? '').toLowerCase();
  if (type === 'password' || /\b(current|new)-password\b/.test(ac)) return 'password';
  if (ac.includes('one-time-code')) return 'otp';
  if (/\bcc-/.test(ac)) return 'card';
  const hints = fieldHints(el);
  if (PASSWORD_HINT.test(hints)) return 'password';
  if (CARD_HINT.test(hints)) return 'card';
  if (OTP_HINT.test(hints)) return 'otp';
  return 'normal';
}

const TEXT_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

export function isContentEditable(el: Element): boolean {
  const ce = el.getAttribute('contenteditable');
  return (ce !== null && ce !== 'false') || (el as HTMLElement).isContentEditable === true;
}

/** Campo em que dá para digitar texto. */
export function isEditable(el: Element): boolean {
  if (isTag(el, 'textarea')) return true;
  if (isTag(el, 'input'))
    return TEXT_INPUT_TYPES.has((el.getAttribute('type') ?? '').toLowerCase());
  return isContentEditable(el);
}

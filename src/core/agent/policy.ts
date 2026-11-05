import { normalizeDomain } from '../page/blocklist';
import type { ActionIntent } from '../tools/types';

/**
 * Política de segurança do modo agente: avalia cada ação ANTES de executá-la. Função pura; não
 * depende de o modelo obedecer ao prompt. Ver docs/agent-safety.md.
 */

export interface PolicySession {
  /** Host da aba em que a tarefa começou. */
  startDomain: string;
  /** Texto digitado pelo usuário nesta conversa (nunca conteúdo de páginas). */
  requestText: string;
  planApproved: boolean;
  /** Sites do plano aprovado + domínios liberados pelo usuário durante a tarefa. */
  scopeDomains: string[];
  /** Trecho de texto de injeção visto numa página (sessão suspeita). */
  tainted?: string;
}

export interface PolicySettings {
  agentAllowedDomains: string[];
  agentBlockedDomains: string[];
  blockedDomains: string[];
  sensitiveDomains: string[];
}

export type Decision = 'allow' | 'confirm' | 'deny';

export interface Verdict {
  decision: Decision;
  reasons: string[];
  /** Compra, envio, exclusão, login, site financeiro: sempre confirmada, sem atalho. */
  sensitive: boolean;
  /** Domínio em que o agente precisa ser habilitado para esta ação. */
  enableDomain?: string;
}

const PAGE_ACTIONS = new Set(['click', 'type', 'press_key', 'select_option', 'scroll', 'go_back']);

export function hostOf(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isHttpUrl(url: string | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url) && hostOf(url) !== '';
}

/** O host é um dos domínios da lista ou subdomínio deles. */
export function matchesDomain(host: string, domains: string[]): boolean {
  return !!host && domains.some((d) => d && (host === d || host.endsWith(`.${d}`)));
}

const SECOND_LEVEL = new Set(['com', 'net', 'org', 'gov', 'edu', 'co', 'ac', 'mil', 'nom', 'ind']);

/** "pt.m.wikipedia.org" → "wikipedia.org"; "www.loja.com.br" → "loja.com.br". */
export function baseDomain(host: string): string {
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':')) return host;
  const labels = host.split('.');
  const tld = labels.at(-1) ?? '';
  const second = labels.at(-2) ?? '';
  const n = labels.length >= 3 && tld.length === 2 && SECOND_LEVEL.has(second) ? 3 : 2;
  return labels.slice(-n).join('.');
}

/** Domínios citados num texto ("pesquise na wikipedia.org", "ana@x.com"). */
export function domainsInText(text: string): string[] {
  const found: string[] = [
    ...(text.toLowerCase().match(/\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/g) ?? []),
  ];
  if (/\blocalhost\b/i.test(text)) found.push('localhost');
  return Array.from(new Set(found));
}

/** Domínios que o pedido do usuário cobre (início da tarefa, plano aprovado e citados no pedido). */
export function scopeOf(session: PolicySession): string[] {
  return Array.from(
    new Set(
      [session.startDomain, ...session.scopeDomains, ...domainsInText(session.requestText)]
        .map(normalizeDomain)
        .filter(Boolean)
        .map(baseDomain),
    ),
  );
}

export function inScope(host: string, scope: string[]): boolean {
  return scope.includes(baseDomain(host));
}

// --- Dados sensíveis ---

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Sequência de 13 a 19 dígitos (com espaços/hífens) que passa no Luhn: parece cartão. */
export function containsCardNumber(text: string): boolean {
  const runs = text.match(/\d(?:[ -]?\d){12,18}/g) ?? [];
  return runs.some((r) => {
    const digits = r.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19 && luhn(digits);
  });
}

/**
 * Dados no texto a digitar que não aparecem no pedido do usuário: e-mails, URLs/domínios e números
 * longos. É o padrão típico de exfiltração induzida por uma página.
 */
export function foreignData(text: string, request: string): string[] {
  const req = request.toLowerCase();
  const reqDigits = (request.match(/\d[\d\s().+-]*\d/g) ?? []).map((r) => r.replace(/\D/g, ''));
  const out: string[] = [];
  const emails = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
  const urls = text.match(/\bhttps?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const token of [...emails, ...urls]) {
    if (!req.includes(token.toLowerCase())) out.push(token);
  }
  const withoutEmails = emails.reduce((t, e) => t.replace(e, ' '), text);
  for (const domain of domainsInText(withoutEmails.replace(/\bhttps?:\/\/[^\s"'<>]+/gi, ' '))) {
    if (domain.includes('.') && /[a-z]{2,}$/.test(domain) && !req.includes(domain)) {
      // Só conta como domínio se tiver cara de endereço (evita "Sr.Silva", "obs.Fim").
      if (/\.(com|net|org|br|io|info|xyz|me|co|app|dev|site|online|ru|cn)\b/.test(domain))
        out.push(domain);
    }
  }
  for (const run of text.match(/\d[\d\s().+-]*\d/g) ?? []) {
    const digits = run.replace(/\D/g, '');
    if (digits.length >= 6 && !reqDigits.some((r) => r.includes(digits))) out.push(run.trim());
  }
  return Array.from(new Set(out)).slice(0, 5);
}

// --- Ações sensíveis ---

/** Sites financeiros conhecidos (e subdomínios). Lista do usuário em sensitiveDomains. */
export const FINANCIAL_DOMAINS = [
  'paypal.com',
  'stripe.com',
  'pagseguro.uol.com.br',
  'pagbank.com.br',
  'mercadopago.com',
  'mercadopago.com.br',
  'picpay.com',
  'nubank.com.br',
  'bancointer.com.br',
  'inter.co',
  'itau.com.br',
  'bradesco.com.br',
  'santander.com.br',
  'caixa.gov.br',
  'bb.com.br',
  'c6bank.com.br',
  'btgpactual.com',
  'xpi.com.br',
  'sicredi.com.br',
  'sicoob.com.br',
  'banrisul.com.br',
  'bancopan.com.br',
  'safra.com.br',
  'binance.com',
  'coinbase.com',
  'kraken.com',
  'wise.com',
  'revolut.com',
  'chase.com',
  'wellsfargo.com',
  'bankofamerica.com',
  'citi.com',
  'hsbc.com',
  'capitalone.com',
  'americanexpress.com',
];

const FINANCIAL_HOST = /(^|[.-])(bank|banco|banking|internetbanking|ibanking)([.-]|$)/;
const PAYMENT_PATH = /\/(checkout|payment|payments|pagamento|pagamentos|billing|pay)(\/|$)/i;

export function isFinancialHost(host: string, extra: string[] = []): boolean {
  return matchesDomain(host, [...FINANCIAL_DOMAINS, ...extra]) || FINANCIAL_HOST.test(host);
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Palavras que indicam compra, pagamento, envio, publicação ou exclusão (pt e en). */
const SENSITIVE_WORDS = new RegExp(
  '\\b(' +
    [
      'compr(ar|e|a agora)',
      'finaliz(ar|e)( a)? (compra|pedido)',
      'fech(ar|e)( o)? pedido',
      'conclui(r)? (compra|pedido|pagamento)',
      'pag(ar|ue|amento)',
      'assin(ar|e|atura)',
      'contrat(ar|e)',
      'transferi(r|ncia)',
      'transferencia',
      'pix',
      'doa(r|cao)',
      'envi(ar|e)',
      'publi(car|que)',
      'post(ar|e)',
      'compartilh(ar|e)',
      'apag(ar|ue)',
      'exclu(ir|a)',
      'delet(ar|e)',
      'remov(er|a)',
      'descart(ar|e)',
      'confirm(ar|e)',
      'buy( now)?',
      'purchase',
      'place order',
      'order now',
      'check ?out',
      'pay( now)?',
      'payment',
      'subscribe',
      'donate',
      'transfer',
      'send',
      'submit',
      'post',
      'publish',
      'tweet',
      'share',
      'delete',
      'remove',
      'erase',
      'discard',
      'confirm',
    ].join('|') +
    ')\\b',
);

export function sensitiveWord(text: string): string | undefined {
  return SENSITIVE_WORDS.exec(fold(text))?.[0];
}

const isEnter = (key: string | undefined) => !!key && /^(enter|return)$/i.test(key.trim());

/** A ação envia um formulário (clique em submit, Enter num campo, type com submit). */
function submitsForm(intent: ActionIntent): boolean {
  const el = intent.element;
  if (!el) return false;
  if (intent.kind === 'click') return el.isSubmit;
  if (intent.kind === 'type') return !!intent.submit;
  if (intent.kind === 'press_key') return isEnter(intent.key) && (el.isSubmit || el.editable);
  return false;
}

function sensitiveReasons(intent: ActionIntent, settings: PolicySettings): string[] {
  const reasons: string[] = [];
  const pageHost = hostOf(intent.url);
  const destHost = hostOf(intent.destination);
  for (const host of new Set([pageHost, destHost])) {
    if (host && isFinancialHost(host, settings.sensitiveDomains))
      reasons.push(`${host} é um site financeiro ou marcado como sensível.`);
  }
  for (const url of [intent.url, intent.destination]) {
    if (url && isHttpUrl(url) && PAYMENT_PATH.test(new URL(url).pathname)) {
      reasons.push('A página parece ser de pagamento/checkout.');
      break;
    }
  }

  const el = intent.element;
  const submits = submitsForm(intent);
  if (submits && el?.form) {
    if (el.form.hasPassword) reasons.push('Envia um formulário com campo de senha (login).');
    else if (el.form.method !== 'get' && !el.isSearch)
      reasons.push('Envia um formulário: os dados digitados vão para o site.');
  }
  const enterLike = (intent.kind === 'press_key' && isEnter(intent.key)) || !!intent.submit;
  if (el && enterLike && (el.tag === 'textarea' || el.contentEditable))
    reasons.push('Enter numa caixa de mensagem costuma enviar a mensagem.');

  const clicked = intent.kind === 'click' || (intent.kind === 'press_key' && isEnter(intent.key));
  const words = [
    clicked ? el?.name : '',
    clicked ? el?.text : '',
    submits ? el?.form?.submitLabel : '',
  ].filter(Boolean);
  const word = sensitiveWord(words.join(' | '));
  if (word) reasons.push(`O alvo menciona "${word}" (compra, envio, publicação ou exclusão).`);
  return reasons;
}

const verdict = (decision: Decision, reasons: string[] = [], sensitive = false): Verdict => ({
  decision,
  reasons,
  sensitive,
});

/** Decide se a ação roda direto, precisa de confirmação do usuário ou é negada. */
export function evaluateAction(
  intent: ActionIntent,
  session: PolicySession,
  settings: PolicySettings,
): Verdict {
  const { kind } = intent;
  if (kind === 'wait') return verdict('allow');
  if (!session.planApproved) {
    return verdict('deny', [
      'Nenhum plano aprovado: chame propose_plan e espere a aprovação do usuário antes de agir.',
    ]);
  }

  const pageAction = PAGE_ACTIONS.has(kind);
  const navigates = kind === 'navigate' || kind === 'open_tab';
  const pageHost = pageAction ? hostOf(intent.url) : '';
  const destHost = isHttpUrl(intent.destination) ? hostOf(intent.destination) : '';

  // 1. Negações: nada disso é liberado por confirmação.
  const deny: string[] = [];
  if (navigates && !isHttpUrl(intent.destination))
    deny.push('Só endereços http(s) podem ser abertos pelo agente.');
  if (pageAction && !isHttpUrl(intent.url)) deny.push('O agente só age em páginas http(s).');
  for (const host of new Set([pageHost, destHost])) {
    if (!host) continue;
    if (matchesDomain(host, settings.agentBlockedDomains))
      deny.push(`O agente está bloqueado em ${host} (configurações).`);
    else if (matchesDomain(host, settings.blockedDomains))
      deny.push(`${host} está na lista de domínios sem captura.`);
  }
  const el = intent.element;
  const writesInto =
    kind === 'type' ||
    kind === 'select_option' ||
    (kind === 'press_key' && [...(intent.key ?? '').trim()].length === 1);
  if (el && writesInto && el.fieldKind !== 'normal') {
    const what = { password: 'senha', otp: 'código de verificação (2FA)', card: 'cartão' }[
      el.fieldKind
    ];
    deny.push(
      `O campo é de ${what}: a Lucerna nunca preenche esse tipo de dado. Peça ao usuário para fazer esta etapa.`,
    );
  }
  if (kind === 'type' && intent.text && containsCardNumber(intent.text))
    deny.push('O texto parece um número de cartão: a Lucerna nunca digita dados de cartão.');
  if (deny.length) return verdict('deny', deny, true);

  // 2. Confirmações.
  const confirm: string[] = [];
  let enableDomain: string | undefined;
  const siteHost = pageAction ? pageHost : navigates ? destHost : '';
  if (siteHost && !matchesDomain(siteHost, settings.agentAllowedDomains)) {
    enableDomain = siteHost;
    confirm.push(`O agente ainda não está habilitado em ${siteHost}.`);
  }

  const sensitive = sensitiveReasons(intent, settings);
  confirm.push(...sensitive);

  const scope = scopeOf(session);
  for (const host of new Set([pageHost, destHost])) {
    if (host && !inScope(host, scope))
      confirm.push(`${host} não faz parte do seu pedido nem do plano aprovado.`);
  }

  if (kind === 'type' && intent.text) {
    const foreign = foreignData(intent.text, session.requestText);
    if (foreign.length)
      confirm.push(`O texto contém dados que não estão no seu pedido: ${foreign.join(', ')}.`);
  }

  if (session.tainted && kind !== 'scroll' && kind !== 'switch_tab') {
    confirm.push(
      `Uma página mostrou texto que parece instrução para o assistente ("${session.tainted}"); por segurança, cada ação precisa da sua confirmação.`,
    );
  }

  if (kind === 'close_tab' && !intent.tabOpenedByAgent)
    confirm.push('Fecha uma aba que não foi aberta pelo agente.');

  if (!confirm.length) return verdict('allow');
  return { decision: 'confirm', reasons: confirm, sensitive: sensitive.length > 0, enableDomain };
}

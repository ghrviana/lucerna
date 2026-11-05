import { en } from './dictionaries/en';
import { ptBR } from './dictionaries/pt-BR';

export type Locale = 'pt-BR' | 'en';
export type TranslationKey = keyof typeof ptBR;

export const LOCALES: Locale[] = ['pt-BR', 'en'];
const dictionaries: Record<Locale, Record<TranslationKey, string>> = { 'pt-BR': ptBR, en };

/** Troca `{nome}` pelo valor de `vars.nome` (convertido para string). */
function fill(text: string, vars: Record<string, string | number>): string {
  let out = text;
  for (const [key, value] of Object.entries(vars)) out = out.split(`{${key}}`).join(String(value));
  return out;
}

/**
 * Traduz `key` no idioma `locale` (cai para pt-BR, e por fim para a própria chave, se faltar).
 * Função pura, utilizável fora de componentes React (ex.: `useI18nStore.getState().locale`).
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const text = dictionaries[locale][key] ?? dictionaries['pt-BR'][key] ?? key;
  return vars ? fill(text, vars) : text;
}

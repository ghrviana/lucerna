import { create } from 'zustand';
import { getSettings, onSettingsChanged } from '../storage/settings';
import { translate, type Locale, type TranslationKey } from './translate';

interface I18nState {
  locale: Locale;
  /** Lê o idioma salvo e passa a acompanhar mudanças; devolve a função para parar de ouvir. */
  init: () => Promise<() => void>;
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: 'pt-BR',
  init: async () => {
    const s = await getSettings();
    set({ locale: s.language });
    return onSettingsChanged((s2) => set({ locale: s2.language }));
  },
}));

/** Hook de tradução: o componente re-renderiza quando o idioma muda. */
export function useT() {
  const locale = useI18nStore((s) => s.locale);
  return (key: TranslationKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
}

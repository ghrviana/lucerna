import type { Theme } from './storage/settings';

/** Aplica `.dark` em `<html>` conforme o tema escolhido (ou o do sistema, para 'system'). */
export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

/** Aplica o tema atual e mantém atualizado: mudança de configuração e, se 'system', do SO. */
export function watchTheme(getTheme: () => Theme): () => void {
  applyTheme(getTheme());
  const media = matchMedia('(prefers-color-scheme: dark)');
  const onMediaChange = () => {
    if (getTheme() === 'system') applyTheme('system');
  };
  media.addEventListener('change', onMediaChange);
  return () => media.removeEventListener('change', onMediaChange);
}

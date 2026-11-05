import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: ({ mode }) => ({
    name: 'Lucerna',
    description: 'Assistente de IA em painel lateral para o Chrome.',
    permissions: [
      'sidePanel',
      'storage',
      'activeTab',
      'scripting',
      'contextMenus',
      'alarms',
      'notifications',
    ],
    // Build de testes e2e (`wxt build --mode e2e` → .output/chrome-mv3-e2e): acesso a todos os
    // sites no manifest, porque o Playwright não clica nos diálogos de permissão do Chrome.
    host_permissions:
      mode === 'e2e'
        ? ['https://api.deepseek.com/*', '<all_urls>']
        : ['https://api.deepseek.com/*'],
    // Acesso a sites é pedido por site, em tempo de uso (contexto da página, ferramentas, agente).
    optional_host_permissions: ['<all_urls>'],
    action: { default_title: 'Abrir Lucerna' },
    commands: {
      'open-sidepanel': {
        suggested_key: { default: 'Alt+Shift+M' },
        description: 'Abrir o painel da Lucerna',
      },
    },
  }),
});

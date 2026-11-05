# Lucerna

Extensão para o Google Chrome (Manifest V3): um assistente de IA em painel lateral que conversa
sobre a página aberta (texto, screenshot, PDFs), e que — se você ligar o modo agente — também pode
agir no navegador por você (clicar, digitar, navegar), sempre com plano aprovado antes e
confirmação para ações sensíveis. O nome vem da lucerna, a lamparina a óleo romana: a ideia é um
assistente que primeiro ilumina (lê e explica) o conteúdo da página, depois guia os seus passos.

Funciona com a [DeepSeek](https://api-docs.deepseek.com) por padrão, e opcionalmente com um segundo
provedor compatível com a API de chat da OpenAI (ex.: a própria OpenAI). **Você usa a sua própria
chave de API** — a Lucerna não tem servidor, conta de usuário nem cobra nada.

> **Projeto pessoal, distribuído sem garantias.** Não está na Chrome Web Store — é compartilhado
> direto pelo GitHub, pra quem quiser usar por conta e risco própria. Sem suporte formal; issues e
> PRs são bem-vindos, mas não há compromisso de resposta.

## Funcionalidades

- Chat com streaming, múltiplas conversas com histórico, markdown e realce de código.
- Contexto da página: texto principal, seleção, screenshot, screenshot anotado (elementos
  numerados) e anexo manual de imagens.
- Ferramentas de leitura: comparar abas, ler PDFs abertos no navegador, extrair tabelas e links.
- Modo agente: o modelo pode clicar, digitar e navegar, com plano aprovado antes, confirmação para
  ações sensíveis (comprar, enviar formulário, pagar, apagar...) e lista de sites permitidos.
- Workflows salvos (instruções reutilizáveis, com parâmetros), memória leve (o assistente propõe
  "lembrar disto?", só salva se você aprovar), exportar conversa em markdown.
- Tarefas agendadas: checar uma página de tempos em tempos e notificar se algo mudou.
- Segundo provedor de IA opcional, com modelo escolhido por conversa, e medidor de uso.
- Interface em português (padrão) e inglês; tema claro/escuro.

Cada funcionalidade tem uma explicação curta dentro da própria extensão: Configurações → aba
"Manual".

## Instalação

Não está na Chrome Web Store — carregue a extensão manualmente, em modo desenvolvedor. Duas formas:

### Sem programar (baixando o .zip pronto)

1. Vá até a aba [Releases](../../releases) deste repositório e baixe o `.zip` da versão mais
   recente.
2. Extraia o `.zip` numa pasta fixa do seu computador (não apague nem mova depois — veja o aviso
   abaixo).
3. No Chrome, abra `chrome://extensions`, ative o **Modo do desenvolvedor** (canto superior
   direito) e clique em **Carregar sem compactação** (ou **Carregar descompactada**), apontando
   para a pasta que você extraiu.
4. Clique no ícone da Lucerna na barra de ferramentas para abrir o painel (ou use o atalho
   `Alt+Shift+M`).

> **Importante:** o Chrome liga o armazenamento da extensão (conversas, configurações, chave de
> API) ao caminho da pasta carregada. Depois de instalada, não mova nem renomeie essa pasta — para
> atualizar, veja "Como atualizar" abaixo. Também não remova a extensão e carregue de novo "do
> zero" só para atualizar: isso apaga os dados.

### Para quem programa (clonar e buildar)

1. Pré-requisito: [Node.js](https://nodejs.org) 18 ou mais recente.
2. Clone este repositório e instale as dependências:
   ```sh
   git clone https://github.com/<seu-usuario>/<seu-repositorio>.git
   cd <seu-repositorio>
   npm install
   ```
3. Gere o build de produção:
   ```sh
   npm run build
   ```
   Isso cria a pasta `.output/chrome-mv3`.
4. No Chrome, abra `chrome://extensions`, ative o **Modo do desenvolvedor** e clique em **Carregar
   sem compactação**, apontando para a pasta `.output/chrome-mv3`.
5. Clique no ícone da Lucerna na barra de ferramentas para abrir o painel (ou use o atalho
   `Alt+Shift+M`).

## Como atualizar

- Instalou pelo `.zip`: baixe o `.zip` da versão nova em [Releases](../../releases), extraia **por
  cima da mesma pasta** que você já tinha carregada (mesmo caminho), e clique em "Atualizar" no
  cartão da extensão em `chrome://extensions`.
- Instalou pelo código-fonte: `git pull` (ou baixe as mudanças), `npm run build` de novo, e clique
  em "Atualizar" no cartão da extensão em `chrome://extensions`.

Em ambos os casos, **use sempre "Atualizar"** (ou "Recarregar") — nunca remova a extensão e carregue
de novo como se fosse nova: o Chrome liga o armazenamento ao caminho da pasta, então remover e
recarregar (mesmo apontando pra mesma pasta) pode te deixar sem acesso às conversas e configurações
salvas.

## Configurar a chave de API

O painel pede a chave assim que você tenta conversar; ou vá direto em Configurações (ícone ⚙ no
cabeçalho do painel):

- **DeepSeek** (provedor padrão): crie uma chave em [platform.deepseek.com](https://platform.deepseek.com)
  e cole em Configurações → "Chave da API". A URL base e o modelo padrão já vêm preenchidos.
- **Segundo provedor (opcional)**, compatível com a API da OpenAI: em Configurações → "Segundo
  provedor", preencha nome, chave e modelo (a URL base já vem preenchida com a da OpenAI, edite se
  usar outro serviço compatível). Escolha o provedor por conversa no painel, botão 🔌.

Cada pessoa que instalar a Lucerna usa a **própria** chave — ela fica só no `chrome.storage.local`
do navegador de quem instalou, nunca é commitada no código nem compartilhada entre instalações.

## O que é enviado ao provedor de IA, e o que fica só no seu navegador

A cada mensagem, vai ao provedor de IA escolhido (DeepSeek ou o segundo provedor, se configurado):
o histórico da conversa atual, o prompt de sistema, o contexto de página que você anexar ou que uma
ferramenta ler (texto, seleção, snapshot de elementos, tabelas/links, texto de PDFs — sempre
marcado como dado não confiável), e screenshots (como imagem em base64). No modo agente, também vai
a observação da página depois de cada ação.

**Nunca saem do navegador:** sua chave de API (exceto no cabeçalho de autenticação de cada chamada
ao provedor), senhas, códigos de verificação (2FA) e dados de cartão (o modo agente se recusa a
digitar esses campos). Conversas, workflows, memórias, tarefas agendadas e o registro de ações
ficam só em `chrome.storage.local`/IndexedDB, no seu navegador — nunca são enviados a lugar nenhum
por conta própria. Detalhes completos em [PRIVACY.md](PRIVACY.md).

## Modo agente

Deixa o modelo clicar, digitar, navegar e preencher formulários por você. Alguns cuidados por
projeto:

- **Vem desligado em todo site, por padrão.** Você habilita site por site (nas configurações, ou
  na hora, pelo próprio painel).
- **Plano aprovado antes de agir**: o modelo propõe um plano (objetivo, passos, sites) e espera sua
  aprovação antes da primeira ação.
- **Ações sensíveis pedem confirmação**: enviar formulário, comprar, pagar, publicar, apagar — nada
  disso roda sem você confirmar na hora.
- **Nunca digita senha, código de verificação (2FA) nem dados de cartão**, mesmo que o modelo tente.
- **Botão PARAR**: cancela a tarefa inteira na hora, em qualquer passo.

Detalhes completos (política de segurança, o que é considerado sensível, limitações) em
[docs/agent-safety.md](docs/agent-safety.md).

## Permissões

A extensão só pede o que usa, e a maioria dos sites exige permissão explícita **na hora em que você
usa** uma função que precisa dele (não é concedida de antemão). Resumo rápido, com a justificativa
completa, fase por fase, em [docs/permissions.md](docs/permissions.md):

| Permissão | Para quê |
| --- | --- |
| `storage` | Guardar configurações, chave de API (só local) |
| `sidePanel` | Abrir o painel lateral |
| `activeTab`, `scripting` | Ler e, no modo agente, agir na aba atual |
| `contextMenus` | O item "Perguntar ao assistente" no menu de botão direito |
| `alarms`, `notifications` | Disparar e avisar sobre tarefas agendadas |
| Acesso a outros sites | Opcional, pedido por site quando você usa uma função que precisa (comparar abas, modo agente) |
| `host_permissions` (`api.deepseek.com`) | Chamadas ao provedor de IA padrão |

## Limitações conhecidas

- O modo agente usa eventos sintéticos para clicar/digitar; alguns sites podem ignorá-los (ver
  [docs/agent-safety.md](docs/agent-safety.md)).
- Tarefas agendadas só rodam com o navegador aberto (não há serviço em segundo plano do sistema).
- Em respostas muito longas (ex.: colar um documento inteiro extraído), a geração pode ser cortada
  pelo limite padrão de tokens de resposta da API do provedor.
- iframes de outra origem e shadow DOM fechado ficam fora do alcance da leitura/ação.
- Sem suporte formal — é um projeto pessoal. Issues e PRs são bem-vindos.

## Desenvolvimento

Stack: [WXT](https://wxt.dev) + React + TypeScript + Tailwind CSS; Zustand para estado;
`chrome.storage.local` para configurações e IndexedDB (via `idb`) para conversas/workflows/
memórias/tarefas; Vitest para testes de unidade e Playwright para e2e.

```sh
npm run dev        # modo desenvolvimento (recarrega ao salvar)
npm run build      # build de produção em .output/chrome-mv3
npm run zip        # build + empacota um .zip em .output/
npm run icons      # regenera os PNGs do ícone a partir de assets/icon/*.svg
npm run test       # testes de unidade (Vitest)
npm run e2e        # testes e2e (Playwright, carrega a extensão de verdade)
npm run lint        # ESLint
npm run typecheck  # TypeScript (app + testes e2e)
npm run format      # Prettier
```

Documentação mais detalhada em `docs/`: decisões de arquitetura (`decisions.md`), segurança do modo
agente (`agent-safety.md`), permissões por fase (`permissions.md`) e notas sobre a API da DeepSeek
(`deepseek-notes.md`). Histórico de desenvolvimento por fase em `PROGRESS.md`.

### Publicar uma versão no GitHub (Releases)

Para quem mantém o repositório e quer distribuir uma versão nova para outras pessoas instalarem
pelo `.zip`:

1. `npm run zip` — gera um `.zip` em `.output/` (ex.: `.output/lucerna-0.0.1-chrome.zip`).
2. No GitHub, vá em **Releases → Draft a new release**.
3. Escolha/crie uma tag (ex.: `v0.0.1`), dê um título e anexe o `.zip` gerado.
4. Publique o release. Quem for instalar sem programar baixa esse `.zip` (ver "Instalação" acima).

## Licença

[MIT](LICENSE).

---

## English (short version)

**Lucerna** is a personal Chrome extension (Manifest V3): an AI assistant in the side panel that
reads and discusses the open page, and — if you turn on agent mode — can also act in the browser
for you (click, type, navigate), always with an approved plan and confirmation for sensitive
actions. It works with DeepSeek by default, plus an optional second OpenAI-compatible provider; you
use your own API key, stored only in `chrome.storage.local`.

This is a **personal project, distributed as-is, with no warranties and no formal support** — it is
not on the Chrome Web Store, only shared via this GitHub repository. To install: either download the
`.zip` from the [Releases](../../releases) tab and load it unpacked via
`chrome://extensions` → Developer mode → "Load unpacked", or clone the repo, run `npm install` &&
`npm run build`, and load `.output/chrome-mv3` the same way. Full details (installation, privacy,
agent-mode safeguards, permissions) are in the Portuguese sections above and in
[PRIVACY.md](PRIVACY.md) / [docs/agent-safety.md](docs/agent-safety.md).

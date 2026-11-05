# Privacidade

A Lucerna é uma extensão pessoal, sem servidor próprio e sem conta de usuário. Este documento
descreve exatamente o que acontece com seus dados: o que sai do seu navegador, para onde, e o que
nunca sai.

## Resumo

- A única rede para onde seus dados viajam é o **provedor de IA que você mesmo configura**
  (DeepSeek, e opcionalmente um segundo provedor compatível com a API da OpenAI). Não há backend,
  analytics, telemetria ou qualquer outro serviço de terceiros.
- Sua **chave de API nunca sai do navegador**, exceto no cabeçalho `Authorization` de cada chamada
  ao provedor escolhido — nunca é logada, nunca aparece em mensagens de erro.
- Conversas, workflows, memórias, tarefas agendadas e o registro de ações **ficam só no seu
  navegador** (`chrome.storage.local` e IndexedDB), e nunca são enviados a lugar nenhum por conta
  própria.

## O que é enviado ao provedor de IA

A cada mensagem, vai ao provedor escolhido (no corpo da requisição HTTPS para `/chat/completions`):

- O histórico da conversa atual (suas mensagens e as respostas do modelo).
- O prompt de sistema (interno da Lucerna + o que você escrever em Configurações, se houver).
- Contexto de página que você anexar ou que uma ferramenta ler: texto da página, seleção, snapshot
  de elementos interativos, tabelas/links extraídos, texto de PDFs — sempre dentro de delimitadores
  marcados como "dado não confiável" (ver [docs/agent-safety.md](docs/agent-safety.md)).
- Screenshots (da aba ou anexados por você), como imagem em base64.
- No modo agente: a mesma observação da página (texto/snapshot/screenshot) depois de cada ação.

Isso só acontece quando você está numa conversa — não há envio em segundo plano, exceto pelas
**tarefas agendadas** que você mesmo criar (que também mandam o conteúdo da página checada ao
provedor, do mesmo jeito que uma mensagem normal).

## O que nunca é enviado a lugar nenhum

- Sua chave de API do provedor padrão e do segundo provedor.
- Senhas, códigos de verificação (2FA) e dados de cartão: o modo agente se recusa a digitar esses
  campos, mesmo que o modelo peça (ver [docs/agent-safety.md](docs/agent-safety.md)).
- O conteúdo de abas/sites fora da conversa atual, a menos que você peça explicitamente (ex.:
  "compare as abas abertas") ou uma tarefa agendada esteja configurada para checar aquela página.

## Onde os dados ficam guardados (só no seu navegador)

| Dado | Onde | Sai do navegador? |
| --- | --- | --- |
| Chave de API, modelo, prompt de sistema, domínios permitidos/bloqueados, idioma, tema | `chrome.storage.local` | Só a chave, e só para o provedor escolhido, a cada chamada |
| Conversas e mensagens | IndexedDB (`pagemate`) | Só o que for enviado numa mensagem (ver acima) |
| Workflows salvos | IndexedDB (`pagemate`) | Não |
| Memórias aprovadas | IndexedDB (`pagemate`) | Sim, injetadas no prompt de sistema das conversas seguintes, até você apagar ou desligar a função |
| Tarefas agendadas e seu histórico | IndexedDB (`pagemate`) | A página checada, como qualquer conversa |
| Registro de ações do agente | IndexedDB (`pagemate`) | Não (fica só em Configurações → "Registro de ações", para você conferir) |

Nada disso é sincronizado entre dispositivos nem enviado a um servidor da Lucerna — porque não
existe um. Desinstalar a extensão apaga tudo.

## Permissões do navegador

A extensão só pede o que usa; cada permissão está justificada, fase por fase do desenvolvimento,
em [docs/permissions.md](docs/permissions.md). Resumo:

- `storage`, `sidePanel`: guardar configurações e abrir o painel.
- `activeTab`, `scripting`: ler/agir na aba que você está usando, só quando você pede.
- `contextMenus`: o item "Perguntar ao assistente" no menu de botão direito.
- `alarms`, `notifications`: disparar e avisar sobre tarefas agendadas.
- Acesso a outros sites (além da API do provedor) é **opcional e pedido em tempo de uso** — por
  site, na hora em que você usa uma função que precisa dele (ler outra aba, modo agente). Nunca é
  concedido de antemão para todos os sites.

## Código-fonte e confiança

Todo o código roda localmente no seu navegador; não há código remoto carregado (exigência que o
projeto segue à risca, mesmo fora da Chrome Web Store). Audite o código-fonte à vontade — é exatamente
o que é publicado.

## Responsabilidade

Este é um projeto pessoal, sem suporte formal nem garantias. Você roda com a sua própria chave de
API, e as chamadas feitas ao provedor escolhido estão sujeitas à política de privacidade **dele**
(DeepSeek, OpenAI ou outro), não da Lucerna.

# Permissões

Manifest atual (Fase 2):

| Permissão                         | Motivo                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `sidePanel`                       | Abrir o painel lateral ao clicar no ícone (`setPanelBehavior`).                            |
| `storage`                         | Guardar configurações (chave da API, modelo) em `chrome.storage.local` a partir da Fase 1. |
| host `https://api.deepseek.com/*` | Chamadas à API do LLM.                                                                     |

Previstas e adicionadas só na fase que as usa: `alarms`, `offscreen` (Fase 7). `optional_host_permissions` para todos os sites (pedido em tempo de uso) e `debugger` opcional (Fase 5, só se necessário).

## Fase 4

Nenhuma permissão nova no manifest. As ferramentas de leitura usam o que já existe: `activeTab`/`scripting` (aba ativa) e `optional_host_permissions` (`<all_urls>`), que o painel pede em tempo de uso para ler outras abas e baixar PDFs. A negação só limita as ferramentas à aba ativa.

## Fase 5

Nenhuma permissão nova no manifest de produção. O modo agente usa `scripting` (injetar o executor), `activeTab` e `optional_host_permissions` (`<all_urls>`, pedido ao ligar o modo agente; ou só o site, ao habilitá-lo no cartão de confirmação). `chrome.tabs` (navegar, abrir, trocar e fechar abas) e `chrome.windows.getLastFocused` não exigem permissão.

`debugger` (eventos confiáveis) ficou de fora: o Chrome não aceita essa permissão como opcional (developer.chrome.com, API permissions) e o projeto só a admitia assim.

O build de e2e (`wxt build --mode e2e`) acrescenta `<all_urls>` a `host_permissions` só para os testes automatizados. Esse pacote não deve ser publicado.

## Fase 7

| Permissão       | Motivo                                                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alarms`        | Disparar a verificação periódica de cada tarefa agendada (`chrome.alarms.create` com `periodInMinutes`), sem precisar manter nada rodando enquanto não é hora. |
| `notifications` | Avisar o usuário do resultado de uma tarefa agendada (`chrome.notifications.create`).                                                                          |

A tarefa roda direto no service worker (sem `chrome.offscreen`): documentos offscreen não têm acesso a `chrome.storage` nem `chrome.tabs`, só mensageria e APIs de DOM/mídia — descoberto na validação manual, ver `docs/decisions.md`.

Abrir a página da tarefa numa aba em segundo plano (não a aba ativa) continua exigindo acesso ao site: a tela de criação da tarefa pede `<all_urls>` (de `optional_host_permissions`, já existente) no clique de "Criar tarefa", o mesmo gesto já usado para habilitar o modo agente.

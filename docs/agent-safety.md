# Segurança do modo agente (Fase 5)

Princípio: **o modelo propõe e o código decide**. Cada ação passa por uma política pura
(`src/core/agent/policy.ts`) antes de ser executada. Nenhuma regra depende de o modelo obedecer ao
prompt; o prompt de sistema só reduz tentativas inúteis.

## Fluxo de uma tarefa

1. O usuário liga "Modo agente" na conversa e envia o pedido. A aba ativa vira a aba do agente.
2. O modelo observa (snapshot/screenshot anotado) e chama `propose_plan` (objetivo, passos e
   sites). O painel mostra o plano e **nada roda antes da aprovação**. Sem plano aprovado, toda
   ação de escrita é negada.
3. Cada ação passa pelo portão: a ferramenta descreve a ação (`intent`: alvo, texto, destino) e
   `evaluateAction` decide entre **permitir**, **confirmar** (cartão no painel) ou **negar**.
4. Depois de agir, o loop espera a página assentar e devolve ao modelo uma observação nova
   (snapshot com ids novos e, se ligado, screenshot anotado).
5. A tarefa para quando o modelo responde em texto, ao atingir o limite de passos (padrão 30) ou
   de tempo (padrão 5 min), quando o detector de laço dispara ou quando o usuário clica em
   **PARAR**.

## Negado sempre (não há confirmação que libere)

- Digitar (ou escolher opção) em campo de **senha**, **2FA/OTP** ou **cartão**. A detecção usa
  `type=password`, `autocomplete` (`current-password`, `new-password`, `one-time-code`, `cc-*`) e
  nome/id/rótulo/placeholder (senha, password, otp, 2fa, token, código de verificação, cvv, número
  do cartão...). O executor no script injetado recusa os mesmos campos (defesa em profundidade).
- Texto com número de cartão (13 a 19 dígitos que passam no Luhn).
- Endereços que não são http(s) (`javascript:`, `data:`, `file:`, `chrome:`) e ações em páginas
  que não são http(s).
- Sites na lista "o agente nunca age" ou na lista de domínios sem captura.

## Pede confirmação (o cartão mostra o quê, onde, o texto e os motivos)

- **Site não habilitado** (padrão: nenhum). O cartão oferece "Habilitar agente em X e permitir",
  que grava o site na lista e pede a permissão de host dele no mesmo clique. O cartão do plano
  também permite habilitar os sites do plano (caixa desmarcada por padrão).
- **Ação sensível** (sempre confirmada, sem "não perguntar de novo"):
  - enviar formulário POST ou com campo de senha (clique em submit, Enter, `type` com `submit`).
    Formulários GET e campos de busca não contam, porque pesquisar não muda estado;
  - Enter em textarea ou contenteditable (compositores de mensagem);
  - alvo com palavras como comprar, finalizar compra, pagar, pix, assinar, transferir, enviar,
    publicar, postar, compartilhar, apagar, excluir, remover, confirmar, buy, checkout, pay,
    subscribe, send, submit, post, publish, share, delete, remove (pt e en, sem acento);
  - sites financeiros (lista embutida de bancos, pagamentos e corretoras, mais hosts com
    "bank/banco/banking") e os "sites sensíveis extras" do usuário; caminhos `/checkout`,
    `/payment`, `/pagamento`, `/billing`, `/pay`.
- **Fora do pedido original** (anti-injection):
  - domínio da página ou do destino (inclusive o link clicado) fora de {domínio inicial, sites do
    plano aprovado, domínios citados pelo usuário, domínios já confirmados nesta tarefa}. A
    comparação usa o domínio-base (`pt.m.wikipedia.org` ≈ `wikipedia.org`);
  - texto a digitar com e-mail, URL, domínio ou número de 6+ dígitos que não está no que o usuário
    digitou (exfiltração);
  - **sessão suspeita**: se algum texto lido de páginas casar com padrões de injeção ("ignore as
    instruções anteriores", "new instructions:", "system prompt", "assistente: clique..."), o painel
    mostra um aviso e, daí em diante, toda ação (menos rolar) pede confirmação.
- Fechar uma aba que o agente não abriu.

O "pedido do usuário" é só o texto que ele digitou na conversa. Conteúdo de páginas anexado
(contexto, seleção, snapshot) nunca conta como pedido.

## Outras defesas

- Conteúdo de páginas vai ao modelo dentro de delimitadores (`<dados_da_pagina>` etc.), sanitizado,
  e o prompt de sistema manda não seguir instruções vindas dele.
- Detector de laço: a mesma ação (mesmos argumentos) sem mudar a página (URL + hash do snapshot)
  gera um aviso ao modelo na 2ª vez e encerra a tarefa na 3ª.
- PARAR: um único `AbortController` cancela o stream, as esperas (`wait`, carregamento) e a
  confirmação pendente. Chamadas interrompidas ficam marcadas como "cancelada".
- Registro local (IndexedDB, store `actionLog`, últimas 2.000 entradas): data, conversa, aba, site,
  ferramenta, argumentos (textos encurtados a 200 caracteres), decisão (executada, confirmada,
  recusada, bloqueada, cancelada, plano aprovado/recusado), motivos e resultado. Fica nas
  configurações, em "Registro de ações".
- Histórico enviado ao modelo: só as 2 observações mais recentes vão inteiras; as antigas viram
  um marcador (economia de tokens e menos texto de página no contexto).

## Limitações conhecidas

- As heurísticas reduzem o risco de prompt injection, mas não o eliminam. A confirmação humana é a
  última barreira: leia o cartão antes de permitir.
- Texto em **imagens** (screenshots) não passa pelo detector de injeção.
- Os eventos são sintéticos (`isTrusted = false`). Alguns sites os ignoram. O fallback com
  `chrome.debugger` previsto no plano foi descartado: o Chrome não aceita `debugger` como permissão
  opcional (ver decisions.md).
- Popups abertos por clique sintético (`target=_blank`) podem ser bloqueados; o modelo usa
  `open_tab`.
- iframes de outra origem e shadow DOM fechado continuam fora do alcance do snapshot e do executor.
- O loop roda no painel: fechar o painel interrompe a tarefa.
- A detecção de campo sensível por nome é heurística: um campo de senha sem `type=password` e sem
  nenhuma pista no nome ou rótulo passaria. Nesse caso ainda valem o envio de formulário com senha
  (confirmação) e as demais regras.

# Notas da API DeepSeek (verificadas em api-docs.deepseek.com, 2026-11-03)

Fonte: páginas oficiais Quick Start, Create Chat Completion, Vision e Thinking Mode. A página de Function Calling não detalhou deltas de `tool_calls`; isso ainda precisa ser confirmado empiricamente com `npm run api-check` (ver "Pendente de verificação").

## Endpoint e modelos

- Base URL (compatível com OpenAI): `https://api.deepseek.com` → `POST /chat/completions`. Também existe `https://api.deepseek.com/anthropic`.
- Modelos atuais: `deepseek-flash` (V4.1-Flash, aceita imagens) e `deepseek-v4-pro`.
- `deepseek-v4-flash` e `deepseek-v4-flash-vision-exp` estão aposentados: ainda são aceitos, mas servidos pelo Flash atual. **Padrão do projeto: `deepseek-flash`** (configurável).

## Imagens (visão)

- Só em mensagens `user` (imagem em `system`/`assistant` retorna 400).
- `content` como array de partes: `{type:"text"}`, `{type:"image_url", image_url:{url, detail?}}`, `{type:"file"}`.
- `url`: data URL base64 (`data:image/jpeg;base64,...`), URL http(s) pública (máx. 8192 caracteres, download em até 60 s) ou `file_id` da Files API.
- Formatos: JPEG, PNG, GIF, WebP (detectado pelo conteúdo).
- Limites: corpo 48 MiB; imagem única 32 MiB (base64/URL), 64 MiB (file_id); até 600 imagens; total 64 MiB sem file_id; lado máx. 8192 px (4096 px com 15+ imagens).
- Custo: imagens são redimensionadas para ~1300×1300; no máximo 1024 tokens por imagem. `detail`: `low` (512×512), `high`/`original`/`auto` (resolução original).
- Decisão para a Fase 3: base64 inline (JPEG ~0,7, largura ≤ 1280 px) é suficiente; Files API só se houver reuso/arquivos grandes.

## Streaming

- `stream: true` → SSE (`data: {...}\n\n`, termina com `data: [DONE]`).
- `stream_options: {include_usage: true}` exige `stream: true` (senão 400). O `usage` chega no último chunk de conteúdo, antes de `[DONE]`.
- `delta.content` traz o texto; `delta.reasoning_content` traz o raciocínio (modo thinking).

## Thinking / reasoning

- `thinking: {type: "enabled" | "disabled"}`. Se omitido, `reasoning_effort` decide; se ambos omitidos, thinking fica **ligado**.
- `reasoning_effort`: `none`, `low`, `high` (padrão), `max` (`minimal`→`low`; `medium`/`xhigh`→`high`).
- Em modo thinking, `tool_choice: "required"` ou função nomeada retornam 400.
- **Regra crítica com ferramentas:** se a requisição inclui `tools`, o `reasoning_content` de TODAS as mensagens assistant anteriores deve ser devolvido na íntegra; omitir causa 400. Sem `tools`, é ignorado. Ao fazer streaming, acumular `reasoning_content` e `content` separadamente e salvar ambos na mensagem assistant.
- Implicação para o design (Fases 1/4/5): o tipo de mensagem assistant deve guardar `reasoning_content` e persisti-lo junto da conversa; ou desligar thinking nas chamadas com ferramentas.

## Function calling

- Apenas `type: "function"`; nomes únicos, `[A-Za-z0-9_-]`, até 128 caracteres; `parameters` é JSON Schema; `strict` é Beta.
- `tool_choice`: `none | auto | required | {função}`.
- Loop: enviar tools → anexar a mensagem assistant completa (content, reasoning_content, tool_calls) → anexar `{role:"tool", tool_call_id, content}` → repetir até não haver tool_calls.

## Parâmetros e limites

- `temperature` 0–2 (padrão 1); `max_tokens` 1–393.216 (padrões: 8K sem thinking, 64K com thinking, 128K com effort max); `stop` até 16 sequências.

## Verificação empírica (`npm run api-check`, 4/4 OK)

- Texto sem streaming com `deepseek-flash`: OK; `usage` inclui `prompt_cache_hit_tokens` e `prompt_cache_miss_tokens`.
- Streaming com `include_usage`: OK (15 chunks, `usage` no último).
- Imagem JPEG em base64: descrita corretamente (fundo azul, círculo vermelho, retângulo amarelo, texto "LUCERNA").
- Tool calling com thinking: a resposta trouxe `reasoning_content` e `tool_calls` (com campo `index`); ao devolver a mensagem assistant completa, a resposta final veio normal.
- Pendente de confirmação pelo usuário: deltas de `tool_calls` em streaming com thinking desligado (novo passo do `npm run api-check`, como a extensão envia) e requisição com tools omitindo `reasoning_content` em thinking (esperado 400; não usado pela extensão).
- **Fase 5:** o modo agente não usa nenhum recurso novo da API: function calling em streaming (funcionou na validação manual da Fase 4), imagens em mensagens `user` e thinking desligado.

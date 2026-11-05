/**
 * Dicionário pt-BR (idioma padrão do projeto). `en.ts` precisa ter exatamente as mesmas chaves —
 * `dictionaries.test.ts` confere isso. `{var}` dentro de um texto é substituído por `translate()`.
 */
export const ptBR = {
  'common.save': 'Salvar',
  'common.cancel': 'Cancelar',
  'common.close': 'Fechar',
  'common.edit': 'Editar',
  'common.delete': 'Apagar',
  'common.update': 'Atualizar',
  'common.clear': 'Limpar',
  'common.copy': 'Copiar',
  'common.copied': 'Copiado!',
  'common.create': 'Criar',
  'common.page': 'página',

  // App.tsx
  'app.history': 'Histórico de conversas',
  'app.newConversation': 'Nova conversa',
  'app.workflows': 'Workflows salvos',
  'app.export': 'Exportar conversa em markdown',
  'app.settings': 'Configurações',
  'app.openSettings': 'Abrir configurações',
  'app.configureApiKey': 'Configure sua chave de API nas configurações para conversar.',
  'app.dismissWarning': 'Fechar aviso',
  'app.title': 'Lucerna',

  // ChatView.tsx
  'chat.empty': 'Como posso ajudar? Escreva uma mensagem abaixo.',
  'chat.thinking': 'Pensando…',

  // Composer.tsx
  'composer.summarize': 'Resumir',
  'composer.translate': 'Traduzir',
  'composer.explain': 'Explicar',
  'composer.pageTitle': 'Lê e anexa o texto principal da página atual',
  'composer.page': '📄 Página',
  'composer.reading': 'Lendo…',
  'composer.screenshotTitle': 'Captura a parte visível da aba',
  'composer.screenshot': '📷 Screenshot',
  'composer.capturing': 'Capturando…',
  'composer.annotatedTitle':
    'Screenshot com caixas numeradas nos elementos interativos + lista de elementos',
  'composer.annotated': '🎯 Anotado',
  'composer.imageTitle': 'Anexar imagem (também dá para colar ou arrastar)',
  'composer.image': '📎 Imagem',
  'composer.autoScreenshotTitle':
    'Anexa automaticamente um screenshot da aba ativa em cada mensagem enviada',
  'composer.autoScreenshot': 'Screenshot em toda mensagem',
  'composer.toolsTitle':
    'Deixa o modelo listar e ler abas, PDFs, tabelas e links (somente leitura)',
  'composer.tools': 'Ferramentas de leitura (abas, PDF)',
  'composer.agentModeTitle':
    'Deixa o modelo clicar, digitar e navegar. Ele propõe um plano antes, só age em sites que você habilitar e pede confirmação em ações sensíveis.',
  'composer.agentMode': 'Modo agente (agir no navegador)',
  'composer.placeholderAgent':
    'Descreva a tarefa para o agente (ex.: preencha o formulário com meu nome...)',
  'composer.placeholderChat':
    'Escreva sua mensagem (Enter envia, Shift+Enter quebra linha; /nome roda um workflow salvo)',
  'composer.send': 'Enviar',
  'composer.stop': 'Parar',
  'composer.messageLabel': 'Mensagem',
  'composer.forLabel': '{label}: {subject}',

  // ContextCard.tsx
  'context.includesSelection': ' (inclui seleção)',
  'context.onlySelection': ' (só a seleção)',
  'context.interactiveElements': ' · {n} elementos interativos',
  'context.charCount': '{n} caracteres',
  'context.view': 'Ver/editar',
  'context.removeLabel': 'Remover contexto',
  'context.longText':
    'Texto longo: {total} caracteres na página. Enviando só o início e o fim (limite de {limit}).',
  'context.pageText': 'Texto da página',
  'context.selection': 'Seleção',
  'context.interactiveElementsField': 'Elementos interativos (ids das caixas do screenshot)',

  // ConversationList.tsx
  'convList.search': 'Buscar conversas',
  'convList.noneFound': 'Nenhuma conversa encontrada.',
  'convList.noneYet': 'Nenhuma conversa ainda.',
  'convList.renameLabel': 'Renomear {title}',
  'convList.deleteLabel': 'Apagar {title}',
  'convList.confirmDelete': 'Apagar "{title}"?',
  'convList.newTitleLabel': 'Novo título',

  // Message.tsx
  'message.toolActionIcon': 'Ferramenta de ação: altera algo na página ou no navegador',
  'message.toolReadIcon': 'Ferramenta de leitura: só consulta, não altera nada',
  'message.copyCode': 'Copiar código',
  'message.saveAsWorkflow': '💾 Salvar como workflow',
  'message.contextSent': 'Contexto enviado: {title}',
  'message.regenerate': 'Regenerar',
  'message.decisionConfirmed': '✔ confirmada por você',
  'message.decisionRefused': '✋ recusada por você',
  'message.decisionDenied': '⛔ bloqueada pela política',
  'message.decisionCancelled': 'cancelada',
  'message.decisionPlanApproved': '📋 plano aprovado',
  'message.decisionPlanRefused': '📋 plano recusado',
  'message.toolPending': '⏳ executando…',
  'message.toolOk': '✓',
  'message.toolError': '✗ erro',
  'message.toolResultMore': '\n[… mais {n} caracteres enviados ao modelo]',
  'message.observation': 'Observação da página',
  'message.memorySaved': '🧠 Memória salva: "{text}"',
  'message.memoryDismissed': '🧠 Memória ignorada: "{text}"',
  'message.memoryAsk': '🧠 Lembrar disto: "{text}"?',
  'message.memorySave': 'Salvar',
  'message.memoryIgnore': 'Ignorar',

  // SaveWorkflowDialog.tsx
  'workflowDialog.title': '💾 Salvar como workflow',
  'workflowDialog.name': 'Nome',
  'workflowDialog.instruction': 'Instrução',
  'workflowDialog.placeholderHint':
    'Use {{nome}} no texto para pedir um valor toda vez que executar.',
  'workflowDialog.agentMode': 'Rodar em modo agente',
  'workflowDialog.duplicate':
    'Já existe um workflow com um nome parecido (mesmo /slug). Escolha outro nome.',

  // Thumbnails.tsx
  'thumb.screenshot': 'Screenshot',
  'thumb.annotated': 'Screenshot anotado',
  'thumb.upload': 'Imagem',
  'thumb.enlarge': 'Ampliar {kind}',
  'thumb.remove': 'Remover imagem',

  // WorkflowList.tsx
  'workflowList.search': 'Buscar workflows',
  'workflowList.noneFound': 'Nenhum workflow encontrado.',
  'workflowList.noneYet': 'Nenhum workflow salvo ainda.',
  'workflowList.deleteLabel': 'Apagar {name}',
  'workflowList.confirmDelete': 'Apagar o workflow "{name}"?',
  'workflowList.manage': 'Gerenciar workflows (editar/apagar)',

  // WorkflowParamsForm.tsx
  'workflowParams.run': 'Executar',

  // AgentBar.tsx
  'agentBar.working': '🤖 Agente trabalhando · passo {round}/{max} · {actions} ação(ões) · {sec}s',
  'agentBar.idle': '🤖 Modo agente: pode clicar, digitar e navegar nos sites habilitados.',
  'agentBar.stop': '■ PARAR',
  'agentBar.sites': 'Sites',
  'agentBar.log': 'Registro',
  'agentBar.tainted':
    '⚠️ Uma página mostrou texto que parece instrução para o assistente ("{text}"). Ele não deve ser seguido; a partir de agora cada ação pede sua confirmação.',

  // AgentCards.tsx
  'agentCards.planLabel': 'Plano do agente',
  'agentCards.planTitle': '📋 Plano proposto pelo agente',
  'agentCards.sites': 'Sites: {sites}',
  'agentCards.enableSites':
    'Habilitar o agente em: {sites} (sem isso, ele pede permissão na primeira ação em cada site)',
  'agentCards.sensitiveNotice':
    'Ações sensíveis (enviar, comprar, apagar, publicar) ainda pedirão confirmação.',
  'agentCards.runPlan': 'Executar plano',
  'agentCards.cancel': 'Cancelar',
  'agentCards.sensitiveTitle': '⚠️ Ação sensível: confirme',
  'agentCards.confirmLabel': 'Confirmar ação do agente',
  'agentCards.confirmTitle': '✋ Confirmação necessária',
  'agentCards.in': ' em {site}',
  'agentCards.destination': 'Destino: {url}',
  'agentCards.reason': 'Justificativa do agente (não verificada): {reason}',
  'agentCards.enableAndAllow': 'Habilitar agente em {domain} e permitir',
  'agentCards.allow': 'Permitir',
  'agentCards.refuse': 'Recusar',

  // Options.tsx
  'options.title': 'Configurações da Lucerna',
  'options.tabSettings': 'Configurações',
  'options.tabManual': 'Manual',
  'options.apiKey': 'Chave da API',
  'options.apiKeyHint':
    'Fica só neste navegador (chrome.storage.local) e é enviada apenas ao provedor configurado.',
  'options.show': 'Mostrar',
  'options.hide': 'Ocultar',
  'options.model': 'Modelo',
  'options.modelHint':
    'Padrão: deepseek-flash (aceita imagens). Confira o nome exato do modelo na documentação da API do provedor.',
  'options.baseUrl': 'URL base',
  'options.baseUrlHint': 'Padrão: https://api.deepseek.com',
  'options.temperature': 'Temperatura: {value}',
  'options.temperatureHint': '0 = mais determinístico, 2 = mais criativo.',
  'options.systemPrompt': 'Prompt de sistema personalizado',
  'options.systemPromptHint': 'Instruções extras, adicionadas ao prompt padrão da Lucerna.',
  'options.blockedDomains': 'Domínios sem captura',
  'options.blockedDomainsHint':
    'Um por linha (ex.: meubanco.com.br). A Lucerna não lê texto, screenshot nem snapshot nesses sites e em seus subdomínios.',
  'options.agentTitle': 'Modo agente',
  'options.agentHint':
    'O agente só age nos sites listados abaixo (também dá para habilitar um site na hora, pelo painel). Ele nunca digita senhas, códigos 2FA ou dados de cartão, e toda ação sensível (enviar, comprar, apagar, publicar) pede confirmação.',
  'options.agentAllowed': 'Sites em que o agente pode agir',
  'options.agentAllowedHint': 'Um por linha; vale para subdomínios.',
  'options.agentBlocked': 'Sites em que o agente nunca age',
  'options.agentBlockedHint': 'Têm prioridade sobre a lista acima.',
  'options.agentSensitive': 'Sites sensíveis extras',
  'options.agentSensitiveHint':
    'Toda ação do agente nesses sites pede confirmação (bancos e pagamentos conhecidos já são sensíveis).',
  'options.agentMaxSteps': 'Máximo de passos por tarefa',
  'options.agentMaxStepsHint': '5 a 100.',
  'options.agentMaxMinutes': 'Tempo máximo (minutos)',
  'options.agentMaxMinutesHint': '1 a 30.',
  'options.agentScreenshotEachStep': 'Screenshot anotado a cada passo',
  'options.agentScreenshotEachStepHint':
    'Ajuda o modelo a verificar o resultado; cada imagem custa até ~1.000 tokens.',
  'options.save': 'Salvar',
  'options.saved': 'Configurações salvas.',
  'options.unsaved': 'Alterações não salvas.',
  'options.saveHint':
    'Salva as configurações acima (idioma/tema, provedor, modelo, agente). Workflows, memórias, tarefas agendadas e o registro de ações têm seus próprios botões, abaixo.',
  'options.memoryTitle': 'Memória',
  'options.memoryHint':
    'Deixa a Lucerna propor "lembrar disto?" durante a conversa; só salva o que você aprovar. Desligar aqui também para de enviar as memórias já salvas ao modelo.',
  'options.language': 'Idioma',
  'options.languageHint': 'Idioma da interface da extensão.',
  'options.theme': 'Tema',
  'options.themeHint': 'Aparência da extensão.',
  'options.themeLight': 'Claro',
  'options.themeDark': 'Escuro',
  'options.themeSystem': 'Acompanhar o sistema',
  'options.secondaryProviderTitle': 'Segundo provedor (compatível com OpenAI)',
  'options.secondaryProviderHint':
    'Outro serviço com a mesma API de chat da OpenAI (modelos, streaming e function calling no mesmo formato). Preencha URL base e chave para poder escolher esse provedor numa conversa.',
  'options.providerName': 'Nome (só para identificar na lista)',
  'options.secondaryModelHint':
    'Confira o nome exato do modelo na documentação da API do provedor (ex.: gpt-4o-mini).',
  'options.secondaryBaseUrlHint':
    'Padrão: https://api.openai.com/v1 (compatível com a API de chat da OpenAI); mude se usar outro serviço compatível.',
  'options.reasoningEffort': 'Desligar o raciocínio deste modelo',
  'options.reasoningEffortHint':
    'Marque esta opção só se as respostas falharem com erro sempre que as ferramentas estiverem ativas (alguns modelos de raciocínio exigem isso). Deixe desmarcado se não tiver certeza.',
  'options.pricingTitle': 'Preço (opcional, para o medidor de custo)',
  'options.pricingHint':
    'Em qualquer moeda, por 1 milhão de tokens; deixe em branco para mostrar só a contagem de tokens.',
  'options.priceIn': 'Entrada (por 1M tokens)',
  'options.priceOut': 'Saída (por 1M tokens)',

  // Manual.tsx
  'manual.intro':
    'Um resumo rápido do que a Lucerna faz e como usar cada parte. Os nomes em negrito são os mesmos que aparecem nos botões do painel.',
  'manual.sectionChat': 'Conversar',
  'manual.chatTitle': 'Chat',
  'manual.chatBody':
    'Pergunte qualquer coisa; a resposta aparece em streaming, enquanto é gerada. Dá para parar no meio (Parar), pedir uma nova resposta (Regenerar) e copiar mensagens ou trechos de código.',
  'manual.historyTitle': 'Várias conversas',
  'manual.historyBody':
    'O botão ☰ no cabeçalho abre o histórico — crie, renomeie, apague ou busque conversas antigas. Elas ficam salvas no navegador entre sessões.',
  'manual.shortcutTitle': 'Atalho de teclado',
  'manual.shortcutBody': 'Alt+Shift+M abre e fecha o painel rapidamente, em qualquer aba.',
  'manual.sectionContext': 'Dar contexto da página',
  'manual.pageBtnTitle': '📄 Página',
  'manual.pageBtnBody':
    'Lê o texto principal da página aberta (sem menus, anúncios etc.) e anexa à sua próxima mensagem. Dá para editar ou remover antes de enviar.',
  'manual.screenshotBtnTitle': '📷 Screenshot',
  'manual.screenshotBtnBody':
    'Tira uma foto da parte visível da aba e anexa — útil para perguntar sobre algo visual (gráfico, layout, imagem).',
  'manual.annotatedBtnTitle': '🎯 Anotado',
  'manual.annotatedBtnBody':
    'Como o Screenshot, mas desenha caixas numeradas sobre cada botão/campo/link da tela e lista esses elementos. Ajuda a se referir a um elemento específico, por exemplo ao pedir uma ação no modo agente.',
  'manual.imageBtnTitle': '📎 Imagem',
  'manual.imageBtnBody':
    'Anexa uma imagem sua. Também dá para colar (Ctrl+V) ou arrastar e soltar direto na conversa.',
  'manual.selectionTitle': 'Selecionar texto numa página',
  'manual.selectionBody':
    'Selecione um trecho, clique com o botão direito → "Perguntar ao assistente" → pergunte, resuma, traduza ou explique.',
  'manual.sectionTools': 'Ferramentas de leitura',
  'manual.toolsBody':
    'Com o toggle "Ferramentas" ligado no compositor, o modelo pode sozinho — sem você precisar anexar nada — consultar as abas abertas, ler PDFs abertos no navegador, comparar várias abas, extrair uma tabela em CSV ou listar os links de uma página. Só usa isso quando o pedido realmente precisa.',
  'manual.sectionAgent': 'Modo agente',
  'manual.agentBody':
    'Com o toggle "Modo agente" ligado, o assistente pode agir na página de verdade: clicar, digitar, navegar, abrir/trocar abas. Antes de qualquer ação ele propõe um plano, que você aprova; pede para habilitar o site na primeira vez; e pede confirmação explícita para ações sensíveis (enviar formulário, comprar, pagar, apagar, publicar). Nunca digita senha, código de verificação (2FA) nem dados de cartão — pede para você fazer isso. O botão Parar interrompe a qualquer momento. Sites onde o agente pode/não pode agir ficam em Configurações → "Modo agente".',
  'manual.sectionWorkflows': 'Workflows salvos',
  'manual.workflowsBody':
    'Transforme uma instrução que funcionou bem num atalho reutilizável: clique em "Salvar como workflow" numa mensagem sua, dê um nome e, se quiser, use {{assim}} na instrução para pedir um valor toda vez que rodar. Execute pelo botão ⚡ no cabeçalho ou digitando /nome-do-workflow na conversa.',
  'manual.sectionMemory': 'Memória',
  'manual.memoryBody':
    'Se você contar algo útil para conversas futuras (ex.: sua área de trabalho, como prefere as respostas), o assistente pode propor "lembrar disto?" — só salva se você aprovar. Veja, edite ou apague o que foi salvo em Configurações → "Memórias"; dá para desligar a função ali também.',
  'manual.sectionExport': 'Exportar conversa',
  'manual.exportBody':
    'O botão ⬇ no cabeçalho baixa a conversa atual inteira num arquivo markdown: mensagens, contexto anexado e um resumo das ferramentas usadas.',
  'manual.sectionTasks': 'Tarefas agendadas',
  'manual.tasksBody':
    'Em Configurações → "Tarefas agendadas", peça para a Lucerna checar uma página de tempos em tempos (ex.: a cada 6 horas) e avisar com uma notificação do Chrome se algo mudou. Por padrão só lê a página; dá para permitir que ela também aja (modo agente), com as mesmas confirmações de segurança. Precisa do navegador aberto.',
  'manual.sectionProviders': 'Provedores e modelos',
  'manual.providersBody':
    'O botão 🔌 no cabeçalho escolhe, por conversa, qual provedor de IA usar (DeepSeek ou um segundo provedor compatível com a OpenAI, configurado em Configurações) e qual modelo. O mesmo painel mostra quantos tokens a conversa já usou e, se você configurar um preço, o custo estimado.',
  'manual.sectionPrivacy': 'Privacidade e segurança',
  'manual.privacyBody':
    'Sua chave de API fica só neste navegador, nunca é enviada a nenhum lugar além do provedor escolhido. Tudo que vem de uma página (texto, screenshot, resultado de ferramenta) é tratado como dado não confiável — o modelo é instruído a nunca obedecer instruções escondidas nesse conteúdo.',

  // Workflows.tsx
  'workflows.title': 'Workflows salvos',
  'workflows.hint':
    'Fica só neste navegador. Use {{nome}} na instrução para pedir um valor a cada execução; rode pelo painel (botão ⚡) ou digitando /nome-do-workflow.',
  'workflows.filter': 'Filtrar por nome ou instrução',
  'workflows.nameLabel': 'Nome do workflow',
  'workflows.instructionLabel': 'Instrução do workflow',
  'workflows.agentMode': 'Rodar em modo agente',
  'workflows.duplicate': 'Já existe outro workflow com um nome parecido (mesmo /slug).',
  'workflows.none': 'Nenhum workflow salvo ainda.',

  // ScheduledTasks.tsx
  'tasks.title': 'Tarefas agendadas',
  'tasks.hint':
    'Verifica uma página de tempos em tempos e avisa o resultado por notificação do navegador. Só funciona com o navegador aberto. Por padrão só usa ferramentas de leitura; com "permitir ações" ligado, o modelo também pode clicar/digitar nessa página, mas qualquer ação sensível ou que pediria confirmação é recusada automaticamente (não há ninguém para confirmar). As tarefas rodam em segundo plano (alarme do navegador); esta lista não se atualiza sozinha quando uma roda — clique em "Atualizar" para ver o resultado mais recente.',
  'tasks.namePlaceholder': 'Nome (ex.: Preço do notebook)',
  'tasks.instructionPlaceholder': 'O que verificar (opcional; padrão: resumir e dizer o que mudou)',
  'tasks.every': 'A cada',
  'tasks.hours': 'horas',
  'tasks.allowActions': 'Permitir ações (modo agente)',
  'tasks.urlError': 'A URL precisa começar com http:// ou https://.',
  'tasks.permissionError':
    'Sem acesso a sites, a tarefa não consegue abrir a página para verificar.',
  'tasks.create': 'Criar tarefa',
  'tasks.none': 'Nenhuma tarefa agendada ainda.',
  'tasks.disabled': '(desligada)',
  'tasks.lastRun': 'A cada {hours}h · última: {date}',
  'tasks.failed': ' (falhou)',
  'tasks.history': 'Histórico',
  'tasks.disable': 'Desligar',
  'tasks.enable': 'Ligar',
  'tasks.confirmDelete': 'Apagar a tarefa "{name}"?',
  'tasks.noRuns': 'Ainda não rodou.',
  'tasks.noResponse': '(sem resposta)',

  // Memories.tsx
  'memories.title': 'Memórias',
  'memories.hint':
    'Fatos que a Lucerna propôs e você aprovou; ficam só neste navegador e são reenviados ao modelo em toda conversa nova (enquanto "Memória" estiver ligada, acima).',
  'memories.filter': 'Filtrar memórias',
  'memories.clearAll': 'Limpar tudo',
  'memories.confirmDelete': 'Apagar esta memória?',
  'memories.confirmClear': 'Apagar todas as memórias?',
  'memories.textLabel': 'Texto da memória',
  'memories.none': 'Nenhuma memória salva ainda.',

  // ActionLog.tsx
  'actionLog.title': 'Registro de ações do agente',
  'actionLog.hint':
    'Fica só neste navegador. Guarda as últimas 2.000 ações (textos digitados encurtados).',
  'actionLog.filter': 'Filtrar por site ou ação',
  'actionLog.confirmClear': 'Apagar todo o registro de ações?',
  'actionLog.none': 'Nenhuma ação registrada.',
  'actionLog.reasons': 'Motivos: {reasons}',
  'actionLog.result': 'Resultado: {result}',
  'actionLog.failedSuffix': ' (falhou)',
  'actionLog.decisionAuto': 'executada',
  'actionLog.decisionConfirmed': 'confirmada por você',
  'actionLog.decisionRefused': 'recusada por você',
  'actionLog.decisionDenied': 'bloqueada',
  'actionLog.decisionCancelled': 'cancelada',
  'actionLog.decisionPlanApproved': 'plano aprovado',
  'actionLog.decisionPlanRefused': 'plano recusado',

  // Medidor de uso (usage meter)
  'usage.tokens': '{n} tokens',
  'usage.cost': '{tokens} tokens · ~{cost}',

  // ProviderPanel.tsx
  'providerPanel.title': 'Provedor e modelo',
  'providerPanel.secondaryNotConfigured':
    'Configure um segundo provedor nas configurações para poder escolhê-lo aqui.',
  'app.provider': 'Provedor e modelo da conversa',

  // chatStore.ts (erros e avisos)
  'errors.captureFailure': 'Não foi possível capturar a página.',
  'errors.noActiveTab': 'Nenhuma aba ativa para o agente.',
  'errors.toolLimitReached':
    'Parei após {rounds} rodadas de ferramentas. Peça algo mais específico ou continue a conversa.',
  'errors.noFinalText':
    'O modelo terminou sem devolver texto. Tente de novo ou remova o contexto/imagens.',
  'errors.readPageFailure': 'Não foi possível ler a página.',
  'notices.interrupted': 'Tarefa interrompida: {reason}',
  'notices.autoScreenshotSkipped': 'Screenshot automático ignorado: {error}',
  'notices.maxAttachments': 'No máximo {max} imagens por mensagem.',
  'notices.imageTooLarge': '"{name}" passa de 25 MB e foi ignorada.',

  // conversations.ts
  'conversations.newTitle': 'Nova conversa',
};

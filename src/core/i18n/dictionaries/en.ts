import type { ptBR } from './pt-BR';

/** English dictionary. Must have exactly the same keys as `pt-BR.ts` — checked by `dictionaries.test.ts`. */
export const en: Record<keyof typeof ptBR, string> = {
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.update': 'Refresh',
  'common.clear': 'Clear',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
  'common.create': 'Create',
  'common.page': 'page',

  // App.tsx
  'app.history': 'Conversation history',
  'app.newConversation': 'New conversation',
  'app.workflows': 'Saved workflows',
  'app.export': 'Export conversation as markdown',
  'app.settings': 'Settings',
  'app.openSettings': 'Open settings',
  'app.configureApiKey': 'Set up your API key in settings to start chatting.',
  'app.dismissWarning': 'Dismiss warning',
  'app.title': 'Lucerna',

  // ChatView.tsx
  'chat.empty': 'How can I help? Type a message below.',
  'chat.thinking': 'Thinking…',

  // Composer.tsx
  'composer.summarize': 'Summarize',
  'composer.translate': 'Translate',
  'composer.explain': 'Explain',
  'composer.pageTitle': "Reads and attaches the current page's main text",
  'composer.page': '📄 Page',
  'composer.reading': 'Reading…',
  'composer.screenshotTitle': 'Captures the visible part of the tab',
  'composer.screenshot': '📷 Screenshot',
  'composer.capturing': 'Capturing…',
  'composer.annotatedTitle':
    'Screenshot with numbered boxes on interactive elements + element list',
  'composer.annotated': '🎯 Annotated',
  'composer.imageTitle': 'Attach an image (you can also paste or drag one in)',
  'composer.image': '📎 Image',
  'composer.autoScreenshotTitle':
    'Automatically attaches a screenshot of the active tab to every message you send',
  'composer.autoScreenshot': 'Screenshot on every message',
  'composer.toolsTitle': 'Lets the model list and read tabs, PDFs, tables and links (read-only)',
  'composer.tools': 'Reading tools (tabs, PDF)',
  'composer.agentModeTitle':
    "Lets the model click, type and navigate. It proposes a plan first, only acts on sites you've enabled, and asks for confirmation on sensitive actions.",
  'composer.agentMode': 'Agent mode (act in the browser)',
  'composer.placeholderAgent':
    'Describe the task for the agent (e.g.: fill out the form with my name...)',
  'composer.placeholderChat':
    'Type your message (Enter sends, Shift+Enter breaks the line; /name runs a saved workflow)',
  'composer.send': 'Send',
  'composer.stop': 'Stop',
  'composer.messageLabel': 'Message',
  'composer.forLabel': '{label}: {subject}',

  // ContextCard.tsx
  'context.includesSelection': ' (includes selection)',
  'context.onlySelection': ' (selection only)',
  'context.interactiveElements': ' · {n} interactive elements',
  'context.charCount': '{n} characters',
  'context.view': 'View/edit',
  'context.removeLabel': 'Remove context',
  'context.longText':
    'Long text: {total} characters on the page. Sending only the start and end (limit of {limit}).',
  'context.pageText': 'Page text',
  'context.selection': 'Selection',
  'context.interactiveElementsField': 'Interactive elements (ids of the screenshot boxes)',

  // ConversationList.tsx
  'convList.search': 'Search conversations',
  'convList.noneFound': 'No conversation found.',
  'convList.noneYet': 'No conversations yet.',
  'convList.renameLabel': 'Rename {title}',
  'convList.deleteLabel': 'Delete {title}',
  'convList.confirmDelete': 'Delete "{title}"?',
  'convList.newTitleLabel': 'New title',

  // Message.tsx
  'message.toolActionIcon': 'Action tool: changes something on the page or browser',
  'message.toolReadIcon': 'Reading tool: only reads, does not change anything',
  'message.copyCode': 'Copy code',
  'message.saveAsWorkflow': '💾 Save as workflow',
  'message.contextSent': 'Context sent: {title}',
  'message.regenerate': 'Regenerate',
  'message.decisionConfirmed': '✔ confirmed by you',
  'message.decisionRefused': '✋ refused by you',
  'message.decisionDenied': '⛔ blocked by policy',
  'message.decisionCancelled': 'cancelled',
  'message.decisionPlanApproved': '📋 plan approved',
  'message.decisionPlanRefused': '📋 plan refused',
  'message.toolPending': '⏳ running…',
  'message.toolOk': '✓',
  'message.toolError': '✗ error',
  'message.toolResultMore': '\n[… {n} more characters sent to the model]',
  'message.observation': 'Page observation',
  'message.memorySaved': '🧠 Memory saved: "{text}"',
  'message.memoryDismissed': '🧠 Memory dismissed: "{text}"',
  'message.memoryAsk': '🧠 Remember this: "{text}"?',
  'message.memorySave': 'Save',
  'message.memoryIgnore': 'Ignore',

  // SaveWorkflowDialog.tsx
  'workflowDialog.title': '💾 Save as workflow',
  'workflowDialog.name': 'Name',
  'workflowDialog.instruction': 'Instruction',
  'workflowDialog.placeholderHint':
    'Use {{name}} in the text to ask for a value every time it runs.',
  'workflowDialog.agentMode': 'Run in agent mode',
  'workflowDialog.duplicate':
    'There is already a similarly named workflow (same /slug). Choose another name.',

  // Thumbnails.tsx
  'thumb.screenshot': 'Screenshot',
  'thumb.annotated': 'Annotated screenshot',
  'thumb.upload': 'Image',
  'thumb.enlarge': 'Enlarge {kind}',
  'thumb.remove': 'Remove image',

  // WorkflowList.tsx
  'workflowList.search': 'Search workflows',
  'workflowList.noneFound': 'No workflow found.',
  'workflowList.noneYet': 'No saved workflows yet.',
  'workflowList.deleteLabel': 'Delete {name}',
  'workflowList.confirmDelete': 'Delete the "{name}" workflow?',
  'workflowList.manage': 'Manage workflows (edit/delete)',

  // WorkflowParamsForm.tsx
  'workflowParams.run': 'Run',

  // AgentBar.tsx
  'agentBar.working': '🤖 Agent working · step {round}/{max} · {actions} action(s) · {sec}s',
  'agentBar.idle': '🤖 Agent mode: can click, type and navigate on enabled sites.',
  'agentBar.stop': '■ STOP',
  'agentBar.sites': 'Sites',
  'agentBar.log': 'Log',
  'agentBar.tainted':
    '⚠️ A page showed text that looks like an instruction for the assistant ("{text}"). It must not be followed; from now on every action asks for your confirmation.',

  // AgentCards.tsx
  'agentCards.planLabel': 'Agent plan',
  'agentCards.planTitle': '📋 Plan proposed by the agent',
  'agentCards.sites': 'Sites: {sites}',
  'agentCards.enableSites':
    'Enable the agent on: {sites} (without this, it asks for permission on the first action on each site)',
  'agentCards.sensitiveNotice':
    'Sensitive actions (submit, buy, delete, publish) will still ask for confirmation.',
  'agentCards.runPlan': 'Run plan',
  'agentCards.cancel': 'Cancel',
  'agentCards.sensitiveTitle': '⚠️ Sensitive action: confirm',
  'agentCards.confirmLabel': "Confirm the agent's action",
  'agentCards.confirmTitle': '✋ Confirmation needed',
  'agentCards.in': ' on {site}',
  'agentCards.destination': 'Destination: {url}',
  'agentCards.reason': "Agent's justification (unverified): {reason}",
  'agentCards.enableAndAllow': 'Enable agent on {domain} and allow',
  'agentCards.allow': 'Allow',
  'agentCards.refuse': 'Refuse',

  // Options.tsx
  'options.title': 'Lucerna settings',
  'options.tabSettings': 'Settings',
  'options.tabManual': 'Manual',
  'options.apiKey': 'API key',
  'options.apiKeyHint':
    'Stays only in this browser (chrome.storage.local) and is sent only to the configured provider.',
  'options.show': 'Show',
  'options.hide': 'Hide',
  'options.model': 'Model',
  'options.modelHint':
    "Default: deepseek-flash (accepts images). Check the exact model name in the provider's API documentation.",
  'options.baseUrl': 'Base URL',
  'options.baseUrlHint': 'Default: https://api.deepseek.com',
  'options.temperature': 'Temperature: {value}',
  'options.temperatureHint': '0 = more deterministic, 2 = more creative.',
  'options.systemPrompt': 'Custom system prompt',
  'options.systemPromptHint': "Extra instructions, added to Lucerna's default prompt.",
  'options.blockedDomains': 'Domains without capture',
  'options.blockedDomainsHint':
    "One per line (e.g.: mybank.com). Lucerna won't read text, screenshots or the snapshot on these sites or their subdomains.",
  'options.agentTitle': 'Agent mode',
  'options.agentHint':
    'The agent only acts on the sites listed below (you can also enable a site on the spot, from the panel). It never types passwords, 2FA codes or card data, and every sensitive action (submit, buy, delete, publish) asks for confirmation.',
  'options.agentAllowed': 'Sites where the agent can act',
  'options.agentAllowedHint': 'One per line; applies to subdomains.',
  'options.agentBlocked': 'Sites where the agent never acts',
  'options.agentBlockedHint': 'Take priority over the list above.',
  'options.agentSensitive': 'Extra sensitive sites',
  'options.agentSensitiveHint':
    'Every agent action on these sites asks for confirmation (known banks and payment sites are already sensitive).',
  'options.agentMaxSteps': 'Maximum steps per task',
  'options.agentMaxStepsHint': '5 to 100.',
  'options.agentMaxMinutes': 'Maximum time (minutes)',
  'options.agentMaxMinutesHint': '1 to 30.',
  'options.agentScreenshotEachStep': 'Annotated screenshot on every step',
  'options.agentScreenshotEachStepHint':
    'Helps the model check the result; each image costs up to ~1,000 tokens.',
  'options.save': 'Save',
  'options.saved': 'Settings saved.',
  'options.unsaved': 'Unsaved changes.',
  'options.saveHint':
    'Saves the settings above (language/theme, provider, model, agent). Workflows, memories, scheduled tasks and the action log have their own buttons, below.',
  'options.memoryTitle': 'Memory',
  'options.memoryHint':
    'Lets Lucerna propose "remember this?" during a conversation; it only saves what you approve. Turning this off also stops sending already-saved memories to the model.',
  'options.language': 'Language',
  'options.languageHint': "The extension's interface language.",
  'options.theme': 'Theme',
  'options.themeHint': "The extension's appearance.",
  'options.themeLight': 'Light',
  'options.themeDark': 'Dark',
  'options.themeSystem': 'Follow system',
  'options.secondaryProviderTitle': 'Second provider (OpenAI-compatible)',
  'options.secondaryProviderHint':
    'Another service with the same chat API as OpenAI (models, streaming and function calling in the same format). Fill in the base URL and key to be able to pick this provider in a conversation.',
  'options.providerName': 'Name (just to identify it in the list)',
  'options.secondaryModelHint':
    "Check the exact model name in the provider's API documentation (e.g.: gpt-4o-mini).",
  'options.secondaryBaseUrlHint':
    'Default: https://api.openai.com/v1 (OpenAI chat-API compatible); change it if you use a different compatible service.',
  'options.reasoningEffort': "Turn off this model's reasoning",
  'options.reasoningEffortHint':
    "Only check this if responses fail with an error whenever tools are turned on (some reasoning models require this). Leave it unchecked if you're not sure.",
  'options.pricingTitle': 'Price (optional, for the cost meter)',
  'options.pricingHint':
    'In any currency, per 1 million tokens; leave blank to show only the token count.',
  'options.priceIn': 'Input (per 1M tokens)',
  'options.priceOut': 'Output (per 1M tokens)',

  // Manual.tsx
  'manual.intro':
    'A quick summary of what Lucerna does and how to use each part. The bold names match the buttons you see in the panel.',
  'manual.sectionChat': 'Chatting',
  'manual.chatTitle': 'Chat',
  'manual.chatBody':
    "Ask anything; the answer streams in as it's generated. You can stop midway (Stop), ask for a new answer (Regenerate), and copy messages or code snippets.",
  'manual.historyTitle': 'Multiple conversations',
  'manual.historyBody':
    'The ☰ button in the header opens the history — create, rename, delete or search old conversations. They stay saved in the browser between sessions.',
  'manual.shortcutTitle': 'Keyboard shortcut',
  'manual.shortcutBody': 'Alt+Shift+M quickly opens and closes the panel, on any tab.',
  'manual.sectionContext': 'Giving page context',
  'manual.pageBtnTitle': '📄 Page',
  'manual.pageBtnBody':
    "Reads the open page's main text (no menus, ads, etc.) and attaches it to your next message. You can edit or remove it before sending.",
  'manual.screenshotBtnTitle': '📷 Screenshot',
  'manual.screenshotBtnBody':
    'Takes a picture of the visible part of the tab and attaches it — useful for asking about something visual (a chart, layout, image).',
  'manual.annotatedBtnTitle': '🎯 Annotated',
  'manual.annotatedBtnBody':
    'Like Screenshot, but draws numbered boxes over every button/field/link on screen and lists those elements. Helps you refer to a specific element, for example when asking for an action in agent mode.',
  'manual.imageBtnTitle': '📎 Image',
  'manual.imageBtnBody':
    'Attaches an image of your own. You can also paste (Ctrl+V) or drag and drop one straight into the conversation.',
  'manual.selectionTitle': 'Selecting text on a page',
  'manual.selectionBody':
    'Select some text, right-click → "Ask the assistant" → ask, summarize, translate or explain.',
  'manual.sectionTools': 'Reading tools',
  'manual.toolsBody':
    'With the "Tools" toggle on in the composer, the model can, on its own — without you attaching anything — check open tabs, read PDFs open in the browser, compare several tabs, extract a table as CSV, or list the links on a page. It only does this when the request actually needs it.',
  'manual.sectionAgent': 'Agent mode',
  'manual.agentBody':
    'With the "Agent mode" toggle on, the assistant can actually act on the page: click, type, navigate, open/switch tabs. Before any action it proposes a plan, which you approve; it asks to enable the site the first time; and it asks for explicit confirmation for sensitive actions (submitting a form, buying, paying, deleting, publishing). It never types a password, verification code (2FA) or card details — it asks you to do that. The Stop button interrupts at any time. Sites where the agent can/cannot act live in Settings → "Agent mode".',
  'manual.sectionWorkflows': 'Saved workflows',
  'manual.workflowsBody':
    'Turn an instruction that worked well into a reusable shortcut: click "Save as workflow" on one of your messages, give it a name, and optionally use {{like this}} in the instruction to ask for a value every time it runs. Run it from the ⚡ button in the header or by typing /workflow-name in the conversation.',
  'manual.sectionMemory': 'Memory',
  'manual.memoryBody':
    'If you share something useful for future conversations (e.g. your field of work, how you prefer answers), the assistant can propose "remember this?" — it only saves if you approve. View, edit or delete what was saved in Settings → "Memories"; you can also turn the feature off there.',
  'manual.sectionExport': 'Exporting a conversation',
  'manual.exportBody':
    'The ⬇ button in the header downloads the whole current conversation as a markdown file: messages, attached context and a summary of the tools used.',
  'manual.sectionTasks': 'Scheduled tasks',
  'manual.tasksBody':
    'Further down, in "Scheduled tasks", ask Lucerna to check a page every so often (e.g. every 6 hours) and let you know with a Chrome notification if something changed. By default it only reads the page; you can allow it to also act (agent mode), with the same safety confirmations. Needs the browser to stay open.',
  'manual.sectionProviders': 'Providers and models',
  'manual.providersBody':
    'The 🔌 button in the header picks, per conversation, which AI provider to use (DeepSeek or a second OpenAI-compatible provider configured in Settings) and which model. The same panel shows how many tokens the conversation has used and, if you set a price, the estimated cost.',
  'manual.sectionPrivacy': 'Privacy and security',
  'manual.privacyBody':
    'Your API key stays only in this browser, never sent anywhere besides the chosen provider. Anything coming from a page (text, screenshot, tool result) is treated as untrusted data — the model is instructed to never follow instructions hidden in that content.',

  // Workflows.tsx
  'workflows.title': 'Saved workflows',
  'workflows.hint':
    'Stays only in this browser. Use {{name}} in the instruction to ask for a value on every run; run it from the panel (⚡ button) or by typing /workflow-name.',
  'workflows.filter': 'Filter by name or instruction',
  'workflows.nameLabel': 'Workflow name',
  'workflows.instructionLabel': 'Workflow instruction',
  'workflows.agentMode': 'Run in agent mode',
  'workflows.duplicate': 'There is already another similarly named workflow (same /slug).',
  'workflows.none': 'No saved workflows yet.',

  // ScheduledTasks.tsx
  'tasks.title': 'Scheduled tasks',
  'tasks.hint':
    'Checks a page from time to time and reports the result via a browser notification. Only works while the browser is open. By default it only uses reading tools; with "allow actions" on, the model can also click/type on that page, but any sensitive action, or one that would ask for confirmation, is refused automatically (there is no one to confirm it). Tasks run in the background (browser alarm); this list does not refresh itself when one runs — click "Refresh" to see the latest result.',
  'tasks.namePlaceholder': 'Name (e.g.: Laptop price)',
  'tasks.instructionPlaceholder':
    'What to check (optional; default: summarize and say what changed)',
  'tasks.every': 'Every',
  'tasks.hours': 'hours',
  'tasks.allowActions': 'Allow actions (agent mode)',
  'tasks.urlError': 'The URL must start with http:// or https://.',
  'tasks.permissionError': 'Without access to sites, the task cannot open the page to check it.',
  'tasks.create': 'Create task',
  'tasks.none': 'No scheduled tasks yet.',
  'tasks.disabled': '(disabled)',
  'tasks.lastRun': 'Every {hours}h · last: {date}',
  'tasks.failed': ' (failed)',
  'tasks.history': 'History',
  'tasks.disable': 'Disable',
  'tasks.enable': 'Enable',
  'tasks.confirmDelete': 'Delete the "{name}" task?',
  'tasks.noRuns': "Hasn't run yet.",
  'tasks.noResponse': '(no response)',

  // Memories.tsx
  'memories.title': 'Memories',
  'memories.hint':
    'Facts Lucerna proposed and you approved; they stay only in this browser and are resent to the model in every new conversation (while "Memory" is on, above).',
  'memories.filter': 'Filter memories',
  'memories.clearAll': 'Clear all',
  'memories.confirmDelete': 'Delete this memory?',
  'memories.confirmClear': 'Delete all memories?',
  'memories.textLabel': 'Memory text',
  'memories.none': 'No saved memories yet.',

  // ActionLog.tsx
  'actionLog.title': 'Agent action log',
  'actionLog.hint':
    'Stays only in this browser. Keeps the last 2,000 actions (typed text is shortened).',
  'actionLog.filter': 'Filter by site or action',
  'actionLog.confirmClear': 'Delete the entire action log?',
  'actionLog.none': 'No actions logged.',
  'actionLog.reasons': 'Reasons: {reasons}',
  'actionLog.result': 'Result: {result}',
  'actionLog.failedSuffix': ' (failed)',
  'actionLog.decisionAuto': 'executed',
  'actionLog.decisionConfirmed': 'confirmed by you',
  'actionLog.decisionRefused': 'refused by you',
  'actionLog.decisionDenied': 'blocked',
  'actionLog.decisionCancelled': 'cancelled',
  'actionLog.decisionPlanApproved': 'plan approved',
  'actionLog.decisionPlanRefused': 'plan refused',

  // Usage meter
  'usage.tokens': '{n} tokens',
  'usage.cost': '{tokens} tokens · ~{cost}',

  // ProviderPanel.tsx
  'providerPanel.title': 'Provider and model',
  'providerPanel.secondaryNotConfigured': 'Set up a second provider in settings to pick it here.',
  'app.provider': "Conversation's provider and model",

  // chatStore.ts (errors and notices)
  'errors.captureFailure': 'Could not capture the page.',
  'errors.noActiveTab': 'No active tab for the agent.',
  'errors.toolLimitReached':
    'Stopped after {rounds} tool rounds. Ask something more specific or continue the conversation.',
  'errors.noFinalText':
    'The model finished without returning text. Try again or remove the context/images.',
  'errors.readPageFailure': 'Could not read the page.',
  'notices.interrupted': 'Task interrupted: {reason}',
  'notices.autoScreenshotSkipped': 'Automatic screenshot skipped: {error}',
  'notices.maxAttachments': 'A maximum of {max} images per message.',
  'notices.imageTooLarge': '"{name}" is over 25 MB and was ignored.',

  // conversations.ts
  'conversations.newTitle': 'New conversation',
};

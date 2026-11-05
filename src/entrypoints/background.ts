import { MENU_IDS, PENDING_KEY, type PendingAsk } from '@/core/page/pending';
import { listScheduledTasks } from '@/core/storage/scheduledTasks';
import { syncAllTaskAlarms, taskIdFromAlarm } from '@/core/tasks/alarms';
import { executeScheduledTask } from '@/core/tasks/execute';

const MENU_ROOT = 'lucerna-root';

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ROOT,
      title: 'Perguntar ao assistente',
      contexts: ['selection'],
    });
    const items: [string, string][] = [
      ['lucerna-ask', 'Perguntar sobre a seleção'],
      ['lucerna-summarize', 'Resumir'],
      ['lucerna-translate', 'Traduzir'],
      ['lucerna-explain', 'Explicar'],
    ];
    for (const [id, title] of items) {
      chrome.contextMenus.create({ id, title, parentId: MENU_ROOT, contexts: ['selection'] });
    }
  });
}

export default defineBackground(() => {
  // Clicar no ícone da extensão abre o painel lateral.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: unknown) => console.error('Falha ao configurar o painel lateral', err));

  chrome.runtime.onInstalled.addListener(createMenus);

  // Garante um alarme por tarefa ligada (ex.: o Chrome reinicia e perde alarmes sem periodInMinutes
  // retomado, ou uma tarefa foi criada/editada enquanto o background estava inativo).
  const syncAlarms = () =>
    void listScheduledTasks()
      .then(syncAllTaskAlarms)
      .catch((err: unknown) => console.error('Lucerna: falha ao sincronizar alarmes', err));
  chrome.runtime.onInstalled.addListener(syncAlarms);
  chrome.runtime.onStartup.addListener(syncAlarms);

  // Roda direto no service worker: documentos offscreen não têm acesso a chrome.storage nem
  // chrome.tabs (ver docs/decisions.md), então não dá para executar a tarefa lá.
  chrome.alarms.onAlarm.addListener((alarm) => {
    const taskId = taskIdFromAlarm(alarm.name);
    if (taskId) {
      void executeScheduledTask(taskId).catch((err: unknown) =>
        console.error('Lucerna: falha ao rodar tarefa agendada', err),
      );
    }
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    const action = MENU_IDS[String(info.menuItemId)];
    if (!action || !info.selectionText) return;
    // sidePanel.open precisa ser chamado de forma síncrona dentro do gesto do usuário.
    if (tab?.windowId !== undefined) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch((err: unknown) => console.error(err));
    }
    const pending: PendingAsk = {
      action,
      text: info.selectionText,
      title: tab?.title ?? '',
      url: info.pageUrl ?? tab?.url ?? '',
      ts: Date.now(),
    };
    void chrome.storage.session.set({ [PENDING_KEY]: pending });
  });

  // Atalho de teclado (configurável em chrome://extensions/shortcuts).
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'open-sidepanel' && tab?.windowId !== undefined) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch((err: unknown) => console.error(err));
    }
  });
});

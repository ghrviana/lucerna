/** Esperas abortáveis ligadas a abas (navegação, carregamento), usadas pelas ações do agente. */

export function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('Interrompido', 'AbortError');
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError(signal));
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Inicia uma navegação e espera a aba terminar de carregar. Se ela não começar a carregar em
 * `startMs` (ex.: mudança de âncora, SPA), considera concluída. Limite total: `timeoutMs`.
 */
export function navigateAndWait(
  tabId: number,
  start: () => Promise<unknown>,
  signal: AbortSignal,
  { startMs = 1500, timeoutMs = 15_000 } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    let loading = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (err?: unknown) => {
      timers.forEach(clearTimeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      signal.removeEventListener('abort', onAbort);
      if (err === undefined) resolve();
      else reject(err);
    };
    const onUpdated = (id: number, info: { status?: string }) => {
      if (id !== tabId) return;
      if (info.status === 'loading') loading = true;
      if (info.status === 'complete' && loading) finish();
    };
    const onAbort = () => finish(abortError(signal));
    if (signal.aborted) return reject(abortError(signal));
    chrome.tabs.onUpdated.addListener(onUpdated);
    signal.addEventListener('abort', onAbort, { once: true });
    timers.push(setTimeout(() => !loading && finish(), startMs));
    timers.push(setTimeout(() => finish(), timeoutMs));
    start().catch((err: unknown) => finish(err));
  });
}

/** Espera a aba chegar a status "complete" (ou o limite de tempo). */
export function waitForComplete(
  tabId: number,
  signal: AbortSignal,
  timeoutMs = 15_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (err?: unknown) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      signal.removeEventListener('abort', onAbort);
      if (err === undefined) resolve();
      else reject(err);
    };
    const onUpdated = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    const onAbort = () => finish(abortError(signal));
    if (signal.aborted) return reject(abortError(signal));
    const timer = setTimeout(() => finish(), timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdated);
    signal.addEventListener('abort', onAbort, { once: true });
    chrome.tabs
      .get(tabId)
      .then((t) => t.status === 'complete' && finish())
      .catch(() => finish());
  });
}

/** Depois de um clique/tecla: se a página começou a navegar, espera carregar. */
export async function waitIfNavigating(tabId: number, signal: AbortSignal): Promise<void> {
  await sleep(200, signal);
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (tab?.status === 'loading') await waitForComplete(tabId, signal);
}

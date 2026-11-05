import { normalizeDomain } from '../page/blocklist';
import { LOCALES, type Locale } from '../i18n/translate';

export type Theme = 'light' | 'dark' | 'system';
export const THEMES: Theme[] = ['light', 'dark', 'system'];

/** Segundo provedor, compatível com a API de chat da OpenAI (Fase 8). */
export interface SecondaryProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /**
   * `reasoning_effort` opcional, enviado como está a cada requisição. Alguns modelos de raciocínio
   * compatíveis com a OpenAI (ex.: gpt-6-luna) só aceitam function calling via Chat Completions com
   * `reasoning_effort: "none"`; sem isso a API recusa a requisição sempre que há ferramentas
   * disponíveis. Vazio/`undefined` = não envia o campo. Na UI (Options.tsx) isso vira um simples
   * checkbox liga/desliga (marcado = `"none"`), mas o tipo fica como string livre aqui.
   */
  reasoningEffort?: string;
  /** Preço opcional (qualquer moeda) por 1M tokens, só para o medidor de custo estimado. */
  priceInPerMTok?: number;
  priceOutPerMTok?: number;
}

export const EMPTY_SECONDARY_PROVIDER: SecondaryProvider = {
  name: '',
  // Padrão útil pra quem for configurar a OpenAI (o caso mais comum de "segundo provedor");
  // editável como qualquer campo — normalizeSecondaryProvider nunca sobrescreve um valor já salvo.
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
};

export interface Settings {
  apiKey: string;
  model: string;
  baseUrl: string;
  systemPrompt: string;
  temperature: number;
  /** Domínios (e subdomínios) em que a Lucerna não lê texto, screenshot nem snapshot. */
  blockedDomains: string[];
  /** Modo agente: sites (e subdomínios) em que o agente pode agir. Vazio = nenhum. */
  agentAllowedDomains: string[];
  /** Sites em que o agente nunca age, mesmo se permitidos. */
  agentBlockedDomains: string[];
  /** Sites extras em que toda ação do agente pede confirmação (além da lista embutida). */
  sensitiveDomains: string[];
  /** Máximo de rodadas (passos) por tarefa do agente. */
  agentMaxSteps: number;
  /** Tempo máximo de uma tarefa do agente, em minutos. */
  agentMaxMinutes: number;
  /** Screenshot anotado após cada ação (além do snapshot textual). */
  agentScreenshotEachStep: boolean;
  /** Memória leve: o modelo pode propor "lembrar disto?" e o usuário aprova/edita/apaga. */
  memoryEnabled: boolean;
  /** Idioma da interface (Fase 8). */
  language: Locale;
  /** Tema da interface (Fase 8). */
  theme: Theme;
  /** Preço opcional do provedor padrão, por 1M tokens, para o medidor de custo estimado. */
  priceInPerMTok?: number;
  priceOutPerMTok?: number;
  /** Segundo provedor (Fase 8); "configurado" = baseUrl e apiKey preenchidos. */
  secondaryProvider: SecondaryProvider;
}

export const DEFAULT_SETTINGS: Settings = {
  blockedDomains: [],
  apiKey: '',
  model: 'deepseek-flash',
  baseUrl: 'https://api.deepseek.com',
  systemPrompt: '',
  temperature: 1,
  agentAllowedDomains: [],
  agentBlockedDomains: [],
  sensitiveDomains: [],
  agentMaxSteps: 30,
  agentMaxMinutes: 5,
  agentScreenshotEachStep: true,
  memoryEnabled: true,
  language: 'pt-BR',
  theme: 'system',
  secondaryProvider: EMPTY_SECONDARY_PROVIDER,
};

const KEY = 'settings';

const domainList = (v: unknown): string[] =>
  Array.isArray(v)
    ? Array.from(new Set(v.map((d) => normalizeDomain(String(d))).filter(Boolean)))
    : [];

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Preço opcional (por 1M tokens): número finito e não-negativo, ou undefined. */
function optionalPrice(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function normalizeSecondaryProvider(raw: unknown): SecondaryProvider {
  const s = { ...EMPTY_SECONDARY_PROVIDER, ...(raw as Partial<SecondaryProvider> | undefined) };
  const reasoningEffort = String(s.reasoningEffort ?? '').trim();
  return {
    name: String(s.name).trim(),
    baseUrl: String(s.baseUrl).trim().replace(/\/+$/, ''),
    apiKey: String(s.apiKey).trim(),
    model: String(s.model).trim(),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    priceInPerMTok: optionalPrice(s.priceInPerMTok),
    priceOutPerMTok: optionalPrice(s.priceOutPerMTok),
  };
}

/** Aplica padrões e limites (temperatura 0–2, strings aparadas, listas de domínios normalizadas). */
export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...raw };
  const temp = Number(s.temperature);
  const d = DEFAULT_SETTINGS;
  return {
    apiKey: String(s.apiKey).trim(),
    model: String(s.model).trim() || d.model,
    baseUrl: String(s.baseUrl).trim().replace(/\/+$/, '') || d.baseUrl,
    systemPrompt: String(s.systemPrompt),
    blockedDomains: domainList(s.blockedDomains),
    temperature: Number.isFinite(temp) ? Math.min(2, Math.max(0, temp)) : d.temperature,
    agentAllowedDomains: domainList(s.agentAllowedDomains),
    agentBlockedDomains: domainList(s.agentBlockedDomains),
    sensitiveDomains: domainList(s.sensitiveDomains),
    agentMaxSteps: clampInt(s.agentMaxSteps, 5, 100, d.agentMaxSteps),
    agentMaxMinutes: clampInt(s.agentMaxMinutes, 1, 30, d.agentMaxMinutes),
    agentScreenshotEachStep: s.agentScreenshotEachStep !== false,
    memoryEnabled: s.memoryEnabled !== false,
    language: LOCALES.includes(s.language) ? s.language : d.language,
    theme: THEMES.includes(s.theme) ? s.theme : d.theme,
    priceInPerMTok: optionalPrice(s.priceInPerMTok),
    priceOutPerMTok: optionalPrice(s.priceOutPerMTok),
    secondaryProvider: normalizeSecondaryProvider(s.secondaryProvider),
  };
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return normalizeSettings(stored[KEY] as Partial<Settings> | undefined);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: normalizeSettings(settings) });
}

/** Lê, altera e salva as configurações (ex.: habilitar o agente num site a partir do painel). */
export async function updateSettings(
  change: (s: Settings) => Partial<Settings>,
): Promise<Settings> {
  const current = await getSettings();
  const next = normalizeSettings({ ...current, ...change(current) });
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

/** Chama o callback quando as configurações mudam (ex.: salvas na página de opções). */
export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY])
      cb(normalizeSettings(changes[KEY].newValue as Partial<Settings>));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, EMPTY_SECONDARY_PROVIDER, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('usa padrões quando vazio', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
  it('limita a temperatura e apara strings', () => {
    const s = normalizeSettings({
      temperature: 9,
      apiKey: '  k  ',
      baseUrl: 'https://a.test///',
      model: ' ',
    });
    expect(s.temperature).toBe(2);
    expect(s.apiKey).toBe('k');
    expect(s.baseUrl).toBe('https://a.test');
    expect(s.model).toBe('deepseek-flash');
  });
  it('trata temperatura inválida', () => {
    expect(normalizeSettings({ temperature: NaN }).temperature).toBe(1);
  });
  it('memoryEnabled é true por padrão e preserva false explícito', () => {
    expect(normalizeSettings(undefined).memoryEnabled).toBe(true);
    expect(normalizeSettings({ memoryEnabled: false }).memoryEnabled).toBe(false);
  });

  it('idioma e tema caem no padrão se o valor for desconhecido (Fase 8)', () => {
    expect(normalizeSettings(undefined).language).toBe('pt-BR');
    expect(normalizeSettings(undefined).theme).toBe('system');
    expect(normalizeSettings({ language: 'fr' as never }).language).toBe('pt-BR');
    expect(normalizeSettings({ theme: 'blue' as never }).theme).toBe('system');
    expect(normalizeSettings({ language: 'en', theme: 'dark' }).language).toBe('en');
    expect(normalizeSettings({ language: 'en', theme: 'dark' }).theme).toBe('dark');
  });

  it('normaliza o segundo provedor (apara strings, preço só se finito e não-negativo)', () => {
    const s = normalizeSettings({
      secondaryProvider: {
        name: '  Custom  ',
        baseUrl: 'https://x.test///',
        apiKey: ' k ',
        model: ' m ',
        priceInPerMTok: -1,
        priceOutPerMTok: 5,
      },
    });
    expect(s.secondaryProvider).toEqual({
      name: 'Custom',
      baseUrl: 'https://x.test',
      apiKey: 'k',
      model: 'm',
      priceInPerMTok: undefined,
      priceOutPerMTok: 5,
    });
    expect(normalizeSettings(undefined).secondaryProvider).toEqual({
      name: '',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: '',
      priceInPerMTok: undefined,
      priceOutPerMTok: undefined,
    });
  });

  it('segundo provedor vem com a URL base da OpenAI pré-preenchida por padrão', () => {
    expect(EMPTY_SECONDARY_PROVIDER.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('preserva um baseUrl vazio salvo de propósito (não aplica o novo padrão por cima)', () => {
    const secondaryProvider = { name: '', baseUrl: '', apiKey: 'k', model: 'm' };
    expect(normalizeSettings({ secondaryProvider }).secondaryProvider.baseUrl).toBe('');
  });

  it('reasoningEffort do segundo provedor: apara espaços e some se vazio', () => {
    const base = { name: '', baseUrl: '', apiKey: '', model: '' };
    expect(
      normalizeSettings({ secondaryProvider: { ...base, reasoningEffort: '  none  ' } })
        .secondaryProvider.reasoningEffort,
    ).toBe('none');
    expect(
      normalizeSettings({ secondaryProvider: { ...base, reasoningEffort: '   ' } })
        .secondaryProvider.reasoningEffort,
    ).toBeUndefined();
    expect(normalizeSettings(undefined).secondaryProvider.reasoningEffort).toBeUndefined();
  });

  it('preço do provedor padrão: undefined quando ausente/inválido, preservado quando válido', () => {
    expect(normalizeSettings(undefined).priceInPerMTok).toBeUndefined();
    expect(normalizeSettings({ priceInPerMTok: NaN }).priceInPerMTok).toBeUndefined();
    expect(normalizeSettings({ priceOutPerMTok: 3 }).priceOutPerMTok).toBe(3);
  });
});

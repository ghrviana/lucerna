import { describe, expect, it } from 'vitest';
import { en } from './dictionaries/en';
import { ptBR } from './dictionaries/pt-BR';
import { translate } from './translate';

describe('dicionários pt-BR / en', () => {
  it('têm exatamente as mesmas chaves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ptBR).sort());
  });

  it('nenhum texto fica vazio', () => {
    for (const [dict, entries] of [
      ['pt-BR', ptBR],
      ['en', en],
    ] as const) {
      for (const [key, value] of Object.entries(entries)) {
        expect(value.trim(), `${dict}.${key} está vazio`).not.toBe('');
      }
    }
  });
});

describe('translate', () => {
  it('troca {var} pelo valor dado', () => {
    expect(translate('pt-BR', 'convList.deleteLabel', { title: 'Teste' })).toBe('Apagar Teste');
    expect(translate('en', 'convList.deleteLabel', { title: 'Test' })).toBe('Delete Test');
  });

  it('cai para pt-BR e depois para a própria chave, se faltar', () => {
    const fake = 'nao.existe' as never;
    expect(translate('en', fake)).toBe('nao.existe');
  });
});

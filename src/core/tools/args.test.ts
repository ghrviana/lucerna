import { describe, expect, it } from 'vitest';
import {
  optionalBool,
  optionalInt,
  optionalNumber,
  optionalString,
  optionalTabId,
  requiredInt,
  requiredString,
  requiredTabId,
  stringList,
  ToolArgError,
} from './args';

describe('optionalTabId / requiredTabId', () => {
  it('aceita número inteiro, direto ou como string', () => {
    expect(optionalTabId({ tabId: 7 })).toBe(7);
    expect(optionalTabId({ tabId: '7' })).toBe(7);
  });
  it('undefined/null/vazio vira undefined (opcional)', () => {
    expect(optionalTabId({})).toBeUndefined();
    expect(optionalTabId({ tabId: null })).toBeUndefined();
    expect(optionalTabId({ tabId: '' })).toBeUndefined();
  });
  it('rejeita não-inteiro', () => {
    expect(() => optionalTabId({ tabId: 1.5 })).toThrow(ToolArgError);
    expect(() => optionalTabId({ tabId: 'abc' })).toThrow(ToolArgError);
    expect(() => optionalTabId({ tabId: true })).toThrow(ToolArgError);
  });
  it('requiredTabId exige o campo', () => {
    expect(requiredTabId({ tabId: 3 })).toBe(3);
    expect(() => requiredTabId({})).toThrow(ToolArgError);
  });
});

describe('optionalString / requiredString', () => {
  it('aceita string e number, convertendo number para string', () => {
    expect(optionalString({ k: 'x' }, 'k')).toBe('x');
    expect(optionalString({ k: 42 }, 'k')).toBe('42');
  });
  it('undefined/null/vazio vira undefined', () => {
    expect(optionalString({}, 'k')).toBeUndefined();
    expect(optionalString({ k: null }, 'k')).toBeUndefined();
    expect(optionalString({ k: '' }, 'k')).toBeUndefined();
  });
  it('rejeita tipos que não são texto nem número', () => {
    expect(() => optionalString({ k: true }, 'k')).toThrow(ToolArgError);
    expect(() => optionalString({ k: {} }, 'k')).toThrow(ToolArgError);
  });
  it('requiredString rejeita ausente, mas aceita number', () => {
    expect(requiredString({ k: 'y' }, 'k')).toBe('y');
    expect(requiredString({ k: 5 }, 'k')).toBe('5');
    expect(() => requiredString({}, 'k')).toThrow(ToolArgError);
    expect(() => requiredString({ k: null }, 'k')).toThrow(ToolArgError);
  });
});

describe('optionalInt / requiredInt', () => {
  it('aceita inteiro, direto ou como string', () => {
    expect(optionalInt({ k: 10 }, 'k')).toBe(10);
    expect(optionalInt({ k: '10' }, 'k')).toBe(10);
  });
  it('undefined/null/vazio vira undefined', () => {
    expect(optionalInt({}, 'k')).toBeUndefined();
    expect(optionalInt({ k: '' }, 'k')).toBeUndefined();
  });
  it('rejeita não-inteiro (fração, texto não numérico)', () => {
    expect(() => optionalInt({ k: 1.2 }, 'k')).toThrow(ToolArgError);
    expect(() => optionalInt({ k: 'abc' }, 'k')).toThrow(ToolArgError);
  });
  it('requiredInt exige o campo', () => {
    expect(requiredInt({ k: 2 }, 'k')).toBe(2);
    expect(() => requiredInt({}, 'k')).toThrow(ToolArgError);
  });
});

describe('optionalNumber', () => {
  it('aceita número fracionário, direto ou como string', () => {
    expect(optionalNumber({ k: 1.5 }, 'k')).toBe(1.5);
    expect(optionalNumber({ k: '1.5' }, 'k')).toBe(1.5);
  });
  it('undefined/null/vazio vira undefined', () => {
    expect(optionalNumber({}, 'k')).toBeUndefined();
  });
  it('rejeita não-finito e texto não numérico', () => {
    expect(() => optionalNumber({ k: 'abc' }, 'k')).toThrow(ToolArgError);
    expect(() => optionalNumber({ k: Infinity }, 'k')).toThrow(ToolArgError);
  });
});

describe('optionalBool', () => {
  it('true (booleano ou string "true") vira true; qualquer outra coisa vira false', () => {
    expect(optionalBool({ k: true }, 'k')).toBe(true);
    expect(optionalBool({ k: 'true' }, 'k')).toBe(true);
    expect(optionalBool({ k: false }, 'k')).toBe(false);
    expect(optionalBool({ k: 'false' }, 'k')).toBe(false);
    expect(optionalBool({}, 'k')).toBe(false);
  });
});

describe('stringList', () => {
  it('string vira lista quebrando por linha, aparando e descartando vazias', () => {
    expect(stringList({ k: 'a\n\nb\n  c  \n' }, 'k')).toEqual(['a', 'b', 'c']);
  });
  it('array vira lista de strings aparadas', () => {
    expect(stringList({ k: ['a', ' b ', 1] }, 'k')).toEqual(['a', 'b', '1']);
  });
  it('undefined/null vira lista vazia', () => {
    expect(stringList({}, 'k')).toEqual([]);
    expect(stringList({ k: null }, 'k')).toEqual([]);
  });
  it('rejeita outros tipos', () => {
    expect(() => stringList({ k: 42 }, 'k')).toThrow(ToolArgError);
  });
});

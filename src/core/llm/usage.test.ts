import { describe, expect, it } from 'vitest';
import { estimateCost } from './usage';

describe('estimateCost', () => {
  it('sem nenhum preço configurado, devolve undefined', () => {
    expect(
      estimateCost({ promptTokens: 1000, completionTokens: 500 }, undefined, undefined),
    ).toBeUndefined();
  });

  it('calcula a partir dos preços por 1M tokens (0 quando só um dos dois está definido)', () => {
    expect(estimateCost({ promptTokens: 1_000_000, completionTokens: 0 }, 2, undefined)).toBe(2);
    expect(estimateCost({ promptTokens: 0, completionTokens: 1_000_000 }, undefined, 10)).toBe(10);
  });

  it('soma entrada e saída', () => {
    expect(estimateCost({ promptTokens: 500_000, completionTokens: 250_000 }, 2, 10)).toBeCloseTo(
      1 + 2.5,
    );
  });
});

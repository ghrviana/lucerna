import type { Usage } from './types';

/**
 * Custo estimado (mesma moeda dos preços informados), ou undefined se nenhum preço foi configurado.
 * Preços são por 1 milhão de tokens (ver Settings.priceInPerMTok/priceOutPerMTok).
 */
export function estimateCost(
  usage: Pick<Usage, 'promptTokens' | 'completionTokens'>,
  priceInPerMTok: number | undefined,
  priceOutPerMTok: number | undefined,
): number | undefined {
  if (priceInPerMTok === undefined && priceOutPerMTok === undefined) return undefined;
  const inCost = ((priceInPerMTok ?? 0) * usage.promptTokens) / 1_000_000;
  const outCost = ((priceOutPerMTok ?? 0) * usage.completionTokens) / 1_000_000;
  return inCost + outCost;
}

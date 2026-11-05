/** Limite de caracteres do texto da página enviado ao modelo (~10 mil tokens). */
export const MAX_CONTEXT_CHARS = 40_000;

export interface Truncated {
  text: string;
  truncated: boolean;
  originalLength: number;
  /** Posição (no texto original) a partir de onde o trecho do meio foi omitido. */
  omittedFrom?: number;
  /** Posição (no texto original) onde o rodapé mantido recomeça (fim do trecho omitido). */
  omittedTo?: number;
}

/**
 * Trunca mantendo o início (70%) e o fim (30%), cortando em limites de parágrafo/frase
 * quando possível, e marca o trecho omitido.
 */
export function truncateSmart(text: string, max = MAX_CONTEXT_CHARS): Truncated {
  const originalLength = text.length;
  if (originalLength <= max) return { text, truncated: false, originalLength };

  const headSize = Math.floor(max * 0.7);
  const tailSize = max - headSize;
  const window = Math.floor(max * 0.1);

  let head = text.slice(0, headSize);
  const cut = Math.max(head.lastIndexOf('\n\n'), head.lastIndexOf('. '));
  if (cut > headSize - window) head = head.slice(0, cut + 1);
  const omittedFrom = head.length;

  let tail = text.slice(originalLength - tailSize);
  const start = tail.indexOf('\n\n');
  if (start !== -1 && start < window) tail = tail.slice(start + 2);
  const omittedTo = originalLength - tail.length;

  const omitted = originalLength - head.length - tail.length;
  return {
    text: `${head.trimEnd()}\n\n[… ${omitted} caracteres omitidos …]\n\n${tail.trimStart()}`,
    truncated: true,
    originalLength,
    omittedFrom,
    omittedTo,
  };
}

/**
 * Continua a leitura de `text` a partir de `offset` (o `omittedFrom` de uma leitura anterior).
 * Para por onde o rodapé de `truncateSmart` já recomeça (`omittedTo`), em vez de reenviá-lo —
 * mesmo que o trecho omitido seja maior que `max` (aí é preciso mais de uma continuação).
 */
export function continueTruncated(
  text: string,
  offset: number,
  max = MAX_CONTEXT_CHARS,
): Truncated {
  const originalLength = text.length;
  const full = truncateSmart(text, max);
  const knownTailStart = full.truncated ? (full.omittedTo ?? originalLength) : originalLength;
  const inGap = offset < knownTailStart;
  const end = inGap ? Math.min(offset + max, knownTailStart) : originalLength;
  const truncated = inGap && end < knownTailStart;
  return {
    text: text.slice(offset, end),
    truncated,
    originalLength,
    omittedFrom: truncated ? end : undefined,
  };
}

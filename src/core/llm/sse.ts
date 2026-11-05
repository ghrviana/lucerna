/** Extrai os payloads "data:" de um trecho SSE. Retorna os eventos completos e o resto não processado. */
export function parseSseChunk(buffer: string): { events: string[]; rest: string } {
  const parts = buffer.replace(/\r\n/g, '\n').split('\n\n');
  const rest = parts.pop() ?? '';
  const events = parts.flatMap((block) =>
    block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim()),
  );
  return { events, rest };
}

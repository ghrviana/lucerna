import { describe, expect, it } from 'vitest';
import { parseSseChunk } from './sse';

describe('parseSseChunk', () => {
  it('separa eventos completos e guarda o resto', () => {
    const { events, rest } = parseSseChunk('data: {"a":1}\n\ndata: [DONE]\n\ndata: {"b"');
    expect(events).toEqual(['{"a":1}', '[DONE]']);
    expect(rest).toBe('data: {"b"');
  });

  it('ignora comentários keep-alive', () => {
    const { events } = parseSseChunk(': keep-alive\n\ndata: x\n\n');
    expect(events).toEqual(['x']);
  });
});

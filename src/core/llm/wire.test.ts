import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../storage/conversations';
import { toWireMessages } from './wire';

const img = (id: string) => ({
  id,
  dataUrl: `data:image/jpeg;base64,${id}`,
  width: 10,
  height: 10,
  kind: 'screenshot' as const,
});
const user = (content: string, images?: string[]): ChatMessage => ({
  id: content,
  role: 'user',
  content,
  createdAt: 0,
  images: images?.map(img),
});
const assistant = (content: string): ChatMessage => ({
  id: content,
  role: 'assistant',
  content,
  createdAt: 0,
});

describe('toWireMessages', () => {
  it('repassa extras (memórias) para o prompt de sistema', () => {
    const w = toWireMessages([user('oi')], '', undefined, false, {
      memories: ['gosta de respostas curtas'],
    });
    expect(w[0]?.content).toContain('gosta de respostas curtas');
  });

  it('começa com o prompt de sistema e mantém texto simples como string', () => {
    const w = toWireMessages([user('oi'), assistant('olá')], '');
    expect(w[0]?.role).toBe('system');
    expect(w.slice(1)).toEqual([
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: 'olá' },
    ]);
  });

  it('envia imagens como partes image_url apenas em mensagens do usuário', () => {
    const w = toWireMessages([user('veja', ['a'])], '');
    expect(w[1]?.content).toEqual([
      { type: 'text', text: 'veja' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,a' } },
    ]);
  });

  it('reenvia só as imagens mais recentes: com limite 2, mantém b e c e descarta a', () => {
    const msgs = [user('1', ['a', 'b']), assistant('r'), user('2', ['c'])];
    const w = toWireMessages(msgs, '', 2);
    const first = w[1]?.content;
    expect(Array.isArray(first) ? first.filter((p) => p.type === 'image_url') : []).toHaveLength(1);
    expect(JSON.stringify(w)).not.toContain('base64,a"');
    expect(JSON.stringify(w)).toContain('base64,b');
    expect(JSON.stringify(w)).toContain('base64,c');
  });

  it('inclui o snapshot dentro de delimitadores', () => {
    const m: ChatMessage = {
      ...user('o que há aqui?', ['x']),
      context: {
        title: 'T',
        url: 'https://a.test',
        text: '',
        snapshot: '[1] button "Ok"',
        truncated: false,
        originalLength: 0,
      },
    };
    const first = toWireMessages([m], '')[1]?.content;
    const text = Array.isArray(first) && first[0]?.type === 'text' ? first[0].text : '';
    expect(text).toContain('<snapshot_dom url="https://a.test">\n[1] button "Ok"\n</snapshot_dom>');
  });
  describe('com ferramentas', () => {
    const withCalls = (calls: NonNullable<ChatMessage['toolCalls']>): ChatMessage => ({
      id: 'a1',
      role: 'assistant',
      content: '',
      createdAt: 0,
      toolCalls: calls,
    });

    it('gera assistant com tool_calls seguido de uma mensagem tool por chamada', () => {
      const m = withCalls([
        { id: 'c1', name: 'list_tabs', arguments: '{}', result: { ok: true, text: 'abas' } },
      ]);
      const w = toWireMessages([user('oi'), m], '', undefined, true);
      expect(w.slice(2)).toEqual([
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'c1', type: 'function', function: { name: 'list_tabs', arguments: '{}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'c1', content: 'abas' },
      ]);
      expect(JSON.stringify(w[0])).toContain('FERRAMENTAS');
    });

    it('chamada sem resultado (interrompida) ainda recebe resposta tool', () => {
      const w = toWireMessages(
        [user('oi'), withCalls([{ id: 'c9', name: 'read_tab', arguments: '{}' }])],
        '',
      );
      const tool = w.find((x) => x.role === 'tool');
      expect(tool && 'content' in tool && tool.content).toContain('interrompida');
    });

    it('screenshots de ferramentas vão numa mensagem user e contam no limite de imagens', () => {
      const m = withCalls([
        {
          id: 'c1',
          name: 'take_screenshot',
          arguments: '{}',
          result: { ok: true, text: 'img', images: [img('t')] },
        },
      ]);
      const w = toWireMessages([user('1', ['a']), m], '', 1);
      const last = w.at(-1);
      expect(last?.role).toBe('user');
      expect(JSON.stringify(last)).toContain('base64,t');
      expect(JSON.stringify(w)).not.toContain('base64,a"');
    });
  });
});

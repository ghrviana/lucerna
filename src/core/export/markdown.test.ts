import { describe, expect, it } from 'vitest';
import type { Conversation } from '../storage/conversations';
import { conversationFilename, conversationToMarkdown } from './markdown';

const conv = (over: Partial<Conversation> = {}): Conversation => ({
  id: 'c1',
  title: 'Minha conversa',
  createdAt: 1,
  updatedAt: 1,
  messages: [],
  ...over,
});

describe('conversationToMarkdown', () => {
  it('conversa vazia: título e aviso, sem quebrar', () => {
    const out = conversationToMarkdown(conv());
    expect(out).toContain('# Minha conversa');
    expect(out).toContain('vazia');
  });

  it('inclui o papel (Você/Lucerna), o conteúdo e o contexto de página anexado', () => {
    const out = conversationToMarkdown(
      conv({
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'resuma isso',
            createdAt: 2,
            context: {
              title: 'Exemplo',
              url: 'https://exemplo.test',
              text: 'texto da página',
              truncated: false,
              originalLength: 16,
            },
          },
          { id: 'm2', role: 'assistant', content: 'Resumo pronto.', createdAt: 3 },
        ],
      }),
    );
    expect(out).toContain('## Você');
    expect(out).toContain('resuma isso');
    expect(out).toContain('Contexto da página');
    expect(out).toContain('> texto da página');
    expect(out).toContain('## Lucerna');
    expect(out).toContain('Resumo pronto.');
  });

  it('lista chamadas de ferramenta com nome, argumentos resumidos e resultado', () => {
    const out = conversationToMarkdown(
      conv({
        messages: [
          {
            id: 'm1',
            role: 'assistant',
            content: '',
            createdAt: 1,
            toolCalls: [
              {
                id: 't1',
                name: 'read_tab',
                arguments: JSON.stringify({ tabId: 5 }),
                result: { ok: true, text: 'texto lido' },
              },
            ],
          },
        ],
      }),
    );
    expect(out).toContain('🔧 `read_tab`');
    expect(out).toContain('tabId');
    expect(out).toContain('texto lido');
  });

  it('anota imagens anexadas sem embuti-las', () => {
    const out = conversationToMarkdown(
      conv({
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'veja isto',
            createdAt: 1,
            images: [
              { id: 'i1', dataUrl: 'data:image/png;base64,x', width: 1, height: 1, kind: 'upload' },
            ],
          },
        ],
      }),
    );
    expect(out).toContain('1 imagem(ns) anexada(s)');
    expect(out).not.toContain('data:image');
  });
});

describe('conversationFilename', () => {
  it('normaliza acentos/maiúsculas e termina em .md com a data de hoje', () => {
    const name = conversationFilename('Resumo da Reunião!');
    expect(name).toMatch(/^resumo-da-reuniao-\d{4}-\d{2}-\d{2}\.md$/);
  });

  it('usa "conversa" como nome padrão para título vazio', () => {
    expect(conversationFilename('')).toMatch(/^conversa-\d{4}-\d{2}-\d{2}\.md$/);
  });
});

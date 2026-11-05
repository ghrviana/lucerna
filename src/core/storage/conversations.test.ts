import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  createConversation,
  deleteConversation,
  filterConversations,
  listConversations,
  saveConversation,
  titleFromText,
} from './conversations';

describe('conversations storage', () => {
  it('salva, lista (mais recentes primeiro) e apaga', async () => {
    const a = { ...createConversation(), title: 'A', updatedAt: 1 };
    const b = { ...createConversation(), title: 'B', updatedAt: 2 };
    await saveConversation(a);
    await saveConversation(b);
    expect((await listConversations()).map((c) => c.title)).toEqual(['B', 'A']);
    await deleteConversation(b.id);
    expect((await listConversations()).map((c) => c.title)).toEqual(['A']);
  });

  it('persiste renomeação ao salvar de novo', async () => {
    const [c] = await listConversations();
    await saveConversation({ ...c!, title: 'Renomeada' });
    expect((await listConversations())[0]?.title).toBe('Renomeada');
  });
});

describe('filterConversations', () => {
  it('busca em título e mensagens ignorando acentos', () => {
    const c = {
      ...createConversation(),
      title: 'Receitas',
      messages: [{ id: '1', role: 'user' as const, content: 'Pão de açúcar', createdAt: 0 }],
    };
    const other = { ...createConversation(), title: 'Outra' };
    expect(filterConversations([c, other], 'acucar')).toEqual([c]);
    expect(filterConversations([c, other], 'RECEITA')).toEqual([c]);
    expect(filterConversations([c, other], '  ')).toHaveLength(2);
  });
});

describe('titleFromText', () => {
  it('trunca e normaliza espaços', () => {
    expect(titleFromText('a   b')).toBe('a b');
    expect(titleFromText('x'.repeat(50))).toBe(`${'x'.repeat(40)}…`);
    expect(titleFromText('   ')).toBe('Nova conversa');
  });
});

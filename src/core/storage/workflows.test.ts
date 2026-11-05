import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  createWorkflow,
  deleteWorkflow,
  extractPlaceholders,
  fillPlaceholders,
  filterWorkflows,
  isSlugTaken,
  listWorkflows,
  parseSlashCommand,
  saveWorkflow,
  slugify,
  type Workflow,
} from './workflows';

describe('slugify', () => {
  it('remove acentos, baixa caixa e troca separadores por hífen', () => {
    expect(slugify('Resumo da Reunião!')).toBe('resumo-da-reuniao');
    expect(slugify('  Múltiplos   Espaços  ')).toBe('multiplos-espacos');
  });
});

describe('extractPlaceholders', () => {
  it('extrai nomes únicos, na ordem, ignorando chaves malformadas', () => {
    const text = 'Olá {{nome}}, hoje é {{data}}. {{nome}} de novo. { chave solta }';
    expect(extractPlaceholders(text)).toEqual(['nome', 'data']);
  });

  it('sem placeholders devolve lista vazia', () => {
    expect(extractPlaceholders('texto comum')).toEqual([]);
  });
});

describe('fillPlaceholders', () => {
  it('substitui os valores informados e mantém o placeholder visível quando falta valor', () => {
    const out = fillPlaceholders('Olá {{nome}}, hoje é {{data}}.', { nome: 'Ana' });
    expect(out).toBe('Olá Ana, hoje é {{data}}.');
  });
});

describe('createWorkflow', () => {
  it('usa agentMode=false por padrão e apara o nome', () => {
    const w = createWorkflow({ name: '  Meu workflow  ', instruction: 'faça x' });
    expect(w.name).toBe('Meu workflow');
    expect(w.agentMode).toBe(false);
    expect(w.id).toBeTruthy();
  });
});

describe('CRUD em IndexedDB', () => {
  it('salva, lista do mais recente e apaga', async () => {
    const a = createWorkflow({ name: 'A', instruction: 'a', agentMode: false });
    const b = { ...createWorkflow({ name: 'B', instruction: 'b' }), updatedAt: a.updatedAt + 1 };
    await saveWorkflow(a);
    await saveWorkflow(b);
    expect((await listWorkflows()).map((w) => w.name)).toEqual(['B', 'A']);

    await deleteWorkflow(a.id);
    expect((await listWorkflows()).map((w) => w.name)).toEqual(['B']);
  });
});

describe('filterWorkflows', () => {
  const list: Workflow[] = [
    createWorkflow({ name: 'Resumo de Reunião', instruction: 'resuma a ata' }),
    createWorkflow({ name: 'Traduzir', instruction: 'traduza para inglês' }),
  ];
  it('busca por nome ou instrução, sem diferenciar acento/caixa', () => {
    expect(filterWorkflows(list, 'reuniao')).toHaveLength(1);
    expect(filterWorkflows(list, 'INGLÊS')).toHaveLength(1);
    expect(filterWorkflows(list, '')).toHaveLength(2);
  });
});

describe('isSlugTaken', () => {
  const list: Workflow[] = [createWorkflow({ name: 'Resumo', instruction: 'x' })];
  it('detecta colisão de slug, ignorando o próprio id', () => {
    expect(isSlugTaken(list, 'resumo')).toBe(true);
    expect(isSlugTaken(list, 'resumo', list[0]?.id)).toBe(false);
    expect(isSlugTaken(list, 'outro')).toBe(false);
  });
});

describe('parseSlashCommand', () => {
  const list: Workflow[] = [createWorkflow({ name: 'Resumo de Reunião', instruction: 'x {{a}}' })];

  it('null para texto que não começa com /', () => {
    expect(parseSlashCommand('oi tudo bem', list)).toBeNull();
  });

  it('null para "/" sozinho', () => {
    expect(parseSlashCommand('/', list)).toBeNull();
    expect(parseSlashCommand('/   ', list)).toBeNull();
  });

  it('resolve por slug (acento/caixa-insensível) e devolve o resto como rest', () => {
    const r = parseSlashCommand('/resumo-de-reuniao ata de hoje', list);
    expect(r).toEqual({ kind: 'ok', workflow: list[0], rest: 'ata de hoje' });
  });

  it('erro com a lista de nomes disponíveis quando não encontra', () => {
    const r = parseSlashCommand('/naoexiste', list);
    expect(r?.kind).toBe('error');
    expect(r && 'message' in r ? r.message : '').toContain('/resumo-de-reuniao');
  });
});

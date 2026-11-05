import { db } from './db';

/** Um workflow salvo: uma instrução reutilizável, com parâmetros opcionais ({{nome}}). */
export interface Workflow {
  id: string;
  name: string;
  instruction: string;
  /** Roda em modo agente (clicar/digitar/navegar) em vez de só chat com ferramentas de leitura. */
  agentMode: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Nome "slugificado" (sem acento/espaço), usado para casar com o slash command. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const PLACEHOLDER_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Nomes de {{placeholder}} na instrução, deduplicados, na ordem em que aparecem. */
export function extractPlaceholders(instruction: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of instruction.matchAll(PLACEHOLDER_RE)) {
    const name = m[1];
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Substitui {{placeholder}} pelos valores informados; sem valor, mantém o placeholder visível. */
export function fillPlaceholders(instruction: string, values: Record<string, string>): string {
  return instruction.replace(PLACEHOLDER_RE, (match, name: string) =>
    Object.hasOwn(values, name) ? (values[name] ?? match) : match,
  );
}

export function createWorkflow(data: {
  name: string;
  instruction: string;
  agentMode?: boolean;
}): Workflow {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    instruction: data.instruction,
    agentMode: data.agentMode ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

/** Mais recentes primeiro. */
export async function listWorkflows(): Promise<Workflow[]> {
  return (await (await db()).getAllFromIndex('workflows', 'updatedAt')).reverse();
}

export async function saveWorkflow(w: Workflow): Promise<void> {
  await (await db()).put('workflows', w);
}

export async function deleteWorkflow(id: string): Promise<void> {
  await (await db()).delete('workflows', id);
}

/** Busca por nome ou instrução (sem diferenciar maiúsculas/acentos). */
export function filterWorkflows(list: Workflow[], query: string): Workflow[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const q = norm(query.trim());
  if (!q) return list;
  return list.filter((w) => norm(w.name).includes(q) || norm(w.instruction).includes(q));
}

export function isSlugTaken(list: Workflow[], slug: string, excludeId?: string): boolean {
  return list.some((w) => w.id !== excludeId && slugify(w.name) === slug);
}

export type SlashResult =
  { kind: 'ok'; workflow: Workflow; rest: string } | { kind: 'error'; message: string } | null;

/**
 * Reconhece "/nome-do-workflow resto do texto" digitado no composer. `null` quando o texto não é
 * um comando (não começa com "/", ou é só "/"); erro inline quando nenhum workflow bate o slug.
 */
export function parseSlashCommand(input: string, workflows: Workflow[]): SlashResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIdx = trimmed.indexOf(' ');
  const token = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).trim();
  if (!token) return null;
  const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

  const slug = slugify(token);
  const workflow = workflows.find((w) => slugify(w.name) === slug);
  if (!workflow) {
    const names = workflows.map((w) => `/${slugify(w.name)}`).join(', ');
    return {
      kind: 'error',
      message: names
        ? `Nenhum workflow chamado "/${token}". Disponíveis: ${names}`
        : `Nenhum workflow chamado "/${token}" (nenhum workflow salvo ainda).`,
    };
  }
  return { kind: 'ok', workflow, rest };
}

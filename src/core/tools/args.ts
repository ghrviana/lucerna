/** Leitura defensiva dos argumentos de uma ferramenta (o modelo pode mandar tipos errados). */

export class ToolArgError extends Error {}

export function optionalTabId(args: Record<string, unknown>): number | undefined {
  const v = args.tabId;
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw new ToolArgError('tabId deve ser um número inteiro (veja list_tabs).');
  }
  return n;
}

export function requiredTabId(args: Record<string, unknown>): number {
  const id = optionalTabId(args);
  if (id === undefined) throw new ToolArgError('tabId é obrigatório (veja list_tabs).');
  return id;
}

export function optionalString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' && typeof v !== 'number') {
    throw new ToolArgError(`${key} deve ser texto.`);
  }
  return String(v);
}

export function optionalInt(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    throw new ToolArgError(`${key} deve ser um número inteiro.`);
  }
  return n;
}

export function optionalBool(args: Record<string, unknown>, key: string): boolean {
  const v = args[key];
  return v === true || v === 'true';
}

export function requiredInt(args: Record<string, unknown>, key: string): number {
  const n = optionalInt(args, key);
  if (n === undefined) throw new ToolArgError(`${key} é obrigatório.`);
  return n;
}

export function requiredString(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' && typeof v !== 'number')
    throw new ToolArgError(`${key} é obrigatório.`);
  return String(v);
}

export function optionalNumber(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (v === undefined || v === null || v === '') return undefined;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n))
    throw new ToolArgError(`${key} deve ser um número.`);
  return n;
}

export function stringList(args: Record<string, unknown>, key: string): string[] {
  const v = args[key];
  if (v === undefined || v === null) return [];
  if (typeof v === 'string')
    return v
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  if (!Array.isArray(v)) throw new ToolArgError(`${key} deve ser uma lista de textos.`);
  return v.map((s) => String(s).trim()).filter(Boolean);
}

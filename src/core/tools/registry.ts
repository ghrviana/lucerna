import { ToolArgError } from './args';
import { READ_TOOLS } from './readTools';
import type { Tool, ToolContext, ToolOutcome } from './types';
import { WRITE_TOOLS } from './writeTools';

export type { ToolOutcome } from './types';

/** Ferramentas do chat (somente leitura). */
export const ALL_TOOLS: Tool[] = READ_TOOLS;

/** Ferramentas do modo agente: leitura + ações + propose_plan. */
export const AGENT_TOOLS: Tool[] = [...READ_TOOLS, ...WRITE_TOOLS];

/** Limite do resultado de uma ferramenta enviado ao modelo. */
export const MAX_TOOL_RESULT_CHARS = 60_000;

export const clipResult = (text: string) =>
  text.length > MAX_TOOL_RESULT_CHARS
    ? `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n[resultado truncado]`
    : text;

/** Interpreta o JSON de argumentos que o modelo devolveu (vazio = sem argumentos). */
export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ToolArgError('Os argumentos não são um JSON válido.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ToolArgError('Os argumentos devem ser um objeto JSON.');
  }
  return value as Record<string, unknown>;
}

/** Executa uma chamada de ferramenta; nunca lança: falhas viram resultado de erro para o modelo. */
export async function runTool(
  tools: Tool[],
  call: { name: string; arguments: string },
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) {
    const known = tools.map((t) => t.name).join(', ');
    return {
      ok: false,
      text: `Erro: ferramenta desconhecida "${call.name}". Disponíveis: ${known}.`,
    };
  }
  try {
    const result = await tool.execute(parseToolArguments(call.arguments), ctx);
    return { ok: true, text: clipResult(result.text), images: result.images };
  } catch (err) {
    if (ctx.signal.aborted) throw err;
    console.error(`Lucerna: ferramenta ${call.name} falhou`, err);
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, text: `Erro: ${msg}` };
  }
}

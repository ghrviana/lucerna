/** Repetições seguidas da mesma ação sem efeito: avisa o modelo em WARN e encerra em STOP. */
export const LOOP_WARN = 2;
export const LOOP_STOP = 3;

/** Hash curto (FNV-1a) para comparar estados de página sem guardá-los inteiros. */
export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

/** Chave estável da ação: ferramenta + argumentos (sem a justificativa), em ordem de chave. */
export function actionKey(name: string, args: Record<string, unknown>): string {
  const keys = Object.keys(args)
    .filter((k) => k !== 'reason')
    .sort();
  return `${name}:${JSON.stringify(keys.map((k) => [k, args[k]]))}`;
}

/**
 * Detecta laço: a mesma ação repetida seguidamente sem mudar a página. A assinatura da página
 * (URL + hash do snapshot) vem da observação feita após cada ação.
 */
export class LoopGuard {
  private lastKey = '';
  private lastPage: string | undefined;
  private streak = 0;

  /**
   * Registra uma ação já executada. `pageBefore` é a assinatura antes (undefined = desconhecida),
   * `pageAfter` a de depois. Devolve quantas vezes seguidas ela se repetiu sem efeito.
   */
  record(key: string, pageBefore: string | undefined, pageAfter: string | undefined): number {
    const noEffect = pageBefore !== undefined && pageBefore === pageAfter;
    if (!noEffect) {
      this.streak = 0;
    } else if (key === this.lastKey && this.lastPage === pageAfter) {
      this.streak += 1;
    } else {
      this.streak = 1;
    }
    this.lastKey = key;
    this.lastPage = pageAfter;
    return this.streak;
  }
}

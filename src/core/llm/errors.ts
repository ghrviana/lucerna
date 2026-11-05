export type LlmErrorKind =
  'auth' | 'balance' | 'rate_limit' | 'invalid_request' | 'server' | 'network' | 'unknown';

export class LlmError extends Error {
  constructor(
    public readonly kind: LlmErrorKind,
    public readonly status?: number,
    /** Corpo bruto da resposta de erro do provedor; só para log no console (nunca na UI). */
    public readonly detail?: string,
  ) {
    super(`LLM error: ${kind}${status ? ` (${status})` : ''}`);
  }
}

export function kindFromStatus(status: number): LlmErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'balance';
  if (status === 429) return 'rate_limit';
  if (status === 400 || status === 422) return 'invalid_request';
  if (status >= 500) return 'server';
  return 'unknown';
}

const MESSAGES: Record<LlmErrorKind, string> = {
  auth: 'Chave de API inválida ou sem permissão. Verifique-a nas configurações.',
  balance: 'Saldo insuficiente na conta do provedor. Recarregue o saldo e tente de novo.',
  rate_limit: 'Limite de uso atingido. Aguarde um pouco e tente novamente.',
  invalid_request:
    'O provedor recusou a requisição. Verifique o modelo e os parâmetros nas configurações.',
  server: 'O servidor do provedor está com problemas. Tente novamente em instantes.',
  network: 'Não foi possível conectar ao provedor. Verifique sua conexão e a URL base.',
  unknown: 'Ocorreu um erro inesperado ao falar com o provedor.',
};

/** Mensagem amigável; nunca inclui a chave nem o corpo bruto da resposta. */
export function friendlyError(err: unknown): string {
  return MESSAGES[err instanceof LlmError ? err.kind : 'unknown'];
}

import { requiredString, ToolArgError } from './args';
import type { Tool } from './types';

export const PROPOSE_MEMORY_TOOL_NAME = 'propose_memory';

/**
 * Não grava nada: só registra a proposta na conversa. A gravação de verdade (em `memories`) só
 * acontece quando o usuário clica "Salvar" no cartão de aprovação (ver chatStore.ts). `risk: 'read'`
 * de propósito — não age na página, então não deve passar pela política/observação do modo agente
 * (ver agentTurn.ts, que só pula esse caminho para ferramentas 'read').
 */
export const proposeMemory: Tool = {
  name: PROPOSE_MEMORY_TOOL_NAME,
  description:
    'Propõe lembrar um fato ou preferência do usuário para conversas futuras (ex.: "prefere ' +
    'respostas concisas", "trabalha com química"). Só é salvo se o usuário aprovar no painel; nunca ' +
    'proponha senhas, códigos de verificação, dados de pagamento ou de saúde.',
  jsonSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'O fato a lembrar, em uma frase curta e específica.',
      },
    },
    required: ['text'],
    additionalProperties: false,
  },
  risk: 'read',
  async execute(args) {
    const text = requiredString(args, 'text').trim();
    if (!text) throw new ToolArgError('text não pode ser vazio.');
    return {
      text: 'Proposta de memória registrada; aguardando decisão do usuário (ainda não foi salva).',
    };
  },
};

export const MEMORY_TOOLS: Tool[] = [proposeMemory];

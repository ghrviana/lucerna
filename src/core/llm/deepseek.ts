import { chunkToEvents, streamOpenAIChat, ToolCallAccumulator } from './openaiCompatible';
import type { ChatProvider } from './types';

export { chunkToEvents, ToolCallAccumulator };

/** DeepSeek: mesmo formato da OpenAI, com thinking sempre desligado (ver docs/decisions.md). */
export const deepseekProvider: ChatProvider = {
  stream: (req, signal) => streamOpenAIChat(req, signal, { thinking: { type: 'disabled' } }),
};

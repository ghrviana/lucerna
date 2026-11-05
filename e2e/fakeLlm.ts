import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * LLM falso, compatível com /chat/completions em streaming (SSE). Cada teste define o roteiro:
 * a cada requisição o servidor devolve o próximo passo (texto ou uma chamada de ferramenta).
 * Assim o e2e exercita a extensão de verdade (painel, portão de segurança, executor) de forma
 * determinística, sem chave de API.
 */

interface WireMessage {
  role: string;
  content: unknown;
}

export interface LlmRequest {
  model: string;
  messages: WireMessage[];
  tools?: { function: { name: string } }[];
}

const SNAPSHOT_HEADER = 'elementos interativos visíveis';

/** Visão de uma requisição recebida, para montar argumentos que dependem da página. */
export class RequestView {
  constructor(readonly body: LlmRequest) {}

  toolTexts(): string[] {
    return this.body.messages
      .filter((m) => m.role === 'tool' && typeof m.content === 'string')
      .map((m) => m.content as string);
  }

  lastToolText(): string {
    return this.toolTexts().at(-1) ?? '';
  }

  /** Id do elemento cujo nome contém `name`, no snapshot mais recente devolvido ao modelo. */
  id(name: string): number {
    const snapshot = this.toolTexts().findLast((t) => t.includes(SNAPSHOT_HEADER));
    if (!snapshot) throw new Error('Nenhum snapshot no histórico enviado ao LLM falso.');
    const wanted = name.toLowerCase();
    for (const line of snapshot.split('\n')) {
      const m = /^\[(\d+)\] \S+ "([^"]*)"/.exec(line);
      if (m?.[2]?.toLowerCase().includes(wanted)) return Number(m[1]);
    }
    throw new Error(`Elemento "${name}" não está no snapshot:\n${snapshot}`);
  }
}

export type Step =
  | { content: string; delayMs?: number }
  | {
      tool: string;
      args?: Record<string, unknown> | ((req: RequestView) => Record<string, unknown>);
      delayMs?: number;
    };

const sse = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;

export class FakeLlm {
  readonly requests: LlmRequest[] = [];
  url = '';
  private queue: Step[] = [];
  private server: Server = createServer((req, res) => void this.handle(req, res));
  private calls = 0;

  async start(): Promise<void> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.url = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise((resolve) => this.server.close(resolve));
  }

  script(steps: Step[]): void {
    this.queue = [...steps];
  }

  /** Requisições cuja última mensagem `tool` contém o texto. */
  sawToolResult(text: string): boolean {
    return this.requests.some((r) => new RequestView(r).toolTexts().some((t) => t.includes(text)));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return void res.writeHead(204).end();
    if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions'))
      return void res.writeHead(404).end();

    let raw = '';
    for await (const chunk of req) raw += String(chunk);
    const body = JSON.parse(raw) as LlmRequest;
    this.requests.push(body);
    const step = this.queue.shift() ?? { content: 'Fim do roteiro.' };

    if (step.delayMs) {
      const closed = await new Promise<boolean>((resolve) => {
        const t = setTimeout(() => resolve(false), step.delayMs);
        res.on('close', () => {
          clearTimeout(t);
          resolve(true);
        });
      });
      if (closed) return; // o cliente desistiu (botão Parar)
    }

    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if ('content' in step) {
      res.write(sse({ choices: [{ delta: { content: step.content } }] }));
      res.write(sse({ choices: [{ delta: {}, finish_reason: 'stop' }] }));
    } else {
      const args =
        typeof step.args === 'function' ? step.args(new RequestView(body)) : (step.args ?? {});
      const id = `call_${++this.calls}`;
      const fn = { name: step.tool, arguments: JSON.stringify(args) };
      res.write(
        sse({
          choices: [{ delta: { tool_calls: [{ index: 0, id, type: 'function', function: fn }] } }],
        }),
      );
      res.write(sse({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }));
    }
    res.end('data: [DONE]\n\n');
  }
}

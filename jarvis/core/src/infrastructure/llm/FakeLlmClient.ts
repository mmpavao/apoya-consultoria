import type {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
} from '../../domain/llm/LlmClient.js';

/**
 * Deterministic, offline LLM for tests and CLI demos. Either replay a queued
 * script of responses or compute one from the request — no network, no SDK.
 */
export class FakeLlmClient implements LlmClient {
  readonly model: string;
  private readonly queue: LlmResponse[];
  private readonly responder?: (req: LlmRequest) => LlmResponse;

  constructor(opts: {
    model?: string;
    responses?: LlmResponse[];
    responder?: (req: LlmRequest) => LlmResponse;
  } = {}) {
    this.model = opts.model ?? 'fake-model';
    this.queue = [...(opts.responses ?? [])];
    this.responder = opts.responder;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    if (this.queue.length) return this.queue.shift()!;
    if (this.responder) return this.responder(req);
    return {
      content: [{ type: 'text', text: '' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 0, outputTokens: 0 },
      model: this.model,
    };
  }

  async *stream(req: LlmRequest): AsyncIterable<LlmStreamEvent> {
    const response = await this.complete(req);
    for (const block of response.content) {
      if (block.type === 'text') yield { type: 'text_delta', text: block.text };
    }
    yield { type: 'message_done', response };
  }
}

/** Convenience builders for scripting fake responses in tests. */
export const fakeText = (text: string, model = 'fake-model'): LlmResponse => ({
  content: [{ type: 'text', text }],
  stopReason: 'end_turn',
  usage: { inputTokens: 10, outputTokens: 10 },
  model,
});

export const fakeToolUse = (
  name: string,
  input: unknown,
  id = 'tool-1',
  model = 'fake-model',
): LlmResponse => ({
  content: [{ type: 'tool_use', id, name, input }],
  stopReason: 'tool_use',
  usage: { inputTokens: 10, outputTokens: 10 },
  model,
});

import Anthropic from '@anthropic-ai/sdk';
import type {
  LlmClient,
  LlmRequest,
  LlmResponse,
  LlmStreamEvent,
  LlmContentBlock,
  StopReason,
} from '../../domain/llm/LlmClient.js';
import { modelInfo } from './modelInfo.js';

export interface AnthropicClientOptions {
  apiKey: string;
  model: string;
  /** Non-streaming cap; kept under SDK HTTP timeouts (claude-api guidance). */
  maxTokens?: number;
}

/**
 * Concrete Anthropic provider. The orchestrator depends only on `LlmClient`;
 * this file is the single place that knows the SDK exists, so swapping providers
 * is isolated here (PRD §1, §4.1). Sampling params are stripped for models that
 * reject them (4.7+/Fable) to stay model-agnostic.
 */
export class AnthropicClient implements LlmClient {
  readonly model: string;
  private readonly sdk: Anthropic;
  private readonly defaultMaxTokens: number;

  constructor(opts: AnthropicClientOptions) {
    this.sdk = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.defaultMaxTokens = opts.maxTokens ?? 4096;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const model = req.model ?? this.model;
    const res = await this.sdk.messages.create({
      model,
      max_tokens: req.maxTokens ?? this.defaultMaxTokens,
      system: req.system,
      messages: toSdkMessages(req.messages),
      ...(req.tools?.length ? { tools: toSdkTools(req.tools) } : {}),
      ...this.samplingParams(model, req),
    });
    return {
      content: fromSdkContent(res.content),
      stopReason: mapStopReason(res.stop_reason),
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
      model: res.model,
    };
  }

  async *stream(req: LlmRequest): AsyncIterable<LlmStreamEvent> {
    const model = req.model ?? this.model;
    const stream = this.sdk.messages.stream({
      model,
      max_tokens: req.maxTokens ?? 64_000,
      system: req.system,
      messages: toSdkMessages(req.messages),
      ...(req.tools?.length ? { tools: toSdkTools(req.tools) } : {}),
      ...this.samplingParams(model, req),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        yield { type: 'tool_use_start', id: event.content_block.id, name: event.content_block.name };
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          yield { type: 'tool_use_input_delta', id: String(event.index), partialJson: event.delta.partial_json };
        }
      }
    }

    const final = await stream.finalMessage();
    yield {
      type: 'message_done',
      response: {
        content: fromSdkContent(final.content),
        stopReason: mapStopReason(final.stop_reason),
        usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens },
        model: final.model,
      },
    };
  }

  /** Only forward temperature to models that accept sampling params. */
  private samplingParams(model: string, req: LlmRequest): { temperature?: number } {
    if (req.temperature === undefined) return {};
    return modelInfo(model).acceptsSamplingParams ? { temperature: req.temperature } : {};
  }
}

type SdkMessageParam = Anthropic.MessageParam;

function toSdkMessages(messages: LlmRequest['messages']): SdkMessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content.map(toSdkBlock),
  }));
}

function toSdkBlock(block: LlmContentBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: block.text };
    case 'tool_use':
      return { type: 'tool_use', id: block.id, name: block.name, input: block.input as object };
    case 'tool_result':
      return {
        type: 'tool_result',
        tool_use_id: block.toolUseId,
        content: block.content,
        ...(block.isError ? { is_error: true } : {}),
      };
  }
}

function toSdkTools(tools: NonNullable<LlmRequest['tools']>): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
  }));
}

function fromSdkContent(content: Anthropic.ContentBlock[]): LlmContentBlock[] {
  const out: LlmContentBlock[] = [];
  for (const block of content) {
    if (block.type === 'text') out.push({ type: 'text', text: block.text });
    else if (block.type === 'tool_use')
      out.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
  }
  return out;
}

function mapStopReason(reason: string | null): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'tool_use':
    case 'max_tokens':
    case 'stop_sequence':
      return reason;
    default:
      return 'unknown';
  }
}

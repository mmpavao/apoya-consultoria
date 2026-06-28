import type { ToolSchema } from '../tools/Tool.js';

/**
 * Provider-agnostic LLM contract. The orchestrator depends ONLY on this; the
 * concrete provider (Anthropic, or any future one) is selected by a factory
 * from settings — swapping models is a config change, not a code change
 * (PRD §1, §10).
 */

export type LlmRole = 'user' | 'assistant';

export interface LlmTextBlock {
  type: 'text';
  text: string;
}

export interface LlmToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface LlmToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type LlmContentBlock = LlmTextBlock | LlmToolUseBlock | LlmToolResultBlock;

export interface LlmMessage {
  role: LlmRole;
  content: LlmContentBlock[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools?: ToolSchema[];
  maxTokens?: number;
  temperature?: number;
  /** Per-request model override; defaults to the client's configured model. */
  model?: string;
}

export type StopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'unknown';

export interface LlmResponse {
  content: LlmContentBlock[];
  stopReason: StopReason;
  usage: TokenUsage;
  model: string;
}

/** Streaming events surfaced to the UI (PRD §6.2). */
export type LlmStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_input_delta'; id: string; partialJson: string }
  | { type: 'message_done'; response: LlmResponse };

export interface LlmClient {
  /** Identifier of the currently configured model. */
  readonly model: string;
  /** One-shot completion (used for planning and tool-use turns). */
  complete(req: LlmRequest): Promise<LlmResponse>;
  /** Streaming completion; yields deltas then a terminal message_done. */
  stream(req: LlmRequest): AsyncIterable<LlmStreamEvent>;
}

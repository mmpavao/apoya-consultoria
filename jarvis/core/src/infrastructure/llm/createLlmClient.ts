import type { LlmClient } from '../../domain/llm/LlmClient.js';
import { AnthropicClient } from './AnthropicClient.js';
import { FakeLlmClient } from './FakeLlmClient.js';
import { DEFAULT_MODEL } from './modelInfo.js';

export interface LlmConfig {
  /** Provider id. Add a case here to support another vendor — nothing else changes. */
  provider: 'anthropic' | 'fake';
  model?: string;
  apiKey?: string;
}

/**
 * The "swap the model/provider in one line" seam (PRD §1, §10, §12). Callers
 * receive an `LlmClient` and never see the concrete class.
 */
export function createLlmClient(config: LlmConfig): LlmClient {
  const model = config.model ?? DEFAULT_MODEL;
  switch (config.provider) {
    case 'anthropic':
      if (!config.apiKey) throw new Error('anthropic provider requires an apiKey (from Keychain)');
      return new AnthropicClient({ apiKey: config.apiKey, model });
    case 'fake':
      return new FakeLlmClient({ model });
  }
}

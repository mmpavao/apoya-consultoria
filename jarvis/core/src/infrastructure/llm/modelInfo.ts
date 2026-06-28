/**
 * Per-model capability + pricing facts. Centralised so swapping the configured
 * model (PRD §10) needs no other change. Pricing is USD per 1M tokens.
 */
export interface ModelInfo {
  /** Models in the 4.7+ / Fable family reject temperature/top_p/top_k. */
  acceptsSamplingParams: boolean;
  inputPerMillion: number;
  outputPerMillion: number;
}

export const MODELS: Record<string, ModelInfo> = {
  'claude-opus-4-8': { acceptsSamplingParams: false, inputPerMillion: 5, outputPerMillion: 25 },
  'claude-opus-4-7': { acceptsSamplingParams: false, inputPerMillion: 5, outputPerMillion: 25 },
  'claude-opus-4-6': { acceptsSamplingParams: true, inputPerMillion: 5, outputPerMillion: 25 },
  'claude-sonnet-4-6': { acceptsSamplingParams: true, inputPerMillion: 3, outputPerMillion: 15 },
  'claude-haiku-4-5': { acceptsSamplingParams: true, inputPerMillion: 1, outputPerMillion: 5 },
  'claude-fable-5': { acceptsSamplingParams: false, inputPerMillion: 10, outputPerMillion: 50 },
};

/** Per PRD §10/§12: cost/speed default; override in settings for hard tasks. */
export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export function modelInfo(model: string): ModelInfo {
  return MODELS[model] ?? { acceptsSamplingParams: false, inputPerMillion: 0, outputPerMillion: 0 };
}

export function pricingTable(): Record<string, { inputPerMillion: number; outputPerMillion: number }> {
  return Object.fromEntries(
    Object.entries(MODELS).map(([k, v]) => [
      k,
      { inputPerMillion: v.inputPerMillion, outputPerMillion: v.outputPerMillion },
    ]),
  );
}

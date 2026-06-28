import type { TokenUsage } from '../domain/llm/LlmClient.js';

/** USD per 1M tokens. Override per model via settings (PRD §10). */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface CostBucket {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

const ZERO: CostBucket = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

/**
 * Real-time token/cost accounting per session and per agent (PRD §2, §6, §7).
 * Feeds the cost panel.
 */
export class CostTracker {
  private readonly bySession = new Map<string, CostBucket>();
  private readonly byAgent = new Map<string, CostBucket>();
  private total: CostBucket = { ...ZERO };

  constructor(private readonly pricing: Record<string, ModelPricing>) {}

  record(params: { sessionId: string; agent: string; model: string; usage: TokenUsage }): CostBucket {
    const price = this.pricing[params.model] ?? { inputPerMillion: 0, outputPerMillion: 0 };
    const cost =
      (params.usage.inputTokens / 1_000_000) * price.inputPerMillion +
      (params.usage.outputTokens / 1_000_000) * price.outputPerMillion;
    const delta: CostBucket = {
      inputTokens: params.usage.inputTokens,
      outputTokens: params.usage.outputTokens,
      costUsd: cost,
    };
    this.add(this.bySession, params.sessionId, delta);
    this.add(this.byAgent, params.agent, delta);
    this.total = sum(this.total, delta);
    return delta;
  }

  sessionCost(sessionId: string): CostBucket {
    return this.bySession.get(sessionId) ?? { ...ZERO };
  }

  agentCost(agent: string): CostBucket {
    return this.byAgent.get(agent) ?? { ...ZERO };
  }

  totalCost(): CostBucket {
    return { ...this.total };
  }

  private add(map: Map<string, CostBucket>, key: string, delta: CostBucket): void {
    map.set(key, sum(map.get(key) ?? { ...ZERO }, delta));
  }
}

function sum(a: CostBucket, b: CostBucket): CostBucket {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

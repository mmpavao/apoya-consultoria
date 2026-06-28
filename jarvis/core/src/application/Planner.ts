import { z } from 'zod';
import type { LlmClient } from '../domain/llm/LlmClient.js';
import type { Plan } from '../domain/entities/Task.js';
import type { AgentDefinition } from '../domain/entities/Agent.js';

const planStepSchema = z.object({
  index: z.number().int().nonnegative(),
  agent: z.string(),
  instruction: z.string(),
  suggestedTool: z.string().optional(),
  dependsOn: z.array(z.number().int().nonnegative()).default([]),
});

const planSchema = z.object({
  goal: z.string(),
  steps: z.array(planStepSchema).min(1),
});

const PLANNER_PROMPT = `You are the JARVIS Orchestrator's planner. Decompose the user's intent into an
ordered list of steps. Each step targets exactly one specialist agent and may suggest a tool.
Keep the plan minimal — prefer fewer steps. Respect dependencies via 0-based step indices.

Return ONLY a JSON object, no prose, matching:
{"goal": string, "steps": [{"index": number, "agent": string, "instruction": string,
"suggestedTool"?: string, "dependsOn": number[]}]}`;

/**
 * Turns an intent into a Plan via the LLM (PRD §6.1). Falls back to a single
 * step routed to a default agent if the model returns unusable output, so the
 * loop always makes progress.
 */
export class Planner {
  constructor(
    private readonly llm: LlmClient,
    private readonly agents: readonly AgentDefinition[],
    private readonly defaultAgent: string,
  ) {}

  async plan(intent: string): Promise<{ plan: Plan; tokensIn: number; tokensOut: number }> {
    const roster = this.agents
      .map((a) => `- ${a.name}: ${a.description}`)
      .join('\n');
    const res = await this.llm.complete({
      system: `${PLANNER_PROMPT}\n\nAvailable agents:\n${roster}`,
      messages: [{ role: 'user', content: [{ type: 'text', text: intent }] }],
      maxTokens: 1024,
      temperature: 0,
    });

    const text = res.content
      .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      plan: this.parse(text, intent),
      tokensIn: res.usage.inputTokens,
      tokensOut: res.usage.outputTokens,
    };
  }

  private parse(text: string, intent: string): Plan {
    const json = extractJson(text);
    if (json) {
      const parsed = planSchema.safeParse(json);
      if (parsed.success && this.allAgentsKnown(parsed.data)) {
        return parsed.data;
      }
    }
    return {
      goal: intent,
      steps: [{ index: 0, agent: this.defaultAgent, instruction: intent, dependsOn: [] }],
    };
  }

  private allAgentsKnown(plan: Plan): boolean {
    const known = new Set(this.agents.map((a) => a.name));
    return plan.steps.every((s) => known.has(s.agent));
  }
}

/** Extracts the first balanced JSON object from a possibly noisy LLM reply. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

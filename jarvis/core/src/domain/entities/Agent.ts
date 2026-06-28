/**
 * Specialist agent definition. Each agent has its own system prompt and a
 * least-privilege subset of tools (PRD §4.3). Definitions are pure data so they
 * can be versioned and tested.
 */
export interface AgentDefinition {
  /** Stable id, e.g. "FileAgent". */
  readonly name: string;
  /** Short human description for the UI. */
  readonly description: string;
  /** System prompt steering the agent's behaviour. */
  readonly systemPrompt: string;
  /** Version of the system prompt, recorded on each run for auditing. */
  readonly systemPromptVersion: string;
  /** Names of tools this agent may call. Empty = none. "*" = all registered. */
  readonly allowedTools: readonly string[];
}

export type AgentRunStatus = 'thinking' | 'acting' | 'idle' | 'error' | 'done';

/** Live, observable status of an agent for the Agents panel (PRD §7.2). */
export interface AgentRuntimeState {
  agent: string;
  status: AgentRunStatus;
  currentTaskId: string | null;
  tokensIn: number;
  tokensOut: number;
}

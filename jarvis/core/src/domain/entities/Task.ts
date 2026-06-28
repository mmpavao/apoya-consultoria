import type { AuditFields } from '../types.js';

export type TaskStatus =
  | 'pending'
  | 'planning'
  | 'awaiting_approval'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

export interface Task extends AuditFields {
  sessionId: string;
  parentTaskId: string | null;
  /** Target specialist agent for this task/step. */
  agent: string;
  status: TaskStatus;
  /** 0-based index within the plan; null for the root task. */
  planStep: number | null;
  input: string;
  output: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** A single ordered step the planner emits (PRD §6.1). */
export interface PlanStep {
  index: number;
  agent: string;
  /** Natural-language instruction for the agent. */
  instruction: string;
  /** Tool the planner expects will be used (advisory; agent decides). */
  suggestedTool?: string;
  /** Indices of steps that must finish before this one. */
  dependsOn: number[];
}

export interface Plan {
  goal: string;
  steps: PlanStep[];
}

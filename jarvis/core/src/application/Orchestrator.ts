import type { Plan } from '../domain/entities/Task.js';
import type { AgentDefinition } from '../domain/entities/Agent.js';
import type { Clock, IdGenerator } from '../domain/clock.js';
import type { ToolLogger } from '../domain/tools/Tool.js';
import { Planner } from './Planner.js';
import { AgentRunner, type AgentStepEvent } from './AgentRunner.js';

export type OrchestratorEvent =
  | { type: 'plan_created'; sessionId: string; plan: Plan }
  | { type: 'step_started'; sessionId: string; step: number; agent: string }
  | ({ type: 'agent_event'; sessionId: string; step: number } & AgentStepEvent)
  | { type: 'step_finished'; sessionId: string; step: number; output: string }
  | { type: 'done'; sessionId: string; summary: string }
  | { type: 'error'; sessionId: string; message: string };

export interface RunOptions {
  sessionId: string;
  signal?: AbortSignal;
}

/**
 * Single entry point (PRD §4.3). Plans an intent, executes each step on its
 * specialist agent in dependency order, and streams events to the UI. Step
 * outputs are threaded forward so later steps see earlier results.
 */
export class Orchestrator {
  private readonly agentsByName: Map<string, AgentDefinition>;

  constructor(
    private readonly planner: Planner,
    private readonly runner: AgentRunner,
    private readonly agents: readonly AgentDefinition[],
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly logger: ToolLogger,
  ) {
    this.agentsByName = new Map(agents.map((a) => [a.name, a]));
  }

  async handleIntent(
    intent: string,
    opts: RunOptions,
    onEvent: (e: OrchestratorEvent) => void,
  ): Promise<string> {
    const { sessionId } = opts;
    try {
      const { plan } = await this.planner.plan(intent);
      onEvent({ type: 'plan_created', sessionId, plan });

      const outputs = new Map<number, string>();
      for (const step of orderSteps(plan)) {
        if (opts.signal?.aborted) throw new Error('cancelled');
        const agent = this.agentsByName.get(step.agent);
        if (!agent) throw new Error(`No such agent: ${step.agent}`);

        onEvent({ type: 'step_started', sessionId, step: step.index, agent: step.agent });
        const instruction = buildInstruction(step.instruction, step.dependsOn, outputs);
        const taskId = this.ids.next();

        const result = await this.runner.run(
          agent,
          instruction,
          {
            sessionId,
            taskId,
            agent: agent.name,
            log: childLogger(this.logger, agent.name),
            signal: opts.signal,
          },
          (e) => onEvent({ type: 'agent_event', sessionId, step: step.index, ...e }),
        );

        outputs.set(step.index, result.finalText);
        onEvent({ type: 'step_finished', sessionId, step: step.index, output: result.finalText });
      }

      const summary = [...outputs.values()].filter(Boolean).join('\n\n');
      onEvent({ type: 'done', sessionId, summary });
      return summary;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error('orchestration failed', { message });
      onEvent({ type: 'error', sessionId, message });
      return '';
    }
  }
}

/** Kahn topological order; falls back to declared order on cycles. */
export function orderSteps(plan: Plan): Plan['steps'] {
  const byIndex = new Map(plan.steps.map((s) => [s.index, s]));
  const indegree = new Map<number, number>();
  for (const s of plan.steps) indegree.set(s.index, 0);
  for (const s of plan.steps) {
    for (const dep of s.dependsOn) {
      if (byIndex.has(dep)) indegree.set(s.index, (indegree.get(s.index) ?? 0) + 1);
    }
  }
  const ready = plan.steps
    .filter((s) => (indegree.get(s.index) ?? 0) === 0)
    .sort((a, b) => a.index - b.index);
  const ordered: Plan['steps'] = [];
  const queue = [...ready];
  while (queue.length) {
    const s = queue.shift()!;
    ordered.push(s);
    for (const other of plan.steps) {
      if (other.dependsOn.includes(s.index)) {
        const d = (indegree.get(other.index) ?? 0) - 1;
        indegree.set(other.index, d);
        if (d === 0) queue.push(other);
      }
    }
  }
  return ordered.length === plan.steps.length
    ? ordered
    : [...plan.steps].sort((a, b) => a.index - b.index);
}

function buildInstruction(
  instruction: string,
  dependsOn: number[],
  outputs: Map<number, string>,
): string {
  const context = dependsOn
    .map((d) => outputs.get(d))
    .filter((v): v is string => Boolean(v))
    .join('\n');
  return context ? `Context from previous steps:\n${context}\n\nTask:\n${instruction}` : instruction;
}

function childLogger(parent: ToolLogger, agent: string): ToolLogger {
  const tag = (msg: string) => `[${agent}] ${msg}`;
  return {
    debug: (m, meta) => parent.debug(tag(m), meta),
    info: (m, meta) => parent.info(tag(m), meta),
    warn: (m, meta) => parent.warn(tag(m), meta),
    error: (m, meta) => parent.error(tag(m), meta),
  };
}

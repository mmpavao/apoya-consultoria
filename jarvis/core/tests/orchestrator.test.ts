import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Orchestrator, orderSteps, type OrchestratorEvent } from '../src/application/Orchestrator.js';
import { Planner } from '../src/application/Planner.js';
import { AgentRunner } from '../src/application/AgentRunner.js';
import { ToolRegistry } from '../src/application/ToolRegistry.js';
import { ToolExecutor } from '../src/application/ToolExecutor.js';
import { PermissionService, InMemoryPermissionStore } from '../src/application/PermissionService.js';
import { ApprovalService } from '../src/application/ApprovalService.js';
import { AuditLog, InMemoryAuditStore } from '../src/application/AuditLog.js';
import { CostTracker } from '../src/application/CostTracker.js';
import { FakeLlmClient, fakeText, fakeToolUse } from '../src/infrastructure/llm/FakeLlmClient.js';
import { systemClock } from '../src/domain/clock.js';
import { toolLogger } from '../src/infrastructure/logging/logger.js';
import type { AgentDefinition } from '../src/domain/entities/Agent.js';
import type { Plan } from '../src/domain/entities/Task.js';
import { ok } from '../src/domain/types.js';
import type { Tool } from '../src/domain/tools/Tool.js';
import type { LlmResponse } from '../src/domain/llm/LlmClient.js';

let n = 0;
const ids = { next: () => `id-${n++}` };

const AGENTS: AgentDefinition[] = [
  {
    name: 'EchoAgent',
    description: 'echoes',
    systemPrompt: 'echo',
    systemPromptVersion: '1',
    allowedTools: ['test.echo'],
  },
];

const echoTool: Tool<{ msg: string }, { echo: string }> = {
  name: 'test.echo',
  description: 'echo',
  inputSchema: z.object({ msg: z.string() }),
  permission: 'read',
  reversible: true,
  execute: async (i) => ok({ output: { echo: i.msg } }),
};

function build(responses: LlmResponse[]) {
  n = 0;
  const llm = new FakeLlmClient({ responses });
  const registry = new ToolRegistry();
  registry.register(echoTool);
  const permissions = new PermissionService(new InMemoryPermissionStore([]));
  const approvals = new ApprovalService(systemClock, ids);
  const audit = new AuditLog(new InMemoryAuditStore(), systemClock, ids);
  const executor = new ToolExecutor(registry, permissions, approvals, audit, () => ids.next());
  const cost = new CostTracker({});
  const planner = new Planner(llm, AGENTS, 'EchoAgent');
  const runner = new AgentRunner(llm, registry, executor, cost);
  const orchestrator = new Orchestrator(planner, runner, AGENTS, systemClock, ids, toolLogger());
  return { orchestrator, cost };
}

describe('Orchestrator', () => {
  it('plans then executes, threading the final summary', async () => {
    const plan: Plan = {
      goal: 'g',
      steps: [{ index: 0, agent: 'EchoAgent', instruction: 'say hi', dependsOn: [] }],
    };
    const { orchestrator } = build([
      fakeText(JSON.stringify(plan)), // planner output
      fakeText('done: hi'), // agent turn (no tool use)
    ]);
    const events: OrchestratorEvent[] = [];
    const summary = await orchestrator.handleIntent('say hi', { sessionId: 's' }, (e) => events.push(e));

    expect(summary).toBe('done: hi');
    expect(events.find((e) => e.type === 'plan_created')).toBeTruthy();
    expect(events.find((e) => e.type === 'done')).toBeTruthy();
  });

  it('runs a tool call mid-step then finishes', async () => {
    const plan: Plan = {
      goal: 'g',
      steps: [{ index: 0, agent: 'EchoAgent', instruction: 'echo it', dependsOn: [] }],
    };
    const { orchestrator, cost } = build([
      fakeText(JSON.stringify(plan)),
      fakeToolUse('test.echo', { msg: 'hello' }),
      fakeText('finished'),
    ]);
    const summary = await orchestrator.handleIntent('echo', { sessionId: 's1' }, () => {});
    expect(summary).toBe('finished');
    // planner + 2 agent turns recorded usage
    expect(cost.sessionCost('s1').inputTokens).toBeGreaterThan(0);
  });

  it('falls back to a single default-agent step when the plan is unparseable', async () => {
    const { orchestrator } = build([fakeText('not json'), fakeText('handled')]);
    const events: OrchestratorEvent[] = [];
    const summary = await orchestrator.handleIntent('do thing', { sessionId: 's2' }, (e) => events.push(e));
    expect(summary).toBe('handled');
    const plan = events.find((e) => e.type === 'plan_created');
    expect(plan && plan.type === 'plan_created' && plan.plan.steps[0]?.agent).toBe('EchoAgent');
  });
});

describe('orderSteps', () => {
  it('topologically orders by dependency', () => {
    const plan: Plan = {
      goal: 'g',
      steps: [
        { index: 0, agent: 'A', instruction: 'a', dependsOn: [1] },
        { index: 1, agent: 'A', instruction: 'b', dependsOn: [] },
      ],
    };
    expect(orderSteps(plan).map((s) => s.index)).toEqual([1, 0]);
  });

  it('falls back to declared order on a cycle', () => {
    const plan: Plan = {
      goal: 'g',
      steps: [
        { index: 0, agent: 'A', instruction: 'a', dependsOn: [1] },
        { index: 1, agent: 'A', instruction: 'b', dependsOn: [0] },
      ],
    };
    expect(orderSteps(plan).map((s) => s.index)).toEqual([0, 1]);
  });
});

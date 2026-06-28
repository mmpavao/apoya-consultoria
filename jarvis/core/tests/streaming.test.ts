import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AgentRunner, type AgentStepEvent } from '../src/application/AgentRunner.js';
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
import type { LlmResponse } from '../src/domain/llm/LlmClient.js';
import type { Tool, ToolContext } from '../src/domain/tools/Tool.js';
import { ok } from '../src/domain/types.js';

let n = 0;
const ids = { next: () => `id-${n++}` };
const ctx: ToolContext = { sessionId: 's', taskId: 't', agent: 'EchoAgent', log: toolLogger() };

const agent: AgentDefinition = {
  name: 'EchoAgent',
  description: 'echoes',
  systemPrompt: 'echo',
  systemPromptVersion: '1',
  allowedTools: ['test.echo'],
};

const echoTool: Tool<{ msg: string }, { echo: string }> = {
  name: 'test.echo',
  description: 'echo',
  inputSchema: z.object({ msg: z.string() }),
  permission: 'read',
  reversible: true,
  execute: async (i) => ok({ output: { echo: i.msg } }),
};

function makeRunner(responses: LlmResponse[]) {
  n = 0;
  const llm = new FakeLlmClient({ responses });
  const registry = new ToolRegistry();
  registry.register(echoTool);
  const permissions = new PermissionService(new InMemoryPermissionStore([]));
  const approvals = new ApprovalService(systemClock, ids);
  const audit = new AuditLog(new InMemoryAuditStore(), systemClock, ids);
  const executor = new ToolExecutor(registry, permissions, approvals, audit, () => ids.next());
  return new AgentRunner(llm, registry, executor, new CostTracker({}));
}

describe('AgentRunner streaming (PRD §6.2)', () => {
  it('emits incremental agent_delta events that reconstruct the final text', async () => {
    const runner = makeRunner([fakeText('hello there general kenobi')]);
    const events: AgentStepEvent[] = [];
    const res = await runner.run(agent, 'hi', ctx, (e) => events.push(e));

    const deltas = events.filter((e) => e.kind === 'agent_delta');
    expect(deltas.length).toBeGreaterThan(1); // genuinely streamed, not one blob
    expect(deltas.map((d) => d.text).join('')).toBe('hello there general kenobi');
    expect(res.finalText).toBe('hello there general kenobi');
    // The consolidated turn text is also emitted once.
    expect(events.filter((e) => e.kind === 'agent_text')).toHaveLength(1);
  });

  it('streams across a tool-use turn then finishes', async () => {
    const runner = makeRunner([
      fakeToolUse('test.echo', { msg: 'x' }),
      fakeText('all done'),
    ]);
    const events: AgentStepEvent[] = [];
    const res = await runner.run(agent, 'go', ctx, (e) => events.push(e));

    expect(events.some((e) => e.kind === 'tool_call')).toBe(true);
    expect(events.some((e) => e.kind === 'tool_result' && e.ok)).toBe(true);
    expect(res.finalText).toBe('all done');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../src/application/ToolRegistry.js';
import {
  PermissionService,
  InMemoryPermissionStore,
} from '../src/application/PermissionService.js';
import { ApprovalService } from '../src/application/ApprovalService.js';
import { AuditLog, InMemoryAuditStore } from '../src/application/AuditLog.js';
import { ToolExecutor } from '../src/application/ToolExecutor.js';
import { systemClock } from '../src/domain/clock.js';
import type { Tool, ToolContext } from '../src/domain/tools/Tool.js';
import { ok } from '../src/domain/types.js';
import { toolLogger } from '../src/infrastructure/logging/logger.js';

let counter = 0;
const ids = { next: () => `id-${counter++}` };
const ctx: ToolContext = {
  sessionId: 's',
  taskId: 't',
  agent: 'TestAgent',
  log: toolLogger(),
};

function makeExecutor(over?: { rules?: never }) {
  const registry = new ToolRegistry();
  const permissions = new PermissionService(new InMemoryPermissionStore([]));
  const approvals = new ApprovalService(systemClock, ids);
  const audit = new AuditLog(new InMemoryAuditStore(), systemClock, ids);
  const executor = new ToolExecutor(registry, permissions, approvals, audit, () => ids.next());
  return { registry, permissions, approvals, audit, executor };
}

const echoRead: Tool<{ msg: string }, { echo: string }> = {
  name: 'test.echo',
  description: 'echo',
  inputSchema: z.object({ msg: z.string() }),
  permission: 'read',
  reversible: true,
  execute: async (input) => ok({ output: { echo: input.msg } }),
};

const destroyer: Tool<{ target: string }, { gone: true }> = {
  name: 'test.destroy',
  description: 'destroy',
  inputSchema: z.object({ target: z.string() }),
  permission: 'destructive',
  reversible: false,
  execute: async () => ok({ output: { gone: true } }),
};

describe('ToolExecutor', () => {
  beforeEach(() => {
    counter = 0;
  });

  it('runs read tools automatically and audits them', async () => {
    const { registry, executor, audit } = makeExecutor();
    registry.register(echoRead);
    const res = await executor.execute({ toolName: 'test.echo', input: { msg: 'hi' }, ctx });
    expect(res.ok && res.value.output).toEqual({ echo: 'hi' });
    expect(audit.list().some((e) => e.action === 'tool.execute')).toBe(true);
  });

  it('rejects unknown tools', async () => {
    const { executor } = makeExecutor();
    const res = await executor.execute({ toolName: 'nope', input: {}, ctx });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('TOOL_NOT_FOUND');
  });

  it('validates input against the schema', async () => {
    const { registry, executor } = makeExecutor();
    registry.register(echoRead);
    const res = await executor.execute({ toolName: 'test.echo', input: { msg: 42 }, ctx });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('TOOL_INPUT_INVALID');
  });

  it('blocks a destructive tool until approved, then runs it', async () => {
    const { registry, executor, approvals } = makeExecutor();
    registry.register(destroyer);
    approvals.onEvent((e) => {
      if (e.type === 'requested') approvals.decide(e.request.id, 'approved');
    });
    const res = await executor.execute({ toolName: 'test.destroy', input: { target: '/tmp/x' }, ctx });
    expect(res.ok && res.value.output).toEqual({ gone: true });
  });

  it('does not run a destructive tool when rejected', async () => {
    const { registry, executor, approvals } = makeExecutor();
    registry.register(destroyer);
    approvals.onEvent((e) => {
      if (e.type === 'requested') approvals.decide(e.request.id, 'rejected');
    });
    const res = await executor.execute({ toolName: 'test.destroy', input: { target: '/tmp/x' }, ctx });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('APPROVAL_REJECTED');
  });
});

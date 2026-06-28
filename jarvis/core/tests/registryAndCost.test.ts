import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../src/application/ToolRegistry.js';
import { CostTracker } from '../src/application/CostTracker.js';
import { zodToJsonSchema } from '../src/application/zodToJsonSchema.js';
import type { Tool } from '../src/domain/tools/Tool.js';
import { ok } from '../src/domain/types.js';

const tool = (name: string): Tool => ({
  name,
  description: name,
  inputSchema: z.object({ x: z.string() }),
  permission: 'read',
  reversible: true,
  execute: async () => ok({ output: null }),
});

describe('ToolRegistry', () => {
  it('registers, lists, and rejects duplicates', () => {
    const r = new ToolRegistry();
    r.register(tool('a'));
    expect(() => r.register(tool('a'))).toThrow();
    expect(r.list().map((t) => t.name)).toEqual(['a']);
  });

  it('advertises only allowed tools (least privilege)', () => {
    const r = new ToolRegistry();
    r.registerAll([tool('a'), tool('b'), tool('c')]);
    expect(r.schemasFor(['a', 'c']).map((s) => s.name)).toEqual(['a', 'c']);
    expect(r.schemasFor(['*']).length).toBe(3);
    expect(r.schemasFor().length).toBe(3);
  });

  it('unregisters (e.g. MCP disconnect)', () => {
    const r = new ToolRegistry();
    r.register(tool('a'));
    r.unregister('a');
    expect(r.has('a')).toBe(false);
  });
});

describe('zodToJsonSchema', () => {
  it('produces an object schema with required and descriptions', () => {
    const schema = zodToJsonSchema(
      z.object({
        name: z.string().describe('the name'),
        count: z.number().optional(),
        kind: z.enum(['a', 'b']),
      }),
    );
    expect(schema).toMatchObject({
      type: 'object',
      properties: {
        name: { type: 'string', description: 'the name' },
        count: { type: 'number' },
        kind: { type: 'string', enum: ['a', 'b'] },
      },
      required: ['name', 'kind'],
      additionalProperties: false,
    });
  });
});

describe('CostTracker', () => {
  it('accumulates cost per session and agent from pricing', () => {
    const tracker = new CostTracker({
      'claude-sonnet-4-6': { inputPerMillion: 3, outputPerMillion: 15 },
    });
    tracker.record({
      sessionId: 's',
      agent: 'A',
      model: 'claude-sonnet-4-6',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    });
    expect(tracker.sessionCost('s').costUsd).toBeCloseTo(18, 5);
    expect(tracker.agentCost('A').inputTokens).toBe(1_000_000);
    expect(tracker.totalCost().costUsd).toBeCloseTo(18, 5);
  });

  it('treats unknown models as zero-cost (no crash)', () => {
    const tracker = new CostTracker({});
    const delta = tracker.record({
      sessionId: 's',
      agent: 'A',
      model: 'mystery',
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    expect(delta.costUsd).toBe(0);
  });
});

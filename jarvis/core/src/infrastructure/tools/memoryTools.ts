import { z } from 'zod';
import type { Tool } from '../../domain/tools/Tool.js';
import { ok, err, domainError } from '../../domain/types.js';
import type { MemoryService } from '../memory/MemoryService.js';

/** RAG memory tools (PRD §4.4): recall + store. Both operate on local memory. */
export function memoryTools(memory: MemoryService): Tool[] {
  const recall: Tool<{ query: string; limit?: number }, { hits: { content: string; score: number }[] }> = {
    name: 'memory.recall',
    description: 'Recall relevant facts/preferences from long-term memory.',
    inputSchema: z.object({
      query: z.string().describe('What to recall'),
      limit: z.number().int().positive().max(20).optional(),
    }),
    permission: 'read',
    reversible: true,
    async execute(input) {
      try {
        const hits = await memory.recall(input.query, input.limit ?? 5);
        return ok({ output: { hits: hits.map((h) => ({ content: h.fact.content, score: h.score })) } });
      } catch (e) {
        return err(domainError('MEMORY_RECALL_FAILED', 'Recall failed', e));
      }
    },
  };

  const store: Tool<{ content: string; importance?: number }, { id: string }> = {
    name: 'memory.store',
    description: 'Persist a fact or user preference to long-term memory.',
    inputSchema: z.object({
      content: z.string().describe('The fact to remember'),
      importance: z.number().min(0).max(1).optional().describe('0..1 retention weight'),
    }),
    permission: 'write',
    reversible: true,
    async execute(input) {
      try {
        const fact = await memory.store(input.content, 'fact', input.importance ?? 0.5);
        return ok({ output: { id: fact.id }, meta: { reversible: true } });
      } catch (e) {
        return err(domainError('MEMORY_STORE_FAILED', 'Store failed', e));
      }
    },
  };

  return [recall, store];
}

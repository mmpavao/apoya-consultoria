import { describe, it, expect } from 'vitest';
import { MemoryService, InMemoryFactStore } from '../src/infrastructure/memory/MemoryService.js';
import {
  InMemoryVectorStore,
  HashingEmbeddingProvider,
} from '../src/infrastructure/memory/VectorStore.js';
import { systemClock } from '../src/domain/clock.js';

let n = 0;
const ids = { next: () => `id-${n++}` };

function makeMemory() {
  n = 0;
  return new MemoryService(
    new InMemoryFactStore(),
    new InMemoryVectorStore(),
    new HashingEmbeddingProvider(),
    systemClock,
    ids,
  );
}

describe('MemoryService (RAG)', () => {
  it('stores and recalls the most relevant fact', async () => {
    const memory = makeMemory();
    await memory.store('The user prefers dark mode interfaces');
    await memory.store('The project deadline is next Friday');
    const hits = await memory.recall('what interface theme does the user like');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.fact.content).toMatch(/dark mode/);
  });

  it('forgets a fact so it is no longer recalled', async () => {
    const memory = makeMemory();
    const fact = await memory.store('secret to forget about pineapples');
    await memory.forget(fact.id);
    const hits = await memory.recall('pineapples');
    expect(hits.find((h) => h.fact.id === fact.id)).toBeUndefined();
    expect(memory.list().length).toBe(0);
  });
});

import type { MemoryFact, MemoryHit, MemoryKind } from '../../domain/entities/Memory.js';
import type { Clock, IdGenerator } from '../../domain/clock.js';
import type { EmbeddingProvider, VectorStore } from './VectorStore.js';

export interface MemoryFactStore {
  save(fact: MemoryFact): void;
  get(id: string): MemoryFact | undefined;
  list(): readonly MemoryFact[];
  softDelete(id: string, at: string): void;
}

export class InMemoryFactStore implements MemoryFactStore {
  private readonly facts = new Map<string, MemoryFact>();
  save(fact: MemoryFact): void {
    this.facts.set(fact.id, fact);
  }
  get(id: string): MemoryFact | undefined {
    return this.facts.get(id);
  }
  list(): readonly MemoryFact[] {
    return [...this.facts.values()].filter((f) => !f.deletedAt);
  }
  softDelete(id: string, at: string): void {
    const f = this.facts.get(id);
    if (f) {
      f.deletedAt = at;
      f.updatedAt = at;
    }
  }
}

/**
 * Stores and recalls long-term facts via RAG (PRD §4.3, §10 acceptance). Pairs
 * a fact store with a vector index so memory survives across sessions.
 */
export class MemoryService {
  constructor(
    private readonly facts: MemoryFactStore,
    private readonly vectors: VectorStore,
    private readonly embeddings: EmbeddingProvider,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async store(content: string, kind: MemoryKind = 'fact', importance = 0.5): Promise<MemoryFact> {
    const now = this.clock.now();
    const embeddingRef = this.ids.next();
    const fact: MemoryFact = {
      id: this.ids.next(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      kind,
      content,
      embeddingRef,
      importance,
    };
    this.facts.save(fact);
    await this.vectors.upsert({
      id: embeddingRef,
      factId: fact.id,
      text: content,
      vector: await this.embeddings.embed(content),
    });
    return fact;
  }

  async recall(query: string, k = 5): Promise<MemoryHit[]> {
    const vector = await this.embeddings.embed(query);
    const hits = await this.vectors.query(vector, k);
    return hits
      .map((h) => {
        const fact = this.facts.get(h.factId);
        return fact && !fact.deletedAt ? { fact, score: h.score } : null;
      })
      .filter((x): x is MemoryHit => x !== null);
  }

  list(): readonly MemoryFact[] {
    return this.facts.list();
  }

  async forget(factId: string): Promise<void> {
    const fact = this.facts.get(factId);
    if (!fact) return;
    if (fact.embeddingRef) await this.vectors.remove(fact.embeddingRef);
    this.facts.softDelete(factId, this.clock.now());
  }
}

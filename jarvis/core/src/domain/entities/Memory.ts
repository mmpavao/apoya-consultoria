import type { AuditFields } from '../types.js';

export type MemoryKind = 'fact' | 'preference' | 'summary';

/**
 * A long-term memory fact, retrievable across sessions via RAG (PRD §4.3, §5).
 * The embedding lives in the vector store and is referenced by `embeddingRef`.
 */
export interface MemoryFact extends AuditFields {
  kind: MemoryKind;
  content: string;
  embeddingRef: string | null;
  /** 0..1 relevance/retention weight used for ranking and pruning. */
  importance: number;
}

export interface MemoryHit {
  fact: MemoryFact;
  /** Cosine similarity (or provider score), higher is closer. */
  score: number;
}

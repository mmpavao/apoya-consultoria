/**
 * Long-term memory vector store (PRD §4.3, §5). The production implementation
 * is sqlite-vec with local embeddings (PRD §12); the in-memory cosine store
 * below is the dependency-free default for tests and first-run.
 */
export interface EmbeddingProvider {
  /** Returns a fixed-length embedding for the text. */
  embed(text: string): Promise<number[]>;
}

export interface StoredVector {
  id: string;
  factId: string;
  text: string;
  vector: number[];
}

export interface VectorStore {
  upsert(entry: StoredVector): Promise<void>;
  query(vector: number[], k: number): Promise<{ factId: string; text: string; score: number }[]>;
  remove(id: string): Promise<void>;
}

export class InMemoryVectorStore implements VectorStore {
  private readonly entries: StoredVector[] = [];

  async upsert(entry: StoredVector): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) this.entries[idx] = entry;
    else this.entries.push(entry);
  }

  async query(vector: number[], k: number): Promise<{ factId: string; text: string; score: number }[]> {
    return this.entries
      .map((e) => ({ factId: e.factId, text: e.text, score: cosine(vector, e.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async remove(id: string): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx >= 0) this.entries.splice(idx, 1);
  }
}

/**
 * Deterministic, dependency-free embedding for tests/first-run: hashed bag of
 * tokens into a fixed-dimension vector. Real deployments swap in a local model
 * (PRD §12) behind the same EmbeddingProvider interface.
 */
export class HashingEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly dims = 64) {}
  async embed(text: string): Promise<number[]> {
    const vec = new Array<number>(this.dims).fill(0);
    for (const token of text.toLowerCase().split(/\W+/).filter(Boolean)) {
      let h = 0;
      for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
      vec[h % this.dims] += 1;
    }
    const norm = Math.hypot(...vec) || 1;
    return vec.map((v) => v / norm);
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot; // inputs are unit-normalised, so dot product = cosine similarity
}

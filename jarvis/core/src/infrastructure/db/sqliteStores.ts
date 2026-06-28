import type { Db } from './Database.js';
import type { SessionStore } from '../../application/SessionManager.js';
import type { AuditStore } from '../../application/AuditLog.js';
import type { JobStore, QueuedJob, QueuedJobStatus } from '../../application/TaskQueue.js';
import type { PermissionStore } from '../../application/PermissionService.js';
import type { MemoryFactStore } from '../memory/MemoryService.js';
import type { VectorStore, StoredVector } from '../memory/VectorStore.js';
import { cosine } from '../memory/VectorStore.js';
import type { Session, Message } from '../../domain/entities/Session.js';
import type { AuditEntry } from '../../domain/entities/AuditEntry.js';
import type { PermissionRule } from '../../domain/entities/Permission.js';
import type { MemoryFact, MemoryKind } from '../../domain/entities/Memory.js';
import type { PermissionLevel } from '../../domain/tools/Tool.js';

/**
 * SQLite implementations of the application/infrastructure store interfaces
 * (PRD §5, §8). They are drop-in for the in-memory defaults — bootstrap swaps
 * them in without touching any call site, proving the persistence boundary.
 */

const bool = (v: unknown): boolean => v === 1 || v === true;
const bit = (v: boolean): number => (v ? 1 : 0);

export class SqliteSessionStore implements SessionStore {
  constructor(private readonly db: Db) {}

  save(s: Session): void {
    this.db
      .prepare(
        `INSERT INTO sessions (id, created_at, updated_at, deleted_at, title, status, started_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
           title=excluded.title, status=excluded.status`,
      )
      .run(s.id, s.createdAt, s.updatedAt, s.deletedAt, s.title, s.status, s.startedAt);
  }

  get(id: string): Session | undefined {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toSession(row) : undefined;
  }

  list(): readonly Session[] {
    return (this.db.prepare('SELECT * FROM sessions WHERE deleted_at IS NULL').all() as Record<
      string,
      unknown
    >[]).map(toSession);
  }

  addMessage(m: Message): void {
    this.db
      .prepare(
        `INSERT INTO messages (id, created_at, updated_at, deleted_at, session_id, role, content, tokens_in, tokens_out)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(m.id, m.createdAt, m.updatedAt, m.deletedAt, m.sessionId, m.role, m.content, m.tokensIn, m.tokensOut);
  }

  messages(sessionId: string): readonly Message[] {
    return (
      this.db
        .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at')
        .all(sessionId) as Record<string, unknown>[]
    ).map(toMessage);
  }
}

export class SqliteAuditStore implements AuditStore {
  constructor(private readonly db: Db) {}

  append(e: AuditEntry): void {
    this.db
      .prepare(
        `INSERT INTO audit_log (id, created_at, updated_at, deleted_at, actor, action, target, payload_json, reversible, undone, undo_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.id,
        e.createdAt,
        e.updatedAt,
        e.deletedAt,
        e.actor,
        e.action,
        e.target,
        JSON.stringify(e.payload),
        bit(e.reversible),
        bit(e.undone),
        e.undoToken,
      );
  }

  list(): readonly AuditEntry[] {
    return (this.db.prepare('SELECT * FROM audit_log ORDER BY created_at').all() as Record<
      string,
      unknown
    >[]).map(toAudit);
  }

  get(id: string): AuditEntry | undefined {
    const row = this.db.prepare('SELECT * FROM audit_log WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toAudit(row) : undefined;
  }

  markUndone(id: string): void {
    this.db.prepare('UPDATE audit_log SET undone = 1 WHERE id = ?').run(id);
  }
}

export class SqliteJobStore implements JobStore {
  constructor(private readonly db: Db) {}

  enqueue(job: QueuedJob): void {
    this.db
      .prepare(
        `INSERT INTO jobs (id, kind, payload_json, status, attempts, max_attempts, created_at, updated_at, last_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        job.id,
        job.kind,
        JSON.stringify(job.payload),
        job.status,
        job.attempts,
        job.maxAttempts,
        job.createdAt,
        job.updatedAt,
        job.lastError,
      );
  }

  update(job: QueuedJob): void {
    this.db
      .prepare(
        `UPDATE jobs SET payload_json=?, status=?, attempts=?, max_attempts=?, updated_at=?, last_error=? WHERE id=?`,
      )
      .run(
        JSON.stringify(job.payload),
        job.status,
        job.attempts,
        job.maxAttempts,
        job.updatedAt,
        job.lastError,
        job.id,
      );
  }

  claimable(): QueuedJob[] {
    return (
      this.db
        .prepare("SELECT * FROM jobs WHERE status IN ('queued','running') ORDER BY created_at")
        .all() as Record<string, unknown>[]
    ).map(toJob);
  }

  list(): readonly QueuedJob[] {
    return (this.db.prepare('SELECT * FROM jobs ORDER BY created_at').all() as Record<
      string,
      unknown
    >[]).map(toJob);
  }
}

export class SqlitePermissionStore implements PermissionStore {
  constructor(private readonly db: Db) {}

  list(): readonly PermissionRule[] {
    return (this.db.prepare('SELECT * FROM permissions').all() as Record<string, unknown>[]).map(
      toPermission,
    );
  }

  /** Seeds the allowlist (used at first run). */
  insert(rule: PermissionRule): void {
    this.db
      .prepare(
        `INSERT INTO permissions (id, created_at, updated_at, deleted_at, scope, pattern, level, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
      )
      .run(
        rule.id,
        rule.createdAt,
        rule.updatedAt,
        rule.deletedAt,
        rule.scope,
        rule.pattern,
        rule.level,
        bit(rule.enabled),
      );
  }
}

export class SqliteFactStore implements MemoryFactStore {
  constructor(private readonly db: Db) {}

  save(f: MemoryFact): void {
    this.db
      .prepare(
        `INSERT INTO memory_facts (id, created_at, updated_at, deleted_at, kind, content, embedding_ref, importance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at, deleted_at=excluded.deleted_at,
           content=excluded.content, importance=excluded.importance`,
      )
      .run(f.id, f.createdAt, f.updatedAt, f.deletedAt, f.kind, f.content, f.embeddingRef, f.importance);
  }

  get(id: string): MemoryFact | undefined {
    const row = this.db.prepare('SELECT * FROM memory_facts WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? toFact(row) : undefined;
  }

  list(): readonly MemoryFact[] {
    return (
      this.db.prepare('SELECT * FROM memory_facts WHERE deleted_at IS NULL').all() as Record<
        string,
        unknown
      >[]
    ).map(toFact);
  }

  softDelete(id: string, at: string): void {
    this.db.prepare('UPDATE memory_facts SET deleted_at = ?, updated_at = ? WHERE id = ?').run(at, at, id);
  }
}

/** Vector store persisting embeddings as JSON; cosine ranking in JS (local scale). */
export class SqliteVectorStore implements VectorStore {
  constructor(private readonly db: Db) {}

  async upsert(e: StoredVector): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO memory_embeddings (id, fact_id, vector, text) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET fact_id=excluded.fact_id, vector=excluded.vector, text=excluded.text`,
      )
      .run(e.id, e.factId, JSON.stringify(e.vector), e.text);
  }

  async query(vector: number[], k: number): Promise<{ factId: string; text: string; score: number }[]> {
    const rows = this.db.prepare('SELECT fact_id, vector, text FROM memory_embeddings').all() as {
      fact_id: string;
      vector: string;
      text: string;
    }[];
    return rows
      .map((r) => ({ factId: r.fact_id, text: r.text, score: cosine(vector, JSON.parse(r.vector)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async remove(id: string): Promise<void> {
    this.db.prepare('DELETE FROM memory_embeddings WHERE id = ?').run(id);
  }
}

// --- row mappers -----------------------------------------------------------

function toSession(r: Record<string, unknown>): Session {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    title: r.title as string,
    status: r.status as Session['status'],
    startedAt: r.started_at as string,
  };
}

function toMessage(r: Record<string, unknown>): Message {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    sessionId: r.session_id as string,
    role: r.role as Message['role'],
    content: r.content as string,
    tokensIn: r.tokens_in as number,
    tokensOut: r.tokens_out as number,
  };
}

function toAudit(r: Record<string, unknown>): AuditEntry {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    actor: r.actor as string,
    action: r.action as string,
    target: r.target as string,
    payload: JSON.parse((r.payload_json as string) ?? '{}'),
    reversible: bool(r.reversible),
    undoToken: (r.undo_token as string) ?? null,
    undone: bool(r.undone),
  };
}

function toJob(r: Record<string, unknown>): QueuedJob {
  return {
    id: r.id as string,
    kind: r.kind as string,
    payload: JSON.parse((r.payload_json as string) ?? '{}'),
    status: r.status as QueuedJobStatus,
    attempts: r.attempts as number,
    maxAttempts: r.max_attempts as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lastError: (r.last_error as string) ?? null,
  };
}

function toPermission(r: Record<string, unknown>): PermissionRule {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    scope: r.scope as string,
    pattern: r.pattern as string,
    level: r.level as PermissionLevel,
    enabled: bool(r.enabled),
  };
}

function toFact(r: Record<string, unknown>): MemoryFact {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    deletedAt: (r.deleted_at as string) ?? null,
    kind: r.kind as MemoryKind,
    content: r.content as string,
    embeddingRef: (r.embedding_ref as string) ?? null,
    importance: r.importance as number,
  };
}

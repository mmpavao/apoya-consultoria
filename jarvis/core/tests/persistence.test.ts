import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrap } from '../src/bootstrap.js';
import { openDatabase, runMigrations } from '../src/infrastructure/db/Database.js';

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'jarvis-test-'));
  dbPath = join(dir, 'jarvis.db');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('SQLite persistence (PRD §8 — survives restart)', () => {
  it('persists sessions, messages, memory and audit across a reopen', async () => {
    // --- first run ---
    const a = bootstrap({ dbPath });
    expect(a.db).not.toBeNull();
    const session = a.sessions.create('Persisted session');
    a.sessions.appendMessage(session.id, 'user', 'remember the deadline is Friday');
    await a.memory.store('the deadline is Friday');
    a.audit.record({ actor: 'user', action: 'test.action', target: 'x' });
    a.db!.close();

    // --- restart: brand-new object graph, same file ---
    const b = bootstrap({ dbPath });
    expect(b.sessions.get(session.id)?.title).toBe('Persisted session');
    expect(b.sessions.list()).toHaveLength(1);
    const hits = await b.memory.recall('when is the deadline');
    expect(hits[0]?.fact.content).toMatch(/Friday/);
    expect(b.audit.list().some((e) => e.action === 'test.action')).toBe(true);
    b.db!.close();
  });

  it('a queued job survives restart and runs after reopen', async () => {
    // Enqueue on the first run, do NOT drain, then close.
    const a = bootstrap({ dbPath });
    a.queue.enqueue('demo', { value: 7 });
    expect(a.queue.list()[0]!.status).toBe('queued');
    a.db!.close();

    // Restart: re-register the handler (code isn't persisted) and drain.
    const b = bootstrap({ dbPath });
    let ranWith = 0;
    b.queue.register('demo', async (job) => {
      ranWith = (job.payload.value as number) ?? 0;
    });
    await b.queue.drain();
    expect(ranWith).toBe(7);
    expect(b.queue.list()[0]!.status).toBe('done');
    b.db!.close();
  });

  it('migrations are idempotent', () => {
    const db = openDatabase(':memory:');
    // Already applied during openDatabase; a second run applies nothing.
    expect(runMigrations(db)).toEqual([]);
    db.close();
  });

  it('applies all migration files on a fresh database', () => {
    const db = openDatabase(':memory:'); // openDatabase runs them once
    const rows = db.prepare('SELECT version FROM _migrations ORDER BY version').all() as {
      version: string;
    }[];
    expect(rows.map((r) => r.version)).toEqual(['0001_init.sql', '0002_jobs_and_undo.sql']);
    db.close();
  });

  it('without dbPath the core stays in-memory (db is null)', () => {
    const a = bootstrap({});
    expect(a.db).toBeNull();
    const s = a.sessions.create('ephemeral');
    expect(a.sessions.get(s.id)).toBeTruthy();
  });
});

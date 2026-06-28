import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

// Loaded via require so bundlers that don't yet know the `node:sqlite` builtin
// (e.g. Vite/vitest) never try to resolve it; the type import above is erased.
const sqlite = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export type Db = DatabaseSync;

/**
 * Opens a SQLite database and brings it up to schema via the versioned SQL
 * migrations (PRD §5, §11.5). Uses Node's built-in `node:sqlite` — no native
 * build step — so the queue, sessions, and audit log survive restarts
 * (PRD §8 reliability). Pass ':memory:' for ephemeral/test use.
 */
export function openDatabase(path = ':memory:'): Db {
  const db = new sqlite.DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  runMigrations(db);
  return db;
}

interface MigrationRow {
  version: string;
}

/** Applies any not-yet-applied migration files in lexical order, idempotently. */
export function runMigrations(db: Db): string[] {
  db.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const applied = new Set(
    (db.prepare('SELECT version FROM _migrations').all() as unknown as MigrationRow[]).map(
      (r) => r.version,
    ),
  );
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    db.exec(readFileSync(join(dir, file), 'utf8'));
    db.prepare('INSERT INTO _migrations(version, applied_at) VALUES(?, ?)').run(
      file,
      new Date().toISOString(),
    );
    ran.push(file);
  }
  return ran;
}

import type { PermissionLevel } from '../domain/tools/Tool.js';
import type { PermissionRule } from '../domain/entities/Permission.js';

/** A concrete thing a call touches, checked against allowlist rules. */
export interface PermissionSubject {
  /** e.g. "fs.path", "shell.bin". */
  scope: string;
  value: string;
}

export type PermissionOutcome = 'auto' | 'approval' | 'denied';

export interface PermissionStore {
  list(): readonly PermissionRule[];
}

/** Read-only in-memory store; the production store is backed by SQLite. */
export class InMemoryPermissionStore implements PermissionStore {
  constructor(private readonly rules: PermissionRule[] = []) {}
  list(): readonly PermissionRule[] {
    return this.rules;
  }
}

/** Sensitive paths that must never be writable, even if allowlisted (PRD §4.5). */
const BLOCKED_PATTERNS = ['~/.ssh', '/.ssh/', '/System', '/etc/', '/private/etc'];

const LEVEL_RANK: Record<PermissionLevel, number> = { read: 0, write: 1, destructive: 2 };

/**
 * Decides whether a tool call runs automatically or must go through approval
 * (PRD §4.5). Pure given its store — fully unit-testable.
 */
export class PermissionService {
  constructor(private readonly store: PermissionStore) {}

  evaluate(permission: PermissionLevel, subjects: PermissionSubject[]): PermissionOutcome {
    // Hard blocks first — sensitive targets are denied outright.
    for (const s of subjects) {
      if (s.scope === 'fs.path' && BLOCKED_PATTERNS.some((b) => s.value.includes(b))) {
        return 'denied';
      }
    }

    if (permission === 'read') return 'auto';
    if (permission === 'destructive') return 'approval';

    // write: auto only if every subject is covered by an enabled rule of
    // sufficient level. No subjects → conservative approval.
    if (subjects.length === 0) return 'approval';
    const rules = this.store.list().filter((r) => r.enabled && !r.deletedAt);
    const covered = subjects.every((s) =>
      rules.some(
        (r) =>
          r.scope === s.scope &&
          LEVEL_RANK[r.level] >= LEVEL_RANK[permission] &&
          matchPattern(r.pattern, s.value),
      ),
    );
    return covered ? 'auto' : 'approval';
  }
}

/** Glob-lite: supports `*` as a wildcard anywhere; exact match otherwise. */
export function matchPattern(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*')) return pattern === value;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

/** Derives the subjects a given tool call touches, for permission checks. */
export function subjectsFor(toolName: string, input: unknown): PermissionSubject[] {
  const obj = (input ?? {}) as Record<string, unknown>;
  const subjects: PermissionSubject[] = [];
  if (toolName.startsWith('fs.')) {
    for (const key of ['path', 'from', 'to', 'dest']) {
      const v = obj[key];
      if (typeof v === 'string') subjects.push({ scope: 'fs.path', value: v });
    }
  }
  if (toolName === 'shell.run') {
    const cmd = obj.command;
    if (typeof cmd === 'string') {
      const bin = cmd.trim().split(/\s+/)[0] ?? '';
      subjects.push({ scope: 'shell.bin', value: bin });
    }
  }
  return subjects;
}

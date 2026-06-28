import type { AuditEntry } from '../domain/entities/AuditEntry.js';
import type { Clock, IdGenerator } from '../domain/clock.js';

export interface AuditStore {
  append(entry: AuditEntry): void;
  list(): readonly AuditEntry[];
  get(id: string): AuditEntry | undefined;
  markUndone(id: string): void;
}

export class InMemoryAuditStore implements AuditStore {
  private readonly entries: AuditEntry[] = [];
  append(entry: AuditEntry): void {
    this.entries.push(entry);
  }
  list(): readonly AuditEntry[] {
    return this.entries;
  }
  get(id: string): AuditEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }
  markUndone(id: string): void {
    const e = this.entries.find((x) => x.id === id);
    if (e) e.undone = true;
  }
}

export interface RecordInput {
  actor: string;
  action: string;
  target: string;
  payload?: Record<string, unknown>;
  reversible?: boolean;
  undoToken?: string | null;
}

/**
 * Append-only audit trail (PRD §4.5, §10). Every action flows through here;
 * reversible ones carry an undo token the Activity screen can act on.
 */
export class AuditLog {
  constructor(
    private readonly store: AuditStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  record(input: RecordInput): AuditEntry {
    const now = this.clock.now();
    const entry: AuditEntry = {
      id: this.ids.next(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      actor: input.actor,
      action: input.action,
      target: input.target,
      payload: input.payload ?? {},
      reversible: input.reversible ?? false,
      undoToken: input.undoToken ?? null,
      undone: false,
    };
    this.store.append(entry);
    return entry;
  }

  list(): readonly AuditEntry[] {
    return this.store.list();
  }

  markUndone(id: string): void {
    this.store.markUndone(id);
  }
}

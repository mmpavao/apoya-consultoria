import type { AuditFields } from '../types.js';

/**
 * Immutable record of every action (PRD §4.5, §10). Reversible actions are
 * flagged and may expose an undo token.
 */
export interface AuditEntry extends AuditFields {
  /** Who acted: an agent name, "user", or "system". */
  actor: string;
  /** What happened, e.g. "tool.execute" or "approval.decide". */
  action: string;
  /** What it acted on, e.g. a tool name or entity id. */
  target: string;
  payload: Record<string, unknown>;
  reversible: boolean;
  undoToken: string | null;
  /** Whether a reversible action has since been undone. */
  undone: boolean;
}

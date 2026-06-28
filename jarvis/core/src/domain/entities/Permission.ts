import type { AuditFields } from '../types.js';
import type { PermissionLevel } from '../tools/Tool.js';

/**
 * Allowlist rule. A `write`-level tool call runs automatically only when a
 * matching enabled rule with level >= the call's level exists; otherwise it
 * escalates to approval. `destructive` always escalates regardless (PRD §4.5).
 */
export interface PermissionRule extends AuditFields {
  /** What the pattern matches against, e.g. "fs.path" or "shell.bin". */
  scope: string;
  /** Glob-ish pattern (supports leading/trailing `*`). */
  pattern: string;
  level: PermissionLevel;
  enabled: boolean;
}

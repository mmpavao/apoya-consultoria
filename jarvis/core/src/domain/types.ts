/**
 * Common domain primitives. Pure — no external dependencies.
 */

export type Uuid = string;
export type IsoTimestamp = string;

/** Audit fields present on every persisted entity (PRD §5). */
export interface AuditFields {
  id: Uuid;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  /** Soft delete marker; null when the row is live. */
  deletedAt: IsoTimestamp | null;
}

/** Discriminated result used throughout the core instead of throwing. */
export type Result<T, E = DomainError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export interface DomainError {
  code: string;
  message: string;
  /** Set when the error originates from an external boundary (LLM, OS, MCP). */
  cause?: unknown;
}

export const domainError = (code: string, message: string, cause?: unknown): DomainError => ({
  code,
  message,
  cause,
});

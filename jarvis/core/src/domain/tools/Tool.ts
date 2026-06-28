import type { ZodType } from 'zod';
import type { DomainError, Result } from '../types.js';

/**
 * Permission classes drive the human-in-the-loop governance (PRD §4.5):
 *  - read        → executes automatically
 *  - write       → automatic only if path/command is allowlisted, else approval
 *  - destructive → ALWAYS requires an explicit ApprovalRequest with a preview
 */
export type PermissionLevel = 'read' | 'write' | 'destructive';

/** Context handed to every tool at execution time. */
export interface ToolContext {
  /** Session the call belongs to — for audit/scoping. */
  readonly sessionId: string;
  /** Task that triggered the call. */
  readonly taskId: string;
  /** Agent that requested the call (least-privilege accountability). */
  readonly agent: string;
  /** Structured logger child, already tagged with the above ids. */
  readonly log: ToolLogger;
  /** Cooperative cancellation (kill switch / per-task abort). */
  readonly signal?: AbortSignal;
}

export interface ToolLogger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

/** Optional human-readable preview shown in the approval queue before a write/destructive op runs. */
export interface ToolPreview {
  /** Short summary line (e.g. "Delete 3 files"). */
  summary: string;
  /** Optional detail: a diff, the exact command, the affected paths. */
  detail?: string;
  /** Items the action will affect (paths, ids…), for the approval UI. */
  affected?: string[];
}

export interface ToolResultMeta {
  /** Whether this concrete execution can be undone (sharpens `reversible`). */
  reversible?: boolean;
  /** Opaque token an undo handler can use to revert the effect. */
  undoToken?: string;
}

export type ToolResult<TOutput> = Result<{ output: TOutput; meta?: ToolResultMeta }, DomainError>;

/**
 * Single interface every capability implements. Adding a tool = one file +
 * one registry entry; the orchestrator never changes (PRD §11.4).
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  /** Stable, namespaced id exposed to the LLM, e.g. "fs.write_file". */
  readonly name: string;
  /** Natural-language description the LLM reads to decide when to call it. */
  readonly description: string;
  /** Zod schema → validated input and the JSON Schema advertised to the model. */
  readonly inputSchema: ZodType<TInput>;
  /** Governance class. */
  readonly permission: PermissionLevel;
  /** Whether the effect is reversible in principle (concrete calls refine via meta). */
  readonly reversible: boolean;

  /**
   * Build a preview for the approval queue. Pure: must not mutate anything.
   * Optional — defaults to a generic preview when absent.
   */
  preview?(input: TInput, ctx: ToolContext): Promise<ToolPreview> | ToolPreview;

  /** Perform the action. */
  execute(input: TInput, ctx: ToolContext): Promise<ToolResult<TOutput>>;
}

/** Tool as advertised to the LLM (JSON-Schema'd), independent of its implementation. */
export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

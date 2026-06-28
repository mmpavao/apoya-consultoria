import type { AuditFields } from '../types.js';
import type { PermissionLevel } from '../tools/Tool.js';
import type { ToolPreview } from '../tools/Tool.js';

export type ApprovalDecision = 'pending' | 'approved' | 'rejected';

/**
 * Raised before any write-outside-allowlist or destructive tool call. Nothing
 * executes until decided (PRD §4.5, §6.1 step 5).
 */
export interface ApprovalRequest extends AuditFields {
  toolCallId: string;
  taskId: string;
  toolName: string;
  permission: PermissionLevel;
  preview: ToolPreview;
  decision: ApprovalDecision;
  decidedAt: string | null;
  /** Optional human note attached when deciding. */
  note: string | null;
}

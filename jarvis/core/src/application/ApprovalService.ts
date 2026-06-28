import type { ApprovalRequest, ApprovalDecision } from '../domain/entities/ApprovalRequest.js';
import type { PermissionLevel, ToolPreview } from '../domain/tools/Tool.js';
import type { Clock, IdGenerator } from '../domain/clock.js';

export type ApprovalEvent =
  | { type: 'requested'; request: ApprovalRequest }
  | { type: 'decided'; request: ApprovalRequest };

export type ApprovalListener = (event: ApprovalEvent) => void;

export interface CreateApprovalInput {
  toolCallId: string;
  taskId: string;
  toolName: string;
  permission: PermissionLevel;
  preview: ToolPreview;
}

/**
 * Human-in-the-loop gate (PRD §4.5, §6.1). `request()` returns a promise that
 * resolves only when the UI calls `decide()`. The kill switch rejects all
 * pending requests at once.
 */
export class ApprovalService {
  private readonly pending = new Map<string, ApprovalRequest>();
  private readonly resolvers = new Map<string, (decision: ApprovalDecision) => void>();
  private readonly listeners = new Set<ApprovalListener>();

  constructor(
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  onEvent(listener: ApprovalListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Raise a request and await the human decision. */
  request(input: CreateApprovalInput): Promise<ApprovalDecision> {
    const now = this.clock.now();
    const req: ApprovalRequest = {
      id: this.ids.next(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      toolCallId: input.toolCallId,
      taskId: input.taskId,
      toolName: input.toolName,
      permission: input.permission,
      preview: input.preview,
      decision: 'pending',
      decidedAt: null,
      note: null,
    };
    this.pending.set(req.id, req);
    // Register the resolver BEFORE emitting, so a synchronous decide() in a
    // listener (common in tests and auto-approve flows) still resolves.
    const decided = new Promise<ApprovalDecision>((resolve) => {
      this.resolvers.set(req.id, resolve);
    });
    this.emit({ type: 'requested', request: req });
    return decided;
  }

  /** Called by the UI to approve/reject. */
  decide(id: string, decision: Exclude<ApprovalDecision, 'pending'>, note?: string): void {
    const req = this.pending.get(id);
    const resolve = this.resolvers.get(id);
    if (!req || !resolve) return;
    req.decision = decision;
    req.decidedAt = this.clock.now();
    req.updatedAt = req.decidedAt;
    req.note = note ?? null;
    this.pending.delete(id);
    this.resolvers.delete(id);
    this.emit({ type: 'decided', request: req });
    resolve(decision);
  }

  /** Reject every outstanding request — wired to the global kill switch. */
  rejectAll(note = 'kill switch'): void {
    for (const id of [...this.pending.keys()]) this.decide(id, 'rejected', note);
  }

  listPending(): ApprovalRequest[] {
    return [...this.pending.values()];
  }

  private emit(event: ApprovalEvent): void {
    for (const l of this.listeners) l(event);
  }
}

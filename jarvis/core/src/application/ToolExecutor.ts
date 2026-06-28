import type { Tool, ToolContext, ToolResult } from '../domain/tools/Tool.js';
import { domainError, type DomainError, type Result, err, ok } from '../domain/types.js';
import type { ToolRegistry } from './ToolRegistry.js';
import { PermissionService, subjectsFor } from './PermissionService.js';
import type { ApprovalService } from './ApprovalService.js';
import type { AuditLog } from './AuditLog.js';

export interface ExecuteRequest {
  toolName: string;
  input: unknown;
  ctx: ToolContext;
}

/**
 * The single choke point through which every tool call passes: validate input
 * → evaluate permission → (maybe) request approval → execute → audit
 * (PRD §4.5, §6.1). The orchestrator never calls a tool directly.
 */
export class ToolExecutor {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly permissions: PermissionService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditLog,
    private readonly idForCall: () => string,
  ) {}

  async execute(req: ExecuteRequest): Promise<ToolResult<unknown>> {
    const tool = this.registry.get(req.toolName);
    if (!tool) {
      return err(domainError('TOOL_NOT_FOUND', `Unknown tool: ${req.toolName}`));
    }

    const parsed = tool.inputSchema.safeParse(req.input);
    if (!parsed.success) {
      return err(domainError('TOOL_INPUT_INVALID', parsed.error.message));
    }
    const input = parsed.data;

    const decision = this.permissions.evaluate(tool.permission, subjectsFor(tool.name, input));
    if (decision === 'denied') {
      this.audit.record({
        actor: req.ctx.agent,
        action: 'tool.denied',
        target: tool.name,
        payload: { input },
      });
      return err(domainError('PERMISSION_DENIED', `Blocked by policy: ${tool.name}`));
    }

    if (decision === 'approval') {
      const approved = await this.requireApproval(tool, input, req);
      if (!approved.ok) return approved;
    }

    return this.run(tool, input, req);
  }

  private async requireApproval(
    tool: Tool,
    input: unknown,
    req: ExecuteRequest,
  ): Promise<Result<true, DomainError>> {
    const preview = tool.preview
      ? await tool.preview(input, req.ctx)
      : { summary: `${tool.name} (${tool.permission})` };
    const decision = await this.approvals.request({
      toolCallId: this.idForCall(),
      taskId: req.ctx.taskId,
      toolName: tool.name,
      permission: tool.permission,
      preview,
    });
    this.audit.record({
      actor: 'user',
      action: 'approval.decide',
      target: tool.name,
      payload: { decision, preview },
    });
    if (decision !== 'approved') {
      return err(domainError('APPROVAL_REJECTED', `Rejected: ${tool.name}`));
    }
    return ok(true);
  }

  private async run(tool: Tool, input: unknown, req: ExecuteRequest): Promise<ToolResult<unknown>> {
    try {
      const result = await tool.execute(input, req.ctx);
      this.audit.record({
        actor: req.ctx.agent,
        action: 'tool.execute',
        target: tool.name,
        payload: { input, ok: result.ok },
        reversible: result.ok ? (result.value.meta?.reversible ?? tool.reversible) : false,
        undoToken: result.ok ? (result.value.meta?.undoToken ?? null) : null,
      });
      return result;
    } catch (cause) {
      this.audit.record({
        actor: req.ctx.agent,
        action: 'tool.error',
        target: tool.name,
        payload: { input, message: String(cause) },
      });
      return err(domainError('TOOL_EXECUTION_FAILED', `${tool.name} threw`, cause));
    }
  }
}

/**
 * Public surface of the JARVIS core. The desktop shell imports from here and
 * exposes the orchestrator over Tauri IPC (PRD §4.2).
 */
export { bootstrap, type Jarvis } from './bootstrap.js';
export { Orchestrator, type OrchestratorEvent } from './application/Orchestrator.js';
export { ToolRegistry } from './application/ToolRegistry.js';
export { PermissionService, type PermissionOutcome } from './application/PermissionService.js';
export { ApprovalService, type ApprovalEvent } from './application/ApprovalService.js';
export { AuditLog } from './application/AuditLog.js';
export { CostTracker } from './application/CostTracker.js';
export { TaskQueue } from './application/TaskQueue.js';
export { MemoryService } from './infrastructure/memory/MemoryService.js';
export { McpClientPool, type McpServerConfig } from './infrastructure/mcp/McpClientPool.js';
export { createLlmClient, type LlmConfig } from './infrastructure/llm/createLlmClient.js';
export { DEFAULT_MODEL, MODELS } from './infrastructure/llm/modelInfo.js';
export { AGENTS, DEFAULT_AGENT } from './config/agents.js';
export type { Tool, ToolContext, PermissionLevel } from './domain/tools/Tool.js';
export type { LlmClient } from './domain/llm/LlmClient.js';

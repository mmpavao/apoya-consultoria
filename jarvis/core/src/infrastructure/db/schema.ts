import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/**
 * SQLite schema (PRD §5) via Drizzle. Every table carries audit fields
 * (created_at, updated_at, deleted_at). Schema changes go through versioned
 * migrations in ./migrations (PRD §11.5).
 */
const audit = {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

export const sessions = sqliteTable('sessions', {
  ...audit,
  title: text('title').notNull(),
  status: text('status').notNull(),
  startedAt: text('started_at').notNull(),
});

export const messages = sqliteTable('messages', {
  ...audit,
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
});

export const tasks = sqliteTable('tasks', {
  ...audit,
  sessionId: text('session_id').notNull(),
  parentTaskId: text('parent_task_id'),
  agent: text('agent').notNull(),
  status: text('status').notNull(),
  planStep: integer('plan_step'),
  input: text('input').notNull(),
  output: text('output'),
  startedAt: text('started_at'),
  finishedAt: text('finished_at'),
});

export const agentsRuns = sqliteTable('agents_runs', {
  ...audit,
  taskId: text('task_id').notNull(),
  agent: text('agent').notNull(),
  systemPromptVersion: text('system_prompt_version').notNull(),
  stepsJson: text('steps_json').notNull().default('[]'),
  tokens: integer('tokens').notNull().default(0),
  costUsd: real('cost_usd').notNull().default(0),
});

export const toolCalls = sqliteTable('tool_calls', {
  ...audit,
  taskId: text('task_id').notNull(),
  toolName: text('tool_name').notNull(),
  inputJson: text('input_json').notNull(),
  outputJson: text('output_json'),
  permission: text('permission').notNull(),
  reversible: integer('reversible', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull(),
});

export const approvals = sqliteTable('approvals', {
  ...audit,
  toolCallId: text('tool_call_id').notNull(),
  preview: text('preview').notNull(),
  decision: text('decision').notNull(),
  decidedAt: text('decided_at'),
});

export const auditLog = sqliteTable('audit_log', {
  ...audit,
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  target: text('target').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  reversible: integer('reversible', { mode: 'boolean' }).notNull().default(false),
  undone: integer('undone', { mode: 'boolean' }).notNull().default(false),
});

export const memoryFacts = sqliteTable('memory_facts', {
  ...audit,
  kind: text('kind').notNull(),
  content: text('content').notNull(),
  embeddingRef: text('embedding_ref'),
  importance: real('importance').notNull().default(0.5),
});

export const permissions = sqliteTable('permissions', {
  ...audit,
  scope: text('scope').notNull(),
  pattern: text('pattern').notNull(),
  level: text('level').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const mcpServers = sqliteTable('mcp_servers', {
  ...audit,
  name: text('name').notNull(),
  transport: text('transport').notNull(),
  urlOrCmd: text('url_or_cmd').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
});

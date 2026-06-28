-- JARVIS initial schema (PRD §5). Versioned migration; applied in order.
-- All tables carry audit fields: created_at, updated_at, deleted_at (soft delete).

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  session_id TEXT NOT NULL,
  parent_task_id TEXT,
  agent TEXT NOT NULL,
  status TEXT NOT NULL,
  plan_step INTEGER,
  input TEXT NOT NULL,
  output TEXT,
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);

CREATE TABLE IF NOT EXISTS agents_runs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  task_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  system_prompt_version TEXT NOT NULL,
  steps_json TEXT NOT NULL DEFAULT '[]',
  tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  task_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  permission TEXT NOT NULL,
  reversible INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  tool_call_id TEXT NOT NULL,
  preview TEXT NOT NULL,
  decision TEXT NOT NULL,
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  reversible INTEGER NOT NULL DEFAULT 0,
  undone INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS memory_facts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding_ref TEXT,
  importance REAL NOT NULL DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  scope TEXT NOT NULL,
  pattern TEXT NOT NULL,
  level TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  name TEXT NOT NULL,
  transport TEXT NOT NULL,
  url_or_cmd TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

-- Vector store companion table (sqlite-vec in production; PRD §5).
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id TEXT PRIMARY KEY,
  fact_id TEXT NOT NULL,
  vector BLOB NOT NULL,
  text TEXT NOT NULL
);

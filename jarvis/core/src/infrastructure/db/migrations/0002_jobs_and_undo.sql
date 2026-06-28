-- Background queue persistence (PRD §4.3, §6.3, §8: survives restart) and the
-- undo token on audit entries for reversible-action undo (PRD §7.4).

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

ALTER TABLE audit_log ADD COLUMN undo_token TEXT;

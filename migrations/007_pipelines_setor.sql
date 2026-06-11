-- Migration 007: Pipelines por Setor — Motor Único Configurável
-- Aprovado por Marcio Pavão em 11/06/2026. Spec: docs/arquitetura/spec-pipelines-setor.md
-- NOTA: tabela de auditoria nomeada "tarefa_eventos" (tabela "eventos" já existia no schema legado)

-- ── 1. Tabela pipeline_config ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_config (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor       text UNIQUE NOT NULL,
  nome        text NOT NULL,
  etapas      jsonb NOT NULL DEFAULT '[]',
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Colunas em tarefas ────────────────────────────────────────────────────
ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS setor          text,
  ADD COLUMN IF NOT EXISTS etapa_pipeline text;

CREATE INDEX IF NOT EXISTS idx_tarefas_setor_etapa
  ON tarefas (setor, etapa_pipeline)
  WHERE setor IS NOT NULL;

-- ── 3. Coluna escopo_setores em mcp_api_keys ─────────────────────────────────
ALTER TABLE mcp_api_keys
  ADD COLUMN IF NOT EXISTS escopo_setores jsonb;

UPDATE mcp_api_keys SET escopo_setores = '["*"]' WHERE escopo_setores IS NULL;

-- ── 4. Tabela tarefa_eventos (auditoria de movimentações de pipeline) ─────────
CREATE TABLE IF NOT EXISTS tarefa_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id   uuid NOT NULL,
  tipo        text NOT NULL,
  ator        text NOT NULL,
  ator_tipo   text NOT NULL,
  de_etapa    text,
  para_etapa  text,
  payload     jsonb,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarefa_eventos_tarefa_id ON tarefa_eventos (tarefa_id);
CREATE INDEX IF NOT EXISTS idx_tarefa_eventos_criado_em ON tarefa_eventos (criado_em DESC);

ALTER TABLE tarefa_eventos
  ADD CONSTRAINT fk_tarefa_eventos_tarefa
  FOREIGN KEY (tarefa_id) REFERENCES tarefas(id) ON DELETE CASCADE;

-- ── 5. Seeds pipeline_config ─────────────────────────────────────────────────
-- Inseridos via script Python (ver logs de deploy F1). Idempotente via ON CONFLICT.
-- fiscal: 6 etapas | dp: 5 etapas | contabil: 5 etapas | financeiro: 5 etapas

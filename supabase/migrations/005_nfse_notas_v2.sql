-- ═══════════════════════════════════════════════════════════════════════
-- Migration 005v2 — NFS-e emitidas + recebidas + log NFE.io
-- Usa nomes reais: "clientes" (não "cliente")
-- APOYA Contabilidade — 2026-05-22
-- ═══════════════════════════════════════════════════════════════════════

-- 1. nfse_emitida
CREATE TABLE IF NOT EXISTS nfse_emitida (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nfseio_id           TEXT,
  numero              TEXT,
  codigo_verificacao  TEXT,
  status              TEXT NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho','processando','emitida','cancelada','erro')),
  competencia         TEXT,
  data_emissao        DATE,
  data_cancelamento   DATE,
  tomador_nome        TEXT,
  tomador_cnpj_cpf    TEXT,
  tomador_email       TEXT,
  tomador_municipio   TEXT,
  tomador_uf          TEXT,
  descricao_servico   TEXT,
  codigo_servico      TEXT,
  valor_servico       NUMERIC(14,2),
  aliquota_iss        NUMERIC(5,4),
  valor_iss           NUMERIC(14,2),
  valor_deducoes      NUMERIC(14,2) DEFAULT 0,
  issretido           BOOLEAN DEFAULT FALSE,
  pdf_url             TEXT,
  xml_content         TEXT,
  pdf_storage_path    TEXT,
  erro_msg            TEXT,
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nfse_emitida_cliente_idx     ON nfse_emitida(cliente_id);
CREATE INDEX IF NOT EXISTS nfse_emitida_competencia_idx ON nfse_emitida(competencia);
CREATE INDEX IF NOT EXISTS nfse_emitida_status_idx      ON nfse_emitida(status);

ALTER TABLE nfse_emitida ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfse_emitida_admin ON nfse_emitida;
CREATE POLICY nfse_emitida_admin ON nfse_emitida
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2. nfse_recebida
CREATE TABLE IF NOT EXISTS nfse_recebida (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  cnpj_tomador        TEXT NOT NULL,
  prestador_nome      TEXT,
  prestador_cnpj      TEXT,
  prestador_municipio TEXT,
  numero              TEXT,
  codigo_verificacao  TEXT,
  data_emissao        DATE,
  competencia         TEXT,
  valor_servico       NUMERIC(14,2),
  valor_iss           NUMERIC(14,2),
  aliquota_iss        NUMERIC(5,4),
  issretido           BOOLEAN DEFAULT FALSE,
  descricao_servico   TEXT,
  codigo_servico      TEXT,
  fonte               TEXT DEFAULT 'nfeio' CHECK (fonte IN ('nfeio','manual','serpro')),
  nfseio_id           TEXT,
  xml_content         TEXT,
  pdf_url             TEXT,
  importada_em        TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (cnpj_tomador, numero, prestador_cnpj)
);

CREATE INDEX IF NOT EXISTS nfse_recebida_cliente_idx    ON nfse_recebida(cliente_id);
CREATE INDEX IF NOT EXISTS nfse_recebida_cnpj_idx       ON nfse_recebida(cnpj_tomador);

ALTER TABLE nfse_recebida ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfse_recebida_admin ON nfse_recebida;
CREATE POLICY nfse_recebida_admin ON nfse_recebida
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 3. nfseio_log
CREATE TABLE IF NOT EXISTS nfseio_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID REFERENCES clientes(id) ON DELETE SET NULL,
  operacao    TEXT NOT NULL,
  nfseio_id   TEXT,
  status      TEXT NOT NULL CHECK (status IN ('ok','erro')),
  payload     JSONB,
  resposta    JSONB,
  erro_msg    TEXT,
  duracao_ms  INTEGER,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nfseio_log_cliente_idx  ON nfseio_log(cliente_id);
CREATE INDEX IF NOT EXISTS nfseio_log_created_idx  ON nfseio_log(created_at DESC);

ALTER TABLE nfseio_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nfseio_log_admin ON nfseio_log;
CREATE POLICY nfseio_log_admin ON nfseio_log
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. Triggers
DROP TRIGGER IF EXISTS tg_nfse_emitida_updated ON nfse_emitida;
CREATE TRIGGER tg_nfse_emitida_updated
  BEFORE UPDATE ON nfse_emitida FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tg_nfse_recebida_updated ON nfse_recebida;
CREATE TRIGGER tg_nfse_recebida_updated
  BEFORE UPDATE ON nfse_recebida FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 004v2 — Certificado Digital + Procuração + SERPRO log
-- Usa nomes reais: "clientes" (não "cliente")
-- APOYA Contabilidade — 2026-05-22
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Colunas adicionais em clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tem_certificado    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tem_procuracao     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nfseio_emitente_id TEXT,
  ADD COLUMN IF NOT EXISTS cpf                TEXT;

-- 2. Tabela cliente_certificado
CREATE TABLE IF NOT EXISTS cliente_certificado (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id               UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo                     TEXT NOT NULL CHECK (tipo IN ('A1','A3')),
  pfx_encrypted            BYTEA,
  pfx_senha_encrypted      TEXT,
  pfx_validade             DATE,
  pfx_nome_razao           TEXT,
  pfx_cnpj                 TEXT,
  pfx_serial               TEXT,
  has_procuracao           BOOLEAN NOT NULL DEFAULT FALSE,
  procuracao_validade      DATE,
  procuracao_verificada_em TIMESTAMPTZ,
  nfseio_cert_id           TEXT,
  nfseio_cert_uploaded_at  TIMESTAMPTZ,
  created_by               UUID,
  updated_by               UUID,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cliente_id)
);

ALTER TABLE cliente_certificado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cert_admin_all ON cliente_certificado;
CREATE POLICY cert_admin_all ON cliente_certificado
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 3. Tabela serpro_log
CREATE TABLE IF NOT EXISTS serpro_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID REFERENCES clientes(id) ON DELETE SET NULL,
  tool             TEXT NOT NULL,
  parametros       JSONB,
  resultado_resumo TEXT,
  status           TEXT NOT NULL CHECK (status IN ('ok','erro','bloqueado')),
  erro_msg         TEXT,
  duracao_ms       INTEGER,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS serpro_log_cliente_idx    ON serpro_log(cliente_id);
CREATE INDEX IF NOT EXISTS serpro_log_tool_idx       ON serpro_log(tool);
CREATE INDEX IF NOT EXISTS serpro_log_created_at_idx ON serpro_log(created_at DESC);

ALTER TABLE serpro_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS serpro_log_admin_all ON serpro_log;
CREATE POLICY serpro_log_admin_all ON serpro_log
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. Trigger updated_at para cliente_certificado
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tg_cert_updated_at ON cliente_certificado;
CREATE TRIGGER tg_cert_updated_at
  BEFORE UPDATE ON cliente_certificado
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Trigger de sincronização dos flags
CREATE OR REPLACE FUNCTION sync_cliente_cert_flags()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE clientes SET
    tem_certificado = (NEW.pfx_encrypted IS NOT NULL AND (NEW.pfx_validade IS NULL OR NEW.pfx_validade >= CURRENT_DATE)),
    tem_procuracao  = NEW.has_procuracao
  WHERE id = NEW.cliente_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_cert_flags ON cliente_certificado;
CREATE TRIGGER tg_sync_cert_flags
  AFTER INSERT OR UPDATE ON cliente_certificado
  FOR EACH ROW EXECUTE FUNCTION sync_cliente_cert_flags();

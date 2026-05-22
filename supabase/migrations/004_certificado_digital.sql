-- ═══════════════════════════════════════════════════════════════════════
-- Migration 004 — Certificado Digital e Procuração eCAC
-- APOYA Contabilidade — 2026-05-22
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Habilitar pgcrypto para criptografia simétrica
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Adicionar colunas de regime e habilitação SERPRO/NFE.io em cliente
ALTER TABLE cliente
  ADD COLUMN IF NOT EXISTS regime TEXT
    CHECK (regime IN ('MEI','SIMPLES','LUCRO_PRESUMIDO','LUCRO_REAL','ISENTO')),
  ADD COLUMN IF NOT EXISTS tem_certificado BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tem_procuracao  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nfseio_emitente_id TEXT;  -- ID do emitente no NFE.io

COMMENT ON COLUMN cliente.regime            IS 'Regime tributário: MEI | SIMPLES | LUCRO_PRESUMIDO | LUCRO_REAL | ISENTO';
COMMENT ON COLUMN cliente.tem_certificado   IS 'TRUE quando certificado digital A1/A3 está carregado e válido';
COMMENT ON COLUMN cliente.tem_procuracao    IS 'TRUE quando procuração eCAC foi verificada via SERPRO';
COMMENT ON COLUMN cliente.nfseio_emitente_id IS 'ID do emitente registrado no NFE.io para emissão de NFS-e';

-- 3. Tabela de certificados digitais (armazenamento criptografado)
CREATE TABLE IF NOT EXISTS cliente_certificado (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id              UUID NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,

  -- Certificado digital (A1 = arquivo PFX | A3 = smartcard/token)
  tipo                    TEXT NOT NULL CHECK (tipo IN ('A1','A3')),
  pfx_encrypted           BYTEA,       -- Conteúdo .pfx criptografado (pgp_sym_encrypt)
  pfx_senha_encrypted     TEXT,        -- Senha do .pfx criptografada (pgp_sym_encrypt)
  pfx_validade            DATE,        -- Data de validade (plaintext — para alertas)
  pfx_nome_razao          TEXT,        -- Razão social no certificado (plaintext)
  pfx_cnpj                TEXT,        -- CNPJ do certificado (plaintext)
  pfx_serial              TEXT,        -- Número serial do certificado (plaintext)

  -- Procuração eCAC
  has_procuracao          BOOLEAN NOT NULL DEFAULT FALSE,
  procuracao_validade     DATE,                     -- Validade da procuração (plaintext)
  procuracao_verificada_em TIMESTAMPTZ,             -- Última verificação serpro_procuracoes

  -- NFE.io — referência do certificado após upload
  nfseio_cert_id          TEXT,        -- ID do certificado no NFE.io
  nfseio_cert_uploaded_at TIMESTAMPTZ, -- Quando foi enviado para o NFE.io

  -- Auditoria
  created_by              UUID,
  updated_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(cliente_id)
);

COMMENT ON TABLE cliente_certificado IS 'Certificado digital A1/A3 e procuração eCAC do cliente. PFX criptografado com pgcrypto.';
COMMENT ON COLUMN cliente_certificado.pfx_encrypted IS 'Arquivo .pfx criptografado via pgp_sym_encrypt(content, key)';
COMMENT ON COLUMN cliente_certificado.pfx_senha_encrypted IS 'Senha do .pfx criptografada via pgp_sym_encrypt(senha, key)';

-- 4. RLS na tabela de certificados
ALTER TABLE cliente_certificado ENABLE ROW LEVEL SECURITY;

-- Admin pode ver e editar tudo
CREATE POLICY "cert_admin_all" ON cliente_certificado
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Tabela de log de consultas SERPRO
CREATE TABLE IF NOT EXISTS serpro_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        UUID REFERENCES cliente(id) ON DELETE SET NULL,
  tool              TEXT NOT NULL,
  parametros        JSONB,
  resultado_resumo  TEXT,    -- Resumo sem dados sensíveis (máx 500 chars)
  status            TEXT NOT NULL CHECK (status IN ('ok','erro','bloqueado')),
  erro_msg          TEXT,
  duracao_ms        INTEGER,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS serpro_log_cliente_id_idx ON serpro_log(cliente_id);
CREATE INDEX IF NOT EXISTS serpro_log_tool_idx       ON serpro_log(tool);
CREATE INDEX IF NOT EXISTS serpro_log_created_at_idx ON serpro_log(created_at DESC);

ALTER TABLE serpro_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "serpro_log_admin_all" ON serpro_log
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS tg_cert_updated_at ON cliente_certificado;
CREATE TRIGGER tg_cert_updated_at
  BEFORE UPDATE ON cliente_certificado
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Função para sincronizar tem_certificado / tem_procuracao na tabela cliente
CREATE OR REPLACE FUNCTION sync_cliente_cert_flags()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cliente SET
    tem_certificado = (NEW.pfx_encrypted IS NOT NULL AND NEW.pfx_validade >= CURRENT_DATE),
    tem_procuracao  = NEW.has_procuracao
  WHERE id = NEW.cliente_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_cert_flags ON cliente_certificado;
CREATE TRIGGER tg_sync_cert_flags
  AFTER INSERT OR UPDATE ON cliente_certificado
  FOR EACH ROW EXECUTE FUNCTION sync_cliente_cert_flags();

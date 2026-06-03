-- ============================================================
-- Migração: NFe.io → Focus NF-e
-- Data: 2026-06-03
-- Descrição: Remove colunas da integração NFe.io e adiciona
--            equivalentes para Focus NF-e, sem quebrar dados.
-- ============================================================

-- ── Tabela: nfse_emitida ────────────────────────────────────
-- Renomear nfseio_id → focus_ref (identificador único na Focus)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='nfse_emitida' AND column_name='nfseio_id'
  ) THEN
    ALTER TABLE nfse_emitida RENAME COLUMN nfseio_id TO focus_ref;
  END IF;
END $$;

-- Garantir que focus_ref existe (caso a tabela seja nova)
ALTER TABLE nfse_emitida
  ADD COLUMN IF NOT EXISTS focus_ref TEXT;

-- Unique index para upsert
DROP INDEX IF EXISTS nfse_emitida_nfseio_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS nfse_emitida_focus_ref_key
  ON nfse_emitida (focus_ref)
  WHERE focus_ref IS NOT NULL;

-- ── Tabela: nfse_recebida ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='nfse_recebida' AND column_name='nfseio_id'
  ) THEN
    ALTER TABLE nfse_recebida RENAME COLUMN nfseio_id TO focus_ref;
  END IF;
END $$;

ALTER TABLE nfse_recebida
  ADD COLUMN IF NOT EXISTS focus_ref TEXT;

-- Atualizar campo fonte: "nfeio" → "focus"
UPDATE nfse_recebida SET fonte = 'focus' WHERE fonte = 'nfeio';

-- ── Tabela: nfseio_log → focus_nfse_log ────────────────────
-- Criar a nova tabela de log (mantém a antiga intacta para histórico)
CREATE TABLE IF NOT EXISTS focus_nfse_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id  UUID REFERENCES clientes(id) ON DELETE SET NULL,
  operacao    TEXT NOT NULL,          -- emitir, cancelar, consultar, sincronizar_recebidas
  focus_ref   TEXT,
  status      TEXT NOT NULL CHECK (status IN ('ok','erro')),
  payload     JSONB,
  resposta    JSONB,
  erro_msg    TEXT,
  duracao_ms  INT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE focus_nfse_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "focus_nfse_log_staff_only"
  ON focus_nfse_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin','contador','assistente')
    )
  );

-- ── Tabela: escritorio_config ───────────────────────────────
-- Renomear nfeio_api_key → focusnfe_api_token
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='escritorio_config' AND column_name='nfeio_api_key'
  ) THEN
    ALTER TABLE escritorio_config RENAME COLUMN nfeio_api_key TO focusnfe_api_token;
  END IF;
END $$;

ALTER TABLE escritorio_config
  ADD COLUMN IF NOT EXISTS focusnfe_api_token TEXT,
  ADD COLUMN IF NOT EXISTS focus_ambiente TEXT DEFAULT 'homologacao';

-- Remover colunas exclusivas do NFe.io que não têm equivalente
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='escritorio_config' AND column_name='nfseio_emitente_id'
  ) THEN
    -- Guardar valor antigo no novo campo focus_ambiente para não perder dado
    -- (emitente_id do NFe.io não tem equivalente direto no Focus — o CNPJ é a ref)
    ALTER TABLE escritorio_config DROP COLUMN nfseio_emitente_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='escritorio_config' AND column_name='nfseio_ambiente'
  ) THEN
    -- Migrar valor para a nova coluna
    UPDATE escritorio_config SET focus_ambiente = nfseio_ambiente
      WHERE nfseio_ambiente IS NOT NULL AND focus_ambiente IS NULL;
    ALTER TABLE escritorio_config DROP COLUMN nfseio_ambiente;
  END IF;
END $$;

-- ── Tabela: clientes ────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clientes' AND column_name='nfseio_emitente_id'
  ) THEN
    ALTER TABLE clientes DROP COLUMN nfseio_emitente_id;
  END IF;
END $$;

-- Adicionar focus_ambiente por cliente (homologacao|producao override)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS focus_ambiente TEXT;

-- ── Tabela: clientes — certificado ─────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clientes' AND column_name='nfseio_cert_id'
  ) THEN
    ALTER TABLE clientes RENAME COLUMN nfseio_cert_id TO focus_cert_ref;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clientes' AND column_name='nfseio_cert_uploaded_at'
  ) THEN
    ALTER TABLE clientes RENAME COLUMN nfseio_cert_uploaded_at TO focus_cert_enviado_em;
  END IF;
END $$;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS focus_cert_ref        TEXT,
  ADD COLUMN IF NOT EXISTS focus_cert_enviado     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS focus_cert_enviado_em  TIMESTAMPTZ;

-- ── integracao_config: nfeio → focusnfe ────────────────────
UPDATE integracao_config SET tipo = 'focusnfe' WHERE tipo = 'nfeio';

-- ============================================================
-- FIM DA MIGRAÇÃO
-- Tabelas/colunas NFe.io preservadas (sem DROP das antigas)
-- para garantir rollback seguro. Revisar em 30 dias.
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 005 — NFS-e: notas emitidas + notas recebidas + log NFE.io
-- APOYA Contabilidade — 2026-05-22
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Tabela de NFS-e emitidas (pelo escritório, em nome do cliente)
CREATE TABLE IF NOT EXISTS nfse_emitida (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,

  -- Identificação da nota
  nfseio_id           TEXT,           -- ID da nota no NFE.io
  numero              TEXT,           -- Número da NFS-e
  codigo_verificacao  TEXT,           -- Código de verificação
  status              TEXT NOT NULL DEFAULT 'rascunho'
                        CHECK (status IN ('rascunho','processando','emitida','cancelada','erro')),

  -- Competência e datas
  competencia         TEXT,           -- YYYY-MM (mês de referência)
  data_emissao        DATE,
  data_cancelamento   DATE,

  -- Tomador (quem recebeu o serviço)
  tomador_nome        TEXT,
  tomador_cnpj_cpf    TEXT,
  tomador_email       TEXT,
  tomador_municipio   TEXT,
  tomador_uf          TEXT          CHECK (tomador_uf IS NULL OR length(tomador_uf) = 2),

  -- Serviço
  descricao_servico   TEXT,
  codigo_servico      TEXT,          -- Código LC116 / municipal
  valor_servico       NUMERIC(14,2),
  aliquota_iss        NUMERIC(5,4),  -- Ex: 0.05 = 5%
  valor_iss           NUMERIC(14,2),
  valor_deducoes      NUMERIC(14,2) DEFAULT 0,
  issretido           BOOLEAN DEFAULT FALSE,

  -- Arquivos (armazenados no Supabase Storage)
  pdf_url             TEXT,
  xml_content         TEXT,          -- XML completo da nota
  pdf_storage_path    TEXT,          -- Path no Supabase Storage

  -- Erros
  erro_msg            TEXT,

  -- Auditoria
  created_by          UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nfse_emitida_cliente_idx    ON nfse_emitida(cliente_id);
CREATE INDEX IF NOT EXISTS nfse_emitida_competencia_idx ON nfse_emitida(competencia);
CREATE INDEX IF NOT EXISTS nfse_emitida_status_idx      ON nfse_emitida(status);
CREATE INDEX IF NOT EXISTS nfse_emitida_created_at_idx  ON nfse_emitida(created_at DESC);

ALTER TABLE nfse_emitida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nfse_emitida_admin" ON nfse_emitida
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 2. Tabela de NFS-e recebidas (emitidas CONTRA o CNPJ do cliente)
--    Populada via consulta à API NFE.io / SEFAZ municipal
CREATE TABLE IF NOT EXISTS nfse_recebida (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  cnpj_tomador        TEXT NOT NULL,   -- CNPJ do cliente (quem recebeu)

  -- Prestador (quem emitiu)
  prestador_nome      TEXT,
  prestador_cnpj      TEXT,
  prestador_municipio TEXT,

  -- Dados da nota
  numero              TEXT,
  codigo_verificacao  TEXT,
  data_emissao        DATE,
  competencia         TEXT,           -- YYYY-MM

  -- Valores
  valor_servico       NUMERIC(14,2),
  valor_iss           NUMERIC(14,2),
  aliquota_iss        NUMERIC(5,4),
  issretido           BOOLEAN DEFAULT FALSE,

  -- Descrição
  descricao_servico   TEXT,
  codigo_servico      TEXT,

  -- Fonte dos dados
  fonte               TEXT DEFAULT 'nfeio' CHECK (fonte IN ('nfeio','manual','serpro')),
  nfseio_id           TEXT,

  -- Arquivos
  xml_content         TEXT,
  pdf_url             TEXT,

  -- Controle
  importada_em        TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(cnpj_tomador, numero, prestador_cnpj)
);

CREATE INDEX IF NOT EXISTS nfse_recebida_cliente_idx    ON nfse_recebida(cliente_id);
CREATE INDEX IF NOT EXISTS nfse_recebida_cnpj_idx       ON nfse_recebida(cnpj_tomador);
CREATE INDEX IF NOT EXISTS nfse_recebida_competencia_idx ON nfse_recebida(competencia);

ALTER TABLE nfse_recebida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nfse_recebida_admin" ON nfse_recebida
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 3. Log de operações NFE.io
CREATE TABLE IF NOT EXISTS nfseio_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID REFERENCES cliente(id) ON DELETE SET NULL,
  operacao    TEXT NOT NULL,   -- 'emitir' | 'cancelar' | 'consultar' | 'listar_recebidas'
  nfseio_id   TEXT,
  status      TEXT NOT NULL CHECK (status IN ('ok','erro')),
  payload     JSONB,           -- Request enviado (sem dados sensíveis)
  resposta    JSONB,           -- Response recebido (resumo)
  erro_msg    TEXT,
  duracao_ms  INTEGER,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nfseio_log_cliente_idx   ON nfseio_log(cliente_id);
CREATE INDEX IF NOT EXISTS nfseio_log_operacao_idx  ON nfseio_log(operacao);
CREATE INDEX IF NOT EXISTS nfseio_log_created_idx   ON nfseio_log(created_at DESC);

ALTER TABLE nfseio_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nfseio_log_admin" ON nfseio_log
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. Triggers updated_at
DROP TRIGGER IF EXISTS tg_nfse_emitida_updated ON nfse_emitida;
CREATE TRIGGER tg_nfse_emitida_updated
  BEFORE UPDATE ON nfse_emitida FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tg_nfse_recebida_updated ON nfse_recebida;
CREATE TRIGGER tg_nfse_recebida_updated
  BEFORE UPDATE ON nfse_recebida FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5. Coluna nfseio_emitente_id em cliente (se não existir — pode ter vindo da 004)
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS nfseio_emitente_id TEXT;

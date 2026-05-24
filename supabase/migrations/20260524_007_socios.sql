-- ══════════════════════════════════════════════════════════════
-- 007 · Sócios da empresa
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cliente_socio (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,

  -- Dados pessoais
  nome                  TEXT NOT NULL,
  cpf                   TEXT,
  cnpj_cpf_socio        TEXT,          -- formatado (pode ser CNPJ se for PJ)
  tipo_socio            TEXT NOT NULL DEFAULT 'pf' CHECK (tipo_socio IN ('pf','pj')),

  -- Qualificação societária
  qualificacao          TEXT,          -- Ex: 'Sócio-Administrador', 'Sócio', 'Diretor'
  codigo_qualificacao   INTEGER,       -- Código RF
  percentual            NUMERIC(5,2),  -- 0.00 a 100.00
  capital_subscrito     NUMERIC(15,2),
  capital_integralizado NUMERIC(15,2),

  -- Datas
  data_entrada          DATE,
  data_saida            DATE,

  -- Representante legal
  nome_representante    TEXT,
  cpf_representante     TEXT,
  qualificacao_representante TEXT,

  -- Contato pessoal
  email                 TEXT,
  telefone              TEXT,
  whatsapp              TEXT,

  -- Flags úteis
  is_administrador      BOOLEAN NOT NULL DEFAULT FALSE,
  is_ativo              BOOLEAN NOT NULL DEFAULT TRUE,

  -- Auditoria
  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cliente_socio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "socio_all_authenticated" ON public.cliente_socio
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_cliente_socio_updated_at ON public.cliente_socio;
CREATE TRIGGER trg_cliente_socio_updated_at
  BEFORE UPDATE ON public.cliente_socio
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cliente_socio_cliente
  ON public.cliente_socio(cliente_id);

COMMENT ON TABLE public.cliente_socio IS 'Quadro societário do cliente, populado via BrasilAPI/SERPRO na consulta do CNPJ.';

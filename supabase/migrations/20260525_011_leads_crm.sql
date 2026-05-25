-- ============================================================
-- Migration 011 — Tabela leads_crm (CRM de Prospects)
-- Projeto: APOYA CONTABIL (Supabase ajaqbdsalxfgrwpjbtbn)
-- Criado por: O Contador (COO) — 25/05/2026
-- ============================================================

-- ── Enum: etapa do funil ─────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.lead_etapa AS ENUM (
    'novo', 'qualificacao', 'coleta_dados', 'proposta',
    'negociacao', 'fechado_ganho', 'fechado_perdido'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── Enum: temperatura ────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.lead_temperatura AS ENUM (
    'frio', 'morno', 'quente'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── Enum: canal de origem ────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.lead_canal AS ENUM (
    'whatsapp', 'whatsapp_organico', 'whatsapp_indicacao',
    'instagram', 'site', 'indicacao', 'google', 'outro'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- TABELA: leads_crm
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads_crm (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificação
  nome                text NOT NULL,
  telefone            text NOT NULL,
  email               text,
  cnpj                text,
  razao_social        text,
  nome_fantasia       text,

  -- Dados empresariais
  regime_tributario   text,
  situacao_cadastral  text,
  porte               text,
  municipio           text,
  uf                  text,
  socios              jsonb DEFAULT '[]'::jsonb,

  -- Funil comercial
  etapa               text NOT NULL DEFAULT 'novo'
                        CHECK (etapa IN ('novo','qualificacao','coleta_dados','proposta',
                                         'negociacao','fechado_ganho','fechado_perdido')),
  temperatura         text NOT NULL DEFAULT 'morno'
                        CHECK (temperatura IN ('frio','morno','quente')),
  origem              text NOT NULL DEFAULT 'outro',
  canal               text NOT NULL DEFAULT 'whatsapp'
                        CHECK (canal IN ('whatsapp','whatsapp_organico','whatsapp_indicacao',
                                         'instagram','site','indicacao','google','outro')),
  responsavel         text NOT NULL DEFAULT 'Ana | Atendimento',
  honorario_proposto  numeric(10,2),

  -- Relacionamentos
  cliente_id          uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  contato_id          uuid,
  conversa_id         uuid,

  -- Acompanhamento
  ultimo_contato      date,
  proximo_passo       text,
  motivo_perda        text,
  observacoes         text,

  -- Tags e metadados
  tags                text[] DEFAULT '{}',
  metadados           jsonb DEFAULT '{}'::jsonb,

  -- Controle
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_leads_crm_etapa        ON public.leads_crm(etapa);
CREATE INDEX IF NOT EXISTS idx_leads_crm_temperatura  ON public.leads_crm(temperatura);
CREATE INDEX IF NOT EXISTS idx_leads_crm_responsavel  ON public.leads_crm(responsavel);
CREATE INDEX IF NOT EXISTS idx_leads_crm_cliente_id   ON public.leads_crm(cliente_id);
CREATE INDEX IF NOT EXISTS idx_leads_crm_telefone     ON public.leads_crm(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_crm_canal        ON public.leads_crm(canal);
CREATE INDEX IF NOT EXISTS idx_leads_crm_created_at   ON public.leads_crm(created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_leads_crm_updated_at ON public.leads_crm;
CREATE TRIGGER trg_leads_crm_updated_at
  BEFORE UPDATE ON public.leads_crm
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.leads_crm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e contador lêem tudo" ON public.leads_crm
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'contador')
  );

CREATE POLICY "Admin e contador inserem" ON public.leads_crm
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'contador')
  );

CREATE POLICY "Admin e contador atualizam" ON public.leads_crm
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'contador')
  );

CREATE POLICY "Admin deleta" ON public.leads_crm
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Verificação
SELECT 'leads_crm criada com sucesso' AS status,
       count(*) AS total_leads FROM public.leads_crm;

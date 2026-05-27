-- =============================================================================
-- MIGRATION 013 — meucontador.ai Foundation
-- Sprint 1: whatsapp_sessions, conversas, tarefas_agente, eventos,
--           apuracoes, notas_fiscais, documentos
-- RLS + policies + índices + triggers updated_at
-- =============================================================================

-- WHATSAPP SESSIONS
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number    TEXT UNIQUE NOT NULL,
  client_id       UUID REFERENCES clientes(id) ON DELETE CASCADE,
  agent_context   JSONB DEFAULT '{}',
  last_agent      TEXT,
  modo_humano     BOOLEAN DEFAULT false,
  humano_id       TEXT,
  humano_desde    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_whatsapp_sessions" ON whatsapp_sessions;
CREATE POLICY "service_role_all_whatsapp_sessions" ON whatsapp_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_whatsapp_sessions" ON whatsapp_sessions;
CREATE POLICY "authenticated_read_whatsapp_sessions" ON whatsapp_sessions
  FOR SELECT TO authenticated USING (true);

-- CONVERSAS
CREATE TABLE IF NOT EXISTS conversas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  phone_number  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  agent         TEXT,
  content       TEXT NOT NULL,
  media_url     TEXT,
  media_type    TEXT,
  intent        TEXT,
  tokens_used   INTEGER,
  processado    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE conversas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_conversas" ON conversas;
CREATE POLICY "service_role_all_conversas" ON conversas
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_conversas" ON conversas;
CREATE POLICY "authenticated_read_conversas" ON conversas
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_conversas_client  ON conversas(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_phone   ON conversas(phone_number, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_pending ON conversas(processado) WHERE processado = false;

-- TAREFAS AGENTE
CREATE TABLE IF NOT EXISTS tarefas_agente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID REFERENCES clientes(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('fiscal_urgente','dp','comercial','contabil','societario','outros')),
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  agente          TEXT NOT NULL,
  status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','executando','concluida','erro','cancelada')),
  prioridade      TEXT DEFAULT 'normal' CHECK (prioridade IN ('critica','alta','normal','baixa')),
  executar_em     TIMESTAMPTZ,
  executado_em    TIMESTAMPTZ,
  tentativas      INTEGER DEFAULT 0,
  max_tentativas  INTEGER DEFAULT 3,
  sla_horas       INTEGER,
  sla_vencimento  TIMESTAMPTZ,
  sla_status      TEXT DEFAULT 'no_prazo' CHECK (sla_status IN ('no_prazo','critico','atrasado','concluido')),
  resultado       JSONB,
  erro            TEXT,
  metadados       JSONB DEFAULT '{}',
  criado_por      TEXT,
  criado_por_tipo TEXT DEFAULT 'sistema',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tarefas_agente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_tarefas_agente" ON tarefas_agente;
CREATE POLICY "service_role_all_tarefas_agente" ON tarefas_agente
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_tarefas_agente" ON tarefas_agente;
CREATE POLICY "authenticated_read_tarefas_agente" ON tarefas_agente
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_tarefas_agente_status ON tarefas_agente(status, sla_vencimento);
CREATE INDEX IF NOT EXISTS idx_tarefas_agente_client ON tarefas_agente(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tarefas_agente_agente ON tarefas_agente(agente, status);

-- EVENTOS
CREATE TABLE IF NOT EXISTS eventos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES clientes(id) ON DELETE SET NULL,
  tipo        TEXT NOT NULL,
  descricao   TEXT,
  agente      TEXT,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_eventos" ON eventos;
CREATE POLICY "service_role_all_eventos" ON eventos
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_eventos" ON eventos;
CREATE POLICY "authenticated_read_eventos" ON eventos
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_eventos_client ON eventos(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo   ON eventos(tipo, created_at DESC);

-- APURAÇÕES FISCAIS
CREATE TABLE IF NOT EXISTS apuracoes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  competencia      TEXT NOT NULL,
  regime           TEXT NOT NULL DEFAULT 'simples_nacional',
  receita_bruta    NUMERIC(12,2) DEFAULT 0,
  receita_servico  NUMERIC(12,2) DEFAULT 0,
  receita_comercio NUMERIC(12,2) DEFAULT 0,
  aliquota_efetiva NUMERIC(5,4),
  valor_total      NUMERIC(10,2),
  valor_irpj       NUMERIC(10,2) DEFAULT 0,
  valor_csll       NUMERIC(10,2) DEFAULT 0,
  valor_cofins     NUMERIC(10,2) DEFAULT 0,
  valor_pis        NUMERIC(10,2) DEFAULT 0,
  valor_cpp        NUMERIC(10,2) DEFAULT 0,
  valor_iss        NUMERIC(10,2) DEFAULT 0,
  valor_icms       NUMERIC(10,2) DEFAULT 0,
  status           TEXT DEFAULT 'aberta' CHECK (status IN ('aberta','transmitida','retificada')),
  transmitida_em   TIMESTAMPTZ,
  recibo_pgdas     TEXT,
  serpro_payload   JSONB,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, competencia)
);
ALTER TABLE apuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_apuracoes" ON apuracoes;
CREATE POLICY "service_role_all_apuracoes" ON apuracoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_apuracoes" ON apuracoes;
CREATE POLICY "authenticated_read_apuracoes" ON apuracoes
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_apuracoes_client ON apuracoes(client_id, competencia DESC);

-- NOTAS FISCAIS
CREATE TABLE IF NOT EXISTS notas_fiscais (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('nfse','nfe','nfce','cte')),
  numero          TEXT,
  serie           TEXT,
  tomador_nome    TEXT,
  tomador_cnpj    TEXT,
  tomador_cpf     TEXT,
  tomador_email   TEXT,
  valor_servico   NUMERIC(10,2),
  valor_deducao   NUMERIC(10,2) DEFAULT 0,
  valor_iss       NUMERIC(10,2),
  aliquota_iss    NUMERIC(5,2),
  valor_ir        NUMERIC(10,2) DEFAULT 0,
  valor_pis       NUMERIC(10,2) DEFAULT 0,
  valor_cofins    NUMERIC(10,2) DEFAULT 0,
  valor_csll      NUMERIC(10,2) DEFAULT 0,
  valor_inss      NUMERIC(10,2) DEFAULT 0,
  valor_liquido   NUMERIC(10,2),
  descricao_servico  TEXT,
  codigo_servico     TEXT,
  status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','emitida','cancelada','erro')),
  competencia     TEXT,
  emitida_em      TIMESTAMPTZ,
  cancelada_em    TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  nfeio_id        TEXT,
  pdf_uri         TEXT,
  xml_uri         TEXT,
  emitida_automaticamente BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE notas_fiscais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_notas_fiscais" ON notas_fiscais;
CREATE POLICY "service_role_all_notas_fiscais" ON notas_fiscais
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_notas_fiscais" ON notas_fiscais;
CREATE POLICY "authenticated_read_notas_fiscais" ON notas_fiscais
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_nf_client ON notas_fiscais(client_id, competencia DESC);
CREATE INDEX IF NOT EXISTS idx_nf_status ON notas_fiscais(status, created_at DESC);

-- DOCUMENTOS
CREATE TABLE IF NOT EXISTS documentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('contrato','certificado','procuracao','outro')),
  subtipo         TEXT,
  titulo          TEXT NOT NULL,
  arquivo_uri     TEXT,
  arquivo_url     TEXT,
  clicksign_envelope_id TEXT,
  clicksign_status      TEXT,
  assinado_em           TIMESTAMPTZ,
  data_emissao    DATE,
  data_validade   DATE,
  status          TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','vencido','revogado')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_documentos" ON documentos;
CREATE POLICY "service_role_all_documentos" ON documentos
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_documentos" ON documentos;
CREATE POLICY "authenticated_read_documentos" ON documentos
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_documentos_client   ON documentos(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_validade ON documentos(data_validade) WHERE status = 'ativo';

-- RLS NAS TABELAS ANTIGAS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_clientes" ON clientes;
CREATE POLICY "service_role_all_clientes" ON clientes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_clientes" ON clientes;
CREATE POLICY "authenticated_read_clientes" ON clientes
  FOR SELECT TO authenticated USING (true);

ALTER TABLE obrigacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_obrigacoes" ON obrigacoes;
CREATE POLICY "service_role_all_obrigacoes" ON obrigacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_obrigacoes" ON obrigacoes;
CREATE POLICY "authenticated_read_obrigacoes" ON obrigacoes
  FOR SELECT TO authenticated USING (true);

ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_funcionarios" ON funcionarios;
CREATE POLICY "service_role_all_funcionarios" ON funcionarios
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_funcionarios" ON funcionarios;
CREATE POLICY "authenticated_read_funcionarios" ON funcionarios
  FOR SELECT TO authenticated USING (true);

ALTER TABLE folha_mensal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_folha_mensal" ON folha_mensal;
CREATE POLICY "service_role_all_folha_mensal" ON folha_mensal
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE ferias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_ferias" ON ferias;
CREATE POLICY "service_role_all_ferias" ON ferias
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE rescisoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_rescisoes" ON rescisoes;
CREATE POLICY "service_role_all_rescisoes" ON rescisoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE lancamentos_contabeis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_lancamentos" ON lancamentos_contabeis;
CREATE POLICY "service_role_all_lancamentos" ON lancamentos_contabeis
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_plano_contas" ON plano_contas;
CREATE POLICY "service_role_all_plano_contas" ON plano_contas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- TRIGGERS updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_whatsapp_sessions_upd BEFORE UPDATE ON whatsapp_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_tarefas_agente_upd BEFORE UPDATE ON tarefas_agente
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_apuracoes_upd BEFORE UPDATE ON apuracoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_notas_fiscais_upd BEFORE UPDATE ON notas_fiscais
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_documentos_upd BEFORE UPDATE ON documentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

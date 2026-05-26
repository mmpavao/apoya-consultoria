-- Migration 012: DP Completo — verificação e garantia de estrutura
-- Tabelas já criadas na sprint anterior; esta migration garante
-- campos adicionais, RLS e policies caso ainda não existam.

-- funcionarios
CREATE TABLE IF NOT EXISTS funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text NOT NULL,
  pis text,
  cargo text,
  departamento text,
  salario_base numeric(10,2) NOT NULL DEFAULT 0,
  data_admissao date NOT NULL,
  data_demissao date,
  tipo_contrato text NOT NULL DEFAULT 'clt' CHECK (tipo_contrato IN ('clt','pj','estagiario','autonomo')),
  jornada text,
  banco text, agencia text, conta text, tipo_conta text,
  dependentes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','afastado','demitido')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- folha_mensal
CREATE TABLE IF NOT EXISTS folha_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  total_funcionarios integer NOT NULL DEFAULT 0,
  total_proventos numeric(10,2) NOT NULL DEFAULT 0,
  total_descontos numeric(10,2) NOT NULL DEFAULT 0,
  total_liquido numeric(10,2) NOT NULL DEFAULT 0,
  total_fgts numeric(10,2) NOT NULL DEFAULT 0,
  total_inss_empresa numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','fechada','enviada')),
  fechado_em timestamptz, fechado_por uuid,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, competencia)
);

-- ferias
CREATE TABLE IF NOT EXISTS ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES clientes(id),
  periodo_aquisitivo_ini date NOT NULL,
  periodo_aquisitivo_fim date NOT NULL,
  gozo_inicio date, gozo_fim date,
  dias_gozo integer NOT NULL DEFAULT 30,
  abono_pecuniario boolean NOT NULL DEFAULT false,
  dias_abono integer NOT NULL DEFAULT 0,
  valor_ferias numeric(10,2), valor_abono numeric(10,2), valor_total numeric(10,2),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','agendada','paga','vencida')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- rescisoes
CREATE TABLE IF NOT EXISTS rescisoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES clientes(id),
  tipo text NOT NULL CHECK (tipo IN ('sem_justa_causa','com_justa_causa','pedido_demissao','acordo','aposentadoria')),
  data_aviso date, data_demissao date NOT NULL,
  saldo_salario numeric(10,2) NOT NULL DEFAULT 0,
  ferias_vencidas numeric(10,2) NOT NULL DEFAULT 0,
  ferias_proporcionais numeric(10,2) NOT NULL DEFAULT 0,
  decimo_proporcional numeric(10,2) NOT NULL DEFAULT 0,
  multa_fgts numeric(10,2) NOT NULL DEFAULT 0,
  inss_desconto numeric(10,2) NOT NULL DEFAULT 0,
  irrf_desconto numeric(10,2) NOT NULL DEFAULT 0,
  total_bruto numeric(10,2) NOT NULL DEFAULT 0,
  total_liquido numeric(10,2) NOT NULL DEFAULT 0,
  fgts_saldo numeric(10,2) NOT NULL DEFAULT 0,
  homologada boolean NOT NULL DEFAULT false,
  homologada_em timestamptz, pdf_url text, observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE funcionarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE folha_mensal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ferias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rescisoes     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='funcionarios' AND policyname='auth_all') THEN
    CREATE POLICY "auth_all" ON funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='folha_mensal' AND policyname='auth_all') THEN
    CREATE POLICY "auth_all" ON folha_mensal FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ferias' AND policyname='auth_all') THEN
    CREATE POLICY "auth_all" ON ferias FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rescisoes' AND policyname='auth_all') THEN
    CREATE POLICY "auth_all" ON rescisoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

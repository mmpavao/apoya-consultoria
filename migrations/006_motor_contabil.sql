-- ============================================================
-- APOYA — Migration 006: Motor Contábil
-- Criado em: 2026-05-22
-- Tabelas: documentos_fiscais, lancamentos_contabeis,
--          apuracoes_mensais, plano_contas,
--          periodos_contabeis, extrato_bancario
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. DOCUMENTOS FISCAIS (NF-e entrada/saída, NFS-e, CT-e)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_fiscais (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo                    text NOT NULL CHECK (tipo IN ('nfe_entrada','nfe_saida','nfse_emitida','nfse_recebida','cte','manual')),

  -- Identificação do documento
  numero                  text,
  serie                   text,
  chave_acesso            text UNIQUE,
  modelo                  text, -- '55' NF-e / '65' NFC-e / 'NFS-e'
  natureza_operacao       text,

  -- Datas
  data_emissao            date,
  data_entrada_saida      date,
  mes_referencia          text, -- 'YYYY-MM' — competência contábil

  -- Emitente / Destinatário
  emitente_cnpj           text,
  emitente_razao          text,
  destinatario_cnpj       text,
  destinatario_razao      text,

  -- Valores
  valor_produtos          numeric(15,4) DEFAULT 0,
  valor_frete             numeric(15,4) DEFAULT 0,
  valor_seguro            numeric(15,4) DEFAULT 0,
  valor_desconto          numeric(15,4) DEFAULT 0,
  valor_total             numeric(15,4) DEFAULT 0,

  -- Tributos (totais da nota)
  valor_icms              numeric(15,4) DEFAULT 0,
  valor_ipi               numeric(15,4) DEFAULT 0,
  valor_pis               numeric(15,4) DEFAULT 0,
  valor_cofins            numeric(15,4) DEFAULT 0,
  valor_iss               numeric(15,4) DEFAULT 0,
  valor_cbs               numeric(15,4) DEFAULT 0, -- Reforma Tributária 2026
  valor_ibs               numeric(15,4) DEFAULT 0, -- Reforma Tributária 2026

  -- Classificação fiscal (resultado do motor)
  cfop_principal          text, -- CFOP predominante da nota
  natureza_fiscal         text CHECK (natureza_fiscal IN (
    'compra_revenda','compra_materia_prima','uso_consumo',
    'ativo_imobilizado','venda','servico_prestado',
    'servico_tomado','devolucao','remessa','retorno','outro'
  )),
  gera_credito_icms       boolean DEFAULT false,
  valor_credito_icms      numeric(15,4) DEFAULT 0,
  gera_credito_pis_cofins boolean DEFAULT false,
  valor_credito_pis       numeric(15,4) DEFAULT 0,
  valor_credito_cofins    numeric(15,4) DEFAULT 0,

  -- Conta contábil sugerida
  conta_contabil_sugerida text, -- código do plano de contas
  conta_contabil_confirmada text,

  -- Status do processamento
  status                  text DEFAULT 'recebido' CHECK (status IN (
    'recebido','classificado_auto','classificado_confirmado',
    'lancado','erro','cancelado','ignorado'
  )),
  classificado_por        text DEFAULT 'pendente' CHECK (classificado_por IN (
    'pendente','automatico','humano','agente_ia'
  )),
  confianca               text DEFAULT 'baixa' CHECK (confianca IN ('alta','media','baixa','manual')),

  -- Arquivos
  xml_url                 text,
  pdf_url                 text,

  -- Controle
  observacoes             text,
  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_fiscais_empresa ON documentos_fiscais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_documentos_fiscais_mes ON documentos_fiscais(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_documentos_fiscais_tipo ON documentos_fiscais(tipo);
CREATE INDEX IF NOT EXISTS idx_documentos_fiscais_status ON documentos_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_documentos_fiscais_chave ON documentos_fiscais(chave_acesso) WHERE chave_acesso IS NOT NULL;

-- RLS
ALTER TABLE documentos_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documentos_fiscais_all" ON documentos_fiscais
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- 2. LANÇAMENTOS CONTÁBEIS (partidas dobradas)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lancamentos_contabeis (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  documento_id            uuid REFERENCES documentos_fiscais(id) ON DELETE SET NULL,

  -- Datas
  data_lancamento         date NOT NULL DEFAULT CURRENT_DATE,
  data_competencia        date NOT NULL, -- regime de competência ≠ data pagamento
  mes_referencia          text NOT NULL, -- 'YYYY-MM'

  -- Lançamento
  historico               text NOT NULL,
  conta_debito            text NOT NULL,  -- código do plano de contas
  conta_credito           text NOT NULL,  -- código do plano de contas
  valor                   numeric(15,4) NOT NULL CHECK (valor > 0),

  -- Classificação
  tipo                    text DEFAULT 'automatico' CHECK (tipo IN (
    'automatico','manual','provisao','depreciacao',
    'estorno','ajuste','abertura','encerramento'
  )),
  centro_custo            text,

  -- Controle
  status                  text DEFAULT 'rascunho' CHECK (status IN (
    'rascunho','confirmado','estornado'
  )),
  periodo_fechado         boolean DEFAULT false,
  lancamento_estorno_id   uuid REFERENCES lancamentos_contabeis(id),

  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_empresa ON lancamentos_contabeis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_mes ON lancamentos_contabeis(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_lancamentos_competencia ON lancamentos_contabeis(data_competencia);
CREATE INDEX IF NOT EXISTS idx_lancamentos_contas ON lancamentos_contabeis(conta_debito, conta_credito);

ALTER TABLE lancamentos_contabeis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lancamentos_all" ON lancamentos_contabeis
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- 3. APURAÇÕES MENSAIS (resultado da apuração por competência)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apuracoes_mensais (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  mes_referencia          text NOT NULL, -- 'YYYY-MM'
  regime                  text NOT NULL,

  -- Receita
  receita_bruta           numeric(15,4) DEFAULT 0,
  receita_bruta_comercio  numeric(15,4) DEFAULT 0,
  receita_bruta_servico   numeric(15,4) DEFAULT 0,
  receita_bruta_industria numeric(15,4) DEFAULT 0,
  rbt12                   numeric(15,4) DEFAULT 0, -- RBT12 para Simples

  -- Simples Nacional
  aliquota_efetiva        numeric(8,6) DEFAULT 0,
  das_valor               numeric(15,4) DEFAULT 0,
  das_codigo_barras       text,
  das_linha_digitavel     text,
  das_vencimento          date,
  das_pago_em             date,
  das_comprovante_url     text,

  -- ICMS
  icms_debito             numeric(15,4) DEFAULT 0,
  icms_credito            numeric(15,4) DEFAULT 0,
  icms_a_pagar            numeric(15,4) DEFAULT 0,
  icms_saldo_credor       numeric(15,4) DEFAULT 0,
  icms_pago_em            date,

  -- ISS
  iss_base                numeric(15,4) DEFAULT 0,
  iss_aliquota            numeric(6,4) DEFAULT 0,
  iss_a_pagar             numeric(15,4) DEFAULT 0,
  iss_pago_em             date,

  -- PIS / COFINS
  pis_debito              numeric(15,4) DEFAULT 0,
  pis_credito             numeric(15,4) DEFAULT 0,
  pis_a_pagar             numeric(15,4) DEFAULT 0,
  cofins_debito           numeric(15,4) DEFAULT 0,
  cofins_credito          numeric(15,4) DEFAULT 0,
  cofins_a_pagar          numeric(15,4) DEFAULT 0,

  -- IRPJ / CSLL (LP/LR — trimestral ou mensal)
  irpj_base               numeric(15,4) DEFAULT 0,
  irpj_valor              numeric(15,4) DEFAULT 0,
  irpj_pago_em            date,
  csll_base               numeric(15,4) DEFAULT 0,
  csll_valor              numeric(15,4) DEFAULT 0,
  csll_pago_em            date,

  -- Status geral
  status                  text DEFAULT 'em_andamento' CHECK (status IN (
    'em_andamento','apurado','transmitido','fechado'
  )),

  -- Dados da transmissão PGDAS
  pgdas_transmitido_em    timestamptz,
  pgdas_recibo            text,

  -- Checklist de fechamento (JSON)
  checklist               jsonb DEFAULT '{
    "nfe_entrada_ok": false,
    "nfe_saida_ok": false,
    "folha_ok": false,
    "conciliacao_ok": false,
    "provisoes_ok": false,
    "depreciacao_ok": false,
    "pgdas_transmitido": false,
    "das_enviado_cliente": false,
    "balancete_ok": false
  }'::jsonb,

  observacoes             text,
  created_by              uuid REFERENCES auth.users(id),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),

  UNIQUE(empresa_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_apuracoes_empresa ON apuracoes_mensais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_apuracoes_mes ON apuracoes_mensais(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_apuracoes_status ON apuracoes_mensais(status);

ALTER TABLE apuracoes_mensais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "apuracoes_all" ON apuracoes_mensais
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- 4. PLANO DE CONTAS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plano_contas (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid REFERENCES clientes(id) ON DELETE CASCADE, -- NULL = padrão global do escritório
  codigo                  text NOT NULL,
  descricao               text NOT NULL,
  tipo                    text NOT NULL CHECK (tipo IN ('ativo','passivo','pl','receita','despesa','custo')),
  natureza                text NOT NULL CHECK (natureza IN ('devedora','credora')),
  nivel                   integer NOT NULL DEFAULT 3 CHECK (nivel BETWEEN 1 AND 5),
  codigo_pai              text,
  aceita_lancamento       boolean DEFAULT true, -- conta analítica = true
  ativo                   boolean DEFAULT true,
  created_at              timestamptz DEFAULT now(),

  UNIQUE(empresa_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_plano_contas_empresa ON plano_contas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_plano_contas_tipo ON plano_contas(tipo);

ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plano_contas_all" ON plano_contas
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Seed: plano de contas padrão (empresa_id = NULL = global)
INSERT INTO plano_contas (empresa_id, codigo, descricao, tipo, natureza, nivel, codigo_pai, aceita_lancamento) VALUES
-- ATIVO
(NULL,'1','ATIVO','ativo','devedora',1,NULL,false),
(NULL,'1.1','Ativo Circulante','ativo','devedora',2,'1',false),
(NULL,'1.1.1','Caixa','ativo','devedora',3,'1.1',true),
(NULL,'1.1.2','Bancos Conta Corrente','ativo','devedora',3,'1.1',true),
(NULL,'1.1.3','Aplicações Financeiras','ativo','devedora',3,'1.1',true),
(NULL,'1.1.4','Contas a Receber — Clientes','ativo','devedora',3,'1.1',true),
(NULL,'1.1.5','(-) Provisão Devedores Duvidosos','ativo','credora',3,'1.1',true),
(NULL,'1.1.6','Estoques','ativo','devedora',3,'1.1',true),
(NULL,'1.1.7','ICMS a Recuperar','ativo','devedora',3,'1.1',true),
(NULL,'1.1.8','PIS a Recuperar','ativo','devedora',3,'1.1',true),
(NULL,'1.1.9','COFINS a Recuperar','ativo','devedora',3,'1.1',true),
(NULL,'1.1.10','Adiantamentos a Fornecedores','ativo','devedora',3,'1.1',true),
(NULL,'1.1.11','Outros Créditos','ativo','devedora',3,'1.1',true),
(NULL,'1.2','Ativo Não Circulante','ativo','devedora',2,'1',false),
(NULL,'1.2.1','Realizável a Longo Prazo','ativo','devedora',3,'1.2',false),
(NULL,'1.2.1.1','Depósitos Judiciais','ativo','devedora',4,'1.2.1',true),
(NULL,'1.2.2','Imobilizado','ativo','devedora',3,'1.2',false),
(NULL,'1.2.2.1','Móveis e Utensílios','ativo','devedora',4,'1.2.2',true),
(NULL,'1.2.2.2','Equipamentos de Informática','ativo','devedora',4,'1.2.2',true),
(NULL,'1.2.2.3','Veículos','ativo','devedora',4,'1.2.2',true),
(NULL,'1.2.2.4','Máquinas e Equipamentos','ativo','devedora',4,'1.2.2',true),
(NULL,'1.2.2.5','(-) Depreciação Acumulada','ativo','credora',4,'1.2.2',true),
(NULL,'1.2.3','Intangível','ativo','devedora',3,'1.2',false),
(NULL,'1.2.3.1','Softwares e Licenças','ativo','devedora',4,'1.2.3',true),
(NULL,'1.2.3.2','Marcas e Patentes','ativo','devedora',4,'1.2.3',true),
-- PASSIVO
(NULL,'2','PASSIVO','passivo','credora',1,NULL,false),
(NULL,'2.1','Passivo Circulante','passivo','credora',2,'2',false),
(NULL,'2.1.1','Fornecedores','passivo','credora',3,'2.1',true),
(NULL,'2.1.2','Salários e Ordenados a Pagar','passivo','credora',3,'2.1',true),
(NULL,'2.1.3','INSS a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.1.4','FGTS a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.1.5','IRRF a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.1.6','ICMS a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.1.7','ISS a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.1.8','PIS a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.1.9','COFINS a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.1.10','DAS a Recolher (Simples Nacional)','passivo','credora',3,'2.1',true),
(NULL,'2.1.11','Empréstimos Bancários CP','passivo','credora',3,'2.1',true),
(NULL,'2.1.12','Provisão de Férias','passivo','credora',3,'2.1',true),
(NULL,'2.1.13','Provisão de 13º Salário','passivo','credora',3,'2.1',true),
(NULL,'2.1.14','IRPJ a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.1.15','CSLL a Recolher','passivo','credora',3,'2.1',true),
(NULL,'2.2','Passivo Não Circulante','passivo','credora',2,'2',false),
(NULL,'2.2.1','Empréstimos Bancários LP','passivo','credora',3,'2.2',true),
(NULL,'2.2.2','Financiamentos','passivo','credora',3,'2.2',true),
-- PATRIMÔNIO LÍQUIDO
(NULL,'3','PATRIMÔNIO LÍQUIDO','pl','credora',1,NULL,false),
(NULL,'3.1','Capital Social','pl','credora',2,'3',true),
(NULL,'3.2','Reserva de Lucros','pl','credora',2,'3',true),
(NULL,'3.3','Lucros ou Prejuízos Acumulados','pl','credora',2,'3',true),
(NULL,'3.4','Resultado do Exercício','pl','credora',2,'3',true),
-- RECEITAS
(NULL,'4','RECEITAS','receita','credora',1,NULL,false),
(NULL,'4.1','Receita Bruta de Vendas','receita','credora',2,'4',true),
(NULL,'4.2','Receita Bruta de Serviços','receita','credora',2,'4',true),
(NULL,'4.3','(-) Devoluções de Vendas','receita','devedora',2,'4',true),
(NULL,'4.4','(-) ICMS sobre Vendas','receita','devedora',2,'4',true),
(NULL,'4.5','(-) ISS sobre Serviços','receita','devedora',2,'4',true),
(NULL,'4.6','(-) PIS sobre Faturamento','receita','devedora',2,'4',true),
(NULL,'4.7','(-) COFINS sobre Faturamento','receita','devedora',2,'4',true),
(NULL,'4.8','Outras Receitas Operacionais','receita','credora',2,'4',true),
(NULL,'4.9','Receitas Financeiras','receita','credora',2,'4',true),
-- CUSTOS
(NULL,'5','CUSTOS','custo','devedora',1,NULL,false),
(NULL,'5.1','CMV — Custo das Mercadorias Vendidas','custo','devedora',2,'5',true),
(NULL,'5.2','CPV — Custo dos Produtos Vendidos','custo','devedora',2,'5',true),
(NULL,'5.3','CSV — Custo dos Serviços Vendidos','custo','devedora',2,'5',true),
-- DESPESAS
(NULL,'6','DESPESAS','despesa','devedora',1,NULL,false),
(NULL,'6.1','Despesas com Pessoal','despesa','devedora',2,'6',false),
(NULL,'6.1.1','Salários e Ordenados','despesa','devedora',3,'6.1',true),
(NULL,'6.1.2','INSS sobre Salários (Patronal)','despesa','devedora',3,'6.1',true),
(NULL,'6.1.3','FGTS sobre Salários','despesa','devedora',3,'6.1',true),
(NULL,'6.1.4','Provisão de Férias','despesa','devedora',3,'6.1',true),
(NULL,'6.1.5','Provisão de 13º Salário','despesa','devedora',3,'6.1',true),
(NULL,'6.1.6','Vale-Transporte','despesa','devedora',3,'6.1',true),
(NULL,'6.1.7','Vale-Refeição / Alimentação','despesa','devedora',3,'6.1',true),
(NULL,'6.2','Despesas Operacionais','despesa','devedora',2,'6',false),
(NULL,'6.2.1','Aluguel','despesa','devedora',3,'6.2',true),
(NULL,'6.2.2','Energia Elétrica','despesa','devedora',3,'6.2',true),
(NULL,'6.2.3','Telefone e Internet','despesa','devedora',3,'6.2',true),
(NULL,'6.2.4','Água e Saneamento','despesa','devedora',3,'6.2',true),
(NULL,'6.2.5','Material de Escritório','despesa','devedora',3,'6.2',true),
(NULL,'6.2.6','Honorários Contábeis','despesa','devedora',3,'6.2',true),
(NULL,'6.2.7','Depreciação','despesa','devedora',3,'6.2',true),
(NULL,'6.2.8','Manutenção e Conservação','despesa','devedora',3,'6.2',true),
(NULL,'6.2.9','Seguros','despesa','devedora',3,'6.2',true),
(NULL,'6.2.10','Publicidade e Propaganda','despesa','devedora',3,'6.2',true),
(NULL,'6.3','Despesas Financeiras','despesa','devedora',2,'6',false),
(NULL,'6.3.1','Juros sobre Empréstimos','despesa','devedora',3,'6.3',true),
(NULL,'6.3.2','Tarifas Bancárias','despesa','devedora',3,'6.3',true),
(NULL,'6.3.3','IOF','despesa','devedora',3,'6.3',true),
(NULL,'6.3.4','Multas e Juros Fiscais','despesa','devedora',3,'6.3',true)
ON CONFLICT (empresa_id, codigo) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. PERÍODOS CONTÁBEIS (controle de fechamento mensal)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS periodos_contabeis (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  mes_referencia          text NOT NULL, -- 'YYYY-MM'
  status                  text DEFAULT 'aberto' CHECK (status IN ('aberto','em_fechamento','fechado')),

  -- Checklist de fechamento
  checklist               jsonb DEFAULT '{}'::jsonb,

  -- Auditoria
  fechado_por             uuid REFERENCES auth.users(id),
  fechado_em              timestamptz,
  reaberto_por            uuid REFERENCES auth.users(id),
  reaberto_em             timestamptz,
  motivo_reabertura       text,

  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),

  UNIQUE(empresa_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_periodos_empresa ON periodos_contabeis(empresa_id);
CREATE INDEX IF NOT EXISTS idx_periodos_mes ON periodos_contabeis(mes_referencia);

ALTER TABLE periodos_contabeis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periodos_all" ON periodos_contabeis
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- 6. EXTRATO BANCÁRIO (conciliação)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extrato_bancario (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  mes_referencia          text NOT NULL, -- 'YYYY-MM'

  -- Linha do extrato
  data_linha              date NOT NULL,
  historico_banco         text NOT NULL,
  valor                   numeric(15,4) NOT NULL,
  tipo                    text NOT NULL CHECK (tipo IN ('credito','debito')),
  saldo_apos              numeric(15,4),

  -- Conciliação
  status                  text DEFAULT 'pendente' CHECK (status IN ('pendente','conciliado','ignorado')),
  lancamento_id           uuid REFERENCES lancamentos_contabeis(id) ON DELETE SET NULL,
  conciliado_em           timestamptz,
  conciliado_por          uuid REFERENCES auth.users(id),

  -- Classificação automática sugerida
  historico_classificado  text,
  conta_sugerida          text,
  confianca               text DEFAULT 'baixa' CHECK (confianca IN ('alta','media','baixa')),

  created_at              timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extrato_empresa ON extrato_bancario(empresa_id);
CREATE INDEX IF NOT EXISTS idx_extrato_mes ON extrato_bancario(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_extrato_status ON extrato_bancario(status);

ALTER TABLE extrato_bancario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extrato_all" ON extrato_bancario
  FOR ALL USING (auth.uid() IS NOT NULL);

-- ────────────────────────────────────────────────────────────
-- 7. TRIGGER: updated_at automático
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_documentos_fiscais_updated_at') THEN
    CREATE TRIGGER trg_documentos_fiscais_updated_at
      BEFORE UPDATE ON documentos_fiscais
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lancamentos_updated_at') THEN
    CREATE TRIGGER trg_lancamentos_updated_at
      BEFORE UPDATE ON lancamentos_contabeis
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_apuracoes_updated_at') THEN
    CREATE TRIGGER trg_apuracoes_updated_at
      BEFORE UPDATE ON apuracoes_mensais
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_periodos_updated_at') THEN
    CREATE TRIGGER trg_periodos_updated_at
      BEFORE UPDATE ON periodos_contabeis
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

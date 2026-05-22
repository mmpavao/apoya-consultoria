-- ============================================================
-- MIGRATION 004 — Serviços, Contratos e Documentos
-- APOYA Contabilidade — mai/2026
-- ============================================================

-- set_updated_at (idempotente)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 1. CATÁLOGO GLOBAL DE SERVIÇOS
-- ══════════════════════════════════════════════════════════════
create table if not exists public.servico_catalogo (
  id                uuid primary key default gen_random_uuid(),
  codigo            text unique not null,
  nome              text not null,
  descricao         text,
  categoria         text not null default 'mensal',
  tipo              text not null default 'servico',
  valor_padrao      numeric(12,2) not null default 0,
  unidade           text not null default 'mensal',
  requer_contrato   boolean not null default true,
  requer_nota       boolean not null default true,
  ativo             boolean not null default true,
  ordem             int not null default 99,
  tags              text[] default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.servico_catalogo enable row level security;
create policy "admin_all_servico_catalogo" on public.servico_catalogo
  for all using (true);
drop trigger if exists trg_servico_catalogo_updated_at on public.servico_catalogo;
create trigger trg_servico_catalogo_updated_at
  before update on public.servico_catalogo
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 2. SERVIÇOS CONTRATADOS POR CLIENTE
-- ══════════════════════════════════════════════════════════════
create table if not exists public.cliente_servico (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clientes(id) on delete cascade,
  catalogo_id       uuid not null references public.servico_catalogo(id),
  nome_servico      text not null,
  valor_contratado  numeric(12,2) not null,
  desconto          numeric(12,2) not null default 0,
  valor_final       numeric(12,2) generated always as (valor_contratado - desconto) stored,
  periodicidade     text not null default 'mensal',
  data_inicio       date not null default current_date,
  data_fim          date,
  status            text not null default 'ativo',
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.cliente_servico enable row level security;
create policy "admin_all_cliente_servico" on public.cliente_servico
  for all using (true);
drop trigger if exists trg_cliente_servico_updated_at on public.cliente_servico;
create trigger trg_cliente_servico_updated_at
  before update on public.cliente_servico
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 3. PAGAMENTOS DE SERVIÇOS
-- ══════════════════════════════════════════════════════════════
create table if not exists public.servico_pagamento (
  id                  uuid primary key default gen_random_uuid(),
  cliente_servico_id  uuid not null references public.cliente_servico(id) on delete cascade,
  cliente_id          uuid not null references public.clientes(id) on delete cascade,
  competencia         text not null,
  valor               numeric(12,2) not null,
  data_vencimento     date not null,
  data_pagamento      date,
  status              text not null default 'pendente',
  forma_pagamento     text,
  observacoes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
alter table public.servico_pagamento enable row level security;
create policy "admin_all_servico_pagamento" on public.servico_pagamento
  for all using (true);
drop trigger if exists trg_servico_pagamento_updated_at on public.servico_pagamento;
create trigger trg_servico_pagamento_updated_at
  before update on public.servico_pagamento
  for each row execute function public.set_updated_at();
create index if not exists idx_servico_pagamento_cliente_status
  on public.servico_pagamento(cliente_id, status);
create index if not exists idx_servico_pagamento_vencimento
  on public.servico_pagamento(data_vencimento);

-- ══════════════════════════════════════════════════════════════
-- 4. CONTRATOS
-- ══════════════════════════════════════════════════════════════
create sequence if not exists public.contrato_numero_seq start 1;

create table if not exists public.contrato_cliente (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.clientes(id) on delete cascade,
  numero            text unique,
  titulo            text not null,
  tipo              text not null default 'mensalidade',
  status            text not null default 'rascunho',
  valor_total       numeric(12,2) not null default 0,
  data_inicio       date not null default current_date,
  data_fim          date,
  corpo_html        text,
  clausulas         jsonb not null default '[]',
  servicos_ids      uuid[] not null default '{}',
  clicksign_key     text,
  clicksign_status  text,
  clicksign_url     text,
  assinado_em       timestamptz,
  observacoes       text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.contrato_cliente enable row level security;
create policy "admin_all_contrato_cliente" on public.contrato_cliente
  for all using (true);
drop trigger if exists trg_contrato_cliente_updated_at on public.contrato_cliente;
create trigger trg_contrato_cliente_updated_at
  before update on public.contrato_cliente
  for each row execute function public.set_updated_at();

create or replace function public.gerar_numero_contrato()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    new.numero := 'APOYA-' || to_char(now(), 'YYYY') || '-' ||
                  lpad(nextval('public.contrato_numero_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;
drop trigger if exists trg_contrato_numero on public.contrato_cliente;
create trigger trg_contrato_numero
  before insert on public.contrato_cliente
  for each row execute function public.gerar_numero_contrato();

-- ══════════════════════════════════════════════════════════════
-- 5. DOCUMENTOS — Pastas
-- ══════════════════════════════════════════════════════════════
create table if not exists public.documento_pasta (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  nome        text not null,
  descricao   text,
  cor         text not null default '#6366f1',
  icone       text not null default 'folder',
  ordem       int not null default 99,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.documento_pasta enable row level security;
create policy "admin_all_documento_pasta" on public.documento_pasta
  for all using (true);
drop trigger if exists trg_documento_pasta_updated_at on public.documento_pasta;
create trigger trg_documento_pasta_updated_at
  before update on public.documento_pasta
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 6. DOCUMENTOS — Arquivos
-- ══════════════════════════════════════════════════════════════
create table if not exists public.documento_arquivo (
  id            uuid primary key default gen_random_uuid(),
  pasta_id      uuid not null references public.documento_pasta(id) on delete cascade,
  cliente_id    uuid not null references public.clientes(id) on delete cascade,
  nome          text not null,
  descricao     text,
  tipo_mime     text,
  tamanho_bytes bigint,
  storage_path  text not null,
  storage_url   text,
  tags          text[] default '{}',
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.documento_arquivo enable row level security;
create policy "admin_all_documento_arquivo" on public.documento_arquivo
  for all using (true);
drop trigger if exists trg_documento_arquivo_updated_at on public.documento_arquivo;
create trigger trg_documento_arquivo_updated_at
  before update on public.documento_arquivo
  for each row execute function public.set_updated_at();
create index if not exists idx_documento_arquivo_pasta
  on public.documento_arquivo(pasta_id);
create index if not exists idx_documento_arquivo_cliente
  on public.documento_arquivo(cliente_id);

-- ══════════════════════════════════════════════════════════════
-- 7. SEED — Catálogo de serviços contábeis
-- ══════════════════════════════════════════════════════════════
insert into public.servico_catalogo
  (codigo, nome, descricao, categoria, tipo, valor_padrao, unidade, requer_contrato, requer_nota, ativo, ordem, tags)
values
  ('HON_MEI','Honorário Mensal MEI','Gestão contábil MEI: DASMEI, declarações e suporte.','mensal','servico',89.00,'mensal',true,true,true,1,ARRAY['mensalidade','mei']),
  ('HON_SIMPLES_ME','Honorário Mensal ME — Simples Nacional','Escrituração, apuração de impostos e obrigações para ME.','mensal','servico',250.00,'mensal',true,true,true,2,ARRAY['mensalidade','simples','me']),
  ('HON_SIMPLES_EPP','Honorário Mensal EPP — Simples Nacional','Escrituração completa, folha e obrigações para EPP.','mensal','servico',450.00,'mensal',true,true,true,3,ARRAY['mensalidade','simples','epp']),
  ('HON_LUCRO_PRES','Honorário Mensal — Lucro Presumido','IRPJ/CSLL trimestral, PIS, COFINS e obrigações.','mensal','servico',890.00,'mensal',true,true,true,4,ARRAY['mensalidade','lucro-presumido']),
  ('HON_LUCRO_REAL','Honorário Mensal — Lucro Real','Contabilidade completa com SPED, ECF e LALUR.','mensal','servico',1800.00,'mensal',true,true,true,5,ARRAY['mensalidade','lucro-real']),
  ('HON_DOMESTICA','Honorário Mensal — Empregada Doméstica','eSocial doméstico, FGTS, INSS e rescisões.','mensal','servico',120.00,'mensal',true,true,true,6,ARRAY['mensalidade','domestica']),
  ('ABERTURA_MEI','Abertura de MEI','Registro no Portal do Empreendedor, CNPJ e alvará.','avulso','servico',199.00,'avulso',true,true,true,10,ARRAY['abertura','mei','avulso']),
  ('ABERTURA_ME','Abertura de Empresa (ME/EPP)','Abertura na Junta Comercial, CNPJ, IE e IM.','avulso','servico',799.00,'avulso',true,true,true,11,ARRAY['abertura','me','epp','avulso']),
  ('ENCERRAMENTO','Encerramento / Baixa de Empresa','Baixa na Junta Comercial, cancelamento de CNPJ.','avulso','servico',1200.00,'avulso',true,true,true,12,ARRAY['encerramento','avulso']),
  ('ALTERACAO_CONTRATO','Alteração Contratual','Alteração de endereço, sócio ou atividade.','avulso','servico',450.00,'avulso',true,true,true,13,ARRAY['alteracao','avulso']),
  ('IRPF','Declaração de IRPF','Elaboração e entrega da DIRPF — Pessoa Física.','anual','servico',350.00,'anual',true,true,true,20,ARRAY['irpf','anual']),
  ('IRPF_COMPLEX','IRPF Complexo','DIRPF com ganho de capital, exterior ou atividade rural.','anual','servico',750.00,'anual',true,true,true,21,ARRAY['irpf','anual','complexo']),
  ('CERTIDAO_NEGATIVA','Emissão de Certidão Negativa','CND Federal, Estadual ou Municipal.','avulso','servico',80.00,'avulso',false,false,true,30,ARRAY['certidao','avulso']),
  ('PARCELAMENTO_DEBITO','Parcelamento de Débitos Fiscais','Negociação de parcelamento com Receita Federal.','avulso','servico',500.00,'avulso',true,true,true,31,ARRAY['parcelamento','avulso']),
  ('CONSULTORIA_HORA','Consultoria Tributária (por hora)','Consultoria sob demanda sobre tributação.','eventual','servico',200.00,'hora',false,true,true,40,ARRAY['consultoria','hora']),
  ('PLANEJAMENTO_TRIB','Planejamento Tributário Anual','Análise de enquadramento e economia fiscal.','anual','servico',2500.00,'anual',true,true,true,41,ARRAY['planejamento','anual']),
  ('FOLHA_PAGAMENTO','Folha de Pagamento','Elaboração mensal de folha, holerites e eSocial.','mensal','servico',180.00,'mensal',true,true,true,50,ARRAY['folha','mensal','rh']),
  ('ADMISSAO','Admissão de Funcionário','Registro em carteira e eSocial.','avulso','servico',120.00,'avulso',true,true,true,51,ARRAY['admissao','avulso','rh']),
  ('RESCISAO','Rescisão de Contrato de Trabalho','TRCT, FGTS e homologação.','avulso','servico',250.00,'avulso',true,true,true,52,ARRAY['rescisao','avulso','rh']),
  ('NFSE_AVULSA','Emissão de NFS-e Avulsa','Nota fiscal de serviço para clientes sem contrato.','avulso','servico',30.00,'avulso',false,false,true,60,ARRAY['nfse','avulso'])
on conflict (codigo) do update set
  nome=excluded.nome, descricao=excluded.descricao,
  valor_padrao=excluded.valor_padrao, updated_at=now();

-- ══════════════════════════════════════════════════════════════
-- 8. Realtime
-- ══════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.servico_catalogo;
alter publication supabase_realtime add table public.cliente_servico;
alter publication supabase_realtime add table public.servico_pagamento;
alter publication supabase_realtime add table public.contrato_cliente;
alter publication supabase_realtime add table public.documento_pasta;
alter publication supabase_realtime add table public.documento_arquivo;

-- ============================================================
-- APOYA Gestão — Migration 002: Correção Incremental
-- Adapta schema existente ao PRD completo
-- Projeto: ajaqbdsalxfgrwpjbtbn
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Enums (criar somente se não existem) ─────────────────────
do $$ begin
  create type public.app_role as enum ('admin','contador','assistente','cliente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.regime_tributario as enum (
    'MEI','Simples Nacional','Lucro Presumido','Lucro Real','Doméstica'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cliente_status as enum (
    'ativo','inadimplente','suspenso','inativo','em_analise'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.forma_pagamento as enum ('PIX','Boleto','Débito automático');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tier_servico as enum ('MEI','Simples','Empresarial','Doméstica');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.das_status as enum (
    'pendente','gerado','enviado_whatsapp','pago','vencido','erro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.nfse_status as enum (
    'pendente','emitida','cancelada','erro','rejeitada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cobranca_status as enum (
    'pendente','enviada','paga','vencida','cancelada'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.obrigacao_status as enum (
    'pendente','em_andamento','concluido','atrasado','dispensado'
  );
exception when duplicate_object then null; end $$;

-- ── Função updated_at ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── Função has_role ───────────────────────────────────────────
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- ============================================================
-- TABELA: profiles (criar se não existe)
-- ============================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  nome       text not null default '',
  email      text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Próprio perfil leitura" on public.profiles;
create policy "Próprio perfil leitura" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Próprio perfil update" on public.profiles;
create policy "Próprio perfil update" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Service role acesso total profiles" on public.profiles;
create policy "Service role acesso total profiles" on public.profiles
  for all using (auth.role() = 'service_role');

-- ============================================================
-- TABELA: user_roles (criar se não existe)
-- ============================================================
create table if not exists public.user_roles (
  id      uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  role    public.app_role not null default 'assistente',
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "Leitura do próprio papel" on public.user_roles;
create policy "Leitura do próprio papel" on public.user_roles
  for select using (auth.uid() = user_id);

drop policy if exists "Service role acesso total roles" on public.user_roles;
create policy "Service role acesso total roles" on public.user_roles
  for all using (auth.role() = 'service_role');

-- ============================================================
-- TABELA: clientes — adicionar colunas que faltam
-- ============================================================

-- Colunas de identificação e relacionamento
alter table public.clientes
  add column if not exists razao_social         text,
  add column if not exists nome_fantasia         text,
  add column if not exists regime               text not null default 'Simples Nacional',
  add column if not exists regime_hibrido       boolean not null default false,
  add column if not exists tier                 text not null default 'Simples',
  add column if not exists codigo_servico_nfse  text,
  add column if not exists aliquota_iss         numeric(5,2) default 3.00,
  add column if not exists inscricao_municipal  text,
  add column if not exists inscricao_estadual   text,
  -- Contato
  add column if not exists email                text,
  add column if not exists telefone             text,
  add column if not exists whatsapp             text,
  -- Endereço
  add column if not exists cep                  text,
  add column if not exists logradouro           text,
  add column if not exists numero               text,
  add column if not exists complemento          text,
  add column if not exists bairro               text,
  add column if not exists municipio            text,
  add column if not exists uf                   text,
  add column if not exists codigo_municipio_ibge text,
  -- Atividade
  add column if not exists atividade_principal  text,
  -- Financeiro
  add column if not exists dia_vencimento       integer not null default 10,
  add column if not exists valor_honorario      numeric(10,2),
  add column if not exists forma_pagamento      text not null default 'PIX',
  add column if not exists asaas_customer_id    text,
  -- Status
  add column if not exists data_inadimplencia   date,
  add column if not exists data_suspensao       date,
  add column if not exists motivo_suspensao     text,
  add column if not exists responsavel_id       uuid,
  -- Características
  add column if not exists tem_empregados       boolean not null default false,
  add column if not exists tem_incentivo_fiscal boolean not null default false,
  -- Controle
  add column if not exists created_by           uuid references auth.users(id);

-- Índices
create index if not exists idx_clientes_status on public.clientes(status);
create index if not exists idx_clientes_regime on public.clientes(regime);
create index if not exists idx_clientes_responsavel on public.clientes(responsavel_id);

-- RLS clientes
alter table public.clientes enable row level security;

drop policy if exists "Service role clientes" on public.clientes;
create policy "Service role clientes" on public.clientes
  for all using (auth.role() = 'service_role');

drop policy if exists "Staff vê todos clientes" on public.clientes;
create policy "Staff vê todos clientes" on public.clientes
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'contador'));

-- ============================================================
-- TABELA: obrigacoes — adicionar colunas que faltam
-- ============================================================
alter table public.obrigacoes
  add column if not exists codigo       text,
  add column if not exists nome         text,
  add column if not exists updated_at   timestamptz not null default now(),
  add column if not exists valor_multa  numeric(10,2),
  add column if not exists observacoes  text,
  add column if not exists concluido_em timestamptz,
  add column if not exists concluido_por uuid references auth.users(id);

-- Migrar coluna 'tipo' → 'codigo' se necessário
update public.obrigacoes
  set codigo = tipo
  where codigo is null and tipo is not null;

-- Trigger updated_at
drop trigger if exists trg_obrigacoes_updated_at on public.obrigacoes;
create trigger trg_obrigacoes_updated_at
  before update on public.obrigacoes
  for each row execute function public.set_updated_at();

-- RLS obrigacoes
alter table public.obrigacoes enable row level security;

drop policy if exists "Service role obrigacoes" on public.obrigacoes;
create policy "Service role obrigacoes" on public.obrigacoes
  for all using (auth.role() = 'service_role');

drop policy if exists "Staff gerencia obrigações" on public.obrigacoes;
create policy "Staff gerencia obrigações" on public.obrigacoes
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'contador'));

-- ============================================================
-- TABELA: das_guias — adicionar colunas que faltam
-- ============================================================
alter table public.das_guias
  add column if not exists tipo          text not null default 'DAS',
  add column if not exists tentativas    integer not null default 0,
  add column if not exists ultimo_erro   text,
  add column if not exists enviado_wa_em timestamptz,
  add column if not exists updated_at    timestamptz not null default now();

drop trigger if exists trg_das_updated_at on public.das_guias;
create trigger trg_das_updated_at
  before update on public.das_guias
  for each row execute function public.set_updated_at();

alter table public.das_guias enable row level security;

drop policy if exists "Service role das" on public.das_guias;
create policy "Service role das" on public.das_guias
  for all using (auth.role() = 'service_role');

drop policy if exists "Staff gerencia DAS" on public.das_guias;
create policy "Staff gerencia DAS" on public.das_guias
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'contador'));

-- ============================================================
-- TABELA: nfse_notas — adicionar colunas que faltam
-- ============================================================
alter table public.nfse_notas
  add column if not exists numero_nota        text,
  add column if not exists numero_protocolo   text,
  add column if not exists tomador_razao      text,
  add column if not exists tomador_cnpj       text,
  add column if not exists aliquota_cbs       numeric(5,2) default 0.90,
  add column if not exists aliquota_ibs       numeric(5,2) default 0.10,
  add column if not exists tentativas         integer not null default 0,
  add column if not exists ultimo_erro        text,
  add column if not exists emitida_em         timestamptz,
  add column if not exists cancelada_em       timestamptz,
  add column if not exists motivo_cancelamento text,
  add column if not exists updated_at         timestamptz not null default now();

drop trigger if exists trg_nfse_updated_at on public.nfse_notas;
create trigger trg_nfse_updated_at
  before update on public.nfse_notas
  for each row execute function public.set_updated_at();

alter table public.nfse_notas enable row level security;

drop policy if exists "Service role nfse" on public.nfse_notas;
create policy "Service role nfse" on public.nfse_notas
  for all using (auth.role() = 'service_role');

drop policy if exists "Staff gerencia NFS-e" on public.nfse_notas;
create policy "Staff gerencia NFS-e" on public.nfse_notas
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'contador'));

-- ============================================================
-- TABELA: cobrancas — adicionar colunas que faltam
-- ============================================================
alter table public.cobrancas
  add column if not exists asaas_payment_id   text,
  add column if not exists asaas_invoice_url  text,
  add column if not exists codigo_barras      text,
  add column if not exists pdf_url            text,
  add column if not exists regua_stage_nome   text,
  add column if not exists ultimo_contato_em  timestamptz,
  add column if not exists cancelado_em       timestamptz,
  add column if not exists updated_at         timestamptz not null default now();

drop trigger if exists trg_cobrancas_updated_at on public.cobrancas;
create trigger trg_cobrancas_updated_at
  before update on public.cobrancas
  for each row execute function public.set_updated_at();

alter table public.cobrancas enable row level security;

drop policy if exists "Service role cobrancas" on public.cobrancas;
create policy "Service role cobrancas" on public.cobrancas
  for all using (auth.role() = 'service_role');

drop policy if exists "Staff gerencia cobranças" on public.cobrancas;
create policy "Staff gerencia cobranças" on public.cobrancas
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'contador'));

-- ============================================================
-- NOVAS TABELAS
-- ============================================================

-- calendario_fiscal
create table if not exists public.calendario_fiscal (
  id              uuid primary key default uuid_generate_v4(),
  codigo          text not null,
  nome            text not null,
  descricao       text,
  regime          text,
  competencia_mes integer,
  dia_vencimento  integer,
  mes_vencimento  integer,
  periodicidade   text not null default 'mensal',
  ativo           boolean not null default true,
  observacoes     text,
  vigencia_inicio date,
  vigencia_fim    date
);

alter table public.calendario_fiscal enable row level security;
drop policy if exists "Todos leem calendário" on public.calendario_fiscal;
create policy "Todos leem calendário" on public.calendario_fiscal
  for select using (true);
drop policy if exists "Service role calendario" on public.calendario_fiscal;
create policy "Service role calendario" on public.calendario_fiscal
  for all using (auth.role() = 'service_role');

-- escritorio_config
create table if not exists public.escritorio_config (
  id                   uuid primary key default uuid_generate_v4(),
  razao_social         text not null default 'APOYA Consultoria e Contabilidade',
  nome_fantasia        text not null default 'APOYA',
  cnpj                 text not null default '43507838000189',
  crc                  text,
  email                text,
  telefone             text,
  whatsapp             text,
  logotipo_url         text,
  serpro_token         text,
  nfeio_api_key        text,
  asaas_api_key        text,
  evolution_api_url    text,
  evolution_api_key    text,
  dias_suspensao       integer not null default 45,
  dia_cobranca         integer not null default 5,
  template_wa_das      text,
  template_wa_nfse     text,
  template_wa_cobranca text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.escritorio_config enable row level security;
drop policy if exists "Admin gerencia config" on public.escritorio_config;
create policy "Admin gerencia config" on public.escritorio_config
  for all using (public.has_role(auth.uid(), 'admin') or auth.role() = 'service_role');

-- audit_log
create table if not exists public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id),
  acao        text not null,
  entidade    text,
  entidade_id uuid,
  dados       jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;
drop policy if exists "Admin lê auditoria" on public.audit_log;
create policy "Admin lê auditoria" on public.audit_log
  for select using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Service role auditoria" on public.audit_log;
create policy "Service role auditoria" on public.audit_log
  for all using (auth.role() = 'service_role');

create index if not exists idx_audit_log_created on public.audit_log(created_at desc);
create index if not exists idx_audit_log_acao on public.audit_log(acao);

-- mensagem_whatsapp
create table if not exists public.mensagem_whatsapp (
  id            uuid primary key default uuid_generate_v4(),
  cliente_id    uuid references public.clientes(id) on delete cascade,
  telefone      text not null,
  direcao       text not null check (direcao in ('enviada','recebida')),
  tipo          text not null default 'text',
  conteudo      text,
  arquivo_url   text,
  arquivo_nome  text,
  status        text not null default 'enviada',
  evolution_id  text,
  eh_automatica boolean not null default false,
  lida_em       timestamptz,
  created_at    timestamptz not null default now()
);

alter table public.mensagem_whatsapp enable row level security;
drop policy if exists "Staff vê mensagens" on public.mensagem_whatsapp;
create policy "Staff vê mensagens" on public.mensagem_whatsapp
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'contador') or auth.role() = 'service_role');

create index if not exists idx_mensagem_wa_cliente on public.mensagem_whatsapp(cliente_id);
create index if not exists idx_mensagem_wa_created on public.mensagem_whatsapp(created_at desc);

-- integracao_config
create table if not exists public.integracao_config (
  id         uuid primary key default uuid_generate_v4(),
  tipo       text not null unique,
  ativa      boolean not null default false,
  config     jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.integracao_config enable row level security;
drop policy if exists "Admin gerencia integrações" on public.integracao_config;
create policy "Admin gerencia integrações" on public.integracao_config
  for all using (public.has_role(auth.uid(), 'admin') or auth.role() = 'service_role');

-- ============================================================
-- TRIGGER: handle_new_user (criar/substituir)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  _role public.app_role;
  _user_count integer;
begin
  select count(*) into _user_count from public.profiles;
  _role := case when _user_count = 0 then 'admin' else 'assistente' end;

  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email
  ) on conflict (id) do update set
    nome = excluded.nome,
    email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, _role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED: escritorio_config
-- ============================================================
insert into public.escritorio_config (razao_social, nome_fantasia, cnpj, dias_suspensao, dia_cobranca)
values ('APOYA Consultoria e Contabilidade', 'APOYA', '43507838000189', 45, 5)
on conflict do nothing;

-- ============================================================
-- SEED: calendario_fiscal 2026
-- ============================================================
insert into public.calendario_fiscal (codigo, nome, regime, periodicidade, dia_vencimento, competencia_mes) values
('DASMEI',    'DAS-MEI mensal',           'MEI',               'mensal',    20, null),
('DASANUAL',  'DAS-MEI anual (SIMEI)',     'MEI',               'anual',     31, 5),
('DAS',       'DAS Simples Nacional',     'Simples Nacional',  'mensal',    20, null),
('PGDAS',     'PGDAS-D (declaração)',     'Simples Nacional',  'mensal',    20, null),
('DEFIS',     'DEFIS (anual)',            'Simples Nacional',  'anual',     31, 3),
('DIRBI',     'DIRBI',                   'Simples Nacional',  'mensal',    20, null),
('ESOCIAL',   'eSocial',                 null,                'mensal',    7,  null),
('FGTS',      'FGTS',                    null,                'mensal',    7,  null),
('GPS',       'GPS — INSS',              null,                'mensal',    20, null),
('EFDREINF',  'EFD-Reinf',              null,                'mensal',    15, null),
('DARF',      'DARF IRPJ/CSLL',         'Lucro Presumido',   'mensal',    31, null),
('DCTFWEB',   'DCTFWeb',                null,                'mensal',    15, null),
('EFDCONTRIB','EFD-Contribuições',      'Lucro Presumido',   'mensal',    10, null),
('ECF',       'ECF',                    null,                'anual',     31, 7),
('ECD',       'ECD',                    null,                'anual',     31, 5),
('DAE',       'DAE doméstica',          'Doméstica',         'mensal',    7,  null)
on conflict do nothing;

-- ============================================================
-- SEED: integrações configuráveis
-- ============================================================
insert into public.integracao_config (tipo, ativa, config) values
('serpro',    false, '{"gateway_url":"https://gateway.apiserpro.serpro.gov.br"}'),
('nfeio',     false, '{"base_url":"https://api.nfe.io/v1"}'),
('asaas',     false, '{"base_url":"https://api.asaas.com/v3","sandbox":true}'),
('evolution', false, '{"base_url":"","instance":""}')
on conflict (tipo) do nothing;

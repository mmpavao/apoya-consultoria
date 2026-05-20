-- ============================================================
-- APOYA Gestão — Migration 001: Schema Base Completo
-- Projeto: ajaqbdsalxfgrwpjbtbn
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ── Enum: papéis de usuário ──────────────────────────────────
create type public.app_role as enum (
  'admin',        -- acesso total, configura o escritório
  'contador',     -- acessa todos os clientes
  'assistente',   -- acessa clientes atribuídos
  'cliente'       -- portal: só seus dados (RLS)
);

-- ── Enum: regime tributário ──────────────────────────────────
create type public.regime_tributario as enum (
  'MEI',
  'Simples Nacional',
  'Lucro Presumido',
  'Lucro Real',
  'Doméstica'
);

-- ── Enum: status do cliente ──────────────────────────────────
create type public.cliente_status as enum (
  'ativo',
  'inadimplente',
  'suspenso',
  'inativo',
  'em_analise'
);

-- ── Enum: status de obrigação ────────────────────────────────
create type public.obrigacao_status as enum (
  'pendente',
  'em_andamento',
  'concluido',
  'atrasado',
  'dispensado'
);

-- ── Enum: status DAS ─────────────────────────────────────────
create type public.das_status as enum (
  'pendente',
  'gerado',
  'enviado_whatsapp',
  'pago',
  'vencido',
  'erro'
);

-- ── Enum: status NFS-e ───────────────────────────────────────
create type public.nfse_status as enum (
  'pendente',
  'emitida',
  'cancelada',
  'erro',
  'rejeitada'
);

-- ── Enum: status cobrança ────────────────────────────────────
create type public.cobranca_status as enum (
  'pendente',
  'enviada',
  'paga',
  'vencida',
  'cancelada'
);

-- ── Enum: forma de pagamento ─────────────────────────────────
create type public.forma_pagamento as enum (
  'PIX',
  'Boleto',
  'Débito automático'
);

-- ── Enum: tier de serviço ────────────────────────────────────
create type public.tier_servico as enum (
  'MEI',
  'Simples',
  'Empresarial',
  'Doméstica'
);

-- ============================================================
-- TABELA: profiles
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  nome        text not null,
  email       text not null,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Próprio perfil leitura" on public.profiles
  for select using (auth.uid() = id);

create policy "Próprio perfil update" on public.profiles
  for update using (auth.uid() = id);

create policy "Admin lê todos" on public.profiles
  for select using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- TABELA: user_roles
-- ============================================================
create table public.user_roles (
  id      uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users on delete cascade,
  role    public.app_role not null default 'assistente',
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "Leitura do próprio papel" on public.user_roles
  for select using (auth.uid() = user_id);

create policy "Admin gerencia papéis" on public.user_roles
  for all using (public.has_role(auth.uid(), 'admin'));

-- Função helper — verifica papel do usuário
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- ============================================================
-- TABELA: escritorio_config
-- ============================================================
create table public.escritorio_config (
  id                  uuid primary key default uuid_generate_v4(),
  razao_social        text not null default 'APOYA Consultoria e Contabilidade',
  nome_fantasia       text not null default 'APOYA',
  cnpj                text not null default '43507838000189',
  crc                 text,
  email               text,
  telefone            text,
  whatsapp            text,
  logotipo_url        text,
  -- Integrações
  serpro_token        text,      -- armazenado criptografado
  nfeio_api_key       text,
  asaas_api_key       text,
  evolution_api_url   text,
  evolution_api_key   text,
  -- Configurações operacionais
  dias_suspensao      integer not null default 45,
  dia_cobranca        integer not null default 5,   -- dia do mês para gerar cobranças
  template_wa_das     text,
  template_wa_nfse    text,
  template_wa_cobranca text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Somente uma linha de configuração
alter table public.escritorio_config enable row level security;

create policy "Admin lê e edita config" on public.escritorio_config
  for all using (public.has_role(auth.uid(), 'admin'));

create policy "Contadores leem config" on public.escritorio_config
  for select using (public.has_role(auth.uid(), 'contador'));

-- ============================================================
-- TABELA: empresa_cliente
-- ============================================================
create table public.empresa_cliente (
  id                      uuid primary key default uuid_generate_v4(),
  -- Identificação
  razao_social            text not null,
  nome_fantasia           text,
  cnpj                    text not null unique,
  inscricao_municipal     text,
  inscricao_estadual      text,
  -- Regime e classificação
  regime                  public.regime_tributario not null default 'Simples Nacional',
  regime_hibrido          boolean not null default false,  -- SN com tributação diferenciada
  tier_servico            public.tier_servico not null default 'Simples',
  codigo_servico_nfse     text,
  aliquota_iss            numeric(5,2) default 3.00,
  -- Contato
  email                   text,
  telefone                text,
  whatsapp                text,
  -- Endereço
  cep                     text,
  logradouro              text,
  numero                  text,
  complemento             text,
  bairro                  text,
  municipio               text not null default 'São Paulo',
  uf                      text not null default 'SP',
  codigo_municipio_ibge   text,
  -- Atividade
  atividade_principal     text,
  -- Financeiro
  dia_vencimento          integer not null default 10,
  valor_honorario         numeric(10,2),
  forma_pagamento         public.forma_pagamento not null default 'PIX',
  asaas_customer_id       text,     -- ID do cliente no Asaas
  -- Status e gestão
  status                  public.cliente_status not null default 'ativo',
  data_inadimplencia      date,     -- quando ficou inadimplente
  data_suspensao          date,     -- quando foi suspenso
  motivo_suspensao        text,
  responsavel_id          uuid references public.profiles(id),
  -- Características
  tem_empregados          boolean not null default false,
  tem_incentivo_fiscal    boolean not null default false,
  observacoes             text,
  -- Controle
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  created_by              uuid references auth.users(id)
);

alter table public.empresa_cliente enable row level security;

-- Admin e contador veem todos
create policy "Admin/Contador veem todos clientes" on public.empresa_cliente
  for all using (
    public.has_role(auth.uid(), 'admin') or
    public.has_role(auth.uid(), 'contador')
  );

-- Assistente vê apenas seus clientes
create policy "Assistente vê clientes atribuídos" on public.empresa_cliente
  for select using (
    public.has_role(auth.uid(), 'assistente') and
    responsavel_id = auth.uid()
  );

-- Cliente vê apenas o próprio
create policy "Cliente vê a própria empresa" on public.empresa_cliente
  for select using (
    public.has_role(auth.uid(), 'cliente') and
    created_by = auth.uid()
  );

create index on public.empresa_cliente(status);
create index on public.empresa_cliente(responsavel_id);
create index on public.empresa_cliente(cnpj);
create index on public.empresa_cliente(regime);

-- ============================================================
-- TABELA: calendario_fiscal
-- ============================================================
create table public.calendario_fiscal (
  id              uuid primary key default uuid_generate_v4(),
  codigo          text not null,    -- ex: 'DAS', 'DASMEI', 'DEFIS', 'DCTFWeb'
  nome            text not null,
  descricao       text,
  regime          public.regime_tributario,   -- null = todos
  competencia_mes integer,          -- null = qualquer mês
  dia_vencimento  integer,          -- dia do mês
  mes_vencimento  integer,          -- null = mesmo mês da competência
  periodicidade   text not null default 'mensal', -- mensal, anual, trimestral
  ativo           boolean not null default true,
  observacoes     text,
  vigencia_inicio date,
  vigencia_fim    date
);

-- Leitura pública (sem RLS) — regras fiscais são públicas
alter table public.calendario_fiscal enable row level security;
create policy "Todos leem calendário" on public.calendario_fiscal
  for select using (true);

-- ============================================================
-- TABELA: obrigacao
-- ============================================================
create table public.obrigacao (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid not null references public.empresa_cliente on delete cascade,
  codigo          text not null,    -- ex: 'DAS', 'DASMEI'
  nome            text not null,
  competencia     date not null,    -- 1º dia do mês de referência
  vencimento      date not null,
  status          public.obrigacao_status not null default 'pendente',
  responsavel_id  uuid references public.profiles(id),
  valor_multa     numeric(10,2),
  observacoes     text,
  concluido_em    timestamptz,
  concluido_por   uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.obrigacao enable row level security;

create policy "Admin/Contador gerencia obrigações" on public.obrigacao
  for all using (
    public.has_role(auth.uid(), 'admin') or
    public.has_role(auth.uid(), 'contador')
  );

create index on public.obrigacao(empresa_id);
create index on public.obrigacao(competencia);
create index on public.obrigacao(status);
create index on public.obrigacao(vencimento);

-- ============================================================
-- TABELA: das_guia
-- ============================================================
create table public.das_guia (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid not null references public.empresa_cliente on delete cascade,
  competencia     date not null,    -- 1º dia do mês
  vencimento      date not null,
  valor           numeric(10,2),
  codigo_barras   text,
  pdf_url         text,             -- Storage: das-pdfs/
  status          public.das_status not null default 'pendente',
  tipo            text not null default 'DAS',  -- DAS | DASMEI
  tentativas      integer not null default 0,
  ultimo_erro     text,
  gerado_em       timestamptz,
  enviado_wa_em   timestamptz,
  pago_em         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (empresa_id, competencia, tipo)
);

alter table public.das_guia enable row level security;

create policy "Admin/Contador gerencia DAS" on public.das_guia
  for all using (
    public.has_role(auth.uid(), 'admin') or
    public.has_role(auth.uid(), 'contador')
  );

create policy "Cliente vê próprio DAS" on public.das_guia
  for select using (
    public.has_role(auth.uid(), 'cliente') and
    empresa_id in (
      select id from public.empresa_cliente where created_by = auth.uid()
    )
  );

create index on public.das_guia(empresa_id);
create index on public.das_guia(competencia);
create index on public.das_guia(status);

-- ============================================================
-- TABELA: nfse
-- ============================================================
create table public.nfse (
  id                  uuid primary key default uuid_generate_v4(),
  empresa_id          uuid not null references public.empresa_cliente on delete cascade,
  competencia         date not null,
  numero_nota         text,
  numero_protocolo    text,
  tomador_razao       text,
  tomador_cnpj        text,
  descricao_servico   text,
  valor_servico       numeric(10,2) not null,
  aliquota_iss        numeric(5,2),
  valor_iss           numeric(10,2),
  aliquota_cbs        numeric(5,2) default 0.90,  -- Reforma tributária
  valor_cbs           numeric(10,2),
  aliquota_ibs        numeric(5,2) default 0.10,  -- Reforma tributária
  valor_ibs           numeric(10,2),
  pdf_url             text,
  xml_url             text,
  status              public.nfse_status not null default 'pendente',
  tentativas          integer not null default 0,
  ultimo_erro         text,
  emitida_em          timestamptz,
  cancelada_em        timestamptz,
  motivo_cancelamento text,
  pode_cancelar       boolean generated always as (
    emitida_em is not null and
    emitida_em > now() - interval '24 hours' and
    status = 'emitida'
  ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.nfse enable row level security;

create policy "Admin/Contador gerencia NFS-e" on public.nfse
  for all using (
    public.has_role(auth.uid(), 'admin') or
    public.has_role(auth.uid(), 'contador')
  );

create policy "Cliente vê próprias notas" on public.nfse
  for select using (
    public.has_role(auth.uid(), 'cliente') and
    empresa_id in (
      select id from public.empresa_cliente where created_by = auth.uid()
    )
  );

create index on public.nfse(empresa_id);
create index on public.nfse(competencia);
create index on public.nfse(status);

-- ============================================================
-- TABELA: cobranca
-- ============================================================
create table public.cobranca (
  id                  uuid primary key default uuid_generate_v4(),
  empresa_id          uuid not null references public.empresa_cliente on delete cascade,
  competencia         date not null,
  valor               numeric(10,2) not null,
  vencimento          date not null,
  asaas_payment_id    text,
  asaas_invoice_url   text,
  codigo_barras       text,
  pix_copia_cola      text,
  pdf_url             text,
  status              public.cobranca_status not null default 'pendente',
  -- Régua de cobrança (estágio atual)
  regua_stage         integer not null default 0,  -- 0..4
  regua_stage_nome    text,                        -- 'pre_vencimento', 'D+1', etc.
  ultimo_contato_em   timestamptz,
  -- Controle
  pago_em             timestamptz,
  cancelado_em        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.cobranca enable row level security;

create policy "Admin/Contador gerencia cobranças" on public.cobranca
  for all using (
    public.has_role(auth.uid(), 'admin') or
    public.has_role(auth.uid(), 'contador')
  );

create policy "Cliente vê próprias cobranças" on public.cobranca
  for select using (
    public.has_role(auth.uid(), 'cliente') and
    empresa_id in (
      select id from public.empresa_cliente where created_by = auth.uid()
    )
  );

create index on public.cobranca(empresa_id);
create index on public.cobranca(status);
create index on public.cobranca(vencimento);

-- ============================================================
-- TABELA: mensagem_whatsapp
-- ============================================================
create table public.mensagem_whatsapp (
  id              uuid primary key default uuid_generate_v4(),
  empresa_id      uuid not null references public.empresa_cliente on delete cascade,
  telefone        text not null,
  direcao         text not null check (direcao in ('enviada','recebida')),
  tipo            text not null default 'text', -- text, image, document, audio
  conteudo        text,
  arquivo_url     text,
  arquivo_nome    text,
  status          text not null default 'enviada', -- enviada, entregue, lida, erro
  evolution_id    text,   -- ID da mensagem na Evolution API
  eh_automatica   boolean not null default false,
  lida_em         timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.mensagem_whatsapp enable row level security;

create policy "Admin/Contador veem mensagens" on public.mensagem_whatsapp
  for all using (
    public.has_role(auth.uid(), 'admin') or
    public.has_role(auth.uid(), 'contador')
  );

create index on public.mensagem_whatsapp(empresa_id);
create index on public.mensagem_whatsapp(created_at desc);

-- ============================================================
-- TABELA: audit_log
-- ============================================================
create table public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id),
  acao        text not null,       -- ex: 'das.gerar', 'nfse.emitir', 'cliente.suspender'
  entidade    text,                -- ex: 'das_guia', 'nfse', 'empresa_cliente'
  entidade_id uuid,
  dados       jsonb,               -- snapshot do estado antes/depois
  ip          text,
  created_at  timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "Admin lê auditoria" on public.audit_log
  for select using (public.has_role(auth.uid(), 'admin'));

create index on public.audit_log(user_id);
create index on public.audit_log(acao);
create index on public.audit_log(created_at desc);

-- ============================================================
-- TABELA: integracao_config
-- (secrets de integração por tipo — separados do escritório_config)
-- ============================================================
create table public.integracao_config (
  id          uuid primary key default uuid_generate_v4(),
  tipo        text not null unique,  -- 'serpro','nfeio','asaas','evolution'
  ativa       boolean not null default false,
  config      jsonb not null default '{}',   -- campos não-secretos
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id)
);

alter table public.integracao_config enable row level security;

create policy "Admin gerencia integrações" on public.integracao_config
  for all using (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- TRIGGERS: updated_at automático
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_empresa_updated_at
  before update on public.empresa_cliente
  for each row execute function public.set_updated_at();

create trigger trg_obrigacao_updated_at
  before update on public.obrigacao
  for each row execute function public.set_updated_at();

create trigger trg_das_updated_at
  before update on public.das_guia
  for each row execute function public.set_updated_at();

create trigger trg_nfse_updated_at
  before update on public.nfse
  for each row execute function public.set_updated_at();

create trigger trg_cobranca_updated_at
  before update on public.cobranca
  for each row execute function public.set_updated_at();

-- ============================================================
-- TRIGGER: handle_new_user
-- Cria profile + papel inicial ao registrar usuário
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  _role public.app_role;
  _user_count integer;
begin
  -- Contar usuários existentes (primeiro usuário vira admin)
  select count(*) into _user_count from public.profiles;
  _role := case when _user_count = 0 then 'admin' else 'assistente' end;

  -- Criar profile
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email
  );

  -- Atribuir papel
  insert into public.user_roles (user_id, role)
  values (new.id, _role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED: escritório_config inicial
-- ============================================================
insert into public.escritorio_config (
  razao_social, nome_fantasia, cnpj,
  dias_suspensao, dia_cobranca
) values (
  'APOYA Consultoria e Contabilidade',
  'APOYA',
  '43507838000189',
  45,
  5
) on conflict do nothing;

-- ============================================================
-- SEED: calendario_fiscal 2026
-- ============================================================
insert into public.calendario_fiscal (codigo, nome, regime, periodicidade, dia_vencimento, competencia_mes) values
-- MEI
('DASMEI',  'DAS-MEI mensal',             'MEI',               'mensal',    20, null),
('DASANUAL','DAS-MEI anual (SIMEI)',       'MEI',               'anual',     31, 5),
-- Simples Nacional
('DAS',     'DAS Simples Nacional',       'Simples Nacional',  'mensal',    20, null),
('PGDAS',   'PGDAS-D (declaração)',       'Simples Nacional',  'mensal',    20, null),
('DEFIS',   'DEFIS (declaração anual)',   'Simples Nacional',  'anual',     31, 3),
('DIRBI',   'DIRBI (incentivos fiscais)', 'Simples Nacional',  'mensal',    20, null),
-- Todos com empregados
('ESOCIAL', 'eSocial',                   null,                'mensal',    7,  null),
('FGTS',    'FGTS',                      null,                'mensal',    7,  null),
('GPS',     'GPS — INSS',                null,                'mensal',    20, null),
('EFDREINF','EFD-Reinf',                 null,                'mensal',    15, null),
-- Lucro Presumido / Real
('DARF',    'DARF IRPJ/CSLL',            'Lucro Presumido',   'mensal',    31, null),
('DCTFWEB', 'DCTFWeb',                   null,                'mensal',    15, null),
('EFDCONTRIB','EFD-Contribuições',       'Lucro Presumido',   'mensal',    10, null),
-- Anuais
('ECF',     'ECF',                       null,                'anual',     31, 7),
('ECD',     'ECD',                       null,                'anual',     31, 5),
('DAE',     'DAE doméstica',             'Doméstica',         'mensal',    7,  null)
on conflict do nothing;

-- ============================================================
-- STORAGE BUCKETS
-- (executar via Supabase dashboard ou CLI separadamente)
-- ============================================================
-- insert into storage.buckets (id, name, public) values
--   ('das-pdfs',        'das-pdfs',        false),
--   ('nfse-xml',        'nfse-xml',        false),
--   ('nfse-pdf',        'nfse-pdf',        false),
--   ('boletos',         'boletos',         false),
--   ('whatsapp-files',  'whatsapp-files',  false)
-- on conflict do nothing;

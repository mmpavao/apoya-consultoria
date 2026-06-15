-- 030: departamento_config
-- Preferências (toggles) por setor, persistidas no banco.
-- Resolve: abas Configurações de Contábil/DP/Financeiro que hoje só usam
-- useState (mudança some ao sair da tela).

create table if not exists public.departamento_config (
  setor       text primary key,
  config      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.departamento_config enable row level security;

-- Leitura: qualquer usuário autenticado. Escrita: autenticado.
-- (refinamento por papel/setor fica para o hardening F1.2)
drop policy if exists "departamento_config_select" on public.departamento_config;
create policy "departamento_config_select"
  on public.departamento_config for select
  to authenticated using (true);

drop policy if exists "departamento_config_insert" on public.departamento_config;
create policy "departamento_config_insert"
  on public.departamento_config for insert
  to authenticated with check (true);

drop policy if exists "departamento_config_update" on public.departamento_config;
create policy "departamento_config_update"
  on public.departamento_config for update
  to authenticated using (true) with check (true);

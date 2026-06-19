-- Detalhe da folha por funcionário (proventos/descontos/líquido por pessoa).
-- Antes a folha só tinha os TOTAIS (folha_mensal); a tela mostrava "—" por
-- funcionário. Agora cada folha gera uma linha por funcionário ativo, editável.
-- Idempotente.

create table if not exists public.folha_linha (
  id             uuid primary key default gen_random_uuid(),
  folha_id       uuid not null references public.folha_mensal(id) on delete cascade,
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  salario_base   numeric not null default 0,
  proventos      numeric not null default 0,  -- bruto (salário + adicionais)
  inss           numeric not null default 0,
  irrf           numeric not null default 0,
  fgts           numeric not null default 0,  -- FGTS do mês (8%) — informativo
  descontos      numeric not null default 0,  -- inss + irrf (+ outros)
  liquido        numeric not null default 0,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (folha_id, funcionario_id)
);

create index if not exists idx_folha_linha_folha on public.folha_linha(folha_id);

-- RLS coerente com o módulo DP (acesso por usuário autenticado; o gate fino é
-- por rota/SectorGuard no app). Hardening de RLS é item separado.
alter table public.folha_linha enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='folha_linha' and policyname='folha_linha_rw') then
    create policy folha_linha_rw on public.folha_linha
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- trigger de updated_at (reusa set_updated_at se existir; senão cria)
do $$
begin
  if not exists (select 1 from pg_proc where proname='set_updated_at') then
    create function public.set_updated_at() returns trigger language plpgsql as $fn$
    begin new.updated_at = now(); return new; end $fn$;
  end if;
end $$;

drop trigger if exists trg_folha_linha_updated on public.folha_linha;
create trigger trg_folha_linha_updated before update on public.folha_linha
  for each row execute function public.set_updated_at();

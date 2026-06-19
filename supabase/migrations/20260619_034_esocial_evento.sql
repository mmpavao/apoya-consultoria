-- Rastreamento MANUAL de eventos eSocial por cliente + competência.
-- Antes a tela de eSocial era um mock hardcoded (status ilustrativo). Agora cada
-- evento (S-XXXX) tem status real, marcado à mão pelo operador (pendente →
-- transmitido/erro), persistido. NÃO transmite ao gov (integração é frente
-- futura) — é o controle interno do escritório. Idempotente.

create table if not exists public.esocial_evento (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.clientes(id) on delete cascade,
  competencia    text not null,                       -- 'YYYY-MM'
  codigo         text not null,                       -- 'S-1000', 'S-1200', ...
  status         text not null default 'pendente',    -- pendente | transmitido | erro
  transmitido_em timestamptz,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (empresa_id, competencia, codigo)
);

create index if not exists idx_esocial_evento_empresa_comp
  on public.esocial_evento(empresa_id, competencia);

alter table public.esocial_evento enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='esocial_evento' and policyname='esocial_evento_rw') then
    create policy esocial_evento_rw on public.esocial_evento
      for all to authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_proc where proname='set_updated_at') then
    create function public.set_updated_at() returns trigger language plpgsql as $fn$
    begin new.updated_at = now(); return new; end $fn$;
  end if;
end $$;

drop trigger if exists trg_esocial_evento_updated on public.esocial_evento;
create trigger trg_esocial_evento_updated before update on public.esocial_evento
  for each row execute function public.set_updated_at();

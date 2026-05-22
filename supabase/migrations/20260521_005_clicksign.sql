-- ══════════════════════════════════════════════════════════════
-- MIGRATION 005 — Clicksign: audit log + campos extras
-- ══════════════════════════════════════════════════════════════

-- 1. Enriquecer contrato_cliente com campos do Clicksign
alter table public.contrato_cliente
  add column if not exists clicksign_envelope_id  text,
  add column if not exists clicksign_document_id  text,
  add column if not exists clicksign_signer_id    text,
  add column if not exists clicksign_sign_url     text,  -- link direto para assinatura
  add column if not exists clicksign_signed_pdf   text,  -- URL do PDF assinado
  add column if not exists clicksign_events       jsonb  not null default '[]',
  add column if not exists signatario_nome        text,
  add column if not exists signatario_email       text,
  add column if not exists signatario_whatsapp    text,
  add column if not exists notificacao_canal      text   not null default 'email',  -- email | whatsapp | both
  add column if not exists deadline_days          int    not null default 30,
  add column if not exists enviado_em             timestamptz,
  add column if not exists cancelado_em           timestamptz;

-- 2. Tabela de audit log de eventos Clicksign (webhook)
create table if not exists public.clicksign_evento (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid references public.contrato_cliente(id) on delete set null,
  envelope_id   text,
  event_name    text not null,
  payload       jsonb not null default '{}',
  processed_at  timestamptz not null default now()
);
alter table public.clicksign_evento enable row level security;
create policy "admin_all_clicksign_evento" on public.clicksign_evento
  for all using (true);
create index if not exists idx_clicksign_evento_contrato on public.clicksign_evento(contrato_id);
create index if not exists idx_clicksign_evento_envelope on public.clicksign_evento(envelope_id);

-- 3. Realtime para contratos (já existe, mas garantir)
do $$ begin
  alter publication supabase_realtime add table public.clicksign_evento;
exception when duplicate_object then null;
end $$;

comment on table public.clicksign_evento is 'Audit log dos webhooks recebidos do Clicksign';
comment on column public.contrato_cliente.clicksign_envelope_id is 'ID do envelope na API v3 do Clicksign';
comment on column public.contrato_cliente.clicksign_sign_url    is 'Link de assinatura enviado ao signatário';
comment on column public.contrato_cliente.clicksign_signed_pdf  is 'URL pública do PDF assinado (após fechamento)';

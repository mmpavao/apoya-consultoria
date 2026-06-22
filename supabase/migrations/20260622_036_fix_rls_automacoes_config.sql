-- ============================================================
-- APOYA Gestão — Migration 036: endurecer RLS de automacoes_config
-- ------------------------------------------------------------
-- Auditoria 22/06/2026: a policy "FOR ALL" usava
--   using (auth.role() = 'authenticated')
-- permitindo que QUALQUER usuário autenticado (inclusive assistente
-- ou cliente) gerencie automações, contornando as rotas /api/* admin.
-- Corrige para: leitura por staff; escrita só admin/contador.
-- Padrão alinhado às migrations 014/026/027 (has_role / is_staff).
-- ============================================================

alter table public.automacoes_config enable row level security;

drop policy if exists "Usuários autenticados lêem automações" on public.automacoes_config;
drop policy if exists "Admins e contadores gerenciam automações" on public.automacoes_config;

create policy "Staff lê automações"
  on public.automacoes_config for select
  to authenticated
  using (is_staff(auth.uid()));

create policy "Admin/contador gerencia automações"
  on public.automacoes_config for all
  to authenticated
  using (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'contador'))
  with check (has_role(auth.uid(), 'admin') or has_role(auth.uid(), 'contador'));

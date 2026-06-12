-- =============================================================
-- APOYA — Migration 014: Sprint Fix-1 — Segurança Crítica
-- Data: 2026-06-12 | Autor: DEV APOYA
-- Corrige: policies ALL/USING(true) sem restrição de role
--          políticas 'public' em tabelas sensíveis
--          service_role_all_obrigacoes duplicada
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX-001: Tabelas com ALL para {public} sem auth — CRÍTICO
-- contrato_cliente, documento_arquivo, documento_pasta,
-- servico_catalogo, clicksign_evento
-- ─────────────────────────────────────────────────────────────

-- contrato_cliente
DROP POLICY IF EXISTS "admin_all_contrato_cliente" ON public.contrato_cliente;
CREATE POLICY "admin_all_contrato_cliente" ON public.contrato_cliente
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'));

-- documento_arquivo
DROP POLICY IF EXISTS "admin_all_documento_arquivo" ON public.documento_arquivo;
CREATE POLICY "admin_all_documento_arquivo" ON public.documento_arquivo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'));

-- documento_pasta
DROP POLICY IF EXISTS "admin_all_documento_pasta" ON public.documento_pasta;
CREATE POLICY "admin_all_documento_pasta" ON public.documento_pasta
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'));

-- servico_catalogo
DROP POLICY IF EXISTS "admin_all_servico_catalogo" ON public.servico_catalogo;
CREATE POLICY "admin_all_servico_catalogo" ON public.servico_catalogo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'));

-- clicksign_evento — admin_all (public → authenticated + role check)
DROP POLICY IF EXISTS "admin_all_clicksign_evento" ON public.clicksign_evento;
CREATE POLICY "admin_all_clicksign_evento" ON public.clicksign_evento
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'contador'));

-- ─────────────────────────────────────────────────────────────
-- FIX-002: Tabelas DP — folha_mensal, ferias, rescisoes
-- ALL para authenticated sem has_role — qualquer user autenticado
-- ─────────────────────────────────────────────────────────────

-- folha_mensal: remover auth_all e staff_all genéricos
DROP POLICY IF EXISTS "auth_all" ON public.folha_mensal;
DROP POLICY IF EXISTS "staff_all" ON public.folha_mensal;
CREATE POLICY "dp_staff_all_folha" ON public.folha_mensal
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- ferias: remover auth_all e staff_all genéricos
DROP POLICY IF EXISTS "auth_all" ON public.ferias;
DROP POLICY IF EXISTS "staff_all" ON public.ferias;
CREATE POLICY "dp_staff_all_ferias" ON public.ferias
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- rescisoes: remover auth_all e staff_all genéricos
DROP POLICY IF EXISTS "auth_all" ON public.rescisoes;
DROP POLICY IF EXISTS "staff_all" ON public.rescisoes;
CREATE POLICY "dp_staff_all_rescisoes" ON public.rescisoes
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- funcionarios: remover auth_all e staff_all genéricos
DROP POLICY IF EXISTS "auth_all" ON public.funcionarios;
DROP POLICY IF EXISTS "staff_all" ON public.funcionarios;
CREATE POLICY "dp_staff_all_funcionarios" ON public.funcionarios
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- FIX-003: obrigacoes — policy service_role_all_obrigacoes duplicada
-- (tem USING(true) mas já existe "Service role obrigacoes" correta)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_all_obrigacoes" ON public.obrigacoes;

-- ─────────────────────────────────────────────────────────────
-- FIX-004: processos_societarios e processos_historico
-- ALL para authenticated sem qualquer restrição de role
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "autenticado_all_ps" ON public.processos_societarios;
CREATE POLICY "staff_all_processos_societarios" ON public.processos_societarios
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "autenticado_all_ph" ON public.processos_historico;
CREATE POLICY "staff_all_processos_historico" ON public.processos_historico
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- FIX-005: cliente_socio — ALL authenticated sem restrição
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "socio_all_authenticated" ON public.cliente_socio;
CREATE POLICY "staff_or_owner_cliente_socio" ON public.cliente_socio
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Verificação final — documentar no audit
-- ─────────────────────────────────────────────────────────────
COMMENT ON TABLE public.obrigacoes IS 'Sprint Fix-1 aplicado 2026-06-12 — policies revisadas por DEV APOYA';

-- ─────────────────────────────────────────────────────────────
-- FIX-014b: SELECT policies sensíveis (conversas, whatsapp, etc)
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "authenticated_read_conversas" ON public.conversas;
CREATE POLICY "staff_read_conversas" ON public.conversas
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated_read_whatsapp_sessions" ON public.whatsapp_sessions;
CREATE POLICY "staff_read_whatsapp_sessions" ON public.whatsapp_sessions
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated_read_notas_fiscais" ON public.notas_fiscais;
CREATE POLICY "staff_or_client_read_notas_fiscais" ON public.notas_fiscais
  FOR SELECT TO authenticated
  USING (is_staff(auth.uid()) OR client_id = current_cliente_id());

DROP POLICY IF EXISTS "authenticated_read_tarefas_agente" ON public.tarefas_agente;
CREATE POLICY "staff_read_tarefas_agente" ON public.tarefas_agente
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated_read_apuracoes" ON public.apuracoes;
CREATE POLICY "staff_read_apuracoes" ON public.apuracoes
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "authenticated_read_documentos" ON public.documentos;
CREATE POLICY "staff_read_documentos" ON public.documentos
  FOR SELECT TO authenticated USING (is_staff(auth.uid()));

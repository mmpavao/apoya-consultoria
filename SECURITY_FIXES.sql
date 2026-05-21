-- =============================================================
-- APOYA — Correções de segurança (rodar no SQL Editor do Supabase)
-- =============================================================

-- 1) Esconder credenciais sensíveis do cliente (column-level grants)
REVOKE SELECT ON public.escritorio_config FROM authenticated, anon;
GRANT SELECT (
  id, razao_social, nome_fantasia, cnpj, crc,
  email, telefone, whatsapp, logotipo_url,
  dia_cobranca, dias_suspensao,
  template_wa_cobranca, template_wa_das, template_wa_nfse,
  created_at, updated_at
) ON public.escritorio_config TO authenticated;

REVOKE UPDATE ON public.escritorio_config FROM authenticated, anon;
GRANT UPDATE (
  razao_social, nome_fantasia, cnpj, crc,
  email, telefone, whatsapp, logotipo_url,
  dia_cobranca, dias_suspensao,
  template_wa_cobranca, template_wa_das, template_wa_nfse
) ON public.escritorio_config TO authenticated;

REVOKE SELECT ON public.integracao_config FROM authenticated, anon;
GRANT SELECT (id, tipo, ativa, updated_at, updated_by)
  ON public.integracao_config TO authenticated;
REVOKE UPDATE ON public.integracao_config FROM authenticated, anon;
GRANT UPDATE (tipo, ativa, updated_at, updated_by)
  ON public.integracao_config TO authenticated;

-- 2) Corrigir search_path em set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ begin new.updated_at = now(); return new; end; $$;

-- 3) Restringir writes a admin/contador (remover 'assistente' das policies amplas)
DROP POLICY IF EXISTS "obrigacoes insert" ON public.obrigacoes;
CREATE POLICY "obrigacoes insert" ON public.obrigacoes
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'contador'));
DROP POLICY IF EXISTS "obrigacoes update" ON public.obrigacoes;
CREATE POLICY "obrigacoes update" ON public.obrigacoes
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'contador'));

DROP POLICY IF EXISTS "das_guias insert" ON public.das_guias;
CREATE POLICY "das_guias insert" ON public.das_guias
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'contador'));
DROP POLICY IF EXISTS "das_guias update" ON public.das_guias;
CREATE POLICY "das_guias update" ON public.das_guias
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'contador'));

DROP POLICY IF EXISTS "nfse_notas insert" ON public.nfse_notas;
CREATE POLICY "nfse_notas insert" ON public.nfse_notas
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'contador'));
DROP POLICY IF EXISTS "nfse_notas update" ON public.nfse_notas;
CREATE POLICY "nfse_notas update" ON public.nfse_notas
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'contador'));

DROP POLICY IF EXISTS "cobrancas insert" ON public.cobrancas;
CREATE POLICY "cobrancas insert" ON public.cobrancas
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'contador'));
DROP POLICY IF EXISTS "cobrancas update" ON public.cobrancas;
CREATE POLICY "cobrancas update" ON public.cobrancas
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'contador'));

-- 4) Audit log: bloqueio explícito de UPDATE/DELETE para não-service
DROP POLICY IF EXISTS "audit_log no delete" ON public.audit_log;
CREATE POLICY "audit_log no delete" ON public.audit_log
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);
DROP POLICY IF EXISTS "audit_log no update" ON public.audit_log;
CREATE POLICY "audit_log no update" ON public.audit_log
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);

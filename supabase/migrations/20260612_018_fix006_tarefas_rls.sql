-- Migration 018: FIX-006 — Corrigir RLS tabela tarefas para toda equipe staff
-- Aplicada em 2026-06-12 via Sprint Fix-2

-- Remover policy restritiva (apenas admin/contador)
DROP POLICY IF EXISTS "Staff gerencia tarefas" ON public.tarefas;

-- Policy completa para toda staff
CREATE POLICY "staff_all_tarefas" ON public.tarefas
  FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()) OR auth.role() = 'service_role')
  WITH CHECK (is_staff(auth.uid()) OR auth.role() = 'service_role');

-- Policy SELECT adicional para responsáveis diretos
CREATE POLICY "agente_select_tarefas" ON public.tarefas
  FOR SELECT
  TO authenticated
  USING (
    responsavel = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR cliente_id IN (SELECT id FROM public.clientes)
  );


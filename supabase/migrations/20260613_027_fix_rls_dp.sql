-- SEC-008: Fechar RLS em DP/folha de pagamento
-- Auditoria 12/06/2026: USING(true) WITH CHECK(true) em 4 tabelas
-- folha e CPF de funcionários acessíveis a qualquer logado

-- Verificar e criar has_setor se não existir
CREATE OR REPLACE FUNCTION has_setor(user_id uuid, setor_nome text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_setores
    WHERE user_id = $1 AND setor = $2
  )
  OR is_staff($1);
$$;

-- FUNCIONARIOS
DROP POLICY IF EXISTS "funcionarios_open" ON funcionarios;
DROP POLICY IF EXISTS "Enable all for authenticated" ON funcionarios;
CREATE POLICY "dp_staff_only" ON funcionarios
  FOR ALL USING (is_staff(auth.uid()) OR has_setor(auth.uid(), 'dp'));

-- FOLHA_MENSAL
DROP POLICY IF EXISTS "folha_mensal_open" ON folha_mensal;
DROP POLICY IF EXISTS "Enable all for authenticated" ON folha_mensal;
CREATE POLICY "dp_staff_folha" ON folha_mensal
  FOR ALL USING (is_staff(auth.uid()) OR has_setor(auth.uid(), 'dp'));

-- FERIAS
DROP POLICY IF EXISTS "ferias_open" ON ferias;
DROP POLICY IF EXISTS "Enable all for authenticated" ON ferias;
CREATE POLICY "dp_staff_ferias" ON ferias
  FOR ALL USING (is_staff(auth.uid()) OR has_setor(auth.uid(), 'dp'));

-- RESCISOES
DROP POLICY IF EXISTS "rescisoes_open" ON rescisoes;
DROP POLICY IF EXISTS "Enable all for authenticated" ON rescisoes;
CREATE POLICY "dp_staff_rescisoes" ON rescisoes
  FOR ALL USING (is_staff(auth.uid()) OR has_setor(auth.uid(), 'dp'));

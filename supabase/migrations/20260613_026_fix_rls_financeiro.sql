-- SEC-007: Fechar RLS nas 6 tabelas financeiras/contábeis
-- Auditoria 12/06/2026: policy FOR ALL USING (auth.uid() IS NOT NULL)
-- permite qualquer autenticado ler/escrever dados de todos os clientes

-- LANCAMENTOS
DROP POLICY IF EXISTS "lancamentos_auth" ON lancamentos;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON lancamentos;
CREATE POLICY "lancamentos_staff_only" ON lancamentos
  FOR ALL USING (is_staff(auth.uid()));

-- EXTRATO
DROP POLICY IF EXISTS "extrato_auth" ON extrato;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON extrato;
CREATE POLICY "extrato_staff_only" ON extrato
  FOR ALL USING (is_staff(auth.uid()));

-- APURACOES
DROP POLICY IF EXISTS "apuracoes_auth" ON apuracoes;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON apuracoes;
CREATE POLICY "apuracoes_staff_only" ON apuracoes
  FOR ALL USING (is_staff(auth.uid()));

-- PLANO_CONTAS
DROP POLICY IF EXISTS "plano_contas_auth" ON plano_contas;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON plano_contas;
CREATE POLICY "plano_contas_staff_only" ON plano_contas
  FOR ALL USING (is_staff(auth.uid()));

-- PERIODOS
DROP POLICY IF EXISTS "periodos_auth" ON periodos;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON periodos;
CREATE POLICY "periodos_staff_only" ON periodos
  FOR ALL USING (is_staff(auth.uid()));

-- DOCUMENTOS_FISCAIS
DROP POLICY IF EXISTS "documentos_fiscais_auth" ON documentos_fiscais;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON documentos_fiscais;
CREATE POLICY "documentos_fiscais_staff_only" ON documentos_fiscais
  FOR ALL USING (is_staff(auth.uid()));

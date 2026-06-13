-- SEC-009 + A8: Fechar RLS em cliente_socio, pipeline_config e tarefa_eventos
-- Auditoria 12/06/2026: CPF de sócios + auditoria de pipeline exposta

-- CLIENTE_SOCIO
DROP POLICY IF EXISTS "socio_open" ON cliente_socio;
DROP POLICY IF EXISTS "Enable all for authenticated" ON cliente_socio;
CREATE POLICY "societario_staff_only" ON cliente_socio
  FOR ALL USING (is_staff(auth.uid()) OR has_setor(auth.uid(), 'societario'));

-- PIPELINE_CONFIG — habilitar RLS (nunca foi habilitado)
ALTER TABLE pipeline_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_config_staff_only" ON pipeline_config
  FOR ALL USING (is_staff(auth.uid()));

-- TAREFA_EVENTOS — habilitar RLS (auditoria gravável/forjável sem RLS)
ALTER TABLE tarefa_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarefa_eventos_staff_only" ON tarefa_eventos
  FOR ALL USING (is_staff(auth.uid()));

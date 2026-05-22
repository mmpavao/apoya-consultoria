-- CICLO-10: MEL-03 — Índices de performance para DAS e queries grandes
-- Objetivo: Melhorar performance de select com filtros de competencia, status, cliente

-- Índice composto: cliente_id + competencia + status (para filtros rápidos)
CREATE INDEX IF NOT EXISTS idx_das_guias_cliente_competencia_status 
  ON das_guias(cliente_id, competencia, status);

-- Índice: vencimento DESC (para ordenação padrão)
CREATE INDEX IF NOT EXISTS idx_das_guias_vencimento_desc 
  ON das_guias(vencimento DESC);

-- Índice: status (filtro comum)
CREATE INDEX IF NOT EXISTS idx_das_guias_status 
  ON das_guias(status);

-- Índice: competencia (filtro comum)
CREATE INDEX IF NOT EXISTS idx_das_guias_competencia 
  ON das_guias(competencia);

-- Índice: cnpj (busca por CNPJ específico)
CREATE INDEX IF NOT EXISTS idx_das_guias_cnpj 
  ON das_guias(cnpj);

-- Tabela wa_conversa: índices para polling de mensagens
CREATE INDEX IF NOT EXISTS idx_wa_conversa_instance_updated 
  ON wa_conversa(wa_instance_id, updated_at DESC);

-- Tabela nfse_emitida: índice para relatórios por competência
CREATE INDEX IF NOT EXISTS idx_nfse_emitida_cliente_competencia 
  ON nfse_emitida(cliente_id, data_emissao DESC);

-- Comentário
COMMENT ON INDEX idx_das_guias_cliente_competencia_status IS 
  'MEL-03: Índice composto para queries de DAS com filtros (cliente + competencia + status)';

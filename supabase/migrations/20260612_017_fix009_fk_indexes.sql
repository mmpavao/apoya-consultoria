-- Migration 017: FIX-009 — Índices para 16 FK sem índice
-- Aplicada em 2026-06-12 via Sprint Fix-2

CREATE INDEX IF NOT EXISTS idx_cliente_bloqueio_cliente_id ON public.cliente_bloqueio(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_servico_catalogo_id ON public.cliente_servico(catalogo_id);
CREATE INDEX IF NOT EXISTS idx_contrato_cliente_cliente_id ON public.contrato_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_das_guias_cliente_id ON public.das_guias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documento_pasta_cliente_id ON public.documento_pasta(cliente_id);
CREATE INDEX IF NOT EXISTS idx_extrato_bancario_lancamento_id ON public.extrato_bancario(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_focus_nfse_log_cliente_id ON public.focus_nfse_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_contabeis_documento_id ON public.lancamentos_contabeis(documento_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_contabeis_lancamento_estorno_id ON public.lancamentos_contabeis(lancamento_estorno_id);
CREATE INDEX IF NOT EXISTS idx_nfse_notas_cliente_id ON public.nfse_notas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_processos_historico_processo_id ON public.processos_historico(processo_id);
CREATE INDEX IF NOT EXISTS idx_processos_societarios_cliente_id ON public.processos_societarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_rescisoes_empresa_id ON public.rescisoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_rescisoes_funcionario_id ON public.rescisoes(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_servico_pagamento_cliente_servico_id ON public.servico_pagamento(cliente_servico_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_client_id ON public.whatsapp_sessions(client_id);


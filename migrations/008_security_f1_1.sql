-- Migration 008: F1.1 — Correções de Segurança (Achados 1, 2, 3)
-- Aprovado por Marcio Pavão. Auditoria: Claude Code 11/06/2026
-- Spec: docs/arquitetura/f1.1-correcoes-seguranca.md

-- ── Achado 1: coluna is_human_delegate em mcp_api_keys ────────────────────────
-- Única forma de uma chamada MCP ser tratada como "ação humana aprovada"
-- é via chave com is_human_delegate=true (ex: webhook de aprovação do painel web).
-- Agentes NÃO podem declarar ator_tipo="humano" no payload para burlar aprovação.
ALTER TABLE mcp_api_keys
  ADD COLUMN IF NOT EXISTS is_human_delegate boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN mcp_api_keys.is_human_delegate IS
  'true = chave representa ação humana aprovada (ex: webhook do painel web). '
  'Apenas chaves com este flag podem avançar etapas requer_aprovacao via MCP.';

-- ── Achado 2: escopo_setores aplicado no worker (dados apenas) ─────────────────
-- Colunas criadas na migration 007. Seeds de escopo_setores aplicados via script
-- (ver logs de deploy F1.1). Chaves: agente_fiscal→["fiscal"], agente_dp→["dp"],
-- agente_contabil→["contabil"], agente_financeiro→["financeiro"],
-- agente_atendimento→["*"]

-- ── Achado 3: remoção de secrets hardcoded (código) ────────────────────────────
-- Arquivos limpos (ver commits F1.1):
-- - src/lib/supabase-server.ts: fallback service_role removido → lança erro se ausente
-- - src/integrations/supabase/client.ts: fallback anon removido → lança erro se ausente  
-- - src/routes/api/nfse/index.ts: ANON hardcoded removido → lê de process.env
-- - supabase/functions/nfse-pos-pagamento/index.ts: fallback "apoya-nfse-2026" removido
-- AÇÃO OBRIGATÓRIA PARA MARCIO: rotacionar service_role e anon keys no Dashboard Supabase
-- URL: https://supabase.com/dashboard/project/ajaqbdsalxfgrwpjbtbn/settings/api

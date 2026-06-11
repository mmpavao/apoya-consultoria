-- Migration 006: adicionar coluna metadados à tabela tarefas
-- Motivo: handler tarefa_criar incluía metadados no INSERT (rastreabilidade agente↔humano),
--         mas a coluna não existia → PGRST204 em toda criação de tarefa via MCP v3.0/v3.1.
-- Plano aprovado pelo Marcio em 2026-06-11.

ALTER TABLE tarefas
  ADD COLUMN IF NOT EXISTS metadados jsonb DEFAULT '{}';

COMMENT ON COLUMN tarefas.metadados IS
  'Metadados livres para integração agente↔humano (origem, contexto, IDs externos etc.)';

-- =============================================================
-- Migration 010 — Fix CHECK constraints tabela tarefas
-- Projeto: APOYA CONTABIL (Supabase ajaqbdsalxfgrwpjbtbn)
-- Criado por: O Contador (COO) — 25/05/2026
-- 
-- INSTRUÇÕES: Rodar no Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/ajaqbdsalxfgrwpjbtbn/sql
-- 
-- Motivo: Alinhar CHECK constraints com valores usados pelo:
--   - MCP SERPRO (zapro.tech): tipos fiscal_urgente, outros
--   - tarefas_module v2.1: sla_status critico, expirada, concluido
--   - painel web (talkzzbot): prioridade normal
-- =============================================================

-- Fix 1: Tipos de tarefa (adiciona fiscal_urgente e outros)
ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_tipo_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_tipo_check
  CHECK (tipo = ANY(ARRAY[
    'fiscal','fiscal_urgente','dp','financeiro','societario',
    'compliance','contabilidade','atendimento','comercial','interno','outros'
  ]::text[]));

-- Fix 2: Prioridade (adiciona normal)
ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_prioridade_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_prioridade_check
  CHECK (prioridade = ANY(ARRAY[
    'critica','alta','media','normal','baixa'
  ]::text[]));

-- Fix 3: SLA Status (adiciona critico, expirada, concluido)
ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_sla_status_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_sla_status_check
  CHECK (sla_status IS NULL OR sla_status = ANY(ARRAY[
    'no_prazo','atencao','critico','atrasada','expirada','concluido'
  ]::text[]));

-- Verificacao final
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.tarefas'::regclass
  AND contype = 'c' AND conname LIKE 'tarefas_%'
ORDER BY conname;

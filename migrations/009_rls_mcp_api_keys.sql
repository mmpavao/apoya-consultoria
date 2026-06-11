-- Migration 009: F1.1b — Hardening RLS em mcp_api_keys
-- Achado identificado por: Claude Code (validador), 11/06/2026
-- Spec: docs/arquitetura/f1.1-correcoes-seguranca.md (seção F1.1b)
--
-- PROBLEMA: 3 policies com roles={authenticated} permitiam que QUALQUER
-- usuário logado lesse key_hash/scopes e alterasse a tabela (ex: escopo_setores=['*']).
-- Isso anulava o controle de escopo por setor implementado no worker (F1.1, Achado 2).
--
-- CORREÇÃO: DROP das 3 policies perigosas.
-- Apenas a policy service_role_only_mcp_keys (ALL, qual=auth.role()='service_role')
-- permanece ativa — garante que apenas o worker (service_role) acessa a tabela.
--
-- IMPACTO ZERO no worker: validateApiKey usa service_role → continua funcionando.
-- Confirmado via REST test pós-migration (service_role SELECT: OK).

-- DROP policies perigosas (aplicado em staging 11/06/2026)
DROP POLICY IF EXISTS authenticated_read_mcp_keys   ON public.mcp_api_keys;
DROP POLICY IF EXISTS authenticated_update_mcp_keys ON public.mcp_api_keys;
DROP POLICY IF EXISTS authenticated_insert_mcp_keys ON public.mcp_api_keys;

-- Verificar estado esperado pós-migration:
-- SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename='mcp_api_keys';
-- Esperado: apenas service_role_only_mcp_keys [ALL] roles={public} qual=(auth.role()='service_role')

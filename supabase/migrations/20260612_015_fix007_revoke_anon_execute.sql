-- Migration 015: FIX-007 — Revogar EXECUTE anon em funções SECURITY DEFINER sensíveis
-- Aplicada em 2026-06-12 via Sprint Fix-2

REVOKE EXECUTE ON FUNCTION public.clientes_para_cobranca(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_cliente_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_setor(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_base44_new_message() FROM anon;
REVOKE EXECUTE ON FUNCTION public.notify_base44_new_message() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;


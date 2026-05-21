/**
 * Wrapper sem tipos para tabelas que ainda não estão no Database type
 * (wa_instance, wa_conversa e colunas novas de mensagem_whatsapp).
 * Server-only.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WaSupabaseClient = any;

export function sbFromContext(context: { supabase?: unknown }): WaSupabaseClient {
  if (!context.supabase) {
    throw new Error("Sessão autenticada não encontrada para acessar dados do WhatsApp.");
  }
  return context.supabase as WaSupabaseClient;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sb: any = supabaseAdmin;

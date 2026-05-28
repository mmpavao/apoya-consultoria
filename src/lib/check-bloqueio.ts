import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function checkClienteBloqueado(clienteId: string): Promise<{ bloqueado: boolean; motivo?: string }> {
  const { data } = await (supabaseAdmin as any).from("clientes").select("bloqueado,motivo_bloqueio").eq("id", clienteId).single();
  if (!data) return { bloqueado: false };
  return { bloqueado: data.bloqueado ?? false, motivo: data.motivo_bloqueio ?? undefined };
}

export function erroClienteBloqueado() {
  return new Response(JSON.stringify({ error: "CLIENTE_BLOQUEADO", message: "Cliente suspenso por inadimplência. Apenas o gestor pode reativar." }), { status: 403, headers: { "Content-Type": "application/json" } });
}

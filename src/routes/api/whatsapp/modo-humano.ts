/**
 * POST /api/whatsapp/modo-humano
 * Painel interno — ativar/desativar atendimento humano para um cliente.
 * Quando modo_humano = true, o agente IA para de responder.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticate(request: Request): Promise<{ userId: string } | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await (supabaseAdmin as ReturnType<typeof import("@supabase/supabase-js").createClient>).auth.getUser(token);
  if (error || !data?.user) return json({ error: "Token inválido" }, 401);
  return { userId: data.user.id };
}

export const Route = createFileRoute("/api/whatsapp/modo-humano")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;

        const body = await request.json() as {
          client_id?: string;
          modo_humano?: boolean;
        };

        const { client_id, modo_humano } = body;

        if (!client_id || modo_humano === undefined) {
          return json({ error: "client_id e modo_humano são obrigatórios" }, 400);
        }

        const updateData: Record<string, unknown> = {
          modo_humano,
          updated_at: new Date().toISOString(),
        };

        if (modo_humano) {
          updateData.humano_id = auth.userId;
          updateData.humano_desde = new Date().toISOString();
        } else {
          updateData.humano_id = null;
          updateData.humano_desde = null;
        }

        const { error } = await (supabaseAdmin as ReturnType<typeof import("@supabase/supabase-js").createClient>)
          .from("whatsapp_sessions")
          .update(updateData)
          .eq("client_id", client_id);

        if (error) return json({ error: error.message }, 500);

        // Audit log
        await (supabaseAdmin as ReturnType<typeof import("@supabase/supabase-js").createClient>)
          .from("eventos")
          .insert({
            client_id,
            tipo: modo_humano ? "humano_assumiu" : "ia_retomou",
            descricao: modo_humano
              ? `Atendimento assumido pelo humano (${auth.userId})`
              : "Atendimento devolvido para IA",
            agente: "sistema",
            payload: { operador: auth.userId },
          });

        return json({ ok: true, modo_humano });
      },
    },
  },
});

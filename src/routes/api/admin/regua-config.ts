/**
 * GET  /api/admin/regua-config → lê configuração atual
 * POST /api/admin/regua-config → atualiza configuração (apenas admin)
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse, requireAdmin } from "@/lib/api-auth";

export const Route = createFileRoute("/api/admin/regua-config")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const auth = await requireAdmin(request);
        if (auth instanceof Response) return auth;
        const { data } = await (supabaseAdmin as any).from("regua_cobranca_config")
          .select("*").eq("escritorio_id", "apoya").single();
        return jsonResponse(data ?? {});
      },
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAdmin(request);
        if (auth instanceof Response) return auth;
        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return jsonResponse({ error: "Body inválido" }, 400); }
        const db = supabaseAdmin as any;
        const { data: existing } = await db.from("regua_cobranca_config").select("id").eq("escritorio_id", "apoya").single();
        const payload = { ...body, atualizado_por: auth.user.email, updated_at: new Date().toISOString() };
        let result;
        if (existing) {
          const { data } = await db.from("regua_cobranca_config").update(payload).eq("escritorio_id", "apoya").select().single();
          result = data;
        } else {
          const { data } = await db.from("regua_cobranca_config").insert({ ...payload, escritorio_id: "apoya" }).select().single();
          result = data;
        }
        return jsonResponse({ ok: true, config: result });
      },
    },
  },
});

/**
 * GET  /api/admin/regua-config → lê configuração atual
 * POST /api/admin/regua-config → atualiza configuração (apenas admin)
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function getAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data.user) return null;
  const { data: role } = await (supabaseAdmin as any).from("user_roles").select("role").eq("user_id", data.user.id).single();
  if (!["admin"].includes(role?.role ?? "")) return null;
  return { user: data.user };
}

export const Route = createFileRoute("/api/admin/regua-config")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const admin = await getAdmin(request);
        if (!admin) return json({ error: "Apenas admins" }, 403);
        const { data } = await (supabaseAdmin as any).from("regua_cobranca_config")
          .select("*").eq("escritorio_id", "apoya").single();
        return json(data ?? {});
      },
      POST: async ({ request }: { request: Request }) => {
        const admin = await getAdmin(request);
        if (!admin) return json({ error: "Apenas admins" }, 403);
        let body: Record<string, unknown>;
        try { body = await request.json(); } catch { return json({ error: "Body inválido" }, 400); }
        const db = supabaseAdmin as any;
        const { data: existing } = await db.from("regua_cobranca_config").select("id").eq("escritorio_id", "apoya").single();
        const payload = { ...body, atualizado_por: (admin.user as any).email, updated_at: new Date().toISOString() };
        let result;
        if (existing) {
          const { data } = await db.from("regua_cobranca_config").update(payload).eq("escritorio_id", "apoya").select().single();
          result = data;
        } else {
          const { data } = await db.from("regua_cobranca_config").insert({ ...payload, escritorio_id: "apoya" }).select().single();
          result = data;
        }
        return json({ ok: true, config: result });
      },
    },
  },
});

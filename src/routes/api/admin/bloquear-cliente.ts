/**
 * POST /api/admin/bloquear-cliente  → bloqueia
 * DELETE /api/admin/bloquear-cliente → libera
 * Auth: admin ou contador.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse, requireStaff } from "@/lib/api-auth";

export const Route = createFileRoute("/api/admin/bloquear-cliente")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireStaff(request, ["admin", "contador"]);
        if (auth instanceof Response) return auth;
        let body: { cliente_id: string; motivo?: string; cobranca_id?: string; observacoes?: string };
        try { body = await request.json(); } catch { return jsonResponse({ error: "Body inválido" }, 400); }
        if (!body.cliente_id) return jsonResponse({ error: "cliente_id obrigatório" }, 400);
        const db = supabaseAdmin as any;
        const now = new Date().toISOString();
        const { data: cli } = await db.from("clientes").select("id,razao_social,bloqueado").eq("id", body.cliente_id).single();
        if (!cli) return jsonResponse({ error: "Cliente não encontrado" }, 404);
        if (cli.bloqueado) return jsonResponse({ error: "Já bloqueado" }, 409);
        await db.from("clientes").update({ bloqueado: true, bloqueado_em: now, bloqueado_por: auth.user.email, motivo_bloqueio: body.motivo ?? "inadimplencia", status: "suspenso", updated_at: now }).eq("id", body.cliente_id);
        await db.from("cliente_bloqueio").insert({ cliente_id: body.cliente_id, cliente_nome: cli.razao_social, motivo: body.motivo ?? "inadimplencia", status: "ativo", bloqueado_por: auth.user.email, bloqueado_em: now, cobranca_id: body.cobranca_id ?? null, observacoes: body.observacoes ?? null });
        await db.from("cobrancas").update({ regua_stage: "suspensao", updated_at: now }).eq("cliente_id", body.cliente_id).in("status", ["pendente", "vencida"]);
        return jsonResponse({ ok: true, msg: `${cli.razao_social} bloqueado por inadimplência` });
      },
      DELETE: async ({ request }: { request: Request }) => {
        const auth = await requireStaff(request, ["admin", "contador"]);
        if (auth instanceof Response) return auth;
        let body: { cliente_id: string; prazo_estendido_ate?: string; observacoes?: string };
        try { body = await request.json(); } catch { return jsonResponse({ error: "Body inválido" }, 400); }
        const db = supabaseAdmin as any;
        const now = new Date().toISOString();
        await db.from("clientes").update({ bloqueado: false, bloqueado_em: null, bloqueado_por: null, motivo_bloqueio: null, status: "ativo", updated_at: now }).eq("id", body.cliente_id);
        await db.from("cliente_bloqueio").update({ status: "liberado", liberado_por: auth.user.email, liberado_em: now, prazo_estendido_ate: body.prazo_estendido_ate ?? null, observacoes: body.observacoes ?? null }).eq("cliente_id", body.cliente_id).eq("status", "ativo");
        return jsonResponse({ ok: true, msg: "Cliente liberado com sucesso" });
      },
    },
  },
});

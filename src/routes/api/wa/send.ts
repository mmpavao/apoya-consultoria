/**
 * POST /api/wa/send — Envio real de mensagem via Evolution API
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evo } from "@/integrations/evolution/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromReq(req: Request) {
  const auth  = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export const Route = createFileRoute("/api/wa/send")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getUserFromReq(request);
        if (!user) return json({ error: "Unauthorized" }, 401);

        let body: {
          instance_id?: string;
          telefone: string;
          mensagem: string;
          cliente_id?: string;
          tipo?: string;
        };
        try { body = await request.json(); }
        catch { return json({ error: "Body inválido" }, 400); }

        const { instance_id, telefone, mensagem, cliente_id, tipo = "text" } = body;
        if (!telefone || !mensagem) {
          return json({ error: "telefone e mensagem são obrigatórios" }, 400);
        }

        const phone = telefone.replace(/\D/g, "");
        if (phone.length < 10) return json({ error: "Telefone inválido" }, 400);

        const db = supabaseAdmin as any;

        // ── Buscar instância ativa ──────────────────────────────────────
        let instancia: { id: string; nome: string; evolution_apikey: string; status: string } | null = null;

        if (instance_id) {
          const { data } = await db.from("wa_instance")
            .select("id,nome,evolution_apikey,status")
            .eq("id", instance_id).single();
          instancia = data;
        }
        if (!instancia) {
          const { data } = await db.from("wa_instance")
            .select("id,nome,evolution_apikey,status")
            .eq("status", "connected").limit(1).single();
          instancia = data;
        }

        if (!instancia) {
          return json({ error: "Nenhuma instância WhatsApp conectada. Configure em Configurações → WhatsApp." }, 503);
        }
        if (instancia.status !== "connected") {
          return json({ error: `Instância '${instancia.nome}' está ${instancia.status}. Reconecte.` }, 503);
        }

        // ── Enviar via Evolution API ────────────────────────────────────
        let evolutionMsgId: string | null = null;
        let sendError: string | null = null;
        try {
          const evoRes = await evo<{ key?: { id?: string }; messageId?: string }>(
            "POST",
            `/message/sendText/${instancia.nome}`,
            { number: phone, text: mensagem, delay: 1000 },
            instancia.evolution_apikey,
          );
          evolutionMsgId = evoRes?.key?.id ?? evoRes?.messageId ?? null;
        } catch (err: any) {
          console.error("[wa/send] Evolution error:", err?.message);
          sendError = err?.message ?? "Erro Evolution API";
        }

        // ── Persistir em mensagem_whatsapp ──────────────────────────────
        const { data: msgDb } = await db.from("mensagem_whatsapp").insert({
          cliente_id:   cliente_id ?? null,
          telefone:     phone,
          direcao:      "enviada",
          tipo:         tipo === "template" ? "template" : "texto",
          conteudo:     mensagem,
          status:       sendError ? "erro" : "enviada",
          evolution_id: evolutionMsgId,
          created_by:   user.id,
        }).select("id").single();

        // ── Atualizar wa_conversa ───────────────────────────────────────
        if (!sendError && cliente_id) {
          const { data: conv } = await db.from("wa_conversa")
            .select("id").eq("cliente_id", cliente_id).maybeSingle();
          if (conv) {
            await db.from("wa_conversa").update({
              ultima_mensagem: mensagem,
              ultima_em: new Date().toISOString(),
            }).eq("id", conv.id);
          } else {
            await db.from("wa_conversa").insert({
              cliente_id,
              telefone:        phone,
              ultima_mensagem: mensagem,
              ultima_em:       new Date().toISOString(),
              created_by:      user.id,
            });
          }
        }

        if (sendError) {
          return json({ ok: false, error: sendError, mensagem_id: (msgDb as any)?.id ?? null }, 502);
        }

        return json({
          ok:          true,
          messageId:   evolutionMsgId,
          mensagem_id: (msgDb as any)?.id ?? null,
          instancia:   instancia.nome,
          status:      "enviada",
        });
      },
    },
  },
});

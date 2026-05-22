/**
 * API Routes para gerenciar instâncias Evolution (substitui server fns).
 * GET  /api/wa/instances         → lista instâncias
 * POST /api/wa/instances/create  → cria nova instância
 * POST /api/wa/instances/refresh → atualiza status de uma instância
 * POST /api/wa/instances/connect → gera novo QR
 * POST /api/wa/instances/logout  → desconecta sem deletar
 * POST /api/wa/instances/delete  → remove instância
 *
 * Auth: Bearer token Supabase no header Authorization.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evo, publicBaseUrlFromRequest } from "@/integrations/evolution/client.server";
import { INSTANCE_NAME_RE, slugifyInstanceName } from "@/lib/whatsapp/wa.server";

const WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE",
  "CONNECTION_UPDATE", "QRCODE_UPDATED",
  "MESSAGE_REACTION", "PRESENCE_UPDATE",
];

// ─── helpers ──────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

async function authenticate(request: Request): Promise<{ userId: string } | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return err("Unauthorized: missing Bearer token", 401);
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data?.user) return err("Unauthorized: invalid token", 401);
  return { userId: data.user.id };
}

async function ensureAdmin(userId: string): Promise<Response | null> {
  const r = await (supabaseAdmin as any)
    .from("user_roles").select("role").eq("user_id", userId).single();
  if (!r.data || r.data.role !== "admin")
    return err("Apenas administradores podem gerenciar instâncias do WhatsApp.", 403);
  return null;
}

function buildWebhookUrl(baseUrl: string, instanceName: string, token: string) {
  return `${baseUrl}/api/public/evolution-webhook/${encodeURIComponent(instanceName)}?token=${token}`;
}

async function setEvolutionWebhook(instanceName: string, webhookUrl: string, apiKey?: string | null) {
  try {
    await evo("POST", `/webhook/set/${encodeURIComponent(instanceName)}`, {
      webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, events: WEBHOOK_EVENTS },
    }, apiKey ?? undefined);
  } catch {
    await evo("POST", `/webhook/set/${encodeURIComponent(instanceName)}`, {
      enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: false, events: WEBHOOK_EVENTS,
    }, apiKey ?? undefined);
  }
}

// ─── route ────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/wa/instances")({
  server: {
    handlers: {
      // GET /api/wa/instances — lista todas
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const db = supabaseAdmin as any;
        const r = await db
          .from("wa_instance")
          .select("id,nome,display_name,departamentos,numero,status,qr_code,last_qr_at,last_connected_at,created_at")
          .order("created_at", { ascending: false });
        if (r.error) return err(r.error.message, 500);
        return json({ instances: r.data ?? [] });
      },

      // POST /api/wa/instances — roteador de ações
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const { userId } = auth;

        let body: any;
        try { body = await request.json(); } catch { return err("JSON inválido"); }

        const action: string = body?.action ?? "";
        const db = supabaseAdmin as any;

        // ── CREATE ─────────────────────────────────────────────────────────
        if (action === "create") {
          const adminErr = await ensureAdmin(userId);
          if (adminErr) return adminErr;

          const { displayName, departamentos } = body;
          if (!displayName || !Array.isArray(departamentos) || departamentos.length === 0)
            return err("displayName e departamentos são obrigatórios");

          const slug = slugifyInstanceName(displayName);
          if (!INSTANCE_NAME_RE.test(slug))
            return err("Nome inválido. Use 3-40 caracteres alfanuméricos.");

          const dup = await db.from("wa_instance").select("id").eq("nome", slug).maybeSingle();
          if (dup.data) return err("Já existe uma instância com esse nome.");

          const ins = await db.from("wa_instance")
            .insert({ nome: slug, display_name: displayName, departamentos, status: "creating", created_by: userId })
            .select("*").single();
          if (ins.error) return err(ins.error.message, 500);
          const row = ins.data;

          const baseUrl = publicBaseUrlFromRequest(request);
          const webhookUrl = buildWebhookUrl(baseUrl, slug, row.webhook_token);

          try {
            const evoRes = await evo<any>("POST", "/instance/create", {
              instanceName: slug, qrcode: true, integration: "WHATSAPP-BAILEYS",
              webhook: { url: webhookUrl, byEvents: false, base64: false, events: WEBHOOK_EVENTS },
              rejectCall: false, groupsIgnore: false, alwaysOnline: false,
              readMessages: false, readStatus: false, syncFullHistory: false,
            });
            const evoApiKey = evoRes?.hash?.apikey ?? null;
            const qrBase64 = evoRes?.qrcode?.base64 ?? evoRes?.qrcode?.code ?? null;
            await db.from("wa_instance").update({
              status: "connecting", evolution_apikey: evoApiKey,
              qr_code: qrBase64, last_qr_at: qrBase64 ? new Date().toISOString() : null,
            }).eq("id", row.id);
            return json({ id: row.id, nome: slug, webhookUrl });
          } catch (e: any) {
            await db.from("wa_instance").delete().eq("id", row.id);
            return err(e?.message ?? "Falha ao criar na Evolution API", 502);
          }
        }

        // ── CONNECT (novo QR) ───────────────────────────────────────────────
        if (action === "connect") {
          const adminErr = await ensureAdmin(userId);
          if (adminErr) return adminErr;
          const { instanceId } = body;
          if (!instanceId) return err("instanceId obrigatório");
          const r = await db.from("wa_instance").select("*").eq("id", instanceId).single();
          if (r.error || !r.data) return err("Instância não encontrada", 404);
          const inst = r.data;
          const baseUrl = publicBaseUrlFromRequest(request);
          const webhookUrl = buildWebhookUrl(baseUrl, inst.nome, inst.webhook_token);
          try { await setEvolutionWebhook(inst.nome, webhookUrl, inst.evolution_apikey); } catch { /* ignore */ }
          const res = await evo<any>("GET", `/instance/connect/${encodeURIComponent(inst.nome)}`);
          const qr = res?.base64 ?? res?.code ?? null;
          const connected = res?.instance?.state === "open";
          await db.from("wa_instance").update({
            status: connected ? "connected" : "connecting",
            qr_code: qr, last_qr_at: qr ? new Date().toISOString() : null,
          }).eq("id", inst.id);
          return json({ qr, connected });
        }

        // ── REFRESH STATUS ──────────────────────────────────────────────────
        if (action === "refresh") {
          const { instanceId } = body;
          if (!instanceId) return err("instanceId obrigatório");
          const r = await db.from("wa_instance").select("nome,evolution_apikey").eq("id", instanceId).single();
          if (r.error || !r.data) return err("Instância não encontrada", 404);
          try {
            const res = await evo<any>("GET", `/instance/connectionState/${encodeURIComponent(r.data.nome)}`);
            const state = res?.instance?.state ?? "close";
            const status = state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";
            await db.from("wa_instance").update({
              status,
              ...(status === "connected" ? { last_connected_at: new Date().toISOString() } : {}),
            }).eq("id", instanceId);
            return json({ status });
          } catch {
            return json({ status: "disconnected" });
          }
        }

        // ── LOGOUT ──────────────────────────────────────────────────────────
        if (action === "logout") {
          const adminErr = await ensureAdmin(userId);
          if (adminErr) return adminErr;
          const { instanceId } = body;
          if (!instanceId) return err("instanceId obrigatório");
          const r = await db.from("wa_instance").select("nome").eq("id", instanceId).single();
          if (r.error || !r.data) return err("Instância não encontrada", 404);
          try { await evo("DELETE", `/instance/logout/${encodeURIComponent(r.data.nome)}`); } catch { /* ignore */ }
          await db.from("wa_instance").update({ status: "disconnected", qr_code: null }).eq("id", instanceId);
          return json({ ok: true });
        }

        // ── DELETE ──────────────────────────────────────────────────────────
        if (action === "delete") {
          const adminErr = await ensureAdmin(userId);
          if (adminErr) return adminErr;
          const { instanceId } = body;
          if (!instanceId) return err("instanceId obrigatório");
          const r = await db.from("wa_instance").select("nome").eq("id", instanceId).single();
          if (r.error || !r.data) return err("Instância não encontrada", 404);
          try { await evo("DELETE", `/instance/logout/${encodeURIComponent(r.data.nome)}`); } catch { /* ignore */ }
          try { await evo("DELETE", `/instance/delete/${encodeURIComponent(r.data.nome)}`); } catch { /* ignore */ }
          try { await db.from("wa_conversa").delete().eq("instance_id", instanceId); } catch { /* ignore */ }
          const del = await db.from("wa_instance").delete().eq("id", instanceId);
          if (del.error) return err(`Falha ao excluir: ${del.error.message}`, 500);
          return json({ ok: true });
        }

        return err(`Ação desconhecida: ${action}`);
      },
    },
  },
});

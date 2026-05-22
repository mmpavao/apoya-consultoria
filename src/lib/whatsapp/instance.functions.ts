/**
 * Server functions para gerenciar instâncias Evolution.
 * listInstances e refreshStatus: usam requireAuth + supabaseAdmin (sem RLS)
 * createInstance / deleteInstance / logoutInstance: requerem admin role
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireAuth } from "@/integrations/supabase/require-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evo, publicBaseUrlFromRequest } from "@/integrations/evolution/client.server";
import { INSTANCE_NAME_RE, slugifyInstanceName } from "./wa.server";

const WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE",
  "CONNECTION_UPDATE", "QRCODE_UPDATED",
  "MESSAGE_REACTION", "PRESENCE_UPDATE",
];

// Versão com supabaseAdmin (sem RLS) — para evitar problemas de permissão em consultas
async function ensureAdminByUserId(userId: string) {
  const r = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  if (!r.data || r.data.role !== "admin") {
    throw new Error("Apenas administradores podem gerenciar instâncias do WhatsApp.");
  }
}

function buildWebhookUrl(baseUrl: string, instanceName: string, token: string): string {
  return `${baseUrl}/api/public/evolution-webhook/${encodeURIComponent(instanceName)}?token=${token}`;
}

async function setEvolutionWebhook(instanceName: string, webhookUrl: string, apiKey?: string | null) {
  try {
    await evo("POST", `/webhook/set/${encodeURIComponent(instanceName)}`, {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        events: WEBHOOK_EVENTS,
      },
    }, apiKey ?? undefined);
  } catch {
    await evo("POST", `/webhook/set/${encodeURIComponent(instanceName)}`, {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: WEBHOOK_EVENTS,
    }, apiKey ?? undefined);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// listInstances — usa supabaseAdmin (bypassa RLS)
// ──────────────────────────────────────────────────────────────────────────
export const listInstances = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = supabaseAdmin as any;
    const r = await db
      .from("wa_instance")
      .select("id,nome,display_name,departamentos,numero,status,qr_code,last_qr_at,last_connected_at,created_at")
      .order("created_at", { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return { instances: r.data ?? [] };
  });

// ──────────────────────────────────────────────────────────────────────────
// createInstance
// ──────────────────────────────────────────────────────────────────────────
export const createInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) =>
    z.object({
      displayName: z.string().min(2).max(60),
      departamentos: z.array(z.string().min(1).max(40)).min(1).max(10),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdminByUserId(context.userId);
    const db = supabaseAdmin as any;

    const slug = slugifyInstanceName(data.displayName);
    if (!INSTANCE_NAME_RE.test(slug)) throw new Error("Nome inválido. Use 3-40 caracteres alfanuméricos.");

    const dup = await db.from("wa_instance").select("id").eq("nome", slug).maybeSingle();
    if (dup.data) throw new Error("Já existe uma instância com esse nome. Escolha outro.");

    const ins = await db
      .from("wa_instance")
      .insert({
        nome: slug,
        display_name: data.displayName,
        departamentos: data.departamentos,
        status: "creating",
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (ins.error) throw new Error(ins.error.message);
    const row = ins.data;

    const baseUrl = publicBaseUrlFromRequest(getRequest());
    const webhookUrl = buildWebhookUrl(baseUrl, slug, row.webhook_token);

    try {
      const evoRes = await evo<any>("POST", "/instance/create", {
        instanceName: slug,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: WEBHOOK_EVENTS,
        },
        rejectCall: false,
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
      });

      const evoApiKey = evoRes?.hash?.apikey ?? null;
      const qrBase64 = evoRes?.qrcode?.base64 ?? evoRes?.qrcode?.code ?? null;

      await db.from("wa_instance").update({
        status: "connecting",
        evolution_apikey: evoApiKey,
        qr_code: qrBase64,
        last_qr_at: qrBase64 ? new Date().toISOString() : null,
      }).eq("id", row.id);

      return { id: row.id, nome: slug, webhookUrl };
    } catch (e) {
      await db.from("wa_instance").delete().eq("id", row.id);
      throw e;
    }
  });

// ──────────────────────────────────────────────────────────────────────────
// connectInstance (gera novo QR)
// ──────────────────────────────────────────────────────────────────────────
export const connectInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ instanceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdminByUserId(context.userId);
    const db = supabaseAdmin as any;
    const r = await db.from("wa_instance").select("*").eq("id", data.instanceId).single();
    if (r.error || !r.data) throw new Error("Instância não encontrada");
    const inst = r.data;

    const baseUrl = publicBaseUrlFromRequest(getRequest());
    const webhookUrl = buildWebhookUrl(baseUrl, inst.nome, inst.webhook_token);
    try { await setEvolutionWebhook(inst.nome, webhookUrl, inst.evolution_apikey); } catch { /* ignore */ }

    const res = await evo<any>("GET", `/instance/connect/${encodeURIComponent(inst.nome)}`);
    const qr = res?.base64 ?? res?.code ?? null;
    const already = res?.instance?.state === "open";
    await db.from("wa_instance").update({
      status: already ? "connected" : "connecting",
      qr_code: qr,
      last_qr_at: qr ? new Date().toISOString() : null,
    }).eq("id", inst.id);
    return { qr, connected: already };
  });

// ──────────────────────────────────────────────────────────────────────────
// refreshStatus — usa supabaseAdmin
// ──────────────────────────────────────────────────────────────────────────
export const refreshStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ instanceId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const db = supabaseAdmin as any;
    const r = await db.from("wa_instance").select("nome,evolution_apikey").eq("id", data.instanceId).single();
    if (r.error || !r.data) throw new Error("Instância não encontrada");
    
    try {
      const res = await evo<any>("GET", `/instance/connectionState/${encodeURIComponent(r.data.nome)}`);
      const state = res?.instance?.state ?? "close";
      const status = state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";
      await db.from("wa_instance").update({
        status,
        last_connected_at: status === "connected" ? new Date().toISOString() : undefined,
      }).eq("id", data.instanceId);
      return { status };
    } catch {
      // Evolution API pode estar offline — não falhar
      return { status: "disconnected" };
    }
  });

// ──────────────────────────────────────────────────────────────────────────
// deleteInstance
// ──────────────────────────────────────────────────────────────────────────
export const deleteInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ instanceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdminByUserId(context.userId);
    const db = supabaseAdmin as any;
    const r = await db.from("wa_instance").select("nome").eq("id", data.instanceId).single();
    if (r.error || !r.data) throw new Error("Instância não encontrada");
    try { await evo("DELETE", `/instance/logout/${encodeURIComponent(r.data.nome)}`); } catch { /* ignore */ }
    try { await evo("DELETE", `/instance/delete/${encodeURIComponent(r.data.nome)}`); } catch { /* ignore */ }
    try { await db.from("wa_conversa").delete().eq("instance_id", data.instanceId); } catch { /* ignore */ }
    const del = await db.from("wa_instance").delete().eq("id", data.instanceId);
    if (del.error) throw new Error(`Falha ao excluir instância: ${del.error.message}`);
    return { ok: true };
  });

// ──────────────────────────────────────────────────────────────────────────
// logoutInstance (desconecta sem deletar)
// ──────────────────────────────────────────────────────────────────────────
export const logoutInstance = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input) => z.object({ instanceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdminByUserId(context.userId);
    const db = supabaseAdmin as any;
    const r = await db.from("wa_instance").select("nome").eq("id", data.instanceId).single();
    if (r.error || !r.data) throw new Error("Instância não encontrada");
    try { await evo("DELETE", `/instance/logout/${encodeURIComponent(r.data.nome)}`); } catch { /* ignore */ }
    await db.from("wa_instance").update({ status: "disconnected", qr_code: null }).eq("id", data.instanceId);
    return { ok: true };
  });

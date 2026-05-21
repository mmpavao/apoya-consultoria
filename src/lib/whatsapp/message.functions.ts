/**
 * Server functions de envio/recebimento de mensagens via Evolution.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { evo } from "@/integrations/evolution/client.server";
import { sbFromContext, type WaSupabaseClient } from "./sb.server";
import { phoneToJid, upsertConversa } from "./wa.server";

async function loadCtx(sb: WaSupabaseClient, conversaId: string, userId: string) {
  const c = await sb.from("wa_conversa").select("*, wa_instance:instance_id (id, nome, evolution_apikey)").eq("id", conversaId).single();
  if (c.error || !c.data) throw new Error("Conversa não encontrada");
  const u = await sb.from("profiles").select("full_name").eq("id", userId).single();
  return { conv: c.data, instance: c.data.wa_instance, agenteNome: u.data?.full_name ?? "Agente" };
}

function withTag(content: string, departamento: string | null, agenteNome: string): string {
  const setor = departamento ? departamento.toUpperCase() : "ATENDIMENTO";
  return `*[${setor} — ${agenteNome}]*\n${content}`;
}

// ──────────────────────────────────────────────────────────────────────────
// listConversas / getMensagens
// ──────────────────────────────────────────────────────────────────────────
export const listConversas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ instanceId: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    let q = sb.from("wa_conversa").select("*").order("ultima_em", { ascending: false, nullsFirst: false });
    if (data.instanceId) q = q.eq("instance_id", data.instanceId);
    const r = await q;
    if (r.error) throw new Error(r.error.message);
    return { conversas: r.data ?? [] };
  });

export const getMensagens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversaId: z.string().uuid(), limit: z.number().min(1).max(200).default(100) }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    const r = await sb.from("mensagem_whatsapp")
      .select("*")
      .eq("conversa_id", data.conversaId)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (r.error) throw new Error(r.error.message);
    return { mensagens: r.data ?? [] };
  });

// ──────────────────────────────────────────────────────────────────────────
// assumeConversa
// ──────────────────────────────────────────────────────────────────────────
export const assumeConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    conversaId: z.string().uuid(),
    departamento: z.string().min(1).max(40),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    const r = await sb.from("wa_conversa").update({
      assigned_to: context.userId,
      assigned_at: new Date().toISOString(),
      departamento: data.departamento,
      nao_lidas: 0,
    }).eq("id", data.conversaId).select("*").single();
    if (r.error) throw new Error(r.error.message);
    return { conversa: r.data };
  });

export const liberarConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    await sb.from("wa_conversa").update({ assigned_to: null, assigned_at: null, departamento: null }).eq("id", data.conversaId);
    return { ok: true };
  });

export const marcarLida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ conversaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    await sb.from("wa_conversa").update({ nao_lidas: 0 }).eq("id", data.conversaId);
    return { ok: true };
  });

// ──────────────────────────────────────────────────────────────────────────
// sendPresence (digitando)
// ──────────────────────────────────────────────────────────────────────────
export const sendPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    conversaId: z.string().uuid(),
    presence: z.enum(["composing", "recording", "paused"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    const { conv, instance } = await loadCtx(sb, data.conversaId, context.userId);
    await evo("POST", `/chat/sendPresence/${encodeURIComponent(instance.nome)}`, {
      number: conv.telefone,
      presence: data.presence,
      delay: 1200,
    }, instance.evolution_apikey);
    return { ok: true };
  });

// ──────────────────────────────────────────────────────────────────────────
// sendText
// ──────────────────────────────────────────────────────────────────────────
export const sendText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    conversaId: z.string().uuid(),
    texto: z.string().min(1).max(4096),
    replyTo: z.string().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    const { conv, instance, agenteNome } = await loadCtx(sb, data.conversaId, context.userId);
    const conteudo = withTag(data.texto, conv.departamento, agenteNome);
    const body: any = { number: conv.telefone, text: conteudo, linkPreview: true };
    if (data.replyTo) body.quoted = { key: { id: data.replyTo } };

    const evoRes = await evo<any>("POST", `/message/sendText/${encodeURIComponent(instance.nome)}`, body, instance.evolution_apikey);
    const evoId = evoRes?.key?.id ?? null;

    await sb.from("mensagem_whatsapp").insert({
      instance_id: instance.id,
      conversa_id: conv.id,
      telefone: conv.telefone,
      direcao: "enviada",
      tipo: "text",
      conteudo,
      evolution_id: evoId,
      agente_id: context.userId,
      agente_nome: agenteNome,
      departamento: conv.departamento,
      reply_to: data.replyTo ?? null,
      status: "enviada",
    });

    await sb.from("wa_conversa").update({
      ultima_mensagem: data.texto.slice(0, 120),
      ultima_em: new Date().toISOString(),
    }).eq("id", conv.id);

    return { ok: true, id: evoId };
  });

// ──────────────────────────────────────────────────────────────────────────
// sendMedia (URL ou base64)
// ──────────────────────────────────────────────────────────────────────────
export const sendMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    conversaId: z.string().uuid(),
    mediatype: z.enum(["image", "video", "document"]),
    mimetype: z.string().min(1).max(80),
    media: z.string().min(1),
    fileName: z.string().max(120).optional(),
    caption: z.string().max(1024).optional(),
    replyTo: z.string().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    const { conv, instance, agenteNome } = await loadCtx(sb, data.conversaId, context.userId);
    const caption = data.caption ? withTag(data.caption, conv.departamento, agenteNome) : undefined;
    const body: any = {
      number: conv.telefone,
      mediatype: data.mediatype,
      mimetype: data.mimetype,
      media: data.media,
      fileName: data.fileName,
      caption,
    };
    if (data.replyTo) body.quoted = { key: { id: data.replyTo } };

    const evoRes = await evo<any>("POST", `/message/sendMedia/${encodeURIComponent(instance.nome)}`, body, instance.evolution_apikey);
    const evoId = evoRes?.key?.id ?? null;

    await sb.from("mensagem_whatsapp").insert({
      instance_id: instance.id,
      conversa_id: conv.id,
      telefone: conv.telefone,
      direcao: "enviada",
      tipo: data.mediatype,
      conteudo: caption ?? null,
      arquivo_url: data.media.startsWith("http") ? data.media : null,
      arquivo_nome: data.fileName ?? null,
      mime_type: data.mimetype,
      evolution_id: evoId,
      agente_id: context.userId,
      agente_nome: agenteNome,
      departamento: conv.departamento,
      reply_to: data.replyTo ?? null,
      status: "enviada",
    });
    await sb.from("wa_conversa").update({
      ultima_mensagem: `📎 ${data.fileName ?? data.mediatype}`,
      ultima_em: new Date().toISOString(),
    }).eq("id", conv.id);

    return { ok: true, id: evoId };
  });

// ──────────────────────────────────────────────────────────────────────────
// sendAudio (PTT)
// ──────────────────────────────────────────────────────────────────────────
export const sendAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    conversaId: z.string().uuid(),
    audio: z.string().min(1),    // base64 ou URL
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    const { conv, instance, agenteNome } = await loadCtx(sb, data.conversaId, context.userId);
    const evoRes = await evo<any>("POST", `/message/sendWhatsAppAudio/${encodeURIComponent(instance.nome)}`, {
      number: conv.telefone,
      audio: data.audio,
      encoding: true,
    }, instance.evolution_apikey);
    const evoId = evoRes?.key?.id ?? null;

    await sb.from("mensagem_whatsapp").insert({
      instance_id: instance.id,
      conversa_id: conv.id,
      telefone: conv.telefone,
      direcao: "enviada",
      tipo: "audio",
      mime_type: "audio/ogg",
      arquivo_url: data.audio.startsWith("http") ? data.audio : null,
      evolution_id: evoId,
      agente_id: context.userId,
      agente_nome: agenteNome,
      departamento: conv.departamento,
      status: "enviada",
    });
    await sb.from("wa_conversa").update({
      ultima_mensagem: "🎤 Áudio",
      ultima_em: new Date().toISOString(),
    }).eq("id", conv.id);

    return { ok: true, id: evoId };
  });

// ──────────────────────────────────────────────────────────────────────────
// sendReaction
// ──────────────────────────────────────────────────────────────────────────
export const sendReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    conversaId: z.string().uuid(),
    messageId: z.string().min(1),
    emoji: z.string().max(8),    // "" remove
    fromMe: z.boolean().default(false),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    const { conv, instance, agenteNome } = await loadCtx(sb, data.conversaId, context.userId);
    await evo("POST", `/message/sendReaction/${encodeURIComponent(instance.nome)}`, {
      reactionMessage: {
        key: { remoteJid: phoneToJid(conv.telefone), fromMe: data.fromMe, id: data.messageId },
        reaction: data.emoji,
      },
    }, instance.evolution_apikey);
    await sb.from("mensagem_whatsapp").insert({
      instance_id: instance.id,
      conversa_id: conv.id,
      telefone: conv.telefone,
      direcao: "enviada",
      tipo: "reaction",
      reaction: data.emoji,
      reaction_to: data.messageId,
      agente_id: context.userId,
      agente_nome: agenteNome,
      departamento: conv.departamento,
      status: "enviada",
    });
    return { ok: true };
  });

// ──────────────────────────────────────────────────────────────────────────
// startConversa (iniciar conversa por número novo)
// ──────────────────────────────────────────────────────────────────────────
export const startConversa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    instanceId: z.string().uuid(),
    telefone: z.string().min(8).max(20),
    clienteId: z.string().uuid().optional(),
    nomeContato: z.string().max(80).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = sbFromContext(context);
    const tel = data.telefone.replace(/\D/g, "");
    const conv = await upsertConversa({
      instanceId: data.instanceId,
      telefone: tel,
      nomeContato: data.nomeContato,
    }, sb);
    if (data.clienteId) {
      await sb.from("wa_conversa").update({ cliente_id: data.clienteId }).eq("id", conv.id);
    }
    return { conversa: conv };
  });

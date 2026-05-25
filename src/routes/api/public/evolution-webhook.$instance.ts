/**
 * Webhook público da Evolution API v2.
 * URL: /api/public/evolution-webhook/{instance}?token=<webhook_token>
 *
 * Validado por wa_instance.webhook_token. NUNCA retorna PII em caso de erro.
 */
import { createFileRoute } from "@tanstack/react-router";
import { sb } from "@/lib/whatsapp/sb.server";
import { evo } from "@/integrations/evolution/client.server";
import { jidToPhone, saveMediaBase64, upsertConversa } from "@/lib/whatsapp/wa.server";

export const Route = createFileRoute("/api/public/evolution-webhook/$instance")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        const instanceName = params.instance;

        if (!token || !instanceName) return new Response("missing", { status: 400 });

        const inst = await sb.from("wa_instance").select("*").eq("nome", instanceName).maybeSingle();
        if (!inst.data || inst.data.webhook_token !== token) {
          return new Response("unauthorized", { status: 401 });
        }
        const instance = inst.data;

        let payload: any;
        try { payload = await request.json(); }
        catch { return new Response("bad json", { status: 400 }); }

        const event: string = (payload?.event ?? "").toLowerCase();
        const data = payload?.data ?? {};

        try {
          switch (event) {
            case "connection.update":
              await handleConnectionUpdate(instance.id, data);
              break;
            case "qrcode.updated":
              await handleQrUpdate(instance.id, data);
              break;
            case "messages.upsert":
              await handleMessageUpsert(instance, data);
              break;
            case "messages.update":
              await handleMessageStatus(data);
              break;
            case "message.reaction":
            case "messages.reaction":
              await handleReaction(instance, data);
              break;
            case "presence.update":
              await handlePresence(instance.id, data);
              break;
            default:
              // log para debug
          }
        } catch (e) {
          console.error(`[evolution-webhook] erro processando ${event}`, e);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function handleConnectionUpdate(instanceId: string, data: any) {
  const state = data?.state ?? data?.status ?? "close";
  const status = state === "open" ? "connected" : state === "connecting" ? "connecting" : "disconnected";
  const patch: any = { status };
  if (status === "connected") {
    patch.last_connected_at = new Date().toISOString();
    patch.qr_code = null;
  }
  await sb.from("wa_instance").update(patch).eq("id", instanceId);
}

async function handleQrUpdate(instanceId: string, data: any) {
  const qr = data?.qrcode?.base64 ?? data?.qrcode?.code ?? data?.base64 ?? data?.code ?? null;
  if (!qr) return;
  await sb.from("wa_instance").update({
    qr_code: qr,
    last_qr_at: new Date().toISOString(),
    status: "connecting",
  }).eq("id", instanceId);
}

function extractContent(msg: any): { tipo: string; conteudo: string | null; mimetype?: string; fileName?: string } {
  if (msg?.conversation) return { tipo: "text", conteudo: msg.conversation };
  if (msg?.extendedTextMessage?.text) return { tipo: "text", conteudo: msg.extendedTextMessage.text };
  if (msg?.imageMessage) return { tipo: "image", conteudo: msg.imageMessage.caption ?? null, mimetype: msg.imageMessage.mimetype };
  if (msg?.videoMessage) return { tipo: "video", conteudo: msg.videoMessage.caption ?? null, mimetype: msg.videoMessage.mimetype };
  if (msg?.audioMessage) return { tipo: "audio", conteudo: null, mimetype: msg.audioMessage.mimetype };
  if (msg?.documentMessage) return { tipo: "document", conteudo: msg.documentMessage.caption ?? null, mimetype: msg.documentMessage.mimetype, fileName: msg.documentMessage.fileName };
  if (msg?.stickerMessage) return { tipo: "sticker", conteudo: null, mimetype: "image/webp" };
  if (msg?.reactionMessage) return { tipo: "reaction", conteudo: msg.reactionMessage.text };
  return { tipo: "text", conteudo: "[mensagem não suportada]" };
}

async function handleMessageUpsert(instance: any, data: any) {
  const key = data?.key ?? {};
  const remoteJid: string = key.remoteJid ?? "";
  if (!remoteJid || remoteJid.endsWith("@g.us")) return;   // grupos: ignorar por ora
  const evolutionId: string = key.id;
  if (!evolutionId) return;

  // dedup: se já temos essa msg, sair
  const existing = await sb.from("mensagem_whatsapp").select("id").eq("evolution_id", evolutionId).maybeSingle();
  if (existing.data) return;

  const telefone = jidToPhone(remoteJid);
  const fromMe = !!key.fromMe;
  const pushName: string | undefined = data?.pushName;

  const { tipo, conteudo, mimetype, fileName } = extractContent(data?.message ?? {});

  // upsert conversa
  const conv = await upsertConversa({
    instanceId: instance.id,
    telefone,
    nomeContato: !fromMe ? pushName : undefined,
    ultimaMensagem: conteudo ?? `📎 ${fileName ?? tipo}`,
    incrementaNaoLidas: !fromMe,
    marcarRecebida: !fromMe,
  });

  let arquivoUrl: string | null = null;
  // mídia → baixar via Evolution e salvar no storage
  if (["image", "video", "audio", "document", "sticker"].includes(tipo)) {
    try {
      const media = await evo<any>("POST", `/chat/getBase64FromMediaMessage/${encodeURIComponent(instance.nome)}`, {
        message: { key: { id: evolutionId } },
        convertToMp4: false,
      }, instance.evolution_apikey);
      if (media?.base64) {
        arquivoUrl = await saveMediaBase64({
          instanceName: instance.nome,
          evolutionId,
          base64: media.base64,
          mimetype: media.mimetype ?? mimetype ?? "application/octet-stream",
          fileName: media.fileName ?? fileName,
        });
      }
    } catch (e) {
      console.error("[evolution-webhook] erro baixando mídia", e);
    }
  }

  await sb.from("mensagem_whatsapp").insert({
    instance_id: instance.id,
    conversa_id: conv.id,
    telefone,
    direcao: fromMe ? "enviada" : "recebida",
    tipo,
    conteudo,
    arquivo_url: arquivoUrl,
    arquivo_nome: fileName ?? null,
    mime_type: mimetype ?? null,
    evolution_id: evolutionId,
    status: fromMe ? "enviada" : "recebida",
  });
}

async function handleMessageStatus(data: any) {
  const id = data?.key?.id ?? data?.id;
  const status = data?.status ?? data?.update?.status;
  if (!id || !status) return;
  const map: Record<string, string> = { READ: "lida", DELIVERY_ACK: "entregue", PLAYED: "lida", SERVER_ACK: "enviada", ERROR: "erro" };
  const novo = map[status] ?? null;
  if (!novo) return;
  await sb.from("mensagem_whatsapp").update({ status: novo, lida_em: novo === "lida" ? new Date().toISOString() : undefined }).eq("evolution_id", id);
}

async function handleReaction(instance: any, data: any) {
  const targetId = data?.key?.id;
  const emoji = data?.reaction?.text ?? data?.text ?? "";
  const remoteJid = data?.key?.remoteJid ?? "";
  if (!targetId || !remoteJid) return;
  const telefone = jidToPhone(remoteJid);
  const conv = await upsertConversa({ instanceId: instance.id, telefone });
  await sb.from("mensagem_whatsapp").insert({
    instance_id: instance.id,
    conversa_id: conv.id,
    telefone,
    direcao: data?.key?.fromMe ? "enviada" : "recebida",
    tipo: "reaction",
    reaction: emoji,
    reaction_to: targetId,
    status: "recebida",
  });
}

async function handlePresence(instanceId: string, data: any) {
  const jid = data?.id ?? "";
  const telefone = jidToPhone(jid);
  if (!telefone) return;
  const presences = data?.presences?.[jid] ?? data?.presences?.[Object.keys(data?.presences ?? {})[0]];
  const p = presences?.lastKnownPresence;
  if (p === "composing" || p === "recording") {
    const ate = new Date(Date.now() + 8000).toISOString();
    await sb.from("wa_conversa")
      .update({ contato_digitando_ate: ate })
      .eq("instance_id", instanceId)
      .eq("telefone", telefone);
  } else {
    await sb.from("wa_conversa")
      .update({ contato_digitando_ate: null })
      .eq("instance_id", instanceId)
      .eq("telefone", telefone);
  }
}

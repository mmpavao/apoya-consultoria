/**
 * Helpers compartilhados (server-only) para o módulo WhatsApp.
 */
import { sb } from "./sb.server";

export const INSTANCE_NAME_RE = /^[a-z0-9_-]{3,40}$/;

export function slugifyInstanceName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** "5511999990000@s.whatsapp.net" → "5511999990000" */
export function jidToPhone(jid: string): string {
  return jid.split("@")[0]?.replace(/\D/g, "") ?? "";
}

export function phoneToJid(phone: string): string {
  const num = phone.replace(/\D/g, "");
  return `${num}@s.whatsapp.net`;
}

/** Upsert (ou cria) conversa por (instance_id, telefone). Devolve a conversa atual. */
export async function upsertConversa(params: {
  instanceId: string;
  telefone: string;
  nomeContato?: string | null;
  ultimaMensagem?: string | null;
  incrementaNaoLidas?: boolean;
  marcarRecebida?: boolean;
}) {
  const { instanceId, telefone, nomeContato, ultimaMensagem, incrementaNaoLidas, marcarRecebida } = params;

  // tenta achar
  const existing = await sb
    .from("wa_conversa")
    .select("*")
    .eq("instance_id", instanceId)
    .eq("telefone", telefone)
    .maybeSingle();

  if (existing.data) {
    const patch: Record<string, unknown> = {};
    if (nomeContato && !existing.data.nome_contato) patch.nome_contato = nomeContato;
    if (ultimaMensagem !== undefined) {
      patch.ultima_mensagem = ultimaMensagem;
      patch.ultima_em = new Date().toISOString();
    }
    if (incrementaNaoLidas) patch.nao_lidas = (existing.data.nao_lidas ?? 0) + 1;
    if (Object.keys(patch).length) {
      const upd = await sb.from("wa_conversa").update(patch).eq("id", existing.data.id).select("*").single();
      return upd.data ?? existing.data;
    }
    return existing.data;
  }

  const ins = await sb
    .from("wa_conversa")
    .insert({
      instance_id: instanceId,
      telefone,
      nome_contato: nomeContato ?? null,
      ultima_mensagem: ultimaMensagem ?? null,
      ultima_em: ultimaMensagem ? new Date().toISOString() : null,
      nao_lidas: incrementaNaoLidas && marcarRecebida ? 1 : 0,
    })
    .select("*")
    .single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data!;
}

/** Salva mídia base64 no bucket whatsapp-media. */
export async function saveMediaBase64(args: {
  instanceName: string;
  evolutionId: string;
  base64: string;
  mimetype: string;
  fileName?: string | null;
}): Promise<string> {
  const ext = guessExt(args.mimetype, args.fileName);
  const path = `${args.instanceName}/${args.evolutionId}.${ext}`;
  const bytes = Uint8Array.from(atob(args.base64), c => c.charCodeAt(0));
  const up = await sb.storage.from("whatsapp-media").upload(path, bytes, {
    contentType: args.mimetype,
    upsert: true,
  });
  if (up.error) throw new Error(up.error.message);
  const pub = sb.storage.from("whatsapp-media").getPublicUrl(path);
  return pub.data.publicUrl;
}

function guessExt(mime: string, name?: string | null): string {
  if (name && name.includes(".")) return name.split(".").pop()!;
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}

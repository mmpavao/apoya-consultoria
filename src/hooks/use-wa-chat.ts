import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listConversas, getMensagens, sendText, sendMedia, sendAudio,
  assumeConversa, liberarConversa, marcarLida, sendPresence, sendReaction, startConversa,
} from "@/lib/whatsapp/message.functions";

export interface WaConversa {
  id: string;
  instance_id: string;
  cliente_id: string | null;
  telefone: string;
  nome_contato: string | null;
  avatar_url: string | null;
  ultima_mensagem: string | null;
  ultima_em: string | null;
  nao_lidas: number;
  assigned_to: string | null;
  assigned_at: string | null;
  departamento: string | null;
  contato_digitando_ate: string | null;
}

export interface WaMensagem {
  id: string;
  conversa_id: string;
  direcao: "recebida" | "enviada";
  tipo: string;
  conteudo: string | null;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  mime_type: string | null;
  evolution_id: string | null;
  agente_nome: string | null;
  departamento: string | null;
  reply_to: string | null;
  reaction: string | null;
  reaction_to: string | null;
  status: string;
  created_at: string;
  lida_em: string | null;
}

export function useWaConversas(instanceId?: string) {
  const [conversas, setConversas] = useState<WaConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const fn = useServerFn(listConversas);

  const reload = useCallback(async () => {
    const r = await fn({ data: instanceId ? { instanceId } : {} });
    setConversas(r.conversas as WaConversa[]);
    setLoading(false);
  }, [fn, instanceId]);

  useEffect(() => {
    reload();
    const ch = supabase
      .channel(`wa_conversa:${instanceId ?? "all"}:${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wa_conversa" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload, instanceId]);

  return { conversas, loading, reload };
}

export function useWaMensagens(conversaId: string | null) {
  const [mensagens, setMensagens] = useState<WaMensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(getMensagens);

  const reload = useCallback(async () => {
    if (!conversaId) { setMensagens([]); return; }
    setLoading(true);
    try {
      const r = await fn({ data: { conversaId, limit: 200 } });
      setMensagens(r.mensagens as WaMensagem[]);
    } finally { setLoading(false); }
  }, [fn, conversaId]);

  useEffect(() => {
    reload();
    if (!conversaId) return;
    const ch = supabase
      .channel(`mensagem_whatsapp:${conversaId}:${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagem_whatsapp", filter: `conversa_id=eq.${conversaId}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [reload, conversaId]);

  return { mensagens, loading, reload, setMensagens };
}

export function useWaActions() {
  const fnText = useServerFn(sendText);
  const fnMedia = useServerFn(sendMedia);
  const fnAudio = useServerFn(sendAudio);
  const fnAssume = useServerFn(assumeConversa);
  const fnLiberar = useServerFn(liberarConversa);
  const fnLida = useServerFn(marcarLida);
  const fnPres = useServerFn(sendPresence);
  const fnReact = useServerFn(sendReaction);
  const fnStart = useServerFn(startConversa);

  // throttle do composing
  const lastPresence = useRef(0);
  const sinalizarDigitando = useCallback(async (conversaId: string) => {
    const now = Date.now();
    if (now - lastPresence.current < 4000) return;
    lastPresence.current = now;
    try { await fnPres({ data: { conversaId, presence: "composing" } }); } catch { /* ignore */ }
  }, [fnPres]);

  return {
    enviarTexto: (conversaId: string, texto: string, replyTo?: string) =>
      fnText({ data: { conversaId, texto, replyTo } }),
    enviarMidia: (params: { conversaId: string; mediatype: "image" | "video" | "document"; mimetype: string; media: string; fileName?: string; caption?: string; replyTo?: string }) =>
      fnMedia({ data: params }),
    enviarAudio: (conversaId: string, audio: string) =>
      fnAudio({ data: { conversaId, audio } }),
    assumir: (conversaId: string, departamento: string) =>
      fnAssume({ data: { conversaId, departamento } }),
    liberar: (conversaId: string) => fnLiberar({ data: { conversaId } }),
    marcarLida: (conversaId: string) => fnLida({ data: { conversaId } }),
    reagir: (conversaId: string, messageId: string, emoji: string, fromMe = false) =>
      fnReact({ data: { conversaId, messageId, emoji, fromMe } }),
    iniciar: (params: { instanceId: string; telefone: string; clienteId?: string; nomeContato?: string }) =>
      fnStart({ data: params }),
    sinalizarDigitando,
  };
}

export function useDigitandoLive(ate: string | null): boolean {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => !!ate && new Date(ate).getTime() > now, [ate, now]);
}

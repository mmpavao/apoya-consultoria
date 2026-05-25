/**
 * use-whatsapp — hook de mensagens WhatsApp
 * ATUALIZADO: envio real via /api/wa/send (Evolution API)
 *             fallback para enfileiramento se API falhar
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export type MsgStatus = "enviada" | "entregue" | "lida" | "erro" | "pendente";
export type MsgDirecao = "enviada" | "recebida";

export interface MensagemWA {
  id: string;
  cliente_id: string | null;
  telefone: string;
  direcao: MsgDirecao;
  tipo: string;
  conteudo: string;
  status: MsgStatus;
  created_at: string;
  evolution_id?: string | null;
}

/* ─── Normalizar registro do banco ───────────────────────────────────────── */
function toMensagem(r: any): MensagemWA {
  return {
    id:         r.id,
    cliente_id: r.cliente_id ?? null,
    telefone:   r.telefone ?? "",
    direcao:    (r.direcao as MsgDirecao) ?? "enviada",
    tipo:       r.tipo ?? "texto",
    conteudo:   r.conteudo ?? "",
    status:     (r.status as MsgStatus) ?? "pendente",
    created_at: r.created_at ?? r.criado_em ?? new Date().toISOString(),
    evolution_id: r.evolution_id ?? null,
  };
}

/* ─── Hook principal ─────────────────────────────────────────────────────── */
export function useWhatsapp(clienteId?: string) {
  const { session } = useAuth();
  const [mensagens, setMensagens] = useState<MensagemWA[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Buscar mensagens ───────────────────────────────────────────────────
  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = supabase as any;
      let q = db.from("mensagem_whatsapp").select("*").order("created_at", { ascending: false }).limit(100);
      if (clienteId) q = q.eq("cliente_id", clienteId);
      const { data, error: e } = await q;
      if (e) throw e;
      setMensagens((data ?? []).map(toMensagem));
    } catch (e: any) {
      setError(e.message ?? "Erro ao buscar mensagens");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { fetch(); }, [fetch]);

  // ── Enviar mensagem (REAL via Evolution API) ───────────────────────────
  const enviar = useCallback(async (
    telefone: string,
    mensagem: string,
    opts?: {
      cliente_id?: string;
      instance_id?: string;
      tipo?: string;
    }
  ): Promise<{ ok: boolean; mensagem_id?: string; error?: string }> => {
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return { ok: false, error: "Sem sessão" };
    }

    try {
      const res = await globalThis.fetch("/api/wa/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          telefone,
          mensagem,
          cliente_id: opts?.cliente_id ?? clienteId ?? null,
          instance_id: opts?.instance_id,
          tipo: opts?.tipo ?? "text",
        }),
      });

      const data = await res.json() as any;

      if (!res.ok || !data.ok) {
        const msg = data.error ?? "Falha ao enviar mensagem";
        toast.error(msg);
        // Recarregar para ver mensagem registrada com status=erro
        await fetch();
        return { ok: false, error: msg, mensagem_id: data.mensagem_id };
      }

      toast.success(`Mensagem enviada via ${data.instancia ?? "WhatsApp"}`);
      await fetch();
      return { ok: true, mensagem_id: data.mensagem_id };

    } catch (e: any) {
      toast.error("Erro de rede ao enviar mensagem");
      return { ok: false, error: e.message };
    }
  }, [session, clienteId, fetch]);

  // ── Alias legado (enfileirar) — mantido para compatibilidade ──────────
  const enfileirar = useCallback(async (
    telefone: string,
    mensagem: string,
    opts?: { cliente_id?: string; instance_id?: string }
  ) => {
    return enviar(telefone, mensagem, opts);
  }, [enviar]);

  return { mensagens, loading, error, refresh: fetch, enviar, enfileirar };
}

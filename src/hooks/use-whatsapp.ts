/**
 * Hook: useWhatsapp
 * Lê histórico de mensagens da tabela mensagem_whatsapp no Supabase.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MsgStatus = "enviada" | "entregue" | "lida" | "erro" | "pendente";
export type MsgTipo   = "text" | "template" | "media" | "audio" | "document";
export type MsgDirecao = "enviada" | "recebida";

export interface MensagemWA {
  id: string;
  clienteId: string;
  telefone: string;
  direcao: MsgDirecao;
  tipo: MsgTipo;
  conteudo: string;
  arquivoUrl?: string;
  status: MsgStatus;
  ehAutomatica: boolean;
  lidaEm?: string;
  createdAt: string;
}

function fromDb(r: Record<string, unknown>): MensagemWA {
  return {
    id:           r.id as string,
    clienteId:    r.cliente_id as string,
    telefone:     (r.telefone as string) ?? "—",
    direcao:      (r.direcao as MsgDirecao) ?? "enviada",
    tipo:         (r.tipo as MsgTipo)      ?? "text",
    conteudo:     (r.conteudo as string)   ?? "",
    arquivoUrl:   r.arquivo_url as string | undefined,
    status:       (r.status as MsgStatus)  ?? "pendente",
    ehAutomatica: Boolean(r.eh_automatica),
    lidaEm:       r.lida_em as string | undefined,
    createdAt:    r.created_at as string,
  };
}

export function useWhatsapp() {
  const [mensagens, setMensagens] = useState<MensagemWA[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error: err } = await db
        .from("mensagem_whatsapp")
        .select(`
          id, cliente_id, telefone, direcao, tipo, conteudo,
          arquivo_url, status, eh_automatica, lida_em, created_at
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (err) throw err;
      setMensagens((data ?? []).map(fromDb));
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar mensagens";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const enfileirar = useCallback(async (
    clienteId: string,
    telefone: string,
    conteudo: string,
    tipo: MsgTipo = "text"
  ) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { error: err } = await db
        .from("mensagem_whatsapp")
        .insert({
          cliente_id: clienteId,
          telefone,
          tipo,
          conteudo,
          direcao: "enviada",
          status: "pendente",
          eh_automatica: false,
        });
      if (err) throw err;
      toast.success("Mensagem enfileirada para envio");
      await fetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enfileirar mensagem");
    }
  }, [fetch]);

  return { mensagens, loading, error, refresh: fetch, enfileirar };
}

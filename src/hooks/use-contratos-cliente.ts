/**
 * use-contratos-cliente — hook completo com Clicksign
 * Gerencia contratos por cliente + integração Clicksign API v3
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Tipos ──────────────────────────────────────────────────────
export type ContratoStatus =
  | "rascunho"
  | "aguardando_assinatura"
  | "assinado"
  | "cancelado"
  | "expirado"
  | "recusado";

export type CanalNotificacao = "email" | "whatsapp" | "both";

export interface ContratoCliente {
  id:                   string;
  cliente_id:           string;
  numero:               string;
  titulo:               string;
  tipo:                 string;
  status:               ContratoStatus;
  valor_total:          number;
  data_inicio:          string;
  data_fim?:            string;
  corpo_html?:          string;
  clausulas:            unknown[];
  servicos_ids:         string[];
  // Clicksign
  clicksign_key?:        string;
  clicksign_envelope_id?: string;
  clicksign_document_id?: string;
  clicksign_signer_id?:  string;
  clicksign_status?:     string;
  clicksign_url?:        string;
  clicksign_sign_url?:   string;
  clicksign_signed_pdf?: string;
  clicksign_events:      ClicksignEvento[];
  // Signatário
  signatario_nome?:     string;
  signatario_email?:    string;
  signatario_whatsapp?: string;
  notificacao_canal:    CanalNotificacao;
  deadline_days:        number;
  // Datas
  enviado_em?:          string;
  assinado_em?:         string;
  cancelado_em?:        string;
  observacoes?:         string;
  created_at:           string;
  updated_at:           string;
}

export interface ClicksignEvento {
  timestamp:   string;
  event:       string;
  canal?:      string;
  signatario?: string;
  envelope_id?: string;
}

export interface NovoContratoPayload {
  titulo:           string;
  tipo:             string;
  valor_total:      number;
  data_inicio:      string;
  data_fim?:        string;
  corpo_html?:      string;
  clausulas?:       unknown[];
  servicos_ids?:    string[];
  signatario_nome?:    string;
  signatario_email?:   string;
  signatario_whatsapp?: string;
  notificacao_canal?: CanalNotificacao;
  deadline_days?:   number;
  observacoes?:     string;
}

const SUPABASE_EF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SUPABASE_ANON   = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── Status helpers ─────────────────────────────────────────────
export const STATUS_LABEL: Record<ContratoStatus, string> = {
  rascunho:              "Rascunho",
  aguardando_assinatura: "Aguardando assinatura",
  assinado:              "Assinado",
  cancelado:             "Cancelado",
  expirado:              "Expirado",
  recusado:              "Recusado",
};

export const STATUS_TONE: Record<ContratoStatus, "neutral" | "warning" | "success" | "danger"> = {
  rascunho:              "neutral",
  aguardando_assinatura: "warning",
  assinado:              "success",
  cancelado:             "danger",
  expirado:              "danger",
  recusado:              "danger",
};

// ── Hook ───────────────────────────────────────────────────────
export function useContratosCliente(clienteId: string) {
  const [contratos,  setContratos]  = useState<ContratoCliente[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────
  const fetch = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("contrato_cliente")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) console.error("useContratosCliente:", error);
    else setContratos((data as ContratoCliente[]) || []);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!clienteId) return;
    const channel = supabase
      .channel(`contratos_${clienteId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "contrato_cliente",
        filter: `cliente_id=eq.${clienteId}`,
      }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clienteId, fetch]);

  // ── CRUD básico ────────────────────────────────────────────
  const criar = useCallback(async (clienteId: string, dados: NovoContratoPayload) => {
    const { data, error } = await supabase
      .from("contrato_cliente")
      .insert({ cliente_id: clienteId, ...dados })
      .select()
      .single();
    if (error) { toast.error("Erro ao criar contrato"); throw error; }
    toast.success("Contrato criado");
    await fetch();
    return data as ContratoCliente;
  }, [fetch]);

  const atualizar = useCallback(async (id: string, dados: Partial<ContratoCliente>) => {
    const { error } = await supabase
      .from("contrato_cliente")
      .update(dados)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar contrato"); throw error; }
    toast.success("Contrato atualizado");
    await fetch();
  }, [fetch]);

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("contrato_cliente")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Erro ao excluir contrato"); throw error; }
    toast.success("Contrato excluído");
    await fetch();
  }, [fetch]);

  // ── Clicksign: Enviar para assinatura ────────────────────
  const enviarParaAssinatura = useCallback(async (contratoId: string) => {
    setActionLoading(contratoId);
    try {
      const res = await globalThis.fetch(`${SUPABASE_EF_URL}/clicksign-envelope`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ contrato_id: contratoId }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || "Erro no envio");
      toast.success("Contrato enviado para assinatura!");
      await fetch();
      return result as { envelope_id: string; sign_url: string; message: string };
    } catch (err) {
      toast.error(`Erro ao enviar: ${err}`);
      throw err;
    } finally {
      setActionLoading(null);
    }
  }, [fetch]);

  // ── Clicksign: Reenviar notificação ──────────────────────
  const reenviarNotificacao = useCallback(async (contratoId: string) => {
    setActionLoading(contratoId + "_resend");
    try {
      const res = await globalThis.fetch(`${SUPABASE_EF_URL}/clicksign-envelope`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ contrato_id: contratoId, action: "resend" }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || "Erro ao reenviar");
      toast.success("Notificação reenviada!");
      return result;
    } catch (err) {
      toast.error(`Erro ao reenviar: ${err}`);
      throw err;
    } finally {
      setActionLoading(null);
    }
  }, []);

  // ── Clicksign: Cancelar envelope ─────────────────────────
  const cancelarEnvelope = useCallback(async (contratoId: string) => {
    setActionLoading(contratoId + "_cancel");
    try {
      const res = await globalThis.fetch(`${SUPABASE_EF_URL}/clicksign-envelope`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ contrato_id: contratoId, action: "cancel" }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || "Erro ao cancelar");
      toast.success("Envelope cancelado no Clicksign");
      await fetch();
      return result;
    } catch (err) {
      toast.error(`Erro ao cancelar: ${err}`);
      throw err;
    } finally {
      setActionLoading(null);
    }
  }, [fetch]);

  return {
    contratos, loading, actionLoading, refetch: fetch,
    criar, atualizar, excluir,
    enviarParaAssinatura, reenviarNotificacao, cancelarEnvelope,
  };
}

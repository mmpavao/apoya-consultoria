/**
 * use-contratos-cliente — contratos por cliente (CRUD manual)
 * Status de assinatura é definido manualmente pelo operador.
 * Campos clicksign_* permanecem inertes no banco até a API voltar.
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
  data_inicio:          Date;          // ✅ Agora é Date
  data_fim?:            Date;          // ✅ Agora é Date
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
  enviado_em?:          Date;         // ✅ Agora é Date
  assinado_em?:         Date;         // ✅ Agora é Date
  cancelado_em?:        Date;         // ✅ Agora é Date
  observacoes?:         string;
  created_at:           Date;         // ✅ Agora é Date
  updated_at:           Date;         // ✅ Agora é Date
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
  data_inicio:      string | Date;
  data_fim?:        string | Date;
  corpo_html?:      string;
  clausulas?:       unknown[];
  servicos_ids?:    string[];
  signatario_nome?:    string;
  signatario_email?:   string;
  signatario_whatsapp?: string;
  notificacao_canal?: CanalNotificacao;
  deadline_days?:   number;
  observacoes?:     string;
  emissao_nf?:      "automatica" | "manual";
}

// ── Helpers de data ────────────────────────────────────────────
/**
 * Normalizar data string ou Date para Date objeto
 * @param data string (ISO, YYYY-MM-DD, ou timestamp) ou Date
 * @returns Date ou null se inválida
 */
function normalizarData(data: string | Date | null | undefined): Date | null {
  if (!data) return null;
  
  try {
    if (data instanceof Date) return data;
    
    // String ISO ou YYYY-MM-DD
    const parsed = new Date(data);
    if (isNaN(parsed.getTime())) {
      console.warn(`[useContratosCliente] Data inválida: ${data}`);
      return null;
    }
    return parsed;
  } catch (e) {
    console.error(`[useContratosCliente/normalizarData] Error:`, e);
    return null;
  }
}

/**
 * Mapear row do Supabase para ContratoCliente com datas parseadas
 */
function mapContratoFromDb(row: any): ContratoCliente {
  return {
    id: row.id,
    cliente_id: row.cliente_id,
    numero: row.numero,
    titulo: row.titulo,
    tipo: row.tipo,
    status: row.status,
    valor_total: row.valor_total ?? 0,
    data_inicio: normalizarData(row.data_inicio) || new Date(),
    data_fim: normalizarData(row.data_fim) ?? undefined,
    corpo_html: row.corpo_html,
    clausulas: row.clausulas ?? [],
    servicos_ids: row.servicos_ids ?? [],
    clicksign_key: row.clicksign_key,
    clicksign_envelope_id: row.clicksign_envelope_id,
    clicksign_document_id: row.clicksign_document_id,
    clicksign_signer_id: row.clicksign_signer_id,
    clicksign_status: row.clicksign_status,
    clicksign_url: row.clicksign_url,
    clicksign_sign_url: row.clicksign_sign_url,
    clicksign_signed_pdf: row.clicksign_signed_pdf,
    clicksign_events: row.clicksign_events ?? [],
    signatario_nome: row.signatario_nome,
    signatario_email: row.signatario_email,
    signatario_whatsapp: row.signatario_whatsapp,
    notificacao_canal: row.notificacao_canal ?? "email",
    deadline_days: row.deadline_days ?? 5,
    enviado_em: normalizarData(row.enviado_em) ?? undefined,
    assinado_em: normalizarData(row.assinado_em) ?? undefined,
    cancelado_em: normalizarData(row.cancelado_em) ?? undefined,
    observacoes: row.observacoes,
    created_at: normalizarData(row.created_at) || new Date(),
    updated_at: normalizarData(row.updated_at) || new Date(),
  };
}

/**
 * Formatar data para exibição (ex: "02 de mai, 2026")
 */
export function formatarData(data: Date | null | undefined, formato: "curto" | "longo" = "curto"): string {
  if (!data || !(data instanceof Date) || isNaN(data.getTime())) return "—";
  
  const opts: Intl.DateTimeFormatOptions = 
    formato === "curto" 
      ? { day: "2-digit", month: "short", year: "numeric" }
      : { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" };
  
  return data.toLocaleDateString("pt-BR", opts);
}

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
    try {
      const { data, error } = await supabase
        .from("contrato_cliente")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("[useContratosCliente/fetch] Supabase error:", error);
        return;
      }
      
      // ✅ Mapear com parseamento de datas
      const mapped = (data || []).map(mapContratoFromDb);
      setContratos(mapped);
    } catch (e) {
      console.error("[useContratosCliente/fetch] catch error:", e);
    } finally {
      setLoading(false);
    }
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
    try {
      const dataInicio = dados.data_inicio instanceof Date 
        ? dados.data_inicio.toISOString().split('T')[0]
        : (dados.data_inicio as string | undefined);
      const dataFim = dados.data_fim instanceof Date
        ? dados.data_fim.toISOString().split('T')[0]
        : (dados.data_fim as string | undefined);

      const payload = {
        cliente_id: clienteId,
        titulo: dados.titulo,
        tipo: dados.tipo,
        valor_total: dados.valor_total,
        data_inicio: dataInicio,
        data_fim: dataFim ?? null,
        corpo_html: dados.corpo_html ?? null,
        clausulas: (dados.clausulas ?? []) as any,
        servicos_ids: dados.servicos_ids ?? [],
        signatario_nome: dados.signatario_nome ?? null,
        signatario_email: dados.signatario_email ?? null,
        signatario_whatsapp: dados.signatario_whatsapp ?? null,
        notificacao_canal: dados.notificacao_canal ?? "email",
        deadline_days: dados.deadline_days ?? 5,
        observacoes: dados.observacoes ?? null,
        emissao_nf: dados.emissao_nf ?? "automatica",
        status: "rascunho",
      };
      
      const { data, error } = await supabase
        .from("contrato_cliente")
        .insert(payload as any)
        .select()
        .single();
      
      if (error) {
        console.error("[useContratosCliente/criar] Supabase error:", error);
        toast.error("Erro ao criar contrato");
        throw error;
      }
      
      toast.success("Contrato criado");
      await fetch();
      return mapContratoFromDb(data);
    } catch (e) {
      console.error("[useContratosCliente/criar] catch error:", e);
      throw e;
    }
  }, [fetch]);

  const atualizar = useCallback(async (id: string, dados: Partial<ContratoCliente>) => {
    try {
      // Converter Date para ISO string
      const payload = { ...dados };
      if (dados.data_inicio instanceof Date) {
        payload.data_inicio = dados.data_inicio.toISOString().split('T')[0] as any;
      }
      if (dados.data_fim instanceof Date) {
        payload.data_fim = dados.data_fim.toISOString().split('T')[0] as any;
      }
      
      const { error } = await (supabase
        .from("contrato_cliente") as any)
        .update(payload)
        .eq("id", id);
      
      if (error) {
        console.error("[useContratosCliente/atualizar] Supabase error:", error);
        toast.error("Erro ao atualizar contrato");
        throw error;
      }
      
      toast.success("Contrato atualizado");
      await fetch();
    } catch (e) {
      console.error("[useContratosCliente/atualizar] catch error:", e);
      throw e;
    }
  }, [fetch]);

  const excluir = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("contrato_cliente")
        .delete()
        .eq("id", id);
      
      if (error) {
        console.error("[useContratosCliente/excluir] Supabase error:", error);
        toast.error("Erro ao excluir contrato");
        throw error;
      }
      
      toast.success("Contrato excluído");
      await fetch();
    } catch (e) {
      console.error("[useContratosCliente/excluir] catch error:", e);
      throw e;
    }
  }, [fetch]);

  // ── Clicksign: Enviar para assinatura ────────────────────
  // Assinatura MANUAL (sem Clicksign): o operador atualiza o status do contrato.
  // A assinatura em si é feita fora do sistema (e-mail/papel/portal próprio).
  async function setStatusManual(contratoId: string, status: string, msg: string) {
    setActionLoading(contratoId);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await (supabase as any).from("contrato_cliente")
        .update({ status }).eq("id", contratoId);
      if (error) throw error;
      toast.success(msg);
      await fetch();
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : err}`);
      throw err;
    } finally {
      setActionLoading(null);
    }
  }

  const enviarParaAssinatura = useCallback(
    (contratoId: string) => setStatusManual(contratoId, "aguardando_assinatura", "Contrato marcado como enviado para assinatura"),
    [fetch]
  );
  const reenviarNotificacao = useCallback(async (contratoId: string) => {
    toast.info("Reenvie a cobrança de assinatura ao cliente pelo seu canal (e-mail/WhatsApp).");
    void contratoId;
  }, []);
  const cancelarEnvelope = useCallback(
    (contratoId: string) => setStatusManual(contratoId, "cancelado", "Contrato cancelado"),
    [fetch]
  );

  return {
    contratos, loading, actionLoading, refetch: fetch,
    criar, atualizar, excluir,
    enviarParaAssinatura, reenviarNotificacao, cancelarEnvelope,
  };
}

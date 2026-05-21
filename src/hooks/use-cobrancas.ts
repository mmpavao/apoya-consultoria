/**
 * Hook: useCobrancas
 * Substitui financeiro-store.ts pelo Supabase real.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type CobrancaStatus = "pendente" | "paga" | "vencida" | "cancelada";
export type FormaPagamento  = "PIX" | "BOLETO" | "DEBITO";
export type ReguaStage      = "ok" | "lembrete" | "cobranca" | "negativacao" | "suspensao";

export interface Cobranca {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  descricao: string;
  valor: number;
  forma: FormaPagamento;
  vencimento: string;    // YYYY-MM-DD
  competencia: string;   // YYYY-MM
  status: CobrancaStatus;
  pagoEm?: string;
  asaasId?: string;
  linkPagamento?: string;
  pixCopiaCola?: string;
  boletoUrl?: string;
  reguaStage: ReguaStage;
  ultimoEnvioWhatsapp?: string;
  diasAtraso: number;
}

function fromDb(r: Record<string, unknown>): Cobranca {
  return {
    id:                  r.id as string,
    clienteId:           r.cliente_id as string,
    clienteNome:         r.cliente_nome as string,
    cnpj:                r.cnpj as string,
    descricao:           r.descricao as string,
    valor:               Number(r.valor),
    forma:               (r.forma as string) as FormaPagamento,
    vencimento:          r.vencimento as string,
    competencia:         r.competencia as string,
    status:              r.status as CobrancaStatus,
    pagoEm:              r.pago_em as string | undefined,
    asaasId:             r.asaas_id as string | undefined,
    linkPagamento:       r.link_pagamento as string | undefined,
    pixCopiaCola:        r.pix_copia_cola as string | undefined,
    boletoUrl:           r.boleto_url as string | undefined,
    reguaStage:          (r.regua_stage as string ?? "ok") as ReguaStage,
    ultimoEnvioWhatsapp: r.ultimo_envio_whatsapp as string | undefined,
    diasAtraso:          Number(r.dias_atraso ?? 0),
  };
}

export function useCobrancas(competencia?: string) {
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      let q = supabase.from("cobrancas").select("*").order("vencimento");
      if (competencia) q = q.eq("competencia", competencia);
      const { data, error: err } = await q;
      if (err) throw err;
      setCobrancas((data ?? []).map(fromDb));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar cobranças");
    } finally {
      setLoading(false);
    }
  }, [competencia]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const ch = supabase
      .channel("apoya-cobrancas-static")
      .on("postgres_changes", { event: "*", schema: "public", table: "cobrancas" }, () => {
        window.dispatchEvent(new Event("apoya:cobrancas:changed"));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCobranca = useCallback(async (id: string, patch: Partial<{
    asaasId: string; linkPagamento: string; ultimoEnvioWhatsapp: string; status: CobrancaStatus;
  }>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.asaasId             !== undefined) dbPatch.asaas_id              = patch.asaasId;
    if (patch.linkPagamento       !== undefined) dbPatch.link_pagamento        = patch.linkPagamento;
    if (patch.ultimoEnvioWhatsapp !== undefined) dbPatch.ultimo_envio_whatsapp = patch.ultimoEnvioWhatsapp;
    if (patch.status              !== undefined) dbPatch.status                = patch.status;

    const { error: err } = await supabase.from("cobrancas").update(dbPatch as any).eq("id", id);
    if (err) toast.error("Erro ao atualizar cobrança: " + err.message);
  }, []);

  const kpi = {
    total:   cobrancas.reduce((s, c) => s + c.valor, 0),
    pago:    cobrancas.filter((c) => c.status === "paga").reduce((s, c) => s + c.valor, 0),
    vencido: cobrancas.filter((c) => c.status === "vencida").reduce((s, c) => s + c.valor, 0),
    inad:    cobrancas.filter((c) => c.reguaStage === "suspensao" || c.reguaStage === "negativacao").length,
    count:   cobrancas.length,
  };

  return { cobrancas, loading, error, refetch: fetch, updateCobranca, kpi };
}

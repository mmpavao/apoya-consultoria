/**
 * Hook: useDas
 * Lê guias DAS/DASMEI da tabela das_guias no Supabase.
 * Geração real: via Edge Function SERPRO (nunca no front).
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DasStatus = "pendente" | "gerada" | "enviada" | "paga" | "vencida" | "erro" | "cancelada";
export type DasTipo   = "DAS" | "DASMEI";

export interface DasGuia {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  regime: string;
  tipo: DasTipo;
  competencia: string;
  vencimento: string;
  valor: number;
  status: DasStatus;
  codigoBarras?: string;
  pdfUrl?: string;
  pagoEm?: string;
  enviadoWaEm?: string;
  erroMsg?: string;
  createdAt: string;
}

function fromDb(r: Record<string, unknown>): DasGuia {
  return {
    id:           r.id as string,
    clienteId:    r.cliente_id as string,
    clienteNome:  (r.cliente_nome as string) ?? "—",
    cnpj:         (r.cnpj as string)         ?? "—",
    regime:       (r.regime as string)       ?? "—",
    tipo:         ((r.tipo as string) as DasTipo) ?? "DAS",
    competencia:  r.competencia as string,
    vencimento:   r.vencimento as string,
    valor:        Number(r.valor ?? 0),
    status:       ((r.status as string) as DasStatus) ?? "pendente",
    codigoBarras: r.codigo_barras as string | undefined,
    pdfUrl:       r.pdf_url as string | undefined,
    pagoEm:       r.pago_em as string | undefined,
    enviadoWaEm:  (r.enviado_wa_em ?? r.enviado_whatsapp_em) as string | undefined,
    erroMsg:      (r.ultimo_erro ?? r.erro) as string | undefined,
    createdAt:    r.created_at as string,
  };
}

export function useDas(filtros?: { competencia?: string; status?: DasStatus }) {
  const [guias, setGuias]     = useState<DasGuia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let q = db
        .from("das_guias")
        .select(`
          id, cliente_id, cliente_nome, cnpj, regime, tipo,
          competencia, vencimento, valor, status,
          codigo_barras, pdf_url, pago_em,
          enviado_wa_em, enviado_whatsapp_em,
          ultimo_erro, erro, created_at
        `)
        .order("vencimento", { ascending: false })
        .limit(500);

      if (filtros?.competencia) q = q.eq("competencia", filtros.competencia);
      if (filtros?.status)      q = q.eq("status", filtros.status);

      const { data, error: err } = await q;
      if (err) throw err;
      setGuias((data ?? []).map(fromDb));
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar guias DAS";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filtros?.competencia, filtros?.status]);

  useEffect(() => { fetch(); }, [fetch]);

  const marcarPaga = useCallback(async (id: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { error: err } = await db
        .from("das_guias")
        .update({ status: "paga", pago_em: new Date().toISOString() })
        .eq("id", id);
      if (err) throw err;
      toast.success("Guia marcada como paga");
      await fetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar guia");
    }
  }, [fetch]);

  return { guias, loading, error, refresh: fetch, marcarPaga };
}

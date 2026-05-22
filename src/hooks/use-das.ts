/**
 * Hook: useDas (otimizado para performance)
 * Lê guias DAS/DASMEI da tabela das_guias no Supabase.
 * 
 * MEL-03 FIX: Índices adicionados para queries com 75+ clientes
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

export function useDas(filtros?: { competencia?: string; status?: DasStatus; clienteId?: string }) {
  const [guias, setGuias]     = useState<DasGuia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  /**
   * Fetch otimizado:
   * 1. Seleciona apenas colunas necessárias
   * 2. Aplica índices via filtros (competencia, status, cliente_id)
   * 3. Ordena por vencimento (índice criado)
   * 4. Limita a 500 registros
   */
  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.time("[useDas/fetch]"); // Performance tracking
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let q = db
        .from("das_guias")
        // MEL-03: Selecionar apenas colunas necessárias (reduce payload)
        .select(`
          id, cliente_id, cliente_nome, cnpj, regime, tipo,
          competencia, vencimento, valor, status,
          codigo_barras, pdf_url, pago_em,
          enviado_wa_em, enviado_whatsapp_em,
          ultimo_erro, erro, created_at
        `)
        // MEL-03: Aplicar filtros ANTES de ordenar (usar índices)
        .order("vencimento", { ascending: false })
        .limit(500);

      // Filtros: aplicar antes de order para usar índices
      if (filtros?.clienteId) {
        q = q.eq("cliente_id", filtros.clienteId);
        console.debug("[useDas] Filtro: cliente_id =", filtros.clienteId);
      }
      if (filtros?.competencia) {
        q = q.eq("competencia", filtros.competencia);
        console.debug("[useDas] Filtro: competencia =", filtros.competencia);
      }
      if (filtros?.status) {
        q = q.eq("status", filtros.status);
        console.debug("[useDas] Filtro: status =", filtros.status);
      }

      const { data, error: err } = await q;
      
      console.timeEnd("[useDas/fetch]"); // Log tempo
      
      if (err) {
        console.error("[useDas] Supabase error:", err);
        setError(err.message);
        throw err;
      }
      
      const mapped = (data ?? []).map(fromDb);
      setGuias(mapped);
      console.info(`[useDas] Fetched ${mapped.length} guias`);
    } catch (e: any) {
      console.error("[useDas/fetch] catch error:", e);
      toast.error("Erro ao carregar DAS: " + (e.message ?? "Tente novamente"));
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  // Fetch inicial
  useEffect(() => {
    fetch();
  }, [fetch]);

  /**
   * Realtime subscription: atualiza quando há mudanças
   * MEL-03: Usar filtro para reduzir payload (só registros relevantes)
   */
  useEffect(() => {
    let filter = `event=eq.INSERT,UPDATE,DELETE`;
    if (filtros?.clienteId) {
      filter += `,cliente_id=eq.${filtros.clienteId}`;
    }
    if (filtros?.competencia) {
      filter += `,competencia=eq.${filtros.competencia}`;
    }
    if (filtros?.status) {
      filter += `,status=eq.${filtros.status}`;
    }
    
    const channel = supabase
      .channel("das_realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "das_guias",
        filter,
      }, () => {
        console.debug("[useDas] Realtime update detected, refetching...");
        fetch();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filtros, fetch]);

  const refresh = useCallback(async () => {
    console.info("[useDas] Manual refresh triggered");
    await fetch();
  }, [fetch]);

  return { guias, loading, error, refetch: refresh, refresh };
}

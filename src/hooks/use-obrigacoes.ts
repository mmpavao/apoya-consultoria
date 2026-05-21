/**
 * Hook: useObrigacoes
 * Substitui obrigacoes-store.ts pelo Supabase real.
 */
import { useEffect, useState, useCallback } from "react";
import { useRealtimeTable } from "@/lib/realtime-singleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ObrigacaoStatus = "pendente" | "concluida" | "atrasada" | "em_andamento";
export type ObrigacaoTipo   =
  | "DAS" | "DASN-Simei" | "DCTFWeb" | "EFD-Contribuições" | "EFD-ICMS/IPI"
  | "EFD-Reinf" | "ECF" | "ECD" | "DIRBI" | "DEFIS" | "NFSe" | "FGTS Digital" | "eSocial";

export interface Obrigacao {
  id: string;
  clienteId: string;
  clienteNome: string;
  regime: string;
  tipo: ObrigacaoTipo;
  descricao: string;
  competencia: string;
  vencimento: string;
  status: ObrigacaoStatus;
  valor?: number;
  responsavel: string;
  concluidaEm?: string;
}

function fromDb(r: Record<string, unknown>): Obrigacao {
  return {
    id:           r.id as string,
    clienteId:    r.cliente_id as string,
    clienteNome:  r.cliente_nome as string,
    regime:       r.regime as string,
    tipo:         r.tipo as ObrigacaoTipo,
    descricao:    r.descricao as string,
    competencia:  r.competencia as string,
    vencimento:   r.vencimento as string,
    status:       r.status as ObrigacaoStatus,
    valor:        r.valor ? Number(r.valor) : undefined,
    responsavel:  r.responsavel as string,
    concluidaEm:  r.concluida_em as string | undefined,
  };
}

export function useObrigacoes(competencia?: string) {
  const [obrigacoes, setObrigacoes] = useState<Obrigacao[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      let q = supabase.from("obrigacoes").select("*").order("vencimento");
      if (competencia) q = q.eq("competencia", competencia);
      const { data, error: err } = await q;
      if (err) throw err;
      setObrigacoes((data ?? []).map(fromDb));
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar obrigações");
    } finally {
      setLoading(false);
    }
  }, [competencia]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime via singleton centralizado (evita conflito de channels)
  useRealtimeTable("obrigacoes", fetch);
  const updateStatus = useCallback(async (id: string, status: ObrigacaoStatus) => {
    const patch: Record<string, unknown> = { status };
    if (status === "concluida") patch.concluida_em = new Date().toISOString();
    const { error: err } = await supabase.from("obrigacoes").update(patch as any).eq("id", id);
    if (err) { toast.error("Erro ao atualizar: " + err.message); return false; }
    return true;
  }, []);

  const counts = {
    total:     obrigacoes.length,
    pendente:  obrigacoes.filter((o) => o.status === "pendente").length,
    atrasada:  obrigacoes.filter((o) => o.status === "atrasada").length,
    concluida: obrigacoes.filter((o) => o.status === "concluida").length,
  };

  return { obrigacoes, loading, error, refetch: fetch, updateStatus, counts };
}

export function calcularMulta(valor: number, vencimento: string) {
  const venc = new Date(vencimento);
  const hoje = new Date();
  const dias = Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / 86400000));
  if (dias === 0 || valor <= 0) return { multa: 0, juros: 0, total: valor, dias: 0 };
  const pctMulta = Math.min(0.2, dias * 0.0033);
  const pctJuros = (dias / 30) * 0.01;
  const multa = valor * pctMulta;
  const juros = valor * pctJuros;
  return { multa, juros, total: valor + multa + juros, dias };
}

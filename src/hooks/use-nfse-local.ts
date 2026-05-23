/**
 * use-nfse-local — busca NFS-e emitidas/recebidas diretamente via Supabase client
 *
 * SUBSTITUI o fetch via /api/nfse para leitura de listas (GET).
 * Evita o problema de race condition com authLoading no hook use-nfse.
 * Para emissão (POST) ainda usa /api/nfse.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NfseEmitidaRow {
  id: string;
  cliente_id: string;
  numero?: string;
  status: string;
  competencia?: string;
  data_emissao?: string;
  valor_servico?: number;
  tomador_nome?: string;
  tomador_cnpj_cpf?: string;
  pdf_url?: string;
  nfseio_id?: string;
  created_at?: string;
}

export interface NfseRecebidaRow {
  id: string;
  cliente_id: string;
  numero?: string;
  competencia?: string;
  data_emissao?: string;
  valor_servico?: number;
  prestador_nome?: string;
  prestador_cnpj?: string;
  pdf_url?: string;
  fonte?: string;
  created_at?: string;
}

/** Hook: NFS-e emitidas do cliente, com filtro opcional de competência */
export function useNfseEmitidas(clienteId?: string, competencia?: string) {
  const [notas, setNotas] = useState<NfseEmitidaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("nfse_emitida")
        .select("id,cliente_id,numero,status,competencia,data_emissao,valor_servico,tomador_nome,tomador_cnpj_cpf,pdf_url,nfseio_id,created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (competencia) q = q.eq("competencia", competencia);

      const { data, error: err } = await q;
      if (err) throw err;
      setNotas(data ?? []);
    } catch (e: any) {
      console.error("[useNfseEmitidas] erro:", e);
      setError(e?.message ?? "Erro ao carregar notas emitidas");
      setNotas([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, competencia]);

  useEffect(() => { refetch(); }, [refetch]);

  return { notas, loading, error, refetch };
}

/** Hook: NFS-e recebidas do cliente, com filtro opcional de competência */
export function useNfseRecebidas(clienteId?: string, competencia?: string) {
  const [notas, setNotas] = useState<NfseRecebidaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("nfse_recebida")
        .select("id,cliente_id,numero,competencia,data_emissao,valor_servico,prestador_nome,prestador_cnpj,pdf_url,fonte,created_at")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (competencia) q = q.eq("competencia", competencia);

      const { data, error: err } = await q;
      if (err) throw err;
      setNotas(data ?? []);
    } catch (e: any) {
      console.error("[useNfseRecebidas] erro:", e);
      setError(e?.message ?? "Erro ao carregar notas recebidas");
      setNotas([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, competencia]);

  useEffect(() => { refetch(); }, [refetch]);

  return { notas, loading, error, refetch };
}

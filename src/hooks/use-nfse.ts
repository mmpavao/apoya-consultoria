/**
 * Hook: useNfse
 * Lê notas NFS-e da tabela nfse_notas no Supabase.
 * Emissão real: via Edge Function NFE.io (nunca no front).
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type NfseStatus = "rascunho" | "enviada" | "autorizada" | "cancelada" | "erro" | "rejeitada";

export interface NfseNota {
  id: string;
  clienteId: string;
  clienteNome: string;
  cnpj: string;
  competencia: string;
  valorServico: number;
  status: NfseStatus;
  numeroNota?: string;
  numeroProtocolo?: string;
  tomadorRazao?: string;
  tomadorCnpj?: string;
  aliquotaCbs: number;
  aliquotaIbs: number;
  xmlUrl?: string;
  pdfUrl?: string;
  erroMsg?: string;
  emitidaEm?: string;
  createdAt: string;
}

function fromDb(r: Record<string, unknown>): NfseNota {
  return {
    id:               r.id as string,
    clienteId:        r.cliente_id as string,
    clienteNome:      (r.cliente_nome as string) ?? "—",
    cnpj:             (r.cnpj as string)         ?? "—",
    competencia:      r.competencia as string,
    valorServico:     Number(r.valor_servico ?? 0),
    status:           ((r.status as string) as NfseStatus) ?? "rascunho",
    numeroNota:       (r.numero_nota ?? r.numero) as string | undefined,
    numeroProtocolo:  r.numero_protocolo as string | undefined,
    tomadorRazao:     (r.tomador_razao ?? r.tomador) as string | undefined,
    tomadorCnpj:      (r.tomador_cnpj ?? r.cnpj_tomador) as string | undefined,
    aliquotaCbs:      Number(r.aliquota_cbs ?? 0.9),
    aliquotaIbs:      Number(r.aliquota_ibs ?? 0.1),
    xmlUrl:           r.xml_url as string | undefined,
    pdfUrl:           r.pdf_url as string | undefined,
    erroMsg:          (r.ultimo_erro ?? r.erro) as string | undefined,
    emitidaEm:        r.emitida_em as string | undefined,
    createdAt:        r.created_at as string,
  };
}

export function useNfse(filtros?: { competencia?: string; status?: NfseStatus }) {
  const [notas, setNotas]     = useState<NfseNota[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      let q = db
        .from("nfse_notas")
        .select(`
          id, cliente_id, cliente_nome, cnpj, competencia,
          valor_servico, status, numero_nota, numero, numero_protocolo,
          tomador_razao, tomador, tomador_cnpj, cnpj_tomador,
          aliquota_cbs, aliquota_ibs,
          xml_url, pdf_url, ultimo_erro, erro, emitida_em, created_at
        `)
        .order("competencia", { ascending: false })
        .limit(500);

      if (filtros?.competencia) q = q.eq("competencia", filtros.competencia);
      if (filtros?.status)      q = q.eq("status", filtros.status);

      const { data, error: err } = await q;
      if (err) throw err;
      setNotas((data ?? []).map(fromDb));
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar NFS-e";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filtros?.competencia, filtros?.status]);

  useEffect(() => { fetch(); }, [fetch]);

  return { notas, loading, error, refresh: fetch };
}

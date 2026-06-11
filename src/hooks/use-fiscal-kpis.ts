/**
 * Hook: useFiscalKpis
 * Busca KPIs do setor fiscal diretamente via Supabase (anon client + RLS).
 *
 * KPIs:
 *   - obrigacoes_vencidas:    obrigacoes com data_vencimento < hoje e status != concluida
 *   - obrigacoes_a_vencer_7d: obrigacoes vencendo em <= 7 dias
 *   - das_pendentes:          das com status = 'pendente'
 *   - certificados_expirando: clientes com certificado_vencimento < hoje+30d
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FiscalKpis {
  obrigacoes_vencidas:    number;
  obrigacoes_a_vencer_7d: number;
  das_pendentes:          number;
  certificados_expirando: number;
}

const db = supabase as any;

export function useFiscalKpis() {
  const [kpis, setKpis]     = useState<FiscalKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetchKpis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hoje = new Date();
      const em7d = new Date(hoje);
      em7d.setDate(hoje.getDate() + 7);
      const em30d = new Date(hoje);
      em30d.setDate(hoje.getDate() + 30);

      const iso     = hoje.toISOString().split("T")[0];
      const iso7d   = em7d.toISOString().split("T")[0];
      const iso30d  = em30d.toISOString().split("T")[0];

      // Consultas em paralelo
      // NB: nomes reais do schema — obrigacoes.vencimento (não data_vencimento),
      // tabela das_guias (não das), validade em cliente_certificado.pfx_validade.
      const [
        { count: vencidas },
        { count: aVencer },
        { count: dasPendentes },
        { count: certExpirando },
      ] = await Promise.all([
        db.from("obrigacoes")
          .select("id", { count: "exact", head: true })
          .lt("vencimento", iso)
          .not("status", "in", '("concluida","cancelada")'),

        db.from("obrigacoes")
          .select("id", { count: "exact", head: true })
          .gte("vencimento", iso)
          .lte("vencimento", iso7d)
          .not("status", "in", '("concluida","cancelada")'),

        db.from("das_guias")
          .select("id", { count: "exact", head: true })
          .eq("status", "pendente"),

        // Certificados expirando nos próximos 30 dias (ainda válidos hoje)
        db.from("cliente_certificado")
          .select("id", { count: "exact", head: true })
          .not("pfx_validade", "is", null)
          .gte("pfx_validade", iso)
          .lte("pfx_validade", iso30d),
      ]);

      setKpis({
        obrigacoes_vencidas:    vencidas    ?? 0,
        obrigacoes_a_vencer_7d: aVencer     ?? 0,
        das_pendentes:          dasPendentes ?? 0,
        certificados_expirando: certExpirando ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar KPIs fiscais");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);

  return { kpis, loading, error, refetch: fetchKpis };
}

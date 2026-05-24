/**
 * useCnpjSerpro — enriquece dados do CNPJ via Edge Function Supabase (cnpj-enrich)
 * A EF chama o gateway MCP SERPRO real (mcp.zapro.tech) server-side
 * sem expor credenciais no browser e sem depender de /api/serpro/call
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SerproEnrichment {
  regime?: "MEI" | "Simples" | "Lucro Presumido" | "Lucro Real";
  situacaoCadastral?: string;
  optanteSimplesNacional?: boolean;
  optanteMei?: boolean;
  ultimoPgdasPeriodo?: string;        // 'YYYYMM'
  dteAtivo?: boolean;
  parcelamentosAtivos?: number;
  dividaAtivaRfb?: boolean;
  dividaAtivaPgfn?: boolean;
  regimeRaw?: string;
  regimeDataOpcao?: number;
  regimeAnos?: Array<{ anoCalendario: number; regimeApurado: string }>;
  // Fiscal calculado pelo CNAE
  cnaePrincipal?: string;
  cnaeDescricao?: string;
  anexoSimples?: string;
  codigoServicoNfse?: string;
  aliquotaIss?: number;
  descricaoServico?: string;
}

export function useCnpjSerpro() {
  const enriquecer = useCallback(async (cnpj: string): Promise<SerproEnrichment> => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return {};

    try {
      const { data, error } = await supabase.functions.invoke("cnpj-enrich", {
        body: { cnpj: digits },
      });

      if (error || !data?.ok) {
        console.warn("[useCnpjSerpro] Edge Function error:", error ?? data);
        return {};
      }

      const r = data.data as Record<string, any>;

      return {
        regime:                   r.regime,
        situacaoCadastral:        r.situacaoCadastral,
        optanteMei:               r.regime === "MEI",
        optanteSimplesNacional:   r.regime === "MEI" || r.regime === "Simples",
        ultimoPgdasPeriodo:       r.ultimoPgdasPeriodo,
        dteAtivo:                 r.dteAtivo,
        dividaAtivaRfb:           r.dividaAtivaRfb  ?? false,
        dividaAtivaPgfn:          r.dividaAtivaPgfn ?? false,
        regimeRaw:                r.regimeRaw,
        regimeDataOpcao:          r.regimeDataOpcao,
        regimeAnos:               r.regimeAnos,
        // Fiscal calculado pela EF
        cnaePrincipal:            r.cnaePrincipal,
        cnaeDescricao:            r.cnaeDescricao,
        anexoSimples:             r.anexoSimples,
        codigoServicoNfse:        r.codigoServicoNfse,
        aliquotaIss:              r.aliquotaIss !== undefined ? Number(r.aliquotaIss) : undefined,
        descricaoServico:         r.descricaoServico,
      };
    } catch (err) {
      console.warn("[useCnpjSerpro] Falha ao chamar cnpj-enrich:", err);
      return {};
    }
  }, []);

  return { enriquecer };
}

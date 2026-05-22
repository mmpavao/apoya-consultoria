/**
 * useCnpjSerpro — enriquece dados do CNPJ via gateway SERPRO local
 * Retorna regime tributário real, situação fiscal, última declaração PGDAS
 * Usado em paralelo com BrasilAPI (cadastral) para o onboarding completo
 */
import { useCallback } from "react";

export interface SerproEnrichment {
  regime?: "MEI" | "Simples" | "Lucro Presumido" | "Lucro Real";
  situacaoCadastral?: string;
  optanteSimplesNacional?: boolean;
  optanteMei?: boolean;
  ultimoPgdasPeriodo?: string;        // 'YYYY-MM'
  dteAtivo?: boolean;
  parcelamentosAtivos?: number;
  dividaAtivaRfb?: boolean;
  dividaAtivaPgfn?: boolean;
}

// URL do gateway SERPRO (pode estar na VPS ou local)
const SERPRO_GATEWAY =
  typeof window !== "undefined"
    ? (import.meta.env.VITE_SERPRO_GATEWAY_URL ?? "/api/serpro/call")
    : "/api/serpro/call";

async function callSerpro(tool: string, params: Record<string, string>): Promise<any> {
  try {
    const res = await fetch(SERPRO_GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, params }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Desempacota o resultado do MCP
    const content = data?.content?.[0]?.text ?? data?.result ?? null;
    if (!content) return null;
    try { return typeof content === "string" ? JSON.parse(content) : content; }
    catch { return null; }
  } catch {
    return null;
  }
}

export function useCnpjSerpro() {
  const enriquecer = useCallback(async (cnpj: string): Promise<SerproEnrichment> => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) return {};

    const result: SerproEnrichment = {};

    // Busca em paralelo para máxima velocidade
    const [regimeRes, dteRes, pgdasRes, sitfisRes] = await Promise.allSettled([
      callSerpro("serpro_regime", { cnpj: digits, ano: String(new Date().getFullYear()) }),
      callSerpro("serpro_dte", { cnpj: digits }),
      callSerpro("serpro_pgdas_ultima", { cnpj: digits }),
      callSerpro("serpro_sitfis", { cnpj: digits }),
    ]);

    // Regime tributário
    if (regimeRes.status === "fulfilled" && regimeRes.value) {
      const r = regimeRes.value?.result ?? regimeRes.value;
      const raw = (r?.regimeApurado ?? r?.regime ?? "").toUpperCase();
      if (raw.includes("MEI"))                result.regime = "MEI";
      else if (raw.includes("SIMPLES"))        result.regime = "Simples";
      else if (raw.includes("PRESUMIDO"))      result.regime = "Lucro Presumido";
      else if (raw.includes("REAL"))           result.regime = "Lucro Real";

      result.optanteMei = raw.includes("MEI");
      result.optanteSimplesNacional = raw.includes("SIMPLES") || raw.includes("MEI");
    }

    // DTE
    if (dteRes.status === "fulfilled" && dteRes.value) {
      const r = dteRes.value?.result ?? dteRes.value;
      const ind = r?.indicadorEnquadramento;
      result.dteAtivo = ind === 2 || (r?.statusEnquadramento ?? "").toLowerCase().includes("optante");
    }

    // Última declaração PGDAS
    if (pgdasRes.status === "fulfilled" && pgdasRes.value) {
      const r = pgdasRes.value?.result ?? pgdasRes.value;
      const periodo = r?.periodoApuracao ?? r?.periodo ?? "";
      if (periodo) result.ultimoPgdasPeriodo = periodo;
    }

    // Situação fiscal (RFC + PGFN)
    if (sitfisRes.status === "fulfilled" && sitfisRes.value) {
      const r = sitfisRes.value?.result ?? sitfisRes.value;
      result.situacaoCadastral = r?.situacaoRFB ?? r?.situacao ?? undefined;
      result.dividaAtivaRfb   = r?.possuiDebitoRFB  === true;
      result.dividaAtivaPgfn  = r?.possuiDebitoPGFN === true;
    }

    return result;
  }, []);

  return { enriquecer };
}

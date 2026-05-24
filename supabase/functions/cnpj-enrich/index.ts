/**
 * cnpj-enrich — Edge Function Supabase v2
 * Enriquece CNPJ: regime real (SERPRO) + dados cadastrais (BrasilAPI) + alíquota calculada
 * A alíquota ISS e código de serviço são calculados server-side pelo CNAE (tabela oficial SN)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MCP_URL     = "https://mcp.zapro.tech/mcp";
const MCP_BEARER  = "apoya-mcp-serpro-2026";
const MCP_TIMEOUT = 9000;

async function callMcp(toolName: string, args: Record<string, string>): Promise<any> {
  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MCP_BEARER}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
      signal: AbortSignal.timeout(MCP_TIMEOUT),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.result?.content?.[0]?.text ?? null;
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  } catch {
    return null;
  }
}

function parseRegime(raw: string): string | null {
  const u = (raw ?? "").toUpperCase();
  if (u.includes("MEI"))                                           return "MEI";
  if (u.includes("SIMPLES"))                                       return "Simples";
  if (u.includes("PRESUMIDO"))                                     return "Lucro Presumido";
  if (u.includes("REAL"))                                          return "Lucro Real";
  if (u.includes("COMPETÊNCIA") || u.includes("COMPETENCIA"))     return "Simples";
  return null;
}

// ── Tabela de alíquotas ISS por Anexo SN e CNAE (embutida na EF) ─────────────
const CNAE_MAP: Record<string, { anexo: string; codigoServico?: string; descricao?: string; issParticipacao: number }> = {
  // Contabilidade / Auditoria
  "6920": { anexo: "III", codigoServico: "17.19", descricao: "Contabilidade e auditoria",         issParticipacao: 2.0 },
  "6920601": { anexo: "III", codigoServico: "17.19", descricao: "Atividades de contabilidade",    issParticipacao: 2.0 },
  "6920602": { anexo: "III", codigoServico: "17.19", descricao: "Auditoria e consultoria contábil", issParticipacao: 2.0 },
  // Advocacia
  "6911": { anexo: "IV",  codigoServico: "17.20", descricao: "Serviços advocatícios",             issParticipacao: 2.0 },
  "6911701": { anexo: "IV", codigoServico: "17.20", descricao: "Serviços advocatícios",           issParticipacao: 2.0 },
  // TI / Software
  "6201": { anexo: "III", codigoServico: "01.07", descricao: "Desenvolvimento de software",       issParticipacao: 2.0 },
  "6202": { anexo: "III", codigoServico: "01.07", descricao: "Desenvolvimento de software",       issParticipacao: 2.0 },
  "6203": { anexo: "III", codigoServico: "01.07", descricao: "Desenvolvimento de software",       issParticipacao: 2.0 },
  "6203100": { anexo: "III", codigoServico: "01.07", descricao: "Desenvolvimento de software",    issParticipacao: 2.0 },
  "6209": { anexo: "III", codigoServico: "01.07", descricao: "Suporte técnico em TI",             issParticipacao: 2.0 },
  // Consultoria
  "7020": { anexo: "III", codigoServico: "17.01", descricao: "Consultoria empresarial",           issParticipacao: 2.0 },
  "7020400": { anexo: "III", codigoServico: "17.01", descricao: "Consultoria em gestão",          issParticipacao: 2.0 },
  // Medicina / Saúde
  "8630": { anexo: "V",  codigoServico: "04.01", descricao: "Medicina",                           issParticipacao: 2.0 },
  "8650": { anexo: "V",  codigoServico: "04.02", descricao: "Outros profissionais de saúde",      issParticipacao: 2.0 },
  // Engenharia / Arquitetura
  "7111": { anexo: "V",  codigoServico: "07.01", descricao: "Arquitetura",                        issParticipacao: 2.0 },
  "7112": { anexo: "V",  codigoServico: "07.01", descricao: "Engenharia",                         issParticipacao: 2.0 },
  // Comércio
  "4711": { anexo: "I",  descricao: "Comércio varejista",                                         issParticipacao: 0   },
  "4712": { anexo: "I",  descricao: "Comércio varejista",                                         issParticipacao: 0   },
};

function getAliquotaByCnae(cnae: string, regime: string): {
  codigoServico?: string; aliquotaISS?: number; anexo?: string; descricaoServico?: string;
} {
  if (!cnae || (!regime.includes("Simples") && !regime.includes("MEI"))) return {};
  if (regime.includes("MEI")) return { aliquotaISS: 5 };

  const c = cnae.replace(/\D/g, "");
  const entry = CNAE_MAP[c] ?? CNAE_MAP[c.substring(0, 4)] ?? null;
  if (!entry) return {};

  return {
    codigoServico:    entry.codigoServico,
    aliquotaISS:      entry.issParticipacao,
    anexo:            entry.anexo,
    descricaoServico: entry.descricao,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { cnpj } = await req.json();
    const digits = (cnpj ?? "").replace(/\D/g, "");
    if (digits.length !== 14) {
      return new Response(JSON.stringify({ error: "CNPJ inválido" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const ano = String(new Date().getFullYear());

    // ── Disparo paralelo ──────────────────────────────────────────────────────
    const [regimeRes, dteRes, pgdasRes, sitfisRes, brasilApiRes] = await Promise.allSettled([
      callMcp("serpro_regime",       { cnpj: digits, ano }),
      callMcp("serpro_dte",          { cnpj: digits }),
      callMcp("serpro_pgdas_ultima", { cnpj: digits }),
      callMcp("serpro_sitfis",       { cnpj: digits }),
      // BrasilAPI para CNAE (rápido, público)
      fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, { signal: AbortSignal.timeout(6000) })
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]);

    const result: Record<string, any> = { cnpj: digits };

    // ── Regime SERPRO ─────────────────────────────────────────────────────────
    let regimeFinal = "Simples";
    if (regimeRes.status === "fulfilled" && regimeRes.value) {
      const r = regimeRes.value?.result ?? regimeRes.value;
      const raw = r?.regimeEscolhido ?? r?.regimeApurado ?? r?.regime ?? "";
      result.regime = parseRegime(raw) ?? undefined;
      result.regimeRaw = raw;
      result.regimeDataOpcao = r?.dataHoraOpcao ?? undefined;
      if (result.regime) regimeFinal = result.regime;
    }

    // ── DTE ───────────────────────────────────────────────────────────────────
    if (dteRes.status === "fulfilled" && dteRes.value) {
      const r = dteRes.value?.result ?? dteRes.value;
      result.dteAtivo = r?.indicadorEnquadramento === 2 ||
        (r?.statusEnquadramento ?? "").toLowerCase().includes("optante");
    }

    // ── PGDAS ─────────────────────────────────────────────────────────────────
    if (pgdasRes.status === "fulfilled" && pgdasRes.value) {
      const r = pgdasRes.value?.result ?? pgdasRes.value;
      result.ultimoPgdasPeriodo = r?.periodoApuracao ?? r?.periodo ?? undefined;
    }

    // ── Situação fiscal ───────────────────────────────────────────────────────
    if (sitfisRes.status === "fulfilled" && sitfisRes.value) {
      const r = sitfisRes.value?.result ?? sitfisRes.value;
      result.situacaoCadastral = r?.situacaoRFB ?? r?.situacao ?? undefined;
      result.dividaAtivaRfb    = r?.possuiDebitoRFB  === true;
      result.dividaAtivaPgfn   = r?.possuiDebitoPGFN === true;
    }

    // ── BrasilAPI — CNAE ──────────────────────────────────────────────────────
    if (brasilApiRes.status === "fulfilled" && brasilApiRes.value) {
      const b = brasilApiRes.value as any;
      result.cnaePrincipal = b?.cnae_fiscal ? String(b.cnae_fiscal) : undefined;
      result.cnaeDescricao = b?.cnae_fiscal_descricao ?? undefined;
      result.porte         = b?.porte ?? undefined;
    }

    // ── Alíquota ISS calculada pelo CNAE ──────────────────────────────────────
    if (result.cnaePrincipal) {
      const fiscal = getAliquotaByCnae(result.cnaePrincipal, regimeFinal);
      if (fiscal.codigoServico || fiscal.aliquotaISS !== undefined) {
        result.codigoServicoNfse  = fiscal.codigoServico;
        result.aliquotaIss        = fiscal.aliquotaISS;
        result.anexoSimples       = fiscal.anexo;
        result.descricaoServico   = fiscal.descricaoServico;
      }
    }

    return new Response(JSON.stringify({ ok: true, data: result }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

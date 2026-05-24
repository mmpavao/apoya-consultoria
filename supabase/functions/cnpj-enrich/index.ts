/**
 * cnpj-enrich — Edge Function Supabase
 * Enriquece dados de CNPJ chamando o gateway SERPRO real (mcp.zapro.tech)
 * Retorna: regime, situação fiscal, DTE, PGDAS, sócios, situação cadastral
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MCP_URL     = "https://mcp.zapro.tech/mcp";
const MCP_BEARER  = "apoya-mcp-serpro-2026";
const MCP_TIMEOUT = 8000;

/** Chama uma tool MCP SERPRO */
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

/** Converte string "COMPETÊNCIA" / "SIMPLES" / "MEI" → enum do sistema */
function parseRegime(raw: string): string | null {
  const u = (raw ?? "").toUpperCase();
  if (u.includes("MEI"))                   return "MEI";
  if (u.includes("SIMPLES"))               return "Simples";
  if (u.includes("PRESUMIDO"))             return "Lucro Presumido";
  if (u.includes("REAL"))                  return "Lucro Real";
  // COMPETÊNCIA dentro do Simples → Simples
  if (u.includes("COMPETÊNCIA") || u.includes("COMPETENCIA")) return "Simples";
  return null;
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

    // ── Disparo paralelo de todas as consultas SERPRO ──────────────────────
    const [regimeRes, dteRes, pgdasRes, sitfisRes, regimeAnosRes] = await Promise.allSettled([
      callMcp("serpro_regime",       { cnpj: digits, ano }),
      callMcp("serpro_dte",          { cnpj: digits }),
      callMcp("serpro_pgdas_ultima", { cnpj: digits }),
      callMcp("serpro_sitfis",       { cnpj: digits }),
      callMcp("serpro_regime_anos",  { cnpj: digits }),
    ]);

    const result: Record<string, any> = { cnpj: digits };

    // ── Regime ────────────────────────────────────────────────────────────
    if (regimeRes.status === "fulfilled" && regimeRes.value) {
      const r = regimeRes.value?.result ?? regimeRes.value;
      const raw = r?.regimeEscolhido ?? r?.regimeApurado ?? r?.regime ?? "";
      result.regime = parseRegime(raw) ?? undefined;
      result.regimeRaw = raw;
      result.regimeDataOpcao = r?.dataHoraOpcao ?? undefined;
    }

    // ── DTE ───────────────────────────────────────────────────────────────
    if (dteRes.status === "fulfilled" && dteRes.value) {
      const r = dteRes.value?.result ?? dteRes.value;
      const ind = r?.indicadorEnquadramento;
      result.dteAtivo = ind === 2 ||
        (r?.statusEnquadramento ?? "").toLowerCase().includes("optante");
    }

    // ── Última declaração PGDAS ───────────────────────────────────────────
    if (pgdasRes.status === "fulfilled" && pgdasRes.value) {
      const r = pgdasRes.value?.result ?? pgdasRes.value;
      result.ultimoPgdasPeriodo = r?.periodoApuracao ?? r?.periodo ?? undefined;
    }

    // ── Situação fiscal (RFC + PGFN) ──────────────────────────────────────
    if (sitfisRes.status === "fulfilled" && sitfisRes.value) {
      const r = sitfisRes.value?.result ?? sitfisRes.value;
      result.situacaoCadastral = r?.situacaoRFB ?? r?.situacao ?? undefined;
      result.dividaAtivaRfb    = r?.possuiDebitoRFB  === true;
      result.dividaAtivaPgfn   = r?.possuiDebitoPGFN === true;
    }

    // ── Anos de opção de regime ────────────────────────────────────────────
    if (regimeAnosRes.status === "fulfilled" && regimeAnosRes.value) {
      const r = regimeAnosRes.value?.result ?? regimeAnosRes.value;
      result.regimeAnos = Array.isArray(r) ? r : undefined;
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

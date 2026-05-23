/**
 * SerproClientePanel — Painel SERPRO na aba Fiscal do cliente.
 *
 * Filosofia: NUNCA bloquear consultas por ausência de cert/proc no banco.
 * O MCP que decide se tem acesso ou não. O sistema mostra o resultado
 * (ou o erro do SERPRO) sem pré-filtrar.
 *
 * Auto-fill: ao montar, dispara queries automáticas para preencher
 * dados do cliente (regime, cadastro, situação fiscal, DAS, etc.)
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
  Download, Loader2, RefreshCw, Wifi, WifiOff, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSerpro } from "@/hooks/use-serpro";
import { SerproResultRenderer } from "@/components/serpro/SerproResultRenderer";
import { SERPRO_TOOLS, SERPRO_CATEGORIES } from "@/lib/serpro/tools-catalog";

// ── tipos ──────────────────────────────────────────────────────────────────
type ClienteMin = {
  id: string;
  cnpj?: string | null;
  cpf?: string | null;
  regime?: string | null;
  tem_certificado?: boolean;
  tem_procuracao?: boolean;
};

type ResultState = {
  loading: boolean;
  text: string | null;
  pdfB64: string | null;
  error: string | null;
  ms: number | null;
  blocked: boolean;
};

const EMPTY_R: ResultState = {
  loading: false, text: null, pdfB64: null, error: null, ms: null, blocked: false,
};

// Categorias visíveis na ficha do cliente
const VISIBLE_CATS = [
  "mei", "das_mei", "pgdas", "das", "regime", "declaracoes",
  "ecac", "fiscal", "parcelamentos", "pagamentos", "darf", "eventos",
];

// Tools que disparam automaticamente ao abrir o painel (auto-fill)
const AUTO_TOOLS: Record<string, string[]> = {
  MEI:             ["serpro_ccmei_dados", "serpro_regime_anos", "serpro_pgmei_divida", "serpro_dte", "serpro_caixapostal_indicador"],
  SIMPLES:         ["serpro_regime_anos", "serpro_pgdas_ultima", "serpro_defis_ultima", "serpro_dte", "serpro_caixapostal_indicador", "serpro_sitfis"],
  LUCRO_PRESUMIDO: ["serpro_regime_anos", "serpro_dte", "serpro_caixapostal_indicador", "serpro_sitfis", "serpro_eprocesso"],
  LUCRO_REAL:      ["serpro_regime_anos", "serpro_dte", "serpro_caixapostal_indicador", "serpro_sitfis", "serpro_eprocesso"],
  ISENTO:          ["serpro_regime_anos", "serpro_dte", "serpro_caixapostal_indicador"],
  ALL:             ["serpro_regime_anos", "serpro_dte"],
};

function downloadPdf(b64: string, filename: string) {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch { toast.error("Falha ao gerar PDF"); }
}

// ── Mapeador de erros SERPRO → mensagens amigáveis ─────────────────────────
function friendlyError(err: string | null): string {
  if (!err) return "Erro desconhecido";
  if (err.includes("AcessoNegado-ICGERENCIADOR-022"))
    return "⚠ Procuração não encontrada: este CNPJ não possui procuração eletrônica outorgada à APOYA no portal eCAC (ecac.receita.fazenda.gov.br). Solicite ao cliente que acesse o eCAC e cadastre a procuração para o CNPJ 43.507.838/0001-89 (APOYA Contabilidade).";
  if (err.includes("AcessoNegado-ICGERENCIADOR"))
    return "Acesso negado pelo SERPRO: verifique se a procuração eletrônica está cadastrada no eCAC para este CNPJ.";
  if (err.includes("procuração") || err.includes("procuracao"))
    return "Este acesso requer procuração eletrônica ativa no portal eCAC.";
  if (err.includes("certificado") || err.includes("certificate"))
    return "Este acesso requer certificado digital A1/A3 ativo.";
  if (err.includes("403") || err.includes("Forbidden"))
    return "Acesso negado pelo SERPRO (403). Verifique as credenciais do gateway.";
  if (err.includes("401") || err.includes("Unauthorized"))
    return "Token SERPRO inválido ou expirado. Atualize nas configurações.";
  if (err.includes("timeout") || err.includes("ETIMEDOUT"))
    return "Tempo esgotado ao consultar o SERPRO. Tente novamente.";
  // remover JSON bruto de erros
  if (err.startsWith("{") || err.startsWith("[")) {
    try {
      const parsed = JSON.parse(err);
      return parsed?.texto ?? parsed?.message ?? parsed?.error ?? "Erro na consulta SERPRO";
    } catch { /**/ }
  }
  return err;
}

// ── Caixa de resultado ─────────────────────────────────────────────────────
function ResultBox({ state, onPdf, filename }: {
  state: ResultState; onPdf: () => void; filename: string;
}) {
  if (state.loading) return (
    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Consultando SERPRO…
    </div>
  );
  if (state.blocked) return (
    <div className="flex items-start gap-1.5 py-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-2">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{friendlyError(state.error)}</span>
    </div>
  );
  if (state.error) return (
    <div className="flex items-start gap-1.5 py-1.5 text-xs text-red-500 bg-red-50 rounded-lg px-2 py-2">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span className="break-words">{friendlyError(state.error)}</span>
    </div>
  );
  if (!state.text) return null;
  return (
    <SerproResultRenderer
      text={state.text}
      pdfB64={state.pdfB64}
      ms={state.ms}
      onPdf={onPdf}
    />
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export function SerproClientePanel({ cliente }: { cliente: ClienteMin }) {
  const { call, extractText, extractPdf } = useSerpro();
  const cnpj = (cliente.cnpj ?? "").replace(/\D/g, "");
  const cpf  = (cliente.cpf  ?? "").replace(/\D/g, "");
  const regimeRaw = (cliente.regime ?? "").toUpperCase()
    .replace("SIMPLES NACIONAL", "SIMPLES")
    .replace("LUCRO PRESUMIDO", "LUCRO_PRESUMIDO")
    .replace("LUCRO REAL", "LUCRO_REAL");

  const [results, setResults]   = useState<Record<string, ResultState>>({});
  const [open, setOpen]         = useState<Record<string, boolean>>({});
  const [autoRunning, setAutoRunning] = useState(false);
  const [gwOk, setGwOk]         = useState<boolean | null>(null);
  const didAutoRun = useRef(false);

  // ── auto-fill ao montar ───────────────────────────────────────────────
  const autoFill = useCallback(async () => {
    if (!cnpj || didAutoRun.current) return;
    didAutoRun.current = true;
    setAutoRunning(true);

    // Determinar tools para este regime
    const toolNames = AUTO_TOOLS[regimeRaw] ?? AUTO_TOOLS["ALL"];

    // Verificar gateway primeiro
    const gwRes = await call("serpro_status", {}, cliente.id);
    setGwOk(gwRes.ok);
    if (!gwRes.ok) { setAutoRunning(false); return; }

    // Abrir categoria dos auto-tools automaticamente
    const catsToOpen: Record<string, boolean> = {};

    for (const toolName of toolNames) {
      const tool = SERPRO_TOOLS.find(t => t.name === toolName);
      if (!tool) continue;

      // Marcar como loading
      setResults(p => ({ ...p, [toolName]: { ...EMPTY_R, loading: true } }));
      if (VISIBLE_CATS.includes(tool.category)) {
        catsToOpen[tool.category] = true;
      }

      // Montar params
      const params: Record<string, string> = {};
      if (tool.params.includes("cnpj") && cnpj) params.cnpj = cnpj;
      if (tool.params.includes("cpf")  && cpf)  params.cpf  = cpf;
      if (tool.params.includes("ano"))           params.ano  = String(new Date().getFullYear());
      if (tool.params.includes("periodo")) {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        params.periodo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
      }

      // Chamar (sequencial para não sobrecarregar)
      const res = await call(toolName, params, cliente.id);
      const text  = extractText(res);
      const pdf   = extractPdf(res);

      const isInternalErr = res.ok && text?.startsWith("⚠️");
      setResults(p => ({
        ...p,
        [toolName]: {
          loading: false,
          text: (res.ok && !isInternalErr) ? text : null,
          pdfB64: pdf ?? null,
          error: isInternalErr ? text?.replace("⚠️ ", "") : (res.ok ? null : (res.error ?? "Erro desconhecido")),
          ms: res.duracao_ms ?? null,
          blocked: res.blocked ?? false,
        },
      }));
    }

    setOpen(p => ({ ...p, ...catsToOpen }));
    setAutoRunning(false);
  }, [cnpj, cpf, regimeRaw, cliente.id]);

  useEffect(() => { autoFill(); }, [autoFill]);

  // ── executar tool manualmente ─────────────────────────────────────────
  async function runTool(tool: typeof SERPRO_TOOLS[0]) {
    const params: Record<string, string> = {};
    if (tool.params.includes("cnpj") && cnpj) params.cnpj = cnpj;
    if (tool.params.includes("cpf")  && cpf)  params.cpf  = cpf;
    if (tool.params.includes("ano"))           params.ano  = String(new Date().getFullYear());
    if (tool.params.includes("periodo")) {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      params.periodo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    if (!params.cnpj && tool.params.includes("cnpj")) {
      toast.error("CNPJ não cadastrado para este cliente");
      return;
    }
    if (!params.cpf && tool.params.includes("cpf") && !params.cnpj) {
      toast.error("CPF não cadastrado para este cliente");
      return;
    }

    setResults(p => ({ ...p, [tool.name]: { ...EMPTY_R, loading: true } }));
    const res = await call(tool.name, params, cliente.id);
    const text  = extractText(res);
    const pdf   = extractPdf(res);

    const isInternalErr = res.ok && text?.startsWith("⚠️");
    setResults(p => ({
      ...p,
      [tool.name]: {
        loading: false,
        text: (res.ok && !isInternalErr) ? text : null,
        pdfB64: pdf ?? null,
        error: isInternalErr ? text?.replace("⚠️ ", "") : (res.ok ? null : (res.error ?? "Erro")),
        ms: res.duracao_ms ?? null,
        blocked: res.blocked ?? false,
      },
    }));

    if (res.ok && !isInternalErr) toast.success(`${tool.description} — OK`);
    else if (res.blocked)         toast.warning("Acesso negado pelo SERPRO: " + res.error);
    else if (isInternalErr)       toast.warning("SERPRO: " + text?.replace("⚠️ ", ""));
    else                          toast.error("Erro SERPRO: " + (res.error ?? "desconhecido"));
  }

  // ── filtrar tools por regime e categoria ──────────────────────────────
  const toolsByCategory = VISIBLE_CATS.reduce<Record<string, typeof SERPRO_TOOLS>>((acc, cat) => {
    const tools = SERPRO_TOOLS.filter(t => {
      if (t.category !== cat) return false;
      // Só filtrar por regime quando o regime está definido e a tool não é ALL
      if (regimeRaw && !t.regimes.includes("ALL") && !t.regimes.includes(regimeRaw as any)) return false;
      return true;
    });
    if (tools.length > 0) acc[cat] = tools;
    return acc;
  }, {});

  // ── sem CNPJ ──────────────────────────────────────────────────────────
  if (!cnpj) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 opacity-40" />
        <p className="text-sm font-medium">CNPJ não cadastrado</p>
        <p className="text-xs">Adicione o CNPJ no cadastro do cliente para habilitar as consultas SERPRO.</p>
      </div>
    );
  }

  const hasAnyResult = Object.values(results).some(r => r.text || r.error);

  return (
    <div className="space-y-3">
      {/* ── Status bar ─────────────────────────────────────────────── */}
      <div className="surface-card p-3 flex flex-wrap items-center gap-4">
        {/* Gateway */}
        <div className="flex items-center gap-1.5 text-sm">
          {gwOk === null
            ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            : gwOk
              ? <Wifi className="h-4 w-4 text-emerald-500" />
              : <WifiOff className="h-4 w-4 text-red-400" />
          }
          <span className={`font-medium ${gwOk ? "text-emerald-600" : gwOk === false ? "text-red-500" : "text-muted-foreground"}`}>
            {gwOk === null ? "Verificando gateway…" : gwOk ? "Gateway OK" : "Gateway offline"}
          </span>
        </div>

        {/* Regime */}
        {regimeRaw && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {regimeRaw.replace("_", " ")}
          </span>
        )}

        {/* Indicadores de cert/proc — apenas informativos, não bloqueantes */}
        {cliente.tem_certificado && (
          <span className="text-xs flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Certificado cadastrado
          </span>
        )}
        {cliente.tem_procuracao ? (
          <span className="text-xs flex items-center gap-1 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Procuração eCAC ativa
          </span>
        ) : (
          <span className="text-xs flex items-center gap-1 text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" /> Sem procuração eCAC
          </span>
        )}

        {/* Auto-fill status */}
        {autoRunning && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Buscando dados automaticamente…
          </div>
        )}
        {!autoRunning && hasAnyResult && (
          <button
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => { didAutoRun.current = false; autoFill(); }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar todos
          </button>
        )}
      </div>

      {/* ── Categorias de tools ────────────────────────────────────────── */}
      {Object.entries(toolsByCategory).map(([cat, tools]) => {
        const isOpen = open[cat] ?? false;
        const catResults = tools.filter(t => results[t.name]?.text || results[t.name]?.error);
        const catLoading = tools.some(t => results[t.name]?.loading);

        return (
          <div key={cat} className="surface-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setOpen(p => ({ ...p, [cat]: !isOpen }))}
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  {SERPRO_CATEGORIES[cat] ?? cat}
                </span>
                <span className="text-xs text-muted-foreground">({tools.length})</span>
                {catLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {!catLoading && catResults.length > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                    {catResults.length} com dados
                  </span>
                )}
              </div>
              {isOpen
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />
              }
            </button>

            {isOpen && (
              <div className="divide-y divide-border/40 border-t border-border/40">
                {tools.map(tool => {
                  const state = results[tool.name] ?? EMPTY_R;
                  const missingCnpj = tool.params.includes("cnpj") && !cnpj;
                  const missingCpf  = tool.params.includes("cpf") && !cpf && !cnpj;
                  const canRun      = !missingCnpj && !missingCpf;

                  return (
                    <div key={tool.name} className={`px-4 py-3 transition-colors ${state.text ? "bg-emerald-50/30" : ""}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{tool.description}</p>
                            {tool.returnsPdf && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">PDF</span>
                            )}
                            {tool.isHeavy && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">~20s</span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{tool.name}</p>

                          {/* Aviso leve de cert/proc — informativo, não bloqueante */}
                          {tool.requiresCert && !cliente.tem_certificado && !state.text && (
                            <p className="text-[11px] text-amber-500 mt-0.5 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              ⚠ Exige certificado digital A1/A3
                            </p>
                          )}
                          {tool.requiresProc && !cliente.tem_procuracao && !state.text && (
                            <p className="text-[11px] text-amber-500 mt-0.5 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              ⚠ Exige procuração eCAC ativa
                            </p>
                          )}
                          {missingCnpj && (
                            <p className="text-[11px] text-red-500 mt-0.5">CNPJ necessário — não cadastrado</p>
                          )}
                        </div>

                        {/* Botão — SEMPRE habilitado se tem CNPJ */}
                        <Button
                          size="sm"
                          variant={state.text ? "outline" : "default"}
                          disabled={!canRun || state.loading}
                          className="shrink-0 h-7 text-xs gap-1"
                          onClick={() => runTool(tool)}
                        >
                          {state.loading
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : state.text
                              ? <RefreshCw className="h-3 w-3" />
                              : <Zap className="h-3 w-3" />
                          }
                          {state.text ? "Atualizar" : "Consultar"}
                        </Button>
                      </div>

                      <ResultBox
                        state={state}
                        onPdf={() => state.pdfB64 && downloadPdf(state.pdfB64, `${tool.name}-${cnpj}.pdf`)}
                        filename={`${tool.name}-${cnpj}.pdf`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

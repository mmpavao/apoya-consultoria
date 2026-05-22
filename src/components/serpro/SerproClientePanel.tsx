/**
 * SerproClientePanel — painel SERPRO na aba Fiscal do cliente.
 * Exibe consultas disponíveis por regime + certificado + procuração.
 * Usado em: _app.clientes_.$id.tsx  →  tab "fiscal"
 */
import { useState } from "react";
import {
  Activity, AlertCircle, ChevronDown, ChevronRight, Download,
  FileText, Loader2, RefreshCw, ShieldCheck, ShieldX, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSerpro } from "@/hooks/use-serpro";
import { SERPRO_TOOLS, checkEligibility, SERPRO_CATEGORIES } from "@/lib/serpro/tools-catalog";

// ── tipos mínimos do cliente necessários aqui ─────────────────────────────
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
};

const EMPTY: ResultState = { loading: false, text: null, pdfB64: null, error: null, ms: null };

// Categorias visíveis na aba do cliente (não mostrar util, xml, eventos)
const VISIBLE_CATEGORIES = [
  "mei", "das_mei", "pgdas", "regime", "declaracoes",
  "ecac", "fiscal", "parcelamentos", "pagamentos", "darf",
];

function RegimeBadge({ regime }: { regime?: string | null }) {
  if (!regime) return null;
  const cfgs: Record<string, string> = {
    MEI: "bg-violet-50 text-violet-700 border-violet-200",
    SIMPLES: "bg-blue-50 text-blue-700 border-blue-200",
    LUCRO_PRESUMIDO: "bg-orange-50 text-orange-700 border-orange-200",
    LUCRO_REAL: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfgs[regime] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {regime.replace("_", " ")}
    </span>
  );
}

function StatusIcon({ ok }: { ok?: boolean }) {
  return ok
    ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
    : <ShieldX className="h-3.5 w-3.5 text-red-400 shrink-0" />;
}

function ResultBox({ state, onPdf }: { state: ResultState; onPdf: (b64: string) => void }) {
  if (state.loading) return (
    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Consultando SERPRO…
    </div>
  );
  if (state.error) return (
    <div className="flex items-start gap-2 py-2 text-sm text-red-600">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="break-words">{state.error}</span>
    </div>
  );
  if (!state.text) return null;
  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      {state.pdfB64 && (
        <Button size="sm" variant="outline" className="mb-2 h-7 text-xs gap-1"
          onClick={() => onPdf(state.pdfB64!)}>
          <Download className="h-3 w-3" /> Baixar PDF
        </Button>
      )}
      <pre className="text-[11px] leading-relaxed text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
        {state.text}
      </pre>
      {state.ms && (
        <p className="mt-1 text-[10px] text-muted-foreground text-right">{state.ms}ms</p>
      )}
    </div>
  );
}

function downloadPdf(b64: string, filename: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Componente principal ───────────────────────────────────────────────────

export function SerproClientePanel({ cliente }: { cliente: ClienteMin }) {
  const { call, extractText, extractPdf } = useSerpro();
  const [results, setResults] = useState<Record<string, ResultState>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const regimeKey = (cliente.regime ?? "").toUpperCase().replace(" ", "_");
  const cnpj = cliente.cnpj?.replace(/\D/g, "") ?? "";

  // Filtrar tools disponíveis para o regime deste cliente
  const toolsByCategory = VISIBLE_CATEGORIES.reduce<Record<string, typeof SERPRO_TOOLS>>((acc, cat) => {
    const tools = SERPRO_TOOLS.filter((t) => {
      if (t.category !== cat) return false;
      if (!t.regimes.includes("ALL") && !t.regimes.includes(regimeKey as any)) return false;
      return true;
    });
    if (tools.length > 0) acc[cat] = tools;
    return acc;
  }, {});

  async function runTool(tool: typeof SERPRO_TOOLS[0]) {
    if (!cnpj) return;

    setResults((p) => ({ ...p, [tool.name]: { ...EMPTY, loading: true } }));

    // Montar params básicos
    const params: Record<string, string> = {};
    if (tool.params.includes("cnpj")) params.cnpj = cnpj;
    if (tool.params.includes("cpf") && cliente.cpf) params.cpf = cliente.cpf.replace(/\D/g, "");
    if (tool.params.includes("ano")) params.ano = String(new Date().getFullYear());
    if (tool.params.includes("periodo")) {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      params.periodo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    const res = await call(tool.name, params, cliente.id);
    const text = extractText(res);
    const pdfB64 = extractPdf(res);

    setResults((p) => ({
      ...p,
      [tool.name]: {
        loading: false,
        text: res.ok ? text : null,
        pdfB64,
        error: res.ok ? null : (res.error ?? "Erro desconhecido"),
        ms: res.duracao_ms ?? null,
      },
    }));
  }

  if (!cnpj) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
        <AlertCircle className="h-8 w-8 opacity-40" />
        <p className="text-sm">CNPJ não cadastrado — SERPRO indisponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status de habilitação */}
      <div className="surface-card p-4 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-1.5 text-sm">
          <RegimeBadge regime={regimeKey || null} />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <StatusIcon ok={cliente.tem_certificado} />
          Certificado Digital
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <StatusIcon ok={cliente.tem_procuracao} />
          Procuração eCAC
        </div>
        {!regimeKey && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" />
            Informe o regime fiscal no cadastro para liberar consultas
          </p>
        )}
      </div>

      {/* Categorias de tools */}
      {Object.entries(toolsByCategory).map(([cat, tools]) => {
        const isOpen = open[cat] ?? false;
        return (
          <div key={cat} className="surface-card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setOpen((p) => ({ ...p, [cat]: !isOpen }))}
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  {SERPRO_CATEGORIES[cat]}
                </span>
                <span className="text-xs text-muted-foreground">({tools.length})</span>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="divide-y divide-border/40 border-t border-border/40">
                {tools.map((tool) => {
                  const elig = checkEligibility(tool.name, {
                    regime: regimeKey,
                    tem_certificado: cliente.tem_certificado,
                    tem_procuracao: cliente.tem_procuracao,
                  });
                  const state = results[tool.name] ?? EMPTY;

                  return (
                    <div key={tool.name} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{tool.description}</p>
                            {tool.returnsPdf && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">PDF</span>
                            )}
                            {tool.isHeavy && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">Pesada</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{tool.name}</p>
                          {!elig.eligible && (
                            <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                              {elig.reason}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={elig.eligible ? "default" : "outline"}
                          disabled={!elig.eligible || state.loading}
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
                        onPdf={(b64) => downloadPdf(b64, `${tool.name}-${cnpj}.pdf`)}
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

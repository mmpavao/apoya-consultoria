/**
 * Página /fiscal/serpro — Console SERPRO
 * Consultas por cliente com validação de elegibilidade.
 * Substituição do mock anterior por chamadas reais ao MCP.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Activity, AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
  Download, FileText, Loader2, RefreshCw, Search, Server,
  ShieldCheck, ShieldX, Wifi, WifiOff, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, PageTabs, KpiGrid, KpiCard } from "@/components/PagePlaceholder";
import { useClientes } from "@/hooks/use-clientes";
import { useSerpro } from "@/hooks/use-serpro";
import { SERPRO_TOOLS, SERPRO_CATEGORIES, checkEligibility } from "@/lib/serpro/tools-catalog";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/fiscal/serpro")({
  component: SerproPage,
  head: () => ({ meta: [{ title: "Console SERPRO · APOYA Gestão" }] }),
});

// ─── tipos ────────────────────────────────────────────────────────────────
type GwStatus = { online: boolean; version?: string; contratante?: string; checkedAt: string; latencyMs: number };
type ResultState = { loading: boolean; text: string | null; pdfB64: string | null; error: string | null; ms: number | null };
const EMPTY_R: ResultState = { loading: false, text: null, pdfB64: null, error: null, ms: null };

const CATEGORY_TABS = [
  { id: "all",         label: "Todas" },
  { id: "mei",         label: "MEI" },
  { id: "das_mei",     label: "DAS MEI" },
  { id: "pgdas",       label: "PGDAS / DAS" },
  { id: "declaracoes", label: "Declarações" },
  { id: "ecac",        label: "eCAC" },
  { id: "fiscal",      label: "Sit. Fiscal" },
  { id: "parcelamentos", label: "Parcelamentos" },
  { id: "pagamentos",  label: "PagtoWeb" },
  { id: "darf",        label: "DARF" },
];

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

// ─── Card de status do gateway ─────────────────────────────────────────────
function GatewayCard({ gw, onRefresh, loading }: { gw: GwStatus | null; onRefresh: () => void; loading: boolean }) {
  return (
    <div className="surface-card p-4 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        {gw?.online
          ? <Wifi className="h-5 w-5 text-emerald-500" />
          : <WifiOff className="h-5 w-5 text-red-400" />}
        <div>
          <p className="text-sm font-semibold text-foreground">Gateway SERPRO</p>
          <p className="text-xs text-muted-foreground">mcp.zapro.tech</p>
        </div>
      </div>
      {gw && (
        <>
          <div className="flex items-center gap-1.5">
            {gw.online
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : <AlertCircle className="h-4 w-4 text-red-400" />}
            <span className={`text-sm font-medium ${gw.online ? "text-emerald-600" : "text-red-500"}`}>
              {gw.online ? "Autenticado" : "Offline"}
            </span>
          </div>
          {gw.latencyMs > 0 && (
            <span className="text-xs text-muted-foreground">{gw.latencyMs}ms</span>
          )}
          {gw.version && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full">v{gw.version}</span>
          )}
          <span className="text-xs text-muted-foreground">
            Verificado {new Date(gw.checkedAt).toLocaleTimeString("pt-BR")}
          </span>
        </>
      )}
      <Button size="sm" variant="outline" className="ml-auto h-7 gap-1 text-xs" onClick={onRefresh} disabled={loading}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Verificar
      </Button>
    </div>
  );
}

// ─── Linha de resultado ────────────────────────────────────────────────────
function ResultRow({ state, toolName, cnpj }: { state: ResultState; toolName: string; cnpj: string }) {
  if (state.loading) return (
    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" /> Consultando…
    </div>
  );
  if (state.error) return (
    <div className="flex items-start gap-1.5 py-1.5 text-xs text-red-600">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="break-words">{state.error}</span>
    </div>
  );
  if (!state.text) return null;
  return (
    <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3">
      {state.pdfB64 && (
        <Button size="sm" variant="outline" className="mb-2 h-6 text-[11px] gap-1"
          onClick={() => downloadPdf(state.pdfB64!, `${toolName}-${cnpj}.pdf`)}>
          <Download className="h-3 w-3" /> Baixar PDF
        </Button>
      )}
      <pre className="text-[11px] leading-relaxed text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all max-h-52">
        {state.text}
      </pre>
      {state.ms != null && (
        <p className="mt-1 text-[10px] text-muted-foreground text-right">{state.ms}ms</p>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────
function SerproPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const { clientes } = useClientes();
  const { call, extractText, extractPdf } = useSerpro();

  const [gw, setGw] = useState<GwStatus | null>(null);
  const [gwLoading, setGwLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [catTab, setCatTab] = useState("all");
  const [searchTool, setSearchTool] = useState("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, ResultState>>({});

  // Verificar gateway
  async function checkGateway() {
    if (!token) return;
    setGwLoading(true);
    const t0 = Date.now();
    try {
      const res = await fetch("/api/serpro/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const s = data?.serpro?.result ?? {};
      setGw({
        online: s.token_ok === true,
        version: s.version,
        contratante: s.contratante,
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      });
    } catch {
      setGw({ online: false, checkedAt: new Date().toISOString(), latencyMs: 0 });
    } finally {
      setGwLoading(false);
    }
  }

  useEffect(() => { checkGateway(); }, [token]);

  // Cliente selecionado
  const cliente = useMemo(
    () => clientes.find((c) => c.id === selectedId) ?? null,
    [clientes, selectedId],
  );

  const regimeKey = useMemo(() => {
    const r = (cliente?.regime ?? "").toUpperCase();
    if (r === "SIMPLES NACIONAL" || r === "SIMPLES") return "SIMPLES";
    if (r === "LUCRO PRESUMIDO") return "LUCRO_PRESUMIDO";
    if (r === "LUCRO REAL") return "LUCRO_REAL";
    return r; // MEI, ISENTO, etc.
  }, [cliente]);

  const cnpj = useMemo(() => (cliente?.cnpj ?? "").replace(/\D/g, ""), [cliente]);

  // KPIs de elegibilidade
  const kpi = useMemo(() => {
    const total = SERPRO_TOOLS.length;
    const disponivel = SERPRO_TOOLS.filter((t) => {
      if (!cliente) return false;
      return checkEligibility(t.name, { regime: regimeKey, tem_certificado: (cliente as any).tem_certificado, tem_procuracao: (cliente as any).tem_procuracao }).eligible;
    }).length;
    return { total, disponivel, bloqueadas: total - disponivel };
  }, [cliente, regimeKey]);

  // Filtrar tools
  const filteredTools = useMemo(() => {
    const q = searchTool.trim().toLowerCase();
    return SERPRO_TOOLS.filter((t) => {
      if (catTab !== "all" && t.category !== catTab) return false;
      if (q && !t.name.includes(q) && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catTab, searchTool]);

  // Agrupar por categoria
  const grouped = useMemo(() => {
    return filteredTools.reduce<Record<string, typeof SERPRO_TOOLS>>((acc, t) => {
      acc[t.category] = [...(acc[t.category] ?? []), t];
      return acc;
    }, {});
  }, [filteredTools]);

  async function runTool(tool: typeof SERPRO_TOOLS[0]) {
    if (!cnpj && tool.params.includes("cnpj")) {
      toast.error("Selecione um cliente com CNPJ cadastrado");
      return;
    }
    const params: Record<string, string> = {};
    if (tool.params.includes("cnpj")) params.cnpj = cnpj;
    if (tool.params.includes("cpf") && (cliente as any)?.cpf) params.cpf = ((cliente as any).cpf as string).replace(/\D/g, "");
    if (tool.params.includes("ano")) params.ano = String(new Date().getFullYear());
    if (tool.params.includes("periodo")) {
      const d = new Date(); d.setMonth(d.getMonth() - 1);
      params.periodo = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    setResults((p) => ({ ...p, [tool.name]: { ...EMPTY_R, loading: true } }));
    const res = await call(tool.name, params, selectedId || undefined);
    const text = extractText(res);
    const pdfB64 = extractPdf(res);
    setResults((p) => ({
      ...p,
      [tool.name]: {
        loading: false,
        text: res.ok ? text : null,
        pdfB64: pdfB64 ?? null,
        error: res.ok ? null : (res.error ?? "Erro"),
        ms: res.duracao_ms ?? null,
      },
    }));
    if (res.ok) toast.success(`${tool.description} — OK`);
    else if (res.blocked) toast.warning("Consulta bloqueada: " + res.error);
    else toast.error("Erro na consulta SERPRO");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Console SERPRO"
        subtitle="61 tools disponíveis · Consultas fiscais em tempo real"
        actions={
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">mcp.zapro.tech</span>
          </div>
        }
      />

      {/* Gateway status */}
      <GatewayCard gw={gw} onRefresh={checkGateway} loading={gwLoading} />

      {/* Seletor de cliente */}
      <div className="surface-card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Cliente</p>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione um cliente…" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {c.cnpj ?? c.cpf ?? "—"}
                    {c.regime ? ` (${c.regime})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cliente && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                {regimeKey || "Regime N/D"}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium border flex items-center gap-1 ${
                (cliente as any).tem_certificado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
              }`}>
                {(cliente as any).tem_certificado ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                Certificado
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium border flex items-center gap-1 ${
                (cliente as any).tem_procuracao ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"
              }`}>
                {(cliente as any).tem_procuracao ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                Procuração
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      {cliente && (
        <KpiGrid cols={3}>
          <KpiCard label="Tools disponíveis" value={kpi.disponivel} tone="success" />
          <KpiCard label="Bloqueadas" value={kpi.bloqueadas} tone={kpi.bloqueadas > 0 ? "warning" : "neutral"} subtitle="cert/proc/regime" />
          <KpiCard label="Total no catálogo" value={kpi.total} tone="neutral" />
        </KpiGrid>
      )}

      {/* Filtros de categoria + busca */}
      <div className="space-y-3">
        <PageTabs
          tabs={CATEGORY_TABS}
          activeTab={catTab}
          onTabChange={setCatTab}
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar tool…"
            className="pl-9 h-9"
            value={searchTool}
            onChange={(e) => setSearchTool(e.target.value)}
          />
        </div>
      </div>

      {/* Tools por categoria */}
      <div className="space-y-2">
        {Object.entries(grouped).map(([cat, tools]) => {
          const isOpen = openCats[cat] ?? catTab !== "all";
          return (
            <div key={cat} className="surface-card overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setOpenCats((p) => ({ ...p, [cat]: !isOpen }))}
              >
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">{SERPRO_CATEGORIES[cat] ?? cat}</span>
                  <span className="text-xs text-muted-foreground">({tools.length})</span>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="divide-y divide-border/40 border-t border-border/40">
                  {tools.map((tool) => {
                    const elig = cliente
                      ? checkEligibility(tool.name, { regime: regimeKey, tem_certificado: (cliente as any).tem_certificado, tem_procuracao: (cliente as any).tem_procuracao })
                      : { eligible: false, reason: "Selecione um cliente" } as any;
                    const state = results[tool.name] ?? EMPTY_R;

                    return (
                      <div key={tool.name} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground">{tool.description}</p>
                              {tool.returnsPdf && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">PDF</span>
                              )}
                              {tool.isHeavy && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">Pesada</span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{tool.name}</p>
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                              Params: {tool.params.join(", ") || "—"}
                            </p>
                            {!elig.eligible && (
                              <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                {(elig as any).reason}
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
                            {state.loading ? <Loader2 className="h-3 w-3 animate-spin" />
                              : state.text ? <RefreshCw className="h-3 w-3" />
                              : <Zap className="h-3 w-3" />}
                            {state.text ? "Atualizar" : "Executar"}
                          </Button>
                        </div>
                        <ResultRow state={state} toolName={tool.name} cnpj={cnpj} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {Object.keys(grouped).length === 0 && (
          <div className="surface-card p-8 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhuma tool encontrada para "{searchTool}"</p>
          </div>
        )}
      </div>
    </div>
  );
}

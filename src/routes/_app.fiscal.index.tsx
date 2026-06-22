/**
 * Módulo Fiscal — /_app/fiscal/
 * Tabs: Dashboard | Pipeline | DAS | Documentos | Configurações
 */
import { createFileRoute } from "@tanstack/react-router";
import { fmtBRL, fmtDate } from "@/lib/format";
import { SectorGuard } from "@/components/SectorGuard";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertCircle, AlertTriangle, Calendar,
  CheckCircle2, Check, Clock, Download,
  FileText, FolderOpen, Loader2, Plus, Receipt,
  RefreshCw, Search, ShieldAlert,
  Upload, Wallet, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { KanbanModulo } from "@/components/KanbanModulo";
import { useFiscalKpis } from "@/hooks/use-fiscal-kpis";
import { useDas, type DasGuia, type DasStatus } from "@/hooks/use-das";
import { useClientes } from "@/hooks/use-clientes";
import { criarGuiasDoMes, marcarDasLoteComoGeradas } from "@/lib/das-manual";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef } from "@/components/DataTable";
import { Pagination } from "@/components/PagePlaceholder";
import { DasGerarDialog } from "@/components/DasGerarDialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/fiscal/")({
  component: FiscalModulo,
  head: () => ({ meta: [{ title: "Fiscal · APOYA Gestão" }] }),
});

// ── Helpers ───────────────────────────────────────────────────────────────
const MESES   = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ── KPI Card ──────────────────────────────────────────────────────────────
function FKpiCard({
  label, value, icon: Icon, variant = "default", loading,
}: {
  label: string; value: number | string; icon: React.ElementType;
  variant?: "default" | "warning" | "danger" | "info"; loading?: boolean;
}) {
  const styles = {
    default: { border: "border-border bg-card", icon: "text-muted-foreground",  val: "text-foreground"  },
    warning: { border: "border-yellow-200 bg-yellow-50", icon: "text-yellow-600", val: "text-yellow-700" },
    danger:  { border: "border-red-200 bg-red-50",       icon: "text-red-600",    val: "text-red-700"    },
    info:    { border: "border-blue-200 bg-blue-50",      icon: "text-blue-600",   val: "text-blue-700"   },
  }[variant];
  return (
    <Card className={cn("border transition-colors", styles.border)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-lg p-2 bg-white/60", styles.icon)}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {loading
            ? <div className="h-6 w-12 bg-muted animate-pulse rounded mt-0.5" />
            : <p className={cn("text-2xl font-bold tabular-nums leading-none mt-0.5", styles.val)}>{value}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB — DAS
// ════════════════════════════════════════════════════════════════
const DAS_COLOR: Partial<Record<DasStatus, "gray"|"blue"|"green"|"red">> = {
  pendente: "blue", gerada: "green", paga: "green", erro: "red",
};
const DAS_LABEL: Partial<Record<DasStatus, string>> = {
  pendente: "Pendente", gerada: "Gerada", paga: "Paga", erro: "Erro",
};

function DasTab() {
  const now = new Date();
  const [ano, setAno]       = useState(now.getFullYear());
  const [mes, setMes]       = useState(now.getMonth() + 1);
  const { guias: items, loading: dasLoading, error: dasError, refresh } = useDas();
  const { clientes } = useClientes();
  const [query, setQuery]   = useState("");
  const [regime, setRegime] = useState<"todos"|"MEI"|"Simples">("todos");
  const [dialogDas, setDialogDas] = useState(false);
  const [status, setStatus] = useState<"todos"|DasStatus>("todos");
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const [busy, setBusy]     = useState(false);
  const comp = `${ano}-${mes.toString().padStart(2, "0")}`;

  useEffect(() => {
    refresh();
    const fn = () => refresh();
    window.addEventListener("apoya:das:changed", fn);
    window.addEventListener("apoya:clientes:changed", fn);
    return () => { window.removeEventListener("apoya:das:changed", fn); window.removeEventListener("apoya:clientes:changed", fn); };
  }, [comp, refresh]);
  useEffect(() => setSel(new Set()), [comp]);

  const doMes = useMemo(() => items.filter(g => g.competencia === comp), [items, comp]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return doMes
      .filter(g => q ? `${g.clienteNome} ${g.cnpj}`.toLowerCase().includes(q) : true)
      .filter(g => regime === "todos" || g.regime === regime)
      .filter(g => status === "todos" || g.status === status)
      .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
  }, [doMes, query, regime, status]);

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [query, regime, status, mes, ano]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kpi = useMemo(() => ({
    total:    doMes.length,
    pendente: doMes.filter(g => g.status === "pendente").length,
    gerada:   doMes.filter(g => g.status === "gerada").length,
    paga:     doMes.filter(g => g.status === "paga").length,
    valor:    doMes.reduce((s, g) => s + g.valor, 0),
  }), [doMes]);

  const toggleAll = () => setSel(sel.size === filtered.length ? new Set() : new Set(filtered.map(g => g.id)));
  const toggleOne = (id: string) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };

  async function marcarLoteGeradas() {
    const ids = filtered
      .filter(g => sel.has(g.id) && (g.status === "pendente" || g.status === "erro"))
      .map(g => g.id);
    if (!ids.length) { toast.error("Selecione guias pendentes ou com erro"); return; }
    setBusy(true);
    try {
      const n = await marcarDasLoteComoGeradas(ids);
      await refresh();
      toast.success(`${n} guia(s) marcada(s) como gerada`);
      setSel(new Set());
    } catch (e: any) { toast.error("Erro: " + e?.message); }
    finally { setBusy(false); }
  }

  async function inicializarMes() {
    setBusy(true);
    toast.loading("Criando guias para clientes elegíveis…", { id: "das-init" });
    try {
      const { criadas, error } = await criarGuiasDoMes(comp, clientes, items);
      await refresh();
      if (error) toast.error(error, { id: "das-init" });
      else if (criadas === 0) toast.info("Todas as guias deste mês já existem", { id: "das-init" });
      else toast.success(`${criadas} guia(s) criada(s) para ${comp}`, { id: "das-init" });
    } catch (e: any) { toast.error("Erro: " + e?.message, { id: "das-init" }); }
    finally { setBusy(false); }
  }

  const cols: ColDef<DasGuia>[] = [
    {
      key: "cliente", header: "Cliente",
      cell: g => (
        <div>
          <div className="font-medium leading-tight">{g.clienteNome}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{g.cnpj}</div>
        </div>
      ),
    },
    {
      key: "regime", header: "Regime",
      headerClassName: "hidden sm:table-cell", className: "hidden sm:table-cell",
      cell: g => <InlineBadge color={g.regime === "MEI" ? "violet" : "blue"} dot>{g.regime === "Simples" ? "Simples Nacional" : g.regime}</InlineBadge>,
    },
    {
      key: "vencimento", header: "Vencimento",
      headerClassName: "hidden md:table-cell", className: "hidden md:table-cell",
      cell: g => {
        const late = g.status !== "paga" && new Date(g.vencimento) < new Date();
        return <span className={late ? "font-semibold text-red-600" : ""}>{fmtDate(g.vencimento)}{late && <span className="ml-1 text-[10px] opacity-70">atrasado</span>}</span>;
      },
    },
    {
      key: "valor", header: "Valor",
      headerClassName: "text-right", className: "text-right tabular-nums font-semibold",
      cell: g => fmtBRL(g.valor),
    },
    {
      key: "status", header: "Status",
      cell: g => (
        <div>
          <InlineBadge color={DAS_COLOR[g.status]} dot>{DAS_LABEL[g.status]}</InlineBadge>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Select value={mes.toString()} onValueChange={v => setMes(+v)}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ano.toString()} onValueChange={v => setAno(+v)}>
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setDialogDas(true)} disabled={busy} className="h-8 text-xs gap-1">
            <Plus className="h-3 w-3" /> Nova guia
          </Button>
          <Button size="sm" variant="outline" onClick={inicializarMes} disabled={busy} className="h-8 text-xs gap-1">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Inicializar mês
          </Button>
          {sel.size > 0 && (
            <Button size="sm" onClick={marcarLoteGeradas} disabled={busy} className="h-8 text-xs gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Marcar geradas ({sel.size})
            </Button>
          )}
        </div>
      </div>
      {dasError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Erro ao carregar guias DAS: {dasError}.
          <button type="button" onClick={() => refresh()} className="ml-auto underline font-medium">Tentar de novo</button>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <FKpiCard icon={FileText}      label="Total"    value={dasError ? "—" : kpi.total}          loading={dasLoading} />
        <FKpiCard icon={Clock}         label="Pendente" value={dasError ? "—" : kpi.pendente}       loading={dasLoading} variant={kpi.pendente > 0 ? "warning" : "default"} />
        <FKpiCard icon={CheckCircle2}  label="Geradas"  value={dasError ? "—" : kpi.gerada}         loading={dasLoading} variant={kpi.gerada > 0 ? "info" : "default"} />
        <FKpiCard icon={Wallet}        label="Pagas"    value={dasError ? "—" : kpi.paga}           loading={dasLoading} />
        <FKpiCard icon={AlertTriangle} label="Total R$" value={dasError ? "—" : fmtBRL(kpi.valor)}  loading={dasLoading} />
      </div>
      <DataTable
        rows={pageRows} cols={cols} getKey={g => g.id}
        selected={sel} onToggleAll={toggleAll} onToggleRow={toggleOne}
        emptyIcon={<FileText className="h-8 w-8" />}
        emptyText={`Nenhuma guia DAS para ${MESES[mes - 1]}/${ano}`}
        rowClassName={g => g.status === "paga" ? "opacity-50" : ""}
        toolbar={
          <>
            <TableSearch value={query} onChange={setQuery} placeholder="Buscar cliente ou CNPJ…" />
            <Select value={regime} onValueChange={v => setRegime(v as typeof regime)}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os regimes</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="Simples">Simples Nacional</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="gerada">Gerada</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TableFooter total={doMes.length} filtered={filtered.length} selected={sel.size} />
        <Pagination page={page} totalPages={totalPages} onChange={setPage} pageSize={PAGE_SIZE} total={filtered.length} />
      </div>
      <DasGerarDialog open={dialogDas} onClose={() => setDialogDas(false)} onCreated={() => { setDialogDas(false); refresh(); }} />
    </div>
  );
}
// ════════════════════════════════════════════════════════════════
// TAB — DOCUMENTOS FISCAIS
// ════════════════════════════════════════════════════════════════
type DocFiscal = {
  id: string; empresa_id: string; empresa_nome?: string; tipo: string;
  numero?: string; data_emissao?: string; valor_total?: number; status: string;
  xml_url?: string; pdf_url?: string; emitente_razao?: string; created_at: string;
};
const DOC_TIPOS   = ["NF-e", "NFS-e", "CT-e", "MDF-e", "SAT", "Outros"];
const DOC_S_COLOR: Record<string, "green"|"gray"|"red"|"blue"> = {
  autorizada: "green", emitida: "green", cancelada: "gray", denegada: "red", pendente: "blue",
};

function DocumentosTab() {
  const { clientes } = useClientes();
  const [docs, setDocs]           = useState<DocFiscal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState("");
  const [clienteId, setClienteId] = useState("todos");
  const [tipo, setTipo]           = useState("todos");
  const [uploading, setUploading] = useState(false);
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 20;

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("documentos_fiscais")
        .select("id,empresa_id,tipo,numero,data_emissao,valor_total,status,xml_url,pdf_url,emitente_razao,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (clienteId !== "todos") q = q.eq("empresa_id", clienteId);
      if (tipo !== "todos") q = q.eq("tipo", tipo);
      const { data, error } = await q;
      if (error) throw error;
      setDocs((data ?? []).map((d: any) => ({ ...d, empresa_nome: clientes.find(c => c.id === d.empresa_id)?.razaoSocial ?? "—" })));
    } catch (e: any) { toast.error("Erro ao carregar documentos: " + e.message); }
    finally { setLoading(false); }
  }, [clienteId, tipo, clientes]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter(d => !q || `${d.empresa_nome} ${d.numero} ${d.emitente_razao}`.toLowerCase().includes(q));
  }, [docs, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [query, clienteId, tipo]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xml") && !file.name.endsWith(".pdf")) { toast.error("Apenas XML ou PDF"); return; }
    setUploading(true);
    toast.loading("Enviando documento…", { id: "doc-up" });
    try {
      const path = `fiscal/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      toast.success("Documento enviado!", { id: "doc-up" });
      await loadDocs();
    } catch (e: any) { toast.error("Erro no upload: " + e.message, { id: "doc-up" }); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial ?? c.nomeFantasia}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {DOC_TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <TableSearch value={query} onChange={setQuery} placeholder="Buscar…" />
        </div>
        <label className={cn("inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md border border-border bg-card hover:bg-muted cursor-pointer transition-colors font-medium", uploading && "opacity-50 pointer-events-none")}>
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          Enviar XML / PDF
          <input type="file" accept=".xml,.pdf" className="sr-only" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <FKpiCard icon={FileText}      label="Total"       value={docs.length}                                                              loading={loading} />
        <FKpiCard icon={CheckCircle2}  label="Autorizadas" value={docs.filter(d => d.status === "autorizada" || d.status === "emitida").length} loading={loading} />
        <FKpiCard icon={AlertTriangle} label="Canceladas"  value={docs.filter(d => d.status === "cancelada").length}                        loading={loading} variant="warning" />
        <FKpiCard icon={AlertCircle}   label="Com erro"    value={docs.filter(d => d.status === "denegada" || d.status === "erro").length}   loading={loading} variant="danger" />
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 flex flex-col items-center gap-3 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum documento fiscal encontrado</p>
          <p className="text-xs text-muted-foreground/60">Envie XML ou PDF de NF-e, NFS-e, CT-e</p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Empresa</th>
                  <th className="px-4 py-2.5 text-left hidden md:table-cell">Tipo</th>
                  <th className="px-4 py-2.5 text-left hidden lg:table-cell">Número</th>
                  <th className="px-4 py-2.5 text-left hidden lg:table-cell">Data</th>
                  <th className="px-4 py-2.5 text-right hidden md:table-cell">Valor</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {pageRows.map(doc => (
                  <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-medium text-xs leading-tight">{doc.empresa_nome}</div>
                      {doc.emitente_razao && <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{doc.emitente_razao}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell"><InlineBadge color="blue">{doc.tipo ?? "—"}</InlineBadge></td>
                    <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs">{doc.numero ?? "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs">{doc.data_emissao ? new Date(doc.data_emissao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-right text-xs tabular-nums">{doc.valor_total != null ? fmtBRL(doc.valor_total) : "—"}</td>
                    <td className="px-4 py-3"><InlineBadge color={DOC_S_COLOR[doc.status] ?? "gray"} dot>{doc.status}</InlineBadge></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {doc.pdf_url && <a href={doc.pdf_url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Eye className="h-3 w-3" /></Button></a>}
                        {doc.xml_url && <a href={doc.xml_url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" className="h-6 w-6 p-0"><Download className="h-3 w-3" /></Button></a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TableFooter total={docs.length} filtered={filtered.length} selected={0} />
            <Pagination page={page} totalPages={totalPages} onChange={setPage} pageSize={PAGE_SIZE} total={filtered.length} />
          </div>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TAB — DASHBOARD FISCAL
// ════════════════════════════════════════════════════════════════
function DashboardTab() {
  const { kpis, loading: kpiLoading, error: kpiError, refetch } = useFiscalKpis();
  const [obrigacoes, setObrigacoes] = useState<any[]>([]);
  const [loadingOb, setLoadingOb]   = useState(true);
  const [obError, setObError]       = useState<string | null>(null);

  const loadObrigacoes = useCallback(async () => {
    setLoadingOb(true);
    setObError(null);
    try {
      const { data, error } = await supabase
        .from("obrigacoes")
        .select("id,tipo,cliente_nome,vencimento,status")
        .order("vencimento", { ascending: true })
        .limit(8);
      if (error) throw error;
      setObrigacoes(data ?? []);
    } catch (e: any) {
      setObError(e?.message ?? "Erro ao carregar obrigações");
      setObrigacoes([]);
    } finally {
      setLoadingOb(false);
    }
  }, []);

  useEffect(() => { loadObrigacoes(); }, [loadObrigacoes]);

  const hoje = new Date().toISOString().split("T")[0];
  const vencidas   = obrigacoes.filter(o => o.vencimento < hoje && !["concluida","cancelada"].includes(o.status));
  const aVencer    = obrigacoes.filter(o => o.vencimento >= hoje && !["concluida","cancelada"].includes(o.status));
  const concluidas = obrigacoes.filter(o => o.status === "concluida");

  const statusColor: Record<string, string> = {
    pendente:     "text-blue-600 bg-blue-50 border-blue-200",
    em_andamento: "text-amber-600 bg-amber-50 border-amber-200",
    concluida:    "text-emerald-600 bg-emerald-50 border-emerald-200",
    atrasada:     "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <div className="space-y-6">
      {kpiError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Erro ao carregar KPIs fiscais: {kpiError}
          <button type="button" onClick={() => refetch()} className="ml-auto underline font-medium">Tentar de novo</button>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <FKpiCard label="Obrigações Vencidas" value={kpiError ? "—" : (kpis?.obrigacoes_vencidas ?? 0)}    icon={AlertTriangle} variant={(kpis?.obrigacoes_vencidas ?? 0) > 0 ? "danger" : "default"}  loading={kpiLoading} />
        <FKpiCard label="A vencer (7 dias)"   value={kpiError ? "—" : (kpis?.obrigacoes_a_vencer_7d ?? 0)} icon={Calendar}      variant={(kpis?.obrigacoes_a_vencer_7d ?? 0) > 0 ? "warning" : "default"} loading={kpiLoading} />
        <FKpiCard label="DAS Pendentes"        value={kpiError ? "—" : (kpis?.das_pendentes ?? 0)}           icon={Receipt}       variant={(kpis?.das_pendentes ?? 0) > 0 ? "warning" : "default"}          loading={kpiLoading} />
        <FKpiCard label="Certificados < 30d"   value={kpiError ? "—" : (kpis?.certificados_expirando ?? 0)}  icon={ShieldAlert}   variant={(kpis?.certificados_expirando ?? 0) > 0 ? "warning" : "default"}  loading={kpiLoading} />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-sm font-semibold">Obrigações próximas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Ordenadas por vencimento · operação manual</p>
          </div>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => { refetch(); loadObrigacoes(); }} disabled={kpiLoading || loadingOb}>
            <RefreshCw className={cn("h-3 w-3", (kpiLoading || loadingOb) && "animate-spin")} />
          </Button>
        </div>
        {obError && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {obError}
          </div>
        )}
        {loadingOb ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : obError ? null : obrigacoes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <p className="text-sm">Nenhuma obrigação pendente</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {obrigacoes.slice(0, 7).map(ob => {
              const atrasado = ob.vencimento < hoje && !["concluida","cancelada"].includes(ob.status);
              return (
                <div key={ob.id} className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                  <div className={cn("shrink-0 h-2 w-2 rounded-full", atrasado ? "bg-red-500" : ob.status === "concluida" ? "bg-emerald-500" : "bg-blue-500")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ob.tipo}</p>
                    <p className="text-xs text-muted-foreground truncate">{ob.cliente_nome ?? "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-xs font-semibold tabular-nums", atrasado ? "text-red-600" : "text-foreground")}>
                      {fmtDate(ob.vencimento)}
                    </p>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", statusColor[ob.status] ?? "text-muted-foreground bg-muted border-border")}>
                      {ob.status?.replace("_", " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-red-600 tabular-nums">{vencidas.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Vencidas</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-amber-600 tabular-nums">{aVencer.length}</p>
          <p className="text-xs text-muted-foreground mt-1">A vencer</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-3xl font-bold text-emerald-600 tabular-nums">{concluidas.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Concluídas</p>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════
// TAB — CONFIGURAÇÕES
// ════════════════════════════════════════════════════════════════
function ConfiguracoesTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Modo de operação</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Fiscal 100% manual — sem integrações automáticas</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-muted-foreground">DAS, obrigações e documentos são registrados diretamente no Supabase pela equipe.</span>
        </div>
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div><h3 className="text-sm font-semibold">Notificações</h3><p className="text-xs text-muted-foreground mt-0.5">Informacional — o que o modo manual oferece hoje</p></div>
        <div className="space-y-2">
          {[
            { label: "Alertas críticos no Dashboard", ativo: true },
            { label: "WhatsApp via link wa.me (por cliente)", ativo: true },
            { label: "E-mail automático de pendências", ativo: false },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <div className={cn("h-2 w-2 rounded-full", item.ativo ? "bg-emerald-500" : "bg-muted-foreground/30")} />
              <span className={item.ativo ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
              {item.ativo && <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 ml-auto">Ativo</Badge>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════
function FiscalModuloInner() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão tributária manual · DAS · Obrigações · Pipeline</p>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="das">DAS</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-0">
          <KanbanModulo
              setor="fiscal"
              titulo="Processos"
              fases={[
    { key: "recebimento",  label: "Recebimento",  cor: { border: "border-t-blue-400",   bg: "bg-blue-50/30",   header: "text-blue-700",   dot: "bg-blue-400" } },
    { key: "analise",      label: "Análise",       cor: { border: "border-t-amber-400",  bg: "bg-amber-50/30",  header: "text-amber-700",  dot: "bg-amber-400" } },
    { key: "transmissao",  label: "Transmissão",   cor: { border: "border-t-purple-400", bg: "bg-purple-50/30", header: "text-purple-700", dot: "bg-purple-400" } },
    { key: "pendencias",   label: "Pendências",    cor: { border: "border-t-orange-400", bg: "bg-orange-50/30", header: "text-orange-700", dot: "bg-orange-400" } },
    { key: "concluido",    label: "Concluído",     cor: { border: "border-t-emerald-400",bg: "bg-emerald-50/30",header: "text-emerald-700",dot: "bg-emerald-400"} },
  ]}
              camposForm={[
    { key: "titulo",      label: "Descrição",     tipo: "text" as const,   placeholder: "Ex: PGDAS Maio/2026 — Empresa X", obrigatorio: true },
    { key: "tipo",        label: "Tipo",          tipo: "select" as const, opcoes: [
      { value: "pgdas",        label: "PGDAS-D" },
      { value: "das",          label: "DAS" },
      { value: "sped",         label: "SPED Fiscal" },
      { value: "ecf",          label: "ECF" },
      { value: "nfse",         label: "NFS-e" },
      { value: "outros",       label: "Outros" },
    ]},
    { key: "responsavel", label: "Responsável",   tipo: "text" as const,   placeholder: "Nome do contador" },
  ]}
            />
        </TabsContent>
        <TabsContent value="das" className="mt-0">
          <DasTab />
        </TabsContent>
        <TabsContent value="documentos" className="mt-0">
          <DocumentosTab />
        </TabsContent>
        <TabsContent value="config" className="mt-0">
          <ConfiguracoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function FiscalModulo() {
  return (
    <SectorGuard setor="fiscal">
      <FiscalModuloInner />
    </SectorGuard>
  );
}

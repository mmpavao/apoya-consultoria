/**
 * Módulo Contabilidade — /_app/contabil
 * Tabs: Pipeline | Períodos | Lançamentos | Plano de Contas | Automações | Configurações
 */
import { createFileRoute } from "@tanstack/react-router";
import { SectorGuard } from "@/components/SectorGuard";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AlertTriangle, BookOpen, CheckCircle2, Clock, Download,
  FileText, Loader2, Plus, RefreshCw, Search, ToggleLeft, ToggleRight, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleDashboard } from "@/components/layout/ModuleDashboard";
import { ModuleDocumentosTab } from "@/components/layout/ModuleDocumentosTab";
import { PipelineKanban } from "@/components/PipelineKanban";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef } from "@/components/DataTable";
import { Pagination } from "@/components/PagePlaceholder";
import { useClientes } from "@/hooks/use-clientes";
import {
  useLancamentos, usePlanoContas, usePeriodosContabeis, useAbrirPeriodo, useFecharPeriodo,
  type Lancamento, type PlanoContas, type PeriodoContabil,
} from "@/hooks/use-contabil";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/contabil")({
  component: ContabilPage,
  head: () => ({ meta: [{ title: "Contábil · APOYA Gestão" }] }),
});

const fmtBRL  = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const MESES   = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function CKpiCard({ label, value, icon: Icon, variant = "default", loading }: {
  label: string; value: number | string; icon: React.ElementType;
  variant?: "default" | "warning" | "danger" | "info"; loading?: boolean;
}) {
  const s = {
    default: { border: "border-border bg-card", icon: "text-muted-foreground",  val: "text-foreground"  },
    warning: { border: "border-yellow-200 bg-yellow-50", icon: "text-yellow-600", val: "text-yellow-700" },
    danger:  { border: "border-red-200 bg-red-50",       icon: "text-red-600",    val: "text-red-700"    },
    info:    { border: "border-blue-200 bg-blue-50",      icon: "text-blue-600",   val: "text-blue-700"   },
  }[variant];
  return (
    <Card className={cn("border transition-colors", s.border)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-lg p-2 bg-white/60", s.icon)}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {loading ? <div className="h-6 w-12 bg-muted animate-pulse rounded mt-0.5" />
            : <p className={cn("text-2xl font-bold tabular-nums leading-none mt-0.5", s.val)}>{value}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — PERÍODOS CONTÁBEIS
// ═══════════════════════════════════════════════════════════
function PeriodosTab() {
  const { clientes }          = useClientes();
  const now                   = new Date();
  const comp0                 = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [empresaId, setEmpresaId] = useState("");
  const { periodos, loading }     = usePeriodosContabeis(empresaId || undefined);
  const { abrirPeriodo, loading: abrindo } = useAbrirPeriodo();
  const { fecharPeriodo, loading: fechando } = useFecharPeriodo();
  const [showAbrir, setShowAbrir] = useState(false);
  const [form, setForm]           = useState({ empresa_id: "", competencia: comp0 });

  const cols: ColDef<PeriodoContabil>[] = [
    { key: "competencia", header: "Competência", cell: p => <span className="font-mono">{p.competencia}</span> },
    { key: "empresa", header: "Empresa", headerClassName: "hidden md:table-cell", className: "hidden md:table-cell",
      cell: p => clientes.find(c => c.id === p.empresa_id)?.razaoSocial ?? p.empresa_id },
    { key: "aberto_em", header: "Aberto em", headerClassName: "hidden lg:table-cell", className: "hidden lg:table-cell text-xs",
      cell: p => fmtDate(p.aberto_em) },
    { key: "fechado_em", header: "Fechado em", headerClassName: "hidden lg:table-cell", className: "hidden lg:table-cell text-xs",
      cell: p => fmtDate(p.fechado_em) },
    { key: "status", header: "Status",
      cell: p => <InlineBadge color={p.status === "fechado" ? "green" : "amber"} dot>{p.status === "fechado" ? "Fechado" : "Aberto"}</InlineBadge> },
    { key: "acoes", header: "", className: "text-right",
      cell: p => p.status === "aberto" ? (
        <Button size="sm" variant="outline" className="h-6 text-xs gap-1" disabled={fechando}
          onClick={() => fecharPeriodo(p.id)}>
          {fechando ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Fechar
        </Button>
      ) : null },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as empresas</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setShowAbrir(true)}>
          <Plus className="h-3 w-3" /> Abrir Período
        </Button>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : <DataTable rows={periodos} cols={cols} getKey={p => p.id}
            emptyIcon={<BookOpen className="h-8 w-8" />}
            emptyText="Nenhum período contábil encontrado — clique em Abrir Período" />}

      <Dialog open={showAbrir} onOpenChange={setShowAbrir}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Abrir Período Contábil</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-medium mb-1 block">Empresa</Label>
              <Select value={form.empresa_id} onValueChange={v => setForm(f => ({ ...f, empresa_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente…" /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Mês de referência</Label>
              <Input type="month" value={form.competencia} onChange={e => setForm(f => ({ ...f, competencia: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbrir(false)}>Cancelar</Button>
            <Button disabled={abrindo || !form.empresa_id} onClick={async () => {
              const ok = await abrirPeriodo(form.empresa_id, form.competencia);
              if (ok) { setShowAbrir(false); setForm({ empresa_id: "", competencia: comp0 }); }
            }}>{abrindo ? "Abrindo…" : "Abrir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — LANÇAMENTOS CONTÁBEIS
// ═══════════════════════════════════════════════════════════
function LancamentosTab() {
  const { clientes }              = useClientes();
  const now                       = new Date();
  const [empresaId, setEmpresaId] = useState("");
  const [ano, setAno]             = useState(now.getFullYear());
  const [mes, setMes]             = useState(now.getMonth() + 1);
  const [query, setQuery]         = useState("");
  const [page, setPage]           = useState(1);
  const comp = `${ano}-${String(mes).padStart(2, "0")}`;
  const { lancamentos, loading, totais } = useLancamentos(empresaId, comp);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lancamentos.filter(l => !q || l.historico.toLowerCase().includes(q) || l.conta_debito.includes(q) || l.conta_credito.includes(q));
  }, [lancamentos, query]);

  useEffect(() => setPage(1), [query, empresaId, mes, ano]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const cols: ColDef<Lancamento>[] = [
    { key: "data", header: "Data", cell: l => <span className="text-xs tabular-nums">{fmtDate(l.data_lancamento)}</span> },
    { key: "historico", header: "Histórico", cell: l => <span className="text-sm">{l.historico}</span> },
    { key: "debito", header: "Conta Débito", headerClassName: "hidden md:table-cell font-mono", className: "hidden md:table-cell text-xs font-mono", cell: l => l.conta_debito },
    { key: "credito", header: "Conta Crédito", headerClassName: "hidden md:table-cell font-mono", className: "hidden md:table-cell text-xs font-mono", cell: l => l.conta_credito },
    { key: "valor", header: "Valor", headerClassName: "text-right", className: "text-right tabular-nums font-semibold", cell: l => fmtBRL(l.valor) },
    { key: "tipo", header: "Tipo", cell: l => <InlineBadge color={l.tipo === "debito" ? "red" : "green"} dot>{l.tipo}</InlineBadge> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Selecionar empresa…" /></SelectTrigger>
            <SelectContent>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={mes.toString()} onValueChange={v => setMes(+v)}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ano.toString()} onValueChange={v => setAno(+v)}>
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[now.getFullYear() - 1, now.getFullYear()].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <TableSearch value={query} onChange={setQuery} placeholder="Buscar histórico…" />
        </div>
      </div>
      {empresaId && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <CKpiCard icon={FileText}     label="Lançamentos"   value={lancamentos.length} />
          <CKpiCard icon={AlertTriangle} label="Total Débitos" value={fmtBRL(totais.totalDebito)}  variant="warning" />
          <CKpiCard icon={CheckCircle2} label="Total Créditos" value={fmtBRL(totais.totalCredito)} />
        </div>
      )}
      {!empresaId ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Selecione uma empresa e período para ver os lançamentos</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <DataTable rows={pageRows} cols={cols} getKey={l => l.id}
            emptyIcon={<FileText className="h-8 w-8" />}
            emptyText="Nenhum lançamento neste período" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TableFooter total={lancamentos.length} filtered={filtered.length} selected={0} />
            <Pagination page={page} totalPages={totalPages} onChange={setPage} pageSize={PAGE_SIZE} total={filtered.length} />
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — PLANO DE CONTAS
// ═══════════════════════════════════════════════════════════
const PLANO_PADRAO = [
  { codigo: "1", nome: "ATIVO", tipo: "sintetica", nivel: 1, filhos: [
    { codigo: "1.1", nome: "Ativo Circulante", tipo: "sintetica", nivel: 2, filhos: [
      { codigo: "1.1.1", nome: "Caixa e Equivalentes", tipo: "analitica", nivel: 3 },
      { codigo: "1.1.2", nome: "Contas a Receber", tipo: "analitica", nivel: 3 },
      { codigo: "1.1.3", nome: "Estoques", tipo: "analitica", nivel: 3 },
    ]},
    { codigo: "1.2", nome: "Ativo Não Circulante", tipo: "sintetica", nivel: 2, filhos: [
      { codigo: "1.2.1", nome: "Imobilizado", tipo: "analitica", nivel: 3 },
    ]},
  ]},
  { codigo: "2", nome: "PASSIVO", tipo: "sintetica", nivel: 1, filhos: [
    { codigo: "2.1", nome: "Passivo Circulante", tipo: "sintetica", nivel: 2, filhos: [
      { codigo: "2.1.1", nome: "Fornecedores", tipo: "analitica", nivel: 3 },
      { codigo: "2.1.2", nome: "Obrigações Fiscais", tipo: "analitica", nivel: 3 },
      { codigo: "2.1.3", nome: "Obrigações Trabalhistas", tipo: "analitica", nivel: 3 },
    ]},
  ]},
  { codigo: "3", nome: "PATRIMÔNIO LÍQUIDO", tipo: "sintetica", nivel: 1, filhos: [
    { codigo: "3.1", nome: "Capital Social", tipo: "analitica", nivel: 2 },
    { codigo: "3.2", nome: "Reservas", tipo: "analitica", nivel: 2 },
    { codigo: "3.3", nome: "Lucros/Prejuízos Acumulados", tipo: "analitica", nivel: 2 },
  ]},
  { codigo: "4", nome: "RECEITAS", tipo: "sintetica", nivel: 1, filhos: [
    { codigo: "4.1", nome: "Receitas Operacionais", tipo: "analitica", nivel: 2 },
    { codigo: "4.2", nome: "Receitas Financeiras", tipo: "analitica", nivel: 2 },
  ]},
  { codigo: "5", nome: "DESPESAS", tipo: "sintetica", nivel: 1, filhos: [
    { codigo: "5.1", nome: "Despesas Operacionais", tipo: "analitica", nivel: 2 },
    { codigo: "5.2", nome: "Despesas Administrativas", tipo: "analitica", nivel: 2 },
    { codigo: "5.3", nome: "Despesas Financeiras", tipo: "analitica", nivel: 2 },
  ]},
];

type ContaNode = { codigo: string; nome: string; tipo: string; nivel: number; filhos?: ContaNode[] };

function ContaRow({ conta, depth }: { conta: ContaNode; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const temFilhos = (conta.filhos?.length ?? 0) > 0;
  return (
    <>
      <tr className="hover:bg-muted/20 transition-colors">
        <td className="px-4 py-2" style={{ paddingLeft: `${16 + depth * 24}px` }}>
          <div className="flex items-center gap-2">
            {temFilhos ? (
              <button onClick={() => setOpen(o => !o)} className="text-muted-foreground hover:text-foreground">
                <span className="text-xs">{open ? "▼" : "▶"}</span>
              </button>
            ) : <span className="w-3 inline-block" />}
            <span className="font-mono text-xs text-muted-foreground">{conta.codigo}</span>
            <span className={cn("text-sm", depth === 0 && "font-bold", depth === 1 && "font-semibold")}>{conta.nome}</span>
          </div>
        </td>
        <td className="px-4 py-2">
          <InlineBadge color={conta.tipo === "analitica" ? "blue" : "gray"}>{conta.tipo}</InlineBadge>
        </td>
        <td className="px-4 py-2 text-center text-xs text-muted-foreground">{conta.nivel}</td>
      </tr>
      {open && conta.filhos?.map(f => <ContaRow key={f.codigo} conta={f} depth={depth + 1} />)}
    </>
  );
}

function PlanoContasTab() {
  const { clientes }              = useClientes();
  const [empresaId, setEmpresaId] = useState("");
  const { contas: planoContas, loading }  = usePlanoContas(empresaId);
  const [query, setQuery]         = useState("");

  // Se não tem plano personalizado, usar o padrão
  const hasCustom = planoContas.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Plano padrão (CFC)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Plano padrão (CFC)</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar conta…" className="pl-9 h-8 text-sm w-56" />
        </div>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="px-4 py-2.5 text-left">Conta</th>
              <th className="px-4 py-2.5 text-left">Tipo</th>
              <th className="px-4 py-2.5 text-center">Nível</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {loading ? (
              <tr><td colSpan={3} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
            ) : hasCustom ? (
              planoContas.filter((c: PlanoContas) => !query || c.nome.toLowerCase().includes(query.toLowerCase()) || c.codigo.includes(query)).map((c: PlanoContas) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2" style={{ paddingLeft: `${16 + (c.nivel - 1) * 24}px` }}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">{c.codigo}</span>
                    <span className={cn("text-sm", c.nivel === 1 && "font-bold", c.nivel === 2 && "font-semibold")}>{c.nome}</span>
                  </td>
                  <td className="px-4 py-2"><InlineBadge color={c.tipo === "analitica" ? "blue" : "gray"}>{c.tipo}</InlineBadge></td>
                  <td className="px-4 py-2 text-center text-xs">{c.nivel}</td>
                </tr>
              ))
            ) : (
              PLANO_PADRAO.map(c => <ContaRow key={c.codigo} conta={c} depth={0} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — AUTOMAÇÕES CONTÁBEIS
// ═══════════════════════════════════════════════════════════
type AutoContabil = { id: string; nome: string; descricao: string; agente: string; frequencia: string; ativa: boolean; ultima_resultado?: "ok"|"erro" };

const AUTOS_CONTABIL: AutoContabil[] = [
  { id: "1", nome: "Reconciliação Bancária",  descricao: "Concilia extratos bancários com lançamentos automaticamente", agente: "agente-financeiro",  frequencia: "Diário",        ativa: true,  ultima_resultado: "ok" },
  { id: "2", nome: "Fechamento Mensal",        descricao: "Fecha período e gera balancete ao fim do mês",               agente: "agente-orquestrador", frequencia: "Mensal dia 28", ativa: false },
  { id: "3", nome: "Alerta Divergências",      descricao: "Notifica quando detecta divergências no período",            agente: "agente-financeiro",  frequencia: "Diário",        ativa: true,  ultima_resultado: "ok" },
  { id: "4", nome: "Importar NF-e",            descricao: "Importa NF-e recebidas e classifica por CFOP automaticamente", agente: "agente-fiscal",    frequencia: "Semanal",       ativa: false },
];

function AutomacoesContabil() {
  const { session } = useAuth();
  const [autos, setAutos]         = useState<AutoContabil[]>(AUTOS_CONTABIL);
  const [runningId, setRunningId] = useState<string | null>(null);
  const toggle = (id: string) => setAutos(a => a.map(x => x.id === id ? { ...x, ativa: !x.ativa } : x));

  async function executar(id: string, agente: string) {
    if (!session?.access_token) { toast.error("Sessão expirada"); return; }
    setRunningId(id);
    toast.loading(`Executando ${agente}…`, { id: "auto-cob" });
    try {
      const res = await fetch(`https://ajaqbdsalxfgrwpjbtbn.supabase.co/functions/v1/${agente}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ trigger: "manual" }),
      });
      if (res.ok) { toast.success("Agente executado!", { id: "auto-cob" }); setAutos(a => a.map(x => x.id === id ? { ...x, ultima_resultado: "ok" } : x)); }
      else { const d = await res.json().catch(() => ({})); toast.error((d as any)?.error ?? "Erro", { id: "auto-cob" }); }
    } catch (e: any) { toast.error("Erro: " + e?.message, { id: "auto-cob" }); }
    finally { setRunningId(null); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Agentes de automação contábil — reconciliação, fechamento e alertas.</p>
      {autos.map(a => (
        <div key={a.id} className="rounded-lg border bg-card p-4 flex items-start gap-4">
          <div className={cn("mt-1 h-2.5 w-2.5 rounded-full shrink-0", a.ativa ? "bg-emerald-500" : "bg-muted-foreground/30")} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{a.nome}</p>
              {a.ultima_resultado === "ok"  && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              {a.ultima_resultado === "erro" && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{a.descricao}</p>
            <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
              <span>Agente: <code className="text-foreground">{a.agente}</code></span>
              <span>Freq: <strong className="text-foreground">{a.frequencia}</strong></span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={runningId === a.id} onClick={() => executar(a.id, a.agente)}>
              {runningId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />} Executar
            </Button>
            <button onClick={() => toggle(a.id)} className={cn("p-1 rounded", a.ativa ? "text-emerald-600" : "text-muted-foreground/40")}>
              {a.ativa ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — CONFIGURAÇÕES CONTÁBEIS
// ═══════════════════════════════════════════════════════════
function ConfigContabil() {
  const [configs, setConfigs] = useState([
    { label: "Aprovação antes de fechar período",       ativo: true },
    { label: "Gerar balancete automaticamente",         ativo: false },
    { label: "Notificar divergências ao contador",      ativo: true },
    { label: "Importar NF-e automaticamente",           ativo: false },
    { label: "Reconciliação bancária automática",       ativo: true },
  ]);
  const toggle = (i: number) => setConfigs(c => c.map((x, j) => j === i ? { ...x, ativo: !x.ativo } : x));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Preferências Contábeis</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {configs.map((c, i) => (
            <div key={c.label} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggle(i)}>
              <span className="text-sm">{c.label}</span>
              <div className={cn("h-5 w-9 rounded-full transition-colors relative", c.ativo ? "bg-emerald-500" : "bg-muted-foreground/30")}>
                <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", c.ativo ? "translate-x-4" : "translate-x-0.5")} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Integração Bancária</h3>
        <p className="text-xs text-muted-foreground">Conecte o extrato bancário para reconciliação automática.</p>
        <div className="grid gap-2 md:grid-cols-3">
          {[{ label: "Status", val: "Não configurado" }, { label: "Banco", val: "—" }, { label: "Última sync", val: "—" }].map(item => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-sm font-medium">{item.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
function ContabilPageInner() {
  const { roles }                   = useAuth();
  const { periodos, loading: pLoad } = usePeriodosContabeis();
  const podeAprovar = roles.includes("admin") || roles.includes("contador");

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const abertos  = periodos.filter(p => p.status === "aberto").length;
  const fechados  = periodos.filter(p => p.status === "fechado").length;
  const semPeriodo = 0; // calculado no servidor

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contabilidade</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Lançamentos, períodos e fechamento mensal · competência {mesAtual.split("-").reverse().join("/")}</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1"><RefreshCw className="h-4 w-4" /> Atualizar</Button>
      </div>


      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="periodos">Períodos</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="plano_contas">Plano de Contas</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-0">
          <ModuleDashboard
            kpis={[
              { label: "Períodos Abertos",  value: abertos,    icon: Clock,         variant: abertos > 0 ? "warning" : "default" },
              { label: "Períodos Fechados", value: fechados,   icon: CheckCircle2,  variant: "default" },
              { label: "Sem Período",       value: semPeriodo, icon: BookOpen,      variant: semPeriodo > 0 ? "danger" : "default" },
              { label: "Com Divergência",   value: 0,          icon: AlertTriangle, variant: "default" },
            ]}
            kpisLoading={pLoad}
            agente={{ nome: "Agente Financeiro", edge_fn: "agente-financeiro" }}
            quickActions={[
              { label: "Novo Lançamento", icon: BookOpen,      onClick: () => {}, variant: "outline" },
              { label: "Fechar Período",  icon: CheckCircle2,  onClick: () => {}, variant: "outline" },
            ]}
          />
        </TabsContent>
        <TabsContent value="pipeline"     className="mt-0"><PipelineKanban setor="contabil" podeAprovar={podeAprovar} /></TabsContent>
        <TabsContent value="periodos"     className="mt-0"><PeriodosTab /></TabsContent>
        <TabsContent value="lancamentos"  className="mt-0"><LancamentosTab /></TabsContent>
        <TabsContent value="plano_contas" className="mt-0"><PlanoContasTab /></TabsContent>
        <TabsContent value="documentos"   className="mt-0"><ModuleDocumentosTab modulo="contabil" /></TabsContent>
        <TabsContent value="automacoes"   className="mt-0"><AutomacoesContabil /></TabsContent>
        <TabsContent value="config"       className="mt-0"><ConfigContabil /></TabsContent>
      </Tabs>
    </div>
  );
}

function ContabilPage() {
  return <SectorGuard setor="contabil"><ContabilPageInner /></SectorGuard>;
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fmtBRL, fmtDate } from "@/lib/format";
import { SectorGuard } from "@/components/SectorGuard";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AlertTriangle, ArrowRight, Calendar, CheckCircle2, Clock,
  Download, FileText, Loader2, Plus, RefreshCw, Search,
  ToggleLeft, ToggleRight, Trash2, Users, Wallet, Zap,
} from "lucide-react";
import { toast } from "sonner";
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
import { useDepartamentoConfig } from "@/hooks/use-departamento-config";
import { ModuleDocumentosTab } from "@/components/layout/ModuleDocumentosTab";
import { KanbanModulo } from "@/components/KanbanModulo";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef } from "@/components/DataTable";
import { Pagination } from "@/components/PagePlaceholder";
import { useClientes } from "@/hooks/use-clientes";
import { useEsocial } from "@/hooks/use-esocial";
import {
  useFuncionarios, useFolhaMensal, useFerias, useRescisoes, useCreateFolha, useFecharFolha,
  type Funcionario, type FolhaMensal, type Ferias, type Rescisao,
} from "@/hooks/use-dp";
import { useAuth } from "@/hooks/use-auth";
import { FuncionarioFormDialog } from "@/components/dp";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/dp")({
  component: DpPage,
  head: () => ({ meta: [{ title: "Dep. Pessoal · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function DKpiCard({ label, value, icon: Icon, variant = "default", loading }: {
  label: string; value: number | string; icon: React.ElementType;
  variant?: "default" | "warning" | "danger" | "info"; loading?: boolean;
}) {
  const s = {
    default: { border: "border-border bg-card", icon: "text-muted-foreground", val: "text-foreground" },
    warning: { border: "border-yellow-200 bg-yellow-50", icon: "text-yellow-600", val: "text-yellow-700" },
    danger:  { border: "border-red-200 bg-red-50",       icon: "text-red-600",    val: "text-red-700"   },
    info:    { border: "border-blue-200 bg-blue-50",      icon: "text-blue-600",   val: "text-blue-700"  },
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
// TAB — EMPRESAS / FUNCIONÁRIOS
// ═══════════════════════════════════════════════════════════
const REGIME_CLS: Record<string, string> = {
  "Simples":         "bg-blue-100 text-blue-700",
  "Lucro Presumido": "bg-purple-100 text-purple-700",
  "Lucro Real":      "bg-gray-100 text-gray-600",
  "MEI":             "bg-green-100 text-green-700",
  "Doméstica":       "bg-pink-100 text-pink-700",
};

function EmpresasTab() {
  const navigate = useNavigate();
  const { clientes, loading } = useClientes();
  const { funcionarios: todos } = useFuncionarios();
  const [query, setQuery] = useState("");
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoEmpresa, setNovoEmpresa] = useState("");

  const por_empresa = useMemo(() => {
    const m: Record<string, number> = {};
    todos.filter(f => f.status === "ativo").forEach(f => { m[f.empresa_id] = (m[f.empresa_id] ?? 0) + 1; });
    return m;
  }, [todos]);

  const filtrados = useMemo(() =>
    clientes.filter(c => !query || c.razaoSocial.toLowerCase().includes(query.toLowerCase()))
  , [clientes, query]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar empresa…" className="pl-9 h-8 text-sm" />
        </div>
        <span className="text-xs text-muted-foreground">{filtrados.length} empresas</span>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="px-4 py-2.5 text-left">Empresa</th>
              <th className="px-4 py-2.5 text-left hidden sm:table-cell">Regime</th>
              <th className="px-4 py-2.5 text-center hidden md:table-cell">Funcionários</th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtrados.length === 0 && (
              <tr><td colSpan={4} className="text-center text-muted-foreground py-10 text-sm">Nenhuma empresa encontrada</td></tr>
            )}
            {filtrados.map(c => (
              <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.razaoSocial}</div>
                  <div className="text-xs text-muted-foreground font-mono">{c.cnpj}</div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", REGIME_CLS[c.regime ?? "Simples"] ?? REGIME_CLS["Simples"])}>{c.regime ?? "Simples"}</span>
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <span className="font-semibold">{por_empresa[c.id] ?? 0}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setNovoEmpresa(c.id); setNovoOpen(true); }} title="Novo funcionário">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => navigate({ to: "/dp/$empresaId", params: { empresaId: c.id } })}>
                      Ver DP <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {novoOpen && novoEmpresa && (
        <FuncionarioFormDialog open={novoOpen} onClose={() => setNovoOpen(false)} empresaId={novoEmpresa} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — FOLHA DE PAGAMENTO
// ═══════════════════════════════════════════════════════════
function FolhaTab({ autoNovo = 0 }: { autoNovo?: number }) {
  const navigate = useNavigate();
  const now = new Date();
  const [ano, setAno]           = useState(now.getFullYear());
  const { clientes }            = useClientes();
  const [empresaId, setEmpresaId] = useState("");
  const [folhas, setFolhas]     = useState<FolhaMensal[]>([]);
  const [loading, setLoading]   = useState(false);
  const [creating, setCreating] = useState(false);
  const [fechandoId, setFechandoId] = useState<string|null>(null);
  const { createFolha } = useCreateFolha();
  const { fecharFolha } = useFecharFolha();

  const compAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [showNova, setShowNova] = useState(false);
  const [novaForm, setNovaForm] = useState({ empresa_id: "", competencia: compAtual });

  // quickAction do dashboard abre o modal (já com a empresa selecionada, se houver)
  useEffect(() => {
    if (autoNovo > 0) {
      setNovaForm({ empresa_id: empresaId, competencia: compAtual });
      setShowNova(true);
    }
  }, [autoNovo]);

  async function salvarNovaFolha() {
    if (!novaForm.empresa_id) { toast.error("Selecione a empresa"); return; }
    setCreating(true);
    const ok = await createFolha(novaForm.empresa_id, novaForm.competencia);
    setCreating(false);
    if (ok) {
      setShowNova(false);
      if (novaForm.empresa_id === empresaId) loadFolhas();
      else setEmpresaId(novaForm.empresa_id);
    }
  }

  const loadFolhas = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data } = await (supabase as any).from("folha_mensal")
        .select("*").eq("empresa_id", empresaId)
        .gte("competencia", `${ano}-01`).lte("competencia", `${ano}-12`)
        .order("competencia", { ascending: false });
      setFolhas(data ?? []);
    } finally { setLoading(false); }
  }, [empresaId, ano]);

  useEffect(() => { loadFolhas(); }, [loadFolhas]);

  const kpi = useMemo(() => ({
    total:    folhas.length,
    abertas:  folhas.filter(f => f.status === "aberta").length,
    fechadas: folhas.filter(f => f.status === "fechada").length,
    liquido:  folhas.reduce((s: number, f: FolhaMensal) => s + (f.total_liquido ?? 0), 0),
  }), [folhas]);

  const cols: ColDef<FolhaMensal>[] = [
    { key: "competencia", header: "Competência", cell: (f: FolhaMensal) => <span className="font-mono text-sm">{f.competencia}</span> },
    { key: "funcionarios", header: "Funcionários", headerClassName: "text-center", className: "text-center", cell: (f: FolhaMensal) => f.total_funcionarios },
    { key: "proventos", header: "Proventos", headerClassName: "text-right", className: "text-right tabular-nums", cell: (f: FolhaMensal) => fmtBRL(f.total_proventos) },
    { key: "descontos", header: "Descontos", headerClassName: "text-right", className: "text-right tabular-nums text-red-600", cell: (f: FolhaMensal) => fmtBRL(f.total_descontos) },
    { key: "liquido", header: "Líquido", headerClassName: "text-right", className: "text-right tabular-nums font-semibold", cell: (f: FolhaMensal) => fmtBRL(f.total_liquido) },
    {
      key: "status", header: "Status",
      cell: (f: FolhaMensal) => (
        <InlineBadge color={f.status === "fechada" ? "green" : f.status === "enviada" ? "blue" : "amber"} dot>
          {f.status === "aberta" ? "Aberta" : f.status === "fechada" ? "Fechada" : "Enviada"}
        </InlineBadge>
      ),
    },
    {
      key: "acoes", header: "", className: "text-right",
      cell: (f: FolhaMensal) => (
        <div className="inline-flex gap-1 justify-end">
          <Button size="sm" variant="outline" className="h-6 text-xs gap-1"
            onClick={() => navigate({ to: "/dp/$empresaId", params: { empresaId } })}>
            <ArrowRight className="h-3 w-3" /> Linhas
          </Button>
          {f.status === "aberta" && (
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1" disabled={fechandoId === f.id}
              onClick={async () => { setFechandoId(f.id); await fecharFolha(f.id); await loadFolhas(); setFechandoId(null); }}>
              {fechandoId === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Fechar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Selecionar empresa…" /></SelectTrigger>
            <SelectContent>
              {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ano.toString()} onValueChange={v => setAno(+v)}>
            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[now.getFullYear() - 1, now.getFullYear()].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1"
          onClick={() => { setNovaForm({ empresa_id: empresaId, competencia: compAtual }); setShowNova(true); }}>
          <Plus className="h-3 w-3" /> Nova Folha
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DKpiCard icon={FileText}     label="Total folhas"  value={kpi.total}           loading={loading} />
        <DKpiCard icon={Clock}        label="Abertas"       value={kpi.abertas}         loading={loading} variant={kpi.abertas > 0 ? "warning" : "default"} />
        <DKpiCard icon={CheckCircle2} label="Fechadas"      value={kpi.fechadas}        loading={loading} />
        <DKpiCard icon={Wallet}       label="Líquido total" value={fmtBRL(kpi.liquido)} loading={loading} />
      </div>
      {!empresaId ? (
        <div className="rounded-lg border border-dashed bg-card p-10 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Selecione uma empresa para ver as folhas</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <DataTable rows={folhas} cols={cols} getKey={(f: FolhaMensal) => f.id}
          emptyIcon={<FileText className="h-8 w-8" />}
          emptyText="Nenhuma folha neste período — clique em Nova Folha para criar" />
      )}

      <Dialog open={showNova} onOpenChange={setShowNova}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Folha de Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-medium mb-1 block">Empresa</Label>
              <Select value={novaForm.empresa_id} onValueChange={v => setNovaForm(f => ({ ...f, empresa_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar empresa…" /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Competência</Label>
              <Input type="month" value={novaForm.competencia} onChange={e => setNovaForm(f => ({ ...f, competencia: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground mt-1">Calcula INSS/IRRF/FGTS dos funcionários ativos. <strong>Valores estimados</strong> — confira as tabelas (alíquotas) vigentes.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNova(false)}>Cancelar</Button>
            <Button disabled={creating || !novaForm.empresa_id} onClick={salvarNovaFolha}>{creating ? "Abrindo…" : "Abrir Folha"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — FÉRIAS
// ═══════════════════════════════════════════════════════════
function FeriasTab() {
  const { clientes }       = useClientes();
  const [empresaId, setEmpresaId] = useState("");
  const { ferias, loading } = useFerias(empresaId || undefined);

  const hoje = new Date().toISOString().split("T")[0];
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const vencendo = ferias.filter(f => f.status === "pendente" && f.periodo_aquisitivo_fim <= em30);

  const cols: ColDef<Ferias>[] = [
    {
      key: "func", header: "Funcionário",
      cell: f => (
        <div>
          <div className="font-medium">{(f.funcionario as any)?.nome ?? "—"}</div>
          <div className="text-xs text-muted-foreground">{(f.funcionario as any)?.cargo ?? ""}</div>
        </div>
      ),
    },
    { key: "aq_ini", header: "Per. Aquisitivo", headerClassName: "hidden md:table-cell", className: "hidden md:table-cell text-xs",
      cell: f => `${fmtDate(f.periodo_aquisitivo_ini)} → ${fmtDate(f.periodo_aquisitivo_fim)}` },
    { key: "gozo", header: "Gozo", cell: f => f.gozo_inicio ? `${fmtDate(f.gozo_inicio)} (${f.dias_gozo}d)` : "—" },
    { key: "valor", header: "Valor", headerClassName: "text-right hidden md:table-cell", className: "text-right tabular-nums hidden md:table-cell",
      cell: f => f.valor_total ? fmtBRL(f.valor_total) : "—" },
    {
      key: "status", header: "Status",
      cell: f => {
        const venc = f.status === "pendente" && f.periodo_aquisitivo_fim <= hoje;
        return <InlineBadge color={f.status === "paga" ? "green" : f.status === "agendada" ? "blue" : venc ? "red" : "amber"} dot>
          {venc ? "Vencida" : f.status === "paga" ? "Paga" : f.status === "agendada" ? "Agendada" : "Pendente"}
        </InlineBadge>;
      },
    },
  ];

  return (
    <div className="space-y-4">
      {vencendo.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <strong>{vencendo.length}</strong> férias vencendo nos próximos 30 dias
        </div>
      )}
      <div className="flex items-center gap-2">
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as empresas</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : <DataTable rows={ferias} cols={cols} getKey={f => f.id}
            emptyIcon={<Calendar className="h-8 w-8" />}
            emptyText="Nenhuma férias registrada para esta seleção" />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — eSocial
// ═══════════════════════════════════════════════════════════
// Catálogo dos eventos oficiais eSocial (referência fixa); o STATUS é por
// empresa+competência, vindo do banco (esocial_evento), marcado à mão.
type EsocialEventoCat = { codigo: string; nome: string; descricao: string };
const ESOCIAL_CATALOGO: EsocialEventoCat[] = [
  { codigo: "S-1000", nome: "Inf. do Empregador",     descricao: "Dados cadastrais da empresa e do estabelecimento" },
  { codigo: "S-1005", nome: "Tabela de Est.",          descricao: "Informações dos estabelecimentos" },
  { codigo: "S-1020", nome: "Tabela de Lotações",      descricao: "Informações de lotações tributárias" },
  { codigo: "S-1070", nome: "Processos Adm./Jud.",     descricao: "Processos administrativos e judiciais" },
  { codigo: "S-2200", nome: "Cad. Inicial Trab.",      descricao: "Cadastramento inicial do vínculo empregatício" },
  { codigo: "S-2205", nome: "Alt. Cadastral Trab.",    descricao: "Alterações nos dados cadastrais do trabalhador" },
  { codigo: "S-2206", nome: "Alt. Contratual Trab.",   descricao: "Alterações nos dados contratuais" },
  { codigo: "S-2230", nome: "Afastamento Temp.",       descricao: "Afastamentos temporários (doença, licença, etc.)" },
  { codigo: "S-2299", nome: "Desligamento",            descricao: "Comunicação de desligamento do trabalhador" },
  { codigo: "S-1200", nome: "Remuneração Trab.",       descricao: "Remuneração de trabalhadores vinculados ao empregador" },
  { codigo: "S-1210", nome: "Pagamentos/Rendimentos",  descricao: "Pagamentos de rendimentos tributados pelo IRRF" },
  { codigo: "S-1299", nome: "Fechamento Ev. Periód.",  descricao: "Fechamento dos eventos periódicos do mês" },
];

function competenciasEsocial(): string[] {
  const list: string[] = []; const now = new Date();
  for (let i = 0; i < 12; i++) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); list.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); }
  return list;
}
function fmtComp(c: string) { const [y,m]=c.split("-"); const M=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]; return `${M[+m-1]}/${y}`; }

function EsocialTab() {
  const { clientes } = useClientes();
  const now = new Date();
  const [empresaId, setEmpresaId]   = useState("");
  const [competencia, setCompetencia] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const [filtro, setFiltro] = useState<"todos"|"pendente"|"transmitido"|"erro">("todos");
  const { registros, loading, marcar } = useEsocial(empresaId, competencia);

  const eventos = ESOCIAL_CATALOGO.map(c => {
    const r = registros[c.codigo];
    return { ...c, status: (r?.status ?? "pendente") as "pendente"|"transmitido"|"erro", transmitido_em: r?.transmitido_em, observacoes: r?.observacoes };
  });
  const filtrados   = eventos.filter(e => filtro === "todos" || e.status === filtro);
  const transmitidos = eventos.filter(e => e.status === "transmitido").length;
  const pendentes   = eventos.filter(e => e.status === "pendente").length;
  const erros       = eventos.filter(e => e.status === "erro").length;
  const podeMarcar  = !!empresaId;

  return (
    <div className="space-y-4">
      {/* Controle MANUAL — não transmite ao gov; é o acompanhamento interno do escritório. */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-2 text-sm text-blue-700">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Controle manual do eSocial (status por empresa/competência). A transmissão ao gov é feita à parte — aqui você acompanha o que já foi enviado.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={empresaId} onValueChange={setEmpresaId}>
          <SelectTrigger className="h-8 w-56 text-xs"><SelectValue placeholder="Selecionar empresa…" /></SelectTrigger>
          <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={competencia} onValueChange={setCompetencia}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{competenciasEsocial().map(c => <SelectItem key={c} value={c}>{fmtComp(c)}</SelectItem>)}</SelectContent>
        </Select>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DKpiCard icon={CheckCircle2}  label="Transmitidos" value={transmitidos} variant="default" />
        <DKpiCard icon={Clock}         label="Pendentes"    value={pendentes}    variant={pendentes > 0 ? "warning" : "default"} />
        <DKpiCard icon={AlertTriangle} label="Com erro"     value={erros}        variant={erros > 0 ? "danger" : "default"} />
      </div>

      <div className="flex gap-1">
        {(["todos","transmitido","pendente","erro"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={cn("px-3 py-1 text-xs rounded-full border transition-colors",
              filtro === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/40"
            )}>{f === "todos" ? "Todos" : f === "transmitido" ? "Transmitidos" : f === "pendente" ? "Pendentes" : "Erros"}</button>
        ))}
      </div>

      {!empresaId && <p className="text-xs text-muted-foreground">Selecione uma empresa para acompanhar e marcar os eventos.</p>}

      <div className="space-y-2">
        {filtrados.map(ev => (
          <div key={ev.codigo} className="rounded-lg border bg-card px-4 py-3 flex items-start gap-4">
            <div className={cn("mt-0.5 shrink-0 h-2.5 w-2.5 rounded-full", ev.status === "transmitido" ? "bg-emerald-500" : ev.status === "erro" ? "bg-red-500" : "bg-amber-500")} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{ev.codigo}</span>
                <p className="text-sm font-medium">{ev.nome}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{ev.descricao}</p>
              {ev.transmitido_em && <p className="text-[11px] text-muted-foreground mt-1">Transmitido em: {fmtDate(ev.transmitido_em)}</p>}
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium border",
                ev.status === "transmitido" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                ev.status === "erro"        ? "bg-red-50 text-red-700 border-red-200" :
                "bg-amber-50 text-amber-700 border-amber-200"
              )}>
                {ev.status === "transmitido" ? "Transmitido" : ev.status === "erro" ? "Erro" : "Pendente"}
              </span>
              {podeMarcar && (
                <div className="flex gap-1">
                  {ev.status !== "transmitido" && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-emerald-700" onClick={() => marcar(ev.codigo, "transmitido")}>Transmitido</Button>}
                  {ev.status !== "erro"        && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-red-600" onClick={() => marcar(ev.codigo, "erro")}>Erro</Button>}
                  {ev.status !== "pendente"    && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={() => marcar(ev.codigo, "pendente")}>Pendente</Button>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — CONFIGURAÇÕES DP
// ═══════════════════════════════════════════════════════════
const DP_PREFS = [
  { key: "fgts_auto",        label: "Calcular FGTS automaticamente",          def: true },
  { key: "alerta_rescisao",  label: "Alertar rescisões pendentes",            def: true },
  { key: "aprovacao_folha",  label: "Aprovação antes de fechar folha",        def: false },
  { key: "notif_ferias",     label: "Notificação de férias vencendo (30d)",   def: true },
  { key: "esocial_auto",     label: "Transmissão eSocial (desativada — manual)", def: false },
];

function ConfigDP() {
  const { config, loading, saving, save } = useDepartamentoConfig("dp");
  const [vals, setVals] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setVals(Object.fromEntries(DP_PREFS.map(p => [p.key, (config[p.key] as boolean) ?? p.def])));
  }, [config]);
  const toggle = (key: string) => setVals(v => ({ ...v, [key]: !v[key] }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Preferências do DP</h3>
          <Button size="sm" className="h-8 text-xs gap-1" disabled={saving || loading} onClick={() => save(vals)}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Salvar
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {DP_PREFS.map(p => (
            <div key={p.key} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggle(p.key)}>
              <span className="text-sm">{p.label}</span>
              <div className={cn("h-5 w-9 rounded-full transition-colors relative", vals[p.key] ? "bg-emerald-500" : "bg-muted-foreground/30")}>
                <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", vals[p.key] ? "translate-x-4" : "translate-x-0.5")} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">eSocial</h3>
        <p className="text-xs text-muted-foreground">
          Transmissão manual — registre eventos na aba eSocial ou marque status após enviar pelo portal do governo.
        </p>
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Sem integração automática com o eSocial nesta versão.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
function DpPageInner() {
  const { roles } = useAuth();
  const { funcionarios: todos, loading: funcLoading, refresh: refreshFunc } = useFuncionarios();
  const { ferias } = useFerias();
  const [tab, setTab] = useState("dashboard");
  const [novaFolhaNonce, setNovaFolhaNonce] = useState(0);
  const podeAprovar = roles.includes("admin") || roles.includes("contador");

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const ativos      = todos.filter(f => f.status === "ativo").length;
  const demitidos   = todos.filter(f => f.status === "demitido" && f.data_demissao?.startsWith(mesAtual)).length;
  const feriasVenc  = ferias.filter(f => f.status === "pendente" && f.periodo_aquisitivo_fim <= em30).length;

  const [esocialPendentes, setEsocialPendentes] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      const { count, error } = await (supabase as any)
        .from("esocial_evento")
        .select("*", { count: "exact", head: true })
        .eq("competencia", mesAtual)
        .eq("status", "pendente");
      setEsocialPendentes(error ? null : (count ?? 0));
    })();
  }, [mesAtual, funcLoading]);

  const esocialKpi = esocialPendentes === null ? "—" : esocialPendentes;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departamento Pessoal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão centralizada de funcionários, folha e férias</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => refreshFunc()}>
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>


      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
          <TabsTrigger value="esocial">eSocial</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-0">
          <ModuleDashboard
            kpis={[
              { label: "Funcionários Ativos",   value: ativos,      icon: Users,         variant: "default" },
              { label: "Férias Vencendo (30d)", value: feriasVenc,  icon: Calendar,      variant: feriasVenc > 0 ? "warning" : "default" },
              { label: "Rescisões do Mês",      value: demitidos,   icon: FileText,      variant: demitidos > 0 ? "danger" : "default" },
              { label: "eSocial pendentes", value: esocialKpi, icon: CheckCircle2, variant: (typeof esocialKpi === "number" && esocialKpi > 0) ? "warning" as const : "default" },
            ]}
            kpisLoading={funcLoading}
            quickActions={[
              { label: "Nova Folha", icon: FileText, onClick: () => { setTab("folha"); setNovaFolhaNonce(n => n + 1); }, variant: "outline" },
              { label: "Registrar Férias", icon: Calendar, onClick: () => setTab("ferias"), variant: "outline" },
            ]}
          />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-0"><KanbanModulo
              setor="dp"
              titulo="Processos"
              fases={[
    { key: "admissao",    label: "Admissão",      cor: { border: "border-t-blue-400",   bg: "bg-blue-50/30",   header: "text-blue-700",   dot: "bg-blue-400" } },
    { key: "folha",       label: "Folha",         cor: { border: "border-t-amber-400",  bg: "bg-amber-50/30",  header: "text-amber-700",  dot: "bg-amber-400" } },
    { key: "esocial",     label: "eSocial",       cor: { border: "border-t-purple-400", bg: "bg-purple-50/30", header: "text-purple-700", dot: "bg-purple-400" } },
    { key: "rescisao",    label: "Rescisão",      cor: { border: "border-t-orange-400", bg: "bg-orange-50/30", header: "text-orange-700", dot: "bg-orange-400" } },
    { key: "concluido",   label: "Concluído",     cor: { border: "border-t-emerald-400",bg: "bg-emerald-50/30",header: "text-emerald-700",dot: "bg-emerald-400"} },
  ]}
              camposForm={[
    { key: "titulo",      label: "Descrição",     tipo: "text" as const,   placeholder: "Ex: Admissão João Silva — Empresa Y", obrigatorio: true },
    { key: "tipo",        label: "Tipo",          tipo: "select" as const, opcoes: [
      { value: "admissao",    label: "Admissão" },
      { value: "folha",       label: "Folha de Pagamento" },
      { value: "ferias",      label: "Férias" },
      { value: "rescisao",    label: "Rescisão" },
      { value: "esocial",     label: "eSocial" },
      { value: "outros",      label: "Outros" },
    ]},
    { key: "responsavel", label: "Responsável",   tipo: "text" as const,   placeholder: "Nome do analista" },
  ]}
            /></TabsContent>
        <TabsContent value="empresas" className="mt-0"><EmpresasTab /></TabsContent>
        <TabsContent value="folha"    className="mt-0"><FolhaTab autoNovo={novaFolhaNonce} /></TabsContent>
        <TabsContent value="ferias"   className="mt-0"><FeriasTab /></TabsContent>
        <TabsContent value="esocial"  className="mt-0"><EsocialTab /></TabsContent>
        <TabsContent value="documentos" className="mt-0"><ModuleDocumentosTab modulo="dp" /></TabsContent>
        <TabsContent value="config"   className="mt-0"><ConfigDP /></TabsContent>
      </Tabs>
    </div>
  );
}

function DpPage() {
  return <SectorGuard setor="dp"><DpPageInner /></SectorGuard>;
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineKanban } from "@/components/PipelineKanban";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef } from "@/components/DataTable";
import { Pagination } from "@/components/PagePlaceholder";
import { useClientes } from "@/hooks/use-clientes";
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

const fmtBRL  = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
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
function FolhaTab() {
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

  const now2 = new Date();
  const comp = `${ano}-${String(now2.getMonth() + 1).padStart(2, "0")}`;

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
      cell: (f: FolhaMensal) => f.status === "aberta" ? (
        <Button size="sm" variant="outline" className="h-6 text-xs gap-1" disabled={fechandoId === f.id}
          onClick={async () => { setFechandoId(f.id); await fecharFolha(f.id); await loadFolhas(); setFechandoId(null); }}>
          {fechandoId === f.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Fechar
        </Button>
      ) : null,
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
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1" disabled={!empresaId || creating}
          onClick={async () => { setCreating(true); await createFolha(empresaId, comp); await loadFolhas(); setCreating(false); }}>
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Nova Folha
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
type EsocialEvento = { codigo: string; nome: string; descricao: string; status: "ok"|"pendente"|"erro"; ultima_transmissao?: string };

const ESOCIAL_EVENTOS: EsocialEvento[] = [
  { codigo: "S-1000", nome: "Inf. do Empregador",     descricao: "Dados cadastrais da empresa e do estabelecimento",          status: "ok",      ultima_transmissao: "2026-06-01" },
  { codigo: "S-1005", nome: "Tabela de Est.",          descricao: "Informações dos estabelecimentos",                          status: "ok",      ultima_transmissao: "2026-06-01" },
  { codigo: "S-1020", nome: "Tabela de Lotações",      descricao: "Informações de lotações tributárias",                      status: "ok",      ultima_transmissao: "2026-06-01" },
  { codigo: "S-1070", nome: "Processos Adm./Jud.",     descricao: "Processos administrativos e judiciais",                    status: "pendente" },
  { codigo: "S-2200", nome: "Cad. Inicial Trab.",      descricao: "Cadastramento inicial do vínculo empregatício",            status: "ok",      ultima_transmissao: "2026-06-10" },
  { codigo: "S-2205", nome: "Alt. Cadastral Trab.",    descricao: "Alterações nos dados cadastrais do trabalhador",           status: "ok",      ultima_transmissao: "2026-05-15" },
  { codigo: "S-2206", nome: "Alt. Contratual Trab.",   descricao: "Alterações nos dados contratuais",                        status: "pendente" },
  { codigo: "S-2230", nome: "Afastamento Temp.",       descricao: "Afastamentos temporários (doença, licença, etc.)",        status: "ok",      ultima_transmissao: "2026-05-20" },
  { codigo: "S-2299", nome: "Desligamento",            descricao: "Comunicação de desligamento do trabalhador",              status: "ok",      ultima_transmissao: "2026-06-05" },
  { codigo: "S-1200", nome: "Remuneração Trab.",       descricao: "Remuneração de trabalhadores vinculados ao empregador",   status: "pendente" },
  { codigo: "S-1210", nome: "Pagamentos/Rendimentos",  descricao: "Pagamentos de rendimentos tributados pelo IRRF",          status: "pendente" },
  { codigo: "S-1299", nome: "Fechamento Ev. Periód.",  descricao: "Fechamento dos eventos periódicos do mês",               status: "pendente" },
];

function EsocialTab() {
  const [filtro, setFiltro] = useState<"todos"|"pendente"|"ok"|"erro">("todos");

  const filtrados = ESOCIAL_EVENTOS.filter(e => filtro === "todos" || e.status === filtro);
  const pendentes = ESOCIAL_EVENTOS.filter(e => e.status === "pendente").length;
  const erros     = ESOCIAL_EVENTOS.filter(e => e.status === "erro").length;

  return (
    <div className="space-y-4">
      {pendentes > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <strong>{pendentes}</strong> eventos eSocial pendentes de transmissão
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        <DKpiCard icon={CheckCircle2} label="Transmitidos" value={ESOCIAL_EVENTOS.filter(e => e.status === "ok").length}      variant="default" />
        <DKpiCard icon={Clock}        label="Pendentes"    value={pendentes}    variant={pendentes > 0 ? "warning" : "default"} />
        <DKpiCard icon={AlertTriangle} label="Com erro"    value={erros}        variant={erros > 0 ? "danger" : "default"} />
      </div>
      <div className="flex gap-1">
        {(["todos","ok","pendente","erro"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={cn("px-3 py-1 text-xs rounded-full border transition-colors",
              filtro === f ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/40"
            )}>{f === "todos" ? "Todos" : f === "ok" ? "Transmitidos" : f === "pendente" ? "Pendentes" : "Erros"}</button>
        ))}
      </div>
      <div className="space-y-2">
        {filtrados.map(ev => (
          <div key={ev.codigo} className="rounded-lg border bg-card px-4 py-3 flex items-start gap-4">
            <div className={cn("mt-0.5 shrink-0 h-2.5 w-2.5 rounded-full", ev.status === "ok" ? "bg-emerald-500" : ev.status === "erro" ? "bg-red-500" : "bg-amber-500")} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{ev.codigo}</span>
                <p className="text-sm font-medium">{ev.nome}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{ev.descricao}</p>
              {ev.ultima_transmissao && <p className="text-[11px] text-muted-foreground mt-1">Última transmissão: {fmtDate(ev.ultima_transmissao)}</p>}
            </div>
            <div className="shrink-0">
              <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium border",
                ev.status === "ok"      ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                ev.status === "erro"    ? "bg-red-50 text-red-700 border-red-200" :
                "bg-amber-50 text-amber-700 border-amber-200"
              )}>
                {ev.status === "ok" ? "Transmitido" : ev.status === "erro" ? "Erro" : "Pendente"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// TAB — AUTOMAÇÕES DP
// ═══════════════════════════════════════════════════════════
type AutoDP = { id: string; nome: string; descricao: string; agente: string; frequencia: string; ativa: boolean; ultima_resultado?: "ok"|"erro" };

const AUTOS_DP: AutoDP[] = [
  { id: "1", nome: "Monitor eSocial",   descricao: "Verifica eventos vencidos e transmite automaticamente", agente: "agente-rh",    frequencia: "Diário 07:00", ativa: true,  ultima_resultado: "ok" },
  { id: "2", nome: "Alerta Férias 30d", descricao: "Notifica 30 dias antes do vencimento do período",       agente: "agente-rh",    frequencia: "Semanal",      ativa: true,  ultima_resultado: "ok" },
  { id: "3", nome: "Fechamento Folha",  descricao: "Consolida e fecha a folha mensal automaticamente",      agente: "agente-rh",    frequencia: "Mensal dia 25",ativa: false },
  { id: "4", nome: "Alerta Rescisão",   descricao: "Lembra documentos pendentes de rescisão",               agente: "agente-rh",    frequencia: "Diário",       ativa: true,  ultima_resultado: "ok" },
];

function AutomacoesDP() {
  const { session } = useAuth();
  const [autos, setAutos]       = useState<AutoDP[]>(AUTOS_DP);
  const [runningId, setRunningId] = useState<string | null>(null);
  const toggle = (id: string) => setAutos(a => a.map(x => x.id === id ? { ...x, ativa: !x.ativa } : x));

  async function executar(id: string, agente: string) {
    if (!session?.access_token) { toast.error("Sessão expirada"); return; }
    setRunningId(id);
    toast.loading(`Executando ${agente}…`, { id: "auto-dp" });
    try {
      const res = await fetch(`https://ajaqbdsalxfgrwpjbtbn.supabase.co/functions/v1/${agente}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ trigger: "manual" }),
      });
      if (res.ok) { toast.success("Agente executado!", { id: "auto-dp" }); setAutos(a => a.map(x => x.id === id ? { ...x, ultima_resultado: "ok" } : x)); }
      else { const d = await res.json().catch(() => ({})); toast.error((d as any)?.error ?? "Erro", { id: "auto-dp" }); setAutos(a => a.map(x => x.id === id ? { ...x, ultima_resultado: "erro" } : x)); }
    } catch (e: any) { toast.error("Erro: " + e?.message, { id: "auto-dp" }); }
    finally { setRunningId(null); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Agentes autônomos para monitoramento e automação do Departamento Pessoal.</p>
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
// TAB — CONFIGURAÇÕES DP
// ═══════════════════════════════════════════════════════════
function ConfigDP() {
  const [configs, setConfigs] = useState([
    { label: "Calcular FGTS automaticamente",       ativo: true },
    { label: "Alertar rescisões pendentes",           ativo: true },
    { label: "Aprovação antes de fechar folha",       ativo: false },
    { label: "Notificação de férias vencendo (30d)",  ativo: true },
    { label: "Transmissão eSocial automática",        ativo: false },
  ]);
  const toggle = (i: number) => setConfigs(c => c.map((x, j) => j === i ? { ...x, ativo: !x.ativo } : x));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Preferências do DP</h3>
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
        <h3 className="text-sm font-semibold">eSocial</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {[{ label: "Ambiente", val: "Produção" }, { label: "Versão do leiaute", val: "2.5" }, { label: "Status", val: "Conectado" }, { label: "Certificado", val: "Válido até 12/2026" }].map(item => (
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
function DpPageInner() {
  const { roles } = useAuth();
  const { funcionarios: todos, loading: funcLoading } = useFuncionarios();
  const { ferias } = useFerias();
  const podeAprovar = roles.includes("admin") || roles.includes("contador");

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const em30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const ativos      = todos.filter(f => f.status === "ativo").length;
  const demitidos   = todos.filter(f => f.status === "demitido" && f.data_demissao?.startsWith(mesAtual)).length;
  const feriasVenc  = ferias.filter(f => f.status === "pendente" && f.periodo_aquisitivo_fim <= em30).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departamento Pessoal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão centralizada de funcionários, folha e férias</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <DKpiCard icon={Users}         label="Funcionários Ativos"   value={ativos}     loading={funcLoading} />
        <DKpiCard icon={Calendar}      label="Férias Vencendo (30d)" value={feriasVenc} loading={funcLoading} variant={feriasVenc > 0 ? "warning" : "default"} />
        <DKpiCard icon={FileText}      label="Rescisões do Mês"      value={demitidos}  loading={funcLoading} variant={demitidos > 0 ? "danger" : "default"} />
        <DKpiCard icon={CheckCircle2}  label="eSocial Pendentes"     value={ESOCIAL_EVENTOS.filter(e => e.status === "pendente").length} variant="warning" />
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
          <TabsTrigger value="esocial">eSocial</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-0"><PipelineKanban setor="dp" podeAprovar={podeAprovar} /></TabsContent>
        <TabsContent value="empresas" className="mt-0"><EmpresasTab /></TabsContent>
        <TabsContent value="folha"    className="mt-0"><FolhaTab /></TabsContent>
        <TabsContent value="ferias"   className="mt-0"><FeriasTab /></TabsContent>
        <TabsContent value="esocial"  className="mt-0"><EsocialTab /></TabsContent>
        <TabsContent value="automacoes" className="mt-0"><AutomacoesDP /></TabsContent>
        <TabsContent value="config"   className="mt-0"><ConfigDP /></TabsContent>
      </Tabs>
    </div>
  );
}

function DpPage() {
  return <SectorGuard setor="dp"><DpPageInner /></SectorGuard>;
}

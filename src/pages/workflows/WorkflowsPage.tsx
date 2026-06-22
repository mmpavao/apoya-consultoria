import { useState, useMemo, useRef } from "react";
import {
  Plus, LayoutGrid, List, BarChart3, Calendar, Search,
  RefreshCw, Filter, ChevronDown, TrendingUp, Clock,
  AlertTriangle, CheckCircle2, Users,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useTarefas, Tarefa, TarefaStatus, TarefaTipo, TarefaPrioridade, SlaStatus } from "@/hooks/use-tarefas";
import { useResponsaveis } from "@/hooks/use-responsaveis";
import {
  BadgeStatus, BadgePrioridade, BadgeSLA, BadgeTipo, AvatarResponsavel,
  TIPO_LABEL, PRIORIDADE_LABEL, STATUS_LABEL,
  PRIORIDADE_EMOJI, TIPO_DOT, STATUS_CSS, formatData, formatDataCurta, formatDataRelativa,
  responsavelInitials,
} from "./tarefa-utils";
import { TarefaModal }  from "./TarefaModal";
import { NovaTarefaForm } from "./NovaTarefaForm";

/* ─── Kanban columns ─────────────────────────────────────────────────────── */
const COLS: { status: TarefaStatus; label: string; accent: string; bg: string }[] = [
  { status: "aberta",               label: "Aberta",             accent: "border-t-blue-400",    bg: "bg-blue-50/60"   },
  { status: "em_andamento",         label: "Em Andamento",       accent: "border-t-amber-400",   bg: "bg-amber-50/60"  },
  { status: "aguardando_aprovacao", label: "Aguard. Aprovação",  accent: "border-t-violet-400",  bg: "bg-violet-50/60" },
  { status: "aprovada",             label: "Aprovada / Rejeit.", accent: "border-t-emerald-400", bg: "bg-emerald-50/60"},
  { status: "concluida",            label: "Concluída",          accent: "border-t-slate-400",   bg: "bg-slate-50/60"  },
];

export default function WorkflowsPage() {
  const [view,  setView]  = useState<"kanban"|"lista"|"timeline"|"dashboard">("kanban");
  const [tarefa, setTarefa]         = useState<Tarefa | null>(null);
  const [novaTarefa, setNovaTarefa] = useState(false);

  // Filtros
  const [fBusca,      setFBusca]      = useState("");
  const [fResp,       setFResp]       = useState("");
  const [fTipo,       setFTipo]       = useState("");
  const [fStatus,     setFStatus]     = useState("");
  const [fPrior,      setFPrior]      = useState("");
  const [fSla,        setFSla]        = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { tarefas, loading, refetch, atualizarTarefa } = useTarefas();
  const { responsaveis } = useResponsaveis();

  const filtered = useMemo(() => tarefas.filter(t => {
    if (fResp   && t.responsavel !== fResp)   return false;
    if (fTipo   && t.tipo       !== fTipo)    return false;
    if (fStatus && t.status     !== fStatus)  return false;
    if (fPrior  && t.prioridade !== fPrior)   return false;
    if (fSla    && t.sla_status !== fSla)     return false;
    if (fBusca  && !t.titulo.toLowerCase().includes(fBusca.toLowerCase()) && !t.cliente_nome?.toLowerCase().includes(fBusca.toLowerCase())) return false;
    return true;
  }), [tarefas, fResp, fTipo, fStatus, fPrior, fSla, fBusca]);

  const hasFilters = !!(fResp || fTipo || fStatus || fPrior || fSla || fBusca);
  function clearFilters() { setFResp(""); setFTipo(""); setFStatus(""); setFPrior(""); setFSla(""); setFBusca(""); }

  const kpiTotal   = tarefas.length;
  const kpiAberta  = tarefas.filter(t => t.status === "aberta").length;
  const kpiAtras   = tarefas.filter(t => t.sla_status === "atrasada" || t.sla_status === "expirada").length;
  const kpiConcl   = tarefas.filter(t => t.status === "concluida").length;

  return (
    <div className="flex flex-col h-full bg-background min-h-screen animate-fade-up">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-0 bg-card border-b border-border">
        {/* Título + ações */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
              Workflows
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Central de tarefas e aprovações do escritório</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5 h-9">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </Button>
            <Button onClick={() => setNovaTarefa(true)} className="gap-1.5 h-9 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4" /> Nova Tarefa
            </Button>
          </div>
        </div>

        {/* KPI strip */}
        {!loading && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total",      value: kpiTotal,  icon: TrendingUp,    color: "text-slate-600",  bg: "bg-slate-100" },
              { label: "Abertas",    value: kpiAberta, icon: Clock,         color: "text-blue-600",   bg: "bg-blue-100"  },
              { label: "Atrasadas",  value: kpiAtras,  icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-100"   },
              { label: "Concluídas", value: kpiConcl,  icon: CheckCircle2,  color: "text-emerald-600",bg: "bg-emerald-100"},
            ].map(kpi => (
              <div key={kpi.label} className="surface-card flex items-center gap-3 px-4 py-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground leading-none">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Barra de busca + filtros toggle */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefa ou cliente…"
              value={fBusca}
              onChange={e => setFBusca(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
              hasFilters ? "bg-primary/10 text-primary border-primary/30" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros
            {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground underline">limpar</button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} tarefa{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Filtros expansíveis */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 pb-3 pt-1">
            {[
              {
                placeholder: "Responsável", val: fResp, fn: setFResp,
                opts: responsaveis.map(r => ({ v: r.nome, l: r.nome })),
              },
              {
                placeholder: "Tipo", val: fTipo, fn: setFTipo,
                opts: (Object.keys(TIPO_LABEL) as TarefaTipo[]).map(t => ({ v: t, l: TIPO_LABEL[t] })),
              },
              {
                placeholder: "Status", val: fStatus, fn: setFStatus,
                opts: (Object.keys(STATUS_LABEL) as TarefaStatus[]).map(s => ({ v: s, l: STATUS_LABEL[s] })),
              },
              {
                placeholder: "Prioridade", val: fPrior, fn: setFPrior,
                opts: (["critica","alta","media","baixa"] as TarefaPrioridade[]).map(p => ({ v: p, l: `${PRIORIDADE_EMOJI[p]} ${PRIORIDADE_LABEL[p]}` })),
              },
              {
                placeholder: "SLA", val: fSla, fn: setFSla,
                opts: [
                  { v: "no_prazo", l: "🟢 No prazo"  },
                  { v: "atencao",  l: "🟡 Atenção"   },
                  { v: "atrasada", l: "🔴 Atrasada"  },
                  { v: "expirada", l: "💀 Expirada"  },
                ],
              },
            ].map(f => (
              <Select key={f.placeholder} value={f.val || "all"} onValueChange={v => f.fn(v === "all" ? "" : v)}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder={f.placeholder} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {f.opts.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            ))}
          </div>
        )}

        {/* Tabs de visão */}
        <div className="flex gap-0.5">
          {([
            { key: "kanban",    label: "Kanban",    icon: LayoutGrid },
            { key: "lista",     label: "Lista",     icon: List       },
            { key: "timeline",  label: "Timeline",  icon: Calendar   },
            { key: "dashboard", label: "Dashboard", icon: BarChart3  },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                view === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <p className="text-sm">Carregando tarefas…</p>
          </div>
        ) : (
          <>
            {view === "kanban"    && <KanbanView  tarefas={filtered} onSelect={setTarefa} onMove={atualizarTarefa} />}
            {view === "lista"     && <ListaView   tarefas={filtered} onSelect={setTarefa} />}
            {view === "timeline"  && <TimelineView tarefas={filtered} onSelect={setTarefa} />}
            {view === "dashboard" && <DashboardView tarefas={filtered} onSelect={setTarefa} />}
          </>
        )}
      </div>

      {/* Modais */}
      {tarefa && <TarefaModal tarefa={tarefa} open={!!tarefa} onClose={() => setTarefa(null)} />}
      <NovaTarefaForm open={novaTarefa} onClose={() => setNovaTarefa(false)} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   KANBAN
   ═══════════════════════════════════════════════════════════════════════════ */
function KanbanView({ tarefas, onSelect, onMove }: {
  tarefas: Tarefa[];
  onSelect: (t: Tarefa) => void;
  onMove: (id: string, u: Partial<Tarefa>, q: string) => void;
}) {
  const [dragId, setDragId] = useState<string|null>(null);

  return (
    <div className="flex gap-3 p-4 overflow-x-auto h-full min-h-[calc(100vh-320px)]">
      {COLS.map(col => {
        const items = tarefas.filter(t =>
          col.status === "aprovada"
            ? t.status === "aprovada" || t.status === "rejeitada"
            : t.status === col.status
        );
        return (
          <div
            key={col.status}
            className={`flex-shrink-0 w-72 rounded-xl border border-border border-t-4 ${col.accent} ${col.bg} flex flex-col`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragId) { onMove(dragId, { status: col.status }, "Daniel Araújo"); setDragId(null); }}}
          >
            {/* Col header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
              <span className="text-sm font-semibold text-foreground">{col.label}</span>
              <span className="w-5 h-5 rounded-full bg-white border border-border text-[10px] font-bold text-muted-foreground flex items-center justify-center">
                {items.length}
              </span>
            </div>
            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {items.map(t => (
                <KanbanCard key={t.id} tarefa={t} onSelect={onSelect}
                  onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} />
              ))}
              {items.length === 0 && (
                <div className="flex items-center justify-center h-16 text-xs text-muted-foreground border-2 border-dashed border-border/50 rounded-lg">
                  Nenhuma tarefa
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ tarefa: t, onSelect, onDragStart, onDragEnd }: {
  tarefa: Tarefa; onSelect: (t: Tarefa) => void;
  onDragStart: () => void; onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(t)}
      className="bg-white rounded-xl border border-border p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all select-none group"
    >
      {/* Tipo dot + prioridade */}
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className={`w-2 h-2 rounded-full ${TIPO_DOT[t.tipo]}`} />
          {TIPO_LABEL[t.tipo]}
        </span>
        <span className="text-xs">{PRIORIDADE_EMOJI[t.prioridade]}</span>
      </div>
      {/* Título */}
      <p className="text-sm font-medium text-foreground line-clamp-2 mb-2 leading-snug">{t.titulo}</p>
      {/* Cliente */}
      {t.cliente_nome && (
        <p className="text-xs text-muted-foreground mb-2 truncate">📁 {t.cliente_nome}</p>
      )}
      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[9px] font-bold flex items-center justify-center">
            {responsavelInitials(t.responsavel)}
          </div>
          <span className="text-[10px] text-muted-foreground">{t.responsavel.split(" ")[0]}</span>
        </div>
        {t.sla_status && t.data_prazo && <BadgeSLA sla_status={t.sla_status} data_prazo={t.data_prazo} />}
      </div>
      {/* Progresso subtarefas */}
      {t.subtarefas_total > 0 && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Subtarefas</span>
            <span>{t.subtarefas_concluidas}/{t.subtarefas_total}</span>
          </div>
          <Progress value={Math.round((t.subtarefas_concluidas / t.subtarefas_total) * 100)} className="h-1" />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LISTA
   ═══════════════════════════════════════════════════════════════════════════ */
function ListaView({ tarefas, onSelect }: { tarefas: Tarefa[]; onSelect: (t: Tarefa) => void }) {
  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="surface-card overflow-hidden">
        <table className="ft-table w-full">
          <thead>
            <tr>
              <th className="text-left pl-4">Tarefa</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Responsável</th>
              <th>SLA</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            {tarefas.map(t => (
              <tr key={t.id} className="cursor-pointer" onClick={() => onSelect(t)}>
                <td className="pl-4 max-w-xs">
                  <div>
                    <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                    {t.cliente_nome && <p className="text-xs text-muted-foreground truncate">{t.cliente_nome}</p>}
                  </div>
                </td>
                <td><BadgeTipo tipo={t.tipo} /></td>
                <td><BadgeStatus status={t.status} /></td>
                <td><BadgePrioridade prioridade={t.prioridade} /></td>
                <td>
                  <span className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {responsavelInitials(t.responsavel)}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.responsavel}</span>
                  </span>
                </td>
                <td>
                  {t.sla_status && t.data_prazo ? <BadgeSLA sla_status={t.sla_status} data_prazo={t.data_prazo} /> : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="text-xs text-muted-foreground">{formatDataCurta(t.data_prazo)}</td>
              </tr>
            ))}
            {tarefas.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                  Nenhuma tarefa encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TIMELINE
   ═══════════════════════════════════════════════════════════════════════════ */
function TimelineView({ tarefas, onSelect }: { tarefas: Tarefa[]; onSelect: (t: Tarefa) => void }) {
  const comPrazo = tarefas
    .filter(t => t.data_prazo)
    .sort((a, b) => new Date(a.data_prazo!).getTime() - new Date(b.data_prazo!).getTime());
  const semPrazo = tarefas.filter(t => !t.data_prazo);

  return (
    <div className="p-4 overflow-y-auto h-full space-y-6">
      <div className="surface-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> Com prazo definido ({comPrazo.length})
        </h3>
        {comPrazo.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tarefa com prazo</p>}
        <div className="relative">
          {comPrazo.length > 0 && <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />}
          <div className="space-y-3">
            {comPrazo.map(t => (
              <div key={t.id} className="flex gap-4 pl-8 relative cursor-pointer group" onClick={() => onSelect(t)}>
                <div className="absolute left-1.5 top-2 w-3 h-3 rounded-full border-2 border-white bg-primary shadow-sm" />
                <div className="flex-1 bg-slate-50 rounded-xl px-4 py-3 border border-border group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                      {t.cliente_nome && <p className="text-xs text-muted-foreground">{t.cliente_nome}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <BadgeStatus status={t.status} />
                      {t.sla_status && t.data_prazo && <BadgeSLA sla_status={t.sla_status} data_prazo={t.data_prazo} />}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>📅 {formatData(t.data_prazo)}</span>
                    <span>•</span>
                    <span>{t.responsavel}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {semPrazo.length > 0 && (
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Sem prazo definido ({semPrazo.length})</h3>
          <div className="grid grid-cols-2 gap-2">
            {semPrazo.map(t => (
              <div key={t.id} onClick={() => onSelect(t)} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-all text-sm">
                <span className={`w-2 h-2 rounded-full ${TIPO_DOT[t.tipo]}`} />
                <span className="truncate text-foreground">{t.titulo}</span>
                <BadgeStatus status={t.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════════════════════ */
function DashboardView({ tarefas, onSelect }: { tarefas: Tarefa[]; onSelect: (t: Tarefa) => void }) {
  // Distribuição por status
  const byStatus = COLS.map(c => ({
    label: c.label,
    count: tarefas.filter(t => c.status === "aprovada" ? (t.status === "aprovada" || t.status === "rejeitada") : t.status === c.status).length,
    accent: c.accent,
  }));
  const maxByStatus = Math.max(...byStatus.map(s => s.count), 1);

  // Por tipo
  const byTipo = (Object.keys(TIPO_LABEL) as TarefaTipo[]).map(tipo => ({
    tipo, label: TIPO_LABEL[tipo],
    count: tarefas.filter(t => t.tipo === tipo).length,
  })).filter(x => x.count > 0).sort((a,b) => b.count - a.count);

  // Por responsável
  const byResp = Object.values(
    tarefas.reduce((acc, t) => {
      const cur = acc[t.responsavel] ?? { nome: t.responsavel, count: 0, atrasadas: 0 };
      cur.count += 1;
      if (t.sla_status === "atrasada" || t.sla_status === "expirada") cur.atrasadas += 1;
      acc[t.responsavel] = cur;
      return acc;
    }, {} as Record<string, { nome: string; count: number; atrasadas: number }>),
  ).sort((a, b) => b.count - a.count);

  // Urgentes
  const urgentes = tarefas
    .filter(t => t.sla_status === "atrasada" || t.sla_status === "expirada" || t.prioridade === "critica")
    .slice(0, 6);

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="grid grid-cols-2 gap-4">
        {/* Distribuição por status */}
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> Por Status
          </h3>
          <div className="space-y-3">
            {byStatus.map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-semibold text-foreground">{s.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(s.count / maxByStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por tipo */}
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Por Tipo
          </h3>
          <div className="space-y-2">
            {byTipo.map(({ tipo, label, count }) => (
              <div key={tipo} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TIPO_DOT[tipo]}`} />
                <span className="text-sm text-muted-foreground flex-1">{label}</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-24">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(count / tarefas.length) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground w-5 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranking responsáveis */}
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Por Responsável
          </h3>
          <div className="space-y-3">
            {byResp.slice(0, 6).map(r => (
              <div key={r.nome} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 bg-blue-100 text-blue-700">
                  {responsavelInitials(r.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{r.nome}</p>
                  {r.atrasadas > 0 && <p className="text-[10px] text-red-500">{r.atrasadas} atrasada{r.atrasadas !== 1 ? "s" : ""}</p>}
                </div>
                <span className="text-sm font-bold text-foreground">{r.count}</span>
              </div>
            ))}
            {byResp.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado</p>}
          </div>
        </div>

        {/* Urgentes */}
        <div className="surface-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Atenção Imediata
          </h3>
          <div className="space-y-2">
            {urgentes.map(t => (
              <div key={t.id} onClick={() => onSelect(t)} className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-100 hover:border-red-300 cursor-pointer transition-all group">
                <span className={`w-2 h-2 rounded-full shrink-0 ${TIPO_DOT[t.tipo]}`} />
                <span className="text-xs font-medium text-foreground truncate flex-1">{t.titulo}</span>
                <BadgeSLA sla_status={t.sla_status} data_prazo={t.data_prazo} />
              </div>
            ))}
            {urgentes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-sm">Tudo em dia! 🎉</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

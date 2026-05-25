import { useState, useMemo } from "react";
import { Plus, LayoutGrid, List, BarChart3, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTarefas, Tarefa, TarefaStatus, TarefaTipo, TarefaPrioridade, SlaStatus } from "@/hooks/use-tarefas";
import { BadgeStatus, BadgePrioridade, BadgeSLA, BadgeTipo, AvatarResponsavel, TIPO_LABEL, PRIORIDADE_LABEL, STATUS_LABEL, TODOS_RESPONSAVEIS, PRIORIDADE_EMOJI, TIPO_COLORS, formatData } from "./tarefa-utils";
import { TarefaModal } from "./TarefaModal";
import { NovaTarefaForm } from "./NovaTarefaForm";

const KANBAN_COLUNAS: { status: TarefaStatus; label: string; cor: string }[] = [
  { status: "aberta",               label: "Aberta",               cor: "border-blue-300 bg-blue-50" },
  { status: "em_andamento",         label: "Em Andamento",         cor: "border-yellow-300 bg-yellow-50" },
  { status: "aguardando_aprovacao", label: "Aguard. Aprovação",   cor: "border-purple-300 bg-purple-50" },
  { status: "aprovada",             label: "Aprovada / Rejeitada", cor: "border-green-300 bg-green-50" },
  { status: "concluida",            label: "Concluída",            cor: "border-gray-300 bg-gray-50" },
];

export default function WorkflowsPage() {
  const [tab, setTab] = useState<"kanban" | "lista" | "timeline" | "dashboard">("kanban");
  const [tarefaSelecionada, setTarefaSelecionada] = useState<Tarefa | null>(null);
  const [showNovaTarefa, setShowNovaTarefa] = useState(false);

  // Filtros globais
  const [filtroResponsavel, setFiltroResponsavel] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [filtroSla, setFiltroSla] = useState("");
  const [filtroBusca, setFiltroBusca] = useState("");

  const { tarefas, loading, atualizarTarefa } = useTarefas();

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter(t => {
      if (filtroResponsavel && t.responsavel !== filtroResponsavel) return false;
      if (filtroTipo && t.tipo !== filtroTipo) return false;
      if (filtroStatus && t.status !== filtroStatus) return false;
      if (filtroPrioridade && t.prioridade !== filtroPrioridade) return false;
      if (filtroSla && t.sla_status !== filtroSla) return false;
      if (filtroBusca && !t.titulo.toLowerCase().includes(filtroBusca.toLowerCase()) && !t.cliente_nome?.toLowerCase().includes(filtroBusca.toLowerCase())) return false;
      return true;
    });
  }, [tarefas, filtroResponsavel, filtroTipo, filtroStatus, filtroPrioridade, filtroSla, filtroBusca]);

  const hasFilters = !!(filtroResponsavel || filtroTipo || filtroStatus || filtroPrioridade || filtroSla || filtroBusca);

  function limparFiltros() {
    setFiltroResponsavel(""); setFiltroTipo(""); setFiltroStatus("");
    setFiltroPrioridade(""); setFiltroSla(""); setFiltroBusca("");
  }

  return (
    <div className="flex flex-col h-full bg-[#FAFAF7] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F1628]">Workflows</h1>
            <p className="text-sm text-gray-500 mt-0.5">Central de tarefas e aprovações do escritório</p>
          </div>
          <Button onClick={() => setShowNovaTarefa(true)} className="bg-[#E8721C] hover:bg-[#d4621a] gap-2">
            <Plus className="w-4 h-4" /> Nova Tarefa
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Buscar tarefa ou cliente..."
            value={filtroBusca}
            onChange={e => setFiltroBusca(e.target.value)}
            className="w-48 h-8 text-sm"
          />
          <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {TODOS_RESPONSAVEIS.map(r => <SelectItem key={r.nome} value={r.nome}>{r.tipo === "agente" ? "🤖" : "👤"} {r.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {(Object.keys(TIPO_LABEL) as TarefaTipo[]).map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {(Object.keys(STATUS_LABEL) as TarefaStatus[]).map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {(["critica","alta","media","baixa"] as TarefaPrioridade[]).map(p => <SelectItem key={p} value={p}>{PRIORIDADE_EMOJI[p]} {PRIORIDADE_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroSla} onValueChange={setFiltroSla}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="SLA" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="no_prazo">🟢 No prazo</SelectItem>
              <SelectItem value="atencao">🟡 Atenção</SelectItem>
              <SelectItem value="atrasada">🔴 Atrasada</SelectItem>
              <SelectItem value="expirada">💀 Expirada</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <button onClick={limparFiltros} className="text-xs text-gray-400 hover:text-gray-600 underline ml-1">limpar</button>
          )}
          <span className="ml-auto text-xs text-gray-400">{tarefasFiltradas.length} tarefa{tarefasFiltradas.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Tabs de visão */}
        <div className="flex gap-1 mt-4">
          {([
            { key: "kanban", label: "Kanban", icon: LayoutGrid },
            { key: "lista", label: "Lista", icon: List },
            { key: "timeline", label: "Timeline", icon: Calendar },
            { key: "dashboard", label: "Dashboard", icon: BarChart3 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === key ? "bg-[#E8721C] text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Carregando tarefas...</div>
        ) : (
          <>
            {tab === "kanban" && <KanbanView tarefas={tarefasFiltradas} onSelect={setTarefaSelecionada} onMover={atualizarTarefa} />}
            {tab === "lista" && <ListaView tarefas={tarefasFiltradas} onSelect={setTarefaSelecionada} />}
            {tab === "timeline" && <TimelineView tarefas={tarefasFiltradas} onSelect={setTarefaSelecionada} />}
            {tab === "dashboard" && <DashboardView tarefas={tarefasFiltradas} onSelect={setTarefaSelecionada} />}
          </>
        )}
      </div>

      <TarefaModal tarefa={tarefaSelecionada} open={!!tarefaSelecionada} onClose={() => setTarefaSelecionada(null)} />
      <NovaTarefaForm open={showNovaTarefa} onClose={() => setShowNovaTarefa(false)} />
    </div>
  );
}

/* ──────────────────────────── KANBAN ──────────────────────────── */
function KanbanView({ tarefas, onSelect, onMover }: { tarefas: Tarefa[]; onSelect: (t: Tarefa) => void; onMover: (id: string, updates: Partial<Tarefa>, quem: string) => void }) {
  const [dragId, setDragId] = useState<string | null>(null);

  function handleDrop(status: TarefaStatus) {
    if (!dragId) return;
    onMover(dragId, { status }, "Daniel Araújo");
    setDragId(null);
  }

  return (
    <div className="flex gap-4 p-6 overflow-x-auto min-h-[calc(100vh-260px)]">
      {KANBAN_COLUNAS.map(col => {
        const items = tarefas.filter(t => {
          if (col.status === "aprovada") return t.status === "aprovada" || t.status === "rejeitada";
          return t.status === col.status;
        });
        return (
          <div
            key={col.status}
            className={`flex-shrink-0 w-72 rounded-xl border-2 ${col.cor} p-3 flex flex-col gap-3`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.status)}
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              <span className="text-xs bg-white rounded-full px-2 py-0.5 text-gray-500 font-medium">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-320px)]">
              {items.map(t => (
                <KanbanCard key={t.id} tarefa={t} onSelect={onSelect} onDragStart={() => setDragId(t.id)} />
              ))}
              {items.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-8">Nenhuma tarefa</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ tarefa, onSelect, onDragStart }: { tarefa: Tarefa; onSelect: (t: Tarefa) => void; onDragStart: () => void }) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow"
      draggable
      onDragStart={onDragStart}
      onClick={() => onSelect(tarefa)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-gray-800 line-clamp-2 flex-1">{tarefa.titulo}</p>
        <BadgePrioridade prioridade={tarefa.prioridade} />
      </div>
      {tarefa.cliente_nome && (
        <p className="text-xs text-gray-400 mb-2 truncate">📁 {tarefa.cliente_nome}</p>
      )}
      <div className="flex items-center justify-between">
        <AvatarResponsavel nome={tarefa.responsavel} tipo={tarefa.responsavel_tipo} />
        <BadgeSLA sla_status={tarefa.sla_status} data_prazo={tarefa.data_prazo} />
      </div>
      {tarefa.subtarefas_total > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          ☑ {tarefa.subtarefas_concluidas}/{tarefa.subtarefas_total} subtarefas
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── LISTA ──────────────────────────── */
function ListaView({ tarefas, onSelect }: { tarefas: Tarefa[]; onSelect: (t: Tarefa) => void }) {
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 20;
  const total = tarefas.length;
  const paginas = Math.ceil(total / POR_PAGINA);
  const slice = tarefas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="ft-table w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["Título","Tipo","Cliente","Responsável","Prioridade","Prazo","SLA","Status",""].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && (
              <tr><td colSpan={9} className="text-center text-gray-400 py-12 text-sm">Nenhuma tarefa encontrada</td></tr>
            )}
            {slice.map(t => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(t)}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-800 max-w-[200px] truncate">{t.titulo}</p>
                </td>
                <td className="px-4 py-3"><BadgeTipo tipo={t.tipo} /></td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-[140px] truncate">{t.cliente_nome ?? "—"}</td>
                <td className="px-4 py-3"><AvatarResponsavel nome={t.responsavel} tipo={t.responsavel_tipo} /></td>
                <td className="px-4 py-3"><BadgePrioridade prioridade={t.prioridade} /></td>
                <td className="px-4 py-3 text-xs text-gray-500">{t.data_prazo ? formatData(t.data_prazo) : "—"}</td>
                <td className="px-4 py-3"><BadgeSLA sla_status={t.sla_status} data_prazo={t.data_prazo} /></td>
                <td className="px-4 py-3"><BadgeStatus status={t.status} /></td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-[#E8721C] hover:underline" onClick={e => { e.stopPropagation(); onSelect(t); }}>Abrir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paginas > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, total)} de {total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Anterior</button>
            <button onClick={() => setPagina(p => Math.min(paginas, p + 1))} disabled={pagina === paginas} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────── TIMELINE ──────────────────────────── */
function TimelineView({ tarefas, onSelect }: { tarefas: Tarefa[]; onSelect: (t: Tarefa) => void }) {
  const comPrazo = tarefas.filter(t => t.data_prazo).sort((a, b) => new Date(a.data_prazo!).getTime() - new Date(b.data_prazo!).getTime());
  const hoje = new Date();
  const diasVisiveis = 30;

  // Agrupar por semana
  const por_data: Record<string, Tarefa[]> = {};
  comPrazo.forEach(t => {
    const d = new Date(t.data_prazo!).toLocaleDateString("pt-BR");
    if (!por_data[d]) por_data[d] = [];
    por_data[d].push(t);
  });

  if (comPrazo.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Nenhuma tarefa com prazo definido</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Barra Gantt simplificada */}
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase">Próximos {diasVisiveis} dias</p>
        </div>
        <div className="divide-y divide-gray-100">
          {Object.entries(por_data).map(([data, tasks]) => (
            <div key={data} className="flex gap-4 p-4 hover:bg-gray-50">
              <div className="w-24 flex-shrink-0 text-sm font-medium text-gray-600">{data}</div>
              <div className="flex-1 flex flex-wrap gap-2">
                {tasks.map(t => {
                  const atrasada = t.sla_status === "atrasada" || t.sla_status === "expirada";
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelect(t)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90 transition-opacity ${atrasada ? "opacity-90 ring-2 ring-red-400" : ""}`}
                      style={{ backgroundColor: TIPO_COLORS[t.tipo] }}
                    >
                      {t.responsavel_tipo === "agente" ? "🤖" : "👤"} {t.titulo.slice(0, 30)}{t.titulo.length > 30 ? "..." : ""}
                      {atrasada && " ⚠️"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── DASHBOARD ──────────────────────────── */
function DashboardView({ tarefas, onSelect }: { tarefas: Tarefa[]; onSelect: (t: Tarefa) => void }) {
  const total = tarefas.length;
  const abertas = tarefas.filter(t => t.status === "aberta").length;
  const em_andamento = tarefas.filter(t => t.status === "em_andamento").length;
  const atrasadas = tarefas.filter(t => t.sla_status === "atrasada" || t.sla_status === "expirada").length;
  const hoje = new Date().toDateString();
  const concluidas_hoje = tarefas.filter(t => t.concluida_em && new Date(t.concluida_em).toDateString() === hoje).length;

  // Distribuição por tipo
  const por_tipo = (Object.keys(TIPO_LABEL) as TarefaTipo[]).map(tipo => ({
    tipo, label: TIPO_LABEL[tipo], count: tarefas.filter(t => t.tipo === tipo).length, color: TIPO_COLORS[tipo]
  })).filter(x => x.count > 0).sort((a, b) => b.count - a.count);

  // Por responsável
  const por_resp: Record<string, number> = {};
  tarefas.forEach(t => { por_resp[t.responsavel] = (por_resp[t.responsavel] ?? 0) + 1; });
  const resp_sorted = Object.entries(por_resp).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // SLA ranking por agente
  const sla_por_agente: Record<string, { total: number; no_prazo: number }> = {};
  tarefas.forEach(t => {
    if (!sla_por_agente[t.responsavel]) sla_por_agente[t.responsavel] = { total: 0, no_prazo: 0 };
    sla_por_agente[t.responsavel].total++;
    if (t.sla_status === "no_prazo") sla_por_agente[t.responsavel].no_prazo++;
  });

  // 5 mais urgentes
  const urgentes = [...tarefas]
    .filter(t => !["concluida","cancelada"].includes(t.status))
    .sort((a, b) => {
      const pScore: Record<TarefaPrioridade, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };
      const sScore: Record<string, number> = { expirada: 4, atrasada: 3, atencao: 2, no_prazo: 1 };
      return ((sScore[b.sla_status ?? "no_prazo"] ?? 0) + pScore[b.prioridade]) -
             ((sScore[a.sla_status ?? "no_prazo"] ?? 0) + pScore[a.prioridade]);
    }).slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Abertas", value: abertas, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
          { label: "Em Andamento", value: em_andamento, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
          { label: "Atrasadas", value: atrasadas, color: "text-red-600", bg: "bg-red-50 border-red-200" },
          { label: "Concluídas Hoje", value: concluidas_hoje, color: "text-green-600", bg: "bg-green-50 border-green-200" },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">de {total} total</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribuição por tipo */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Tipo</h3>
          <div className="space-y-2">
            {por_tipo.map(item => (
              <div key={item.tipo} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-600 flex-1">{item.label}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${total > 0 ? (item.count / total) * 100 : 0}%`, backgroundColor: item.color }} />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-4 text-right">{item.count}</span>
                </div>
              </div>
            ))}
            {por_tipo.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sem dados</p>}
          </div>
        </div>

        {/* Por responsável */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Por Responsável</h3>
          <div className="space-y-2">
            {resp_sorted.map(([nome, count]) => {
              const tipo = TODOS_RESPONSAVEIS.find(r => r.nome === nome)?.tipo ?? "agente";
              return (
                <div key={nome} className="flex items-center gap-2">
                  <span className="text-sm flex-shrink-0">{tipo === "agente" ? "🤖" : "👤"}</span>
                  <span className="text-xs text-gray-600 flex-1 truncate">{nome}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#E8721C] rounded-full" style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-4 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
            {resp_sorted.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Sem dados</p>}
          </div>
        </div>

        {/* SLA Ranking */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Ranking SLA (% no prazo)</h3>
          <div className="space-y-2">
            {Object.entries(sla_por_agente)
              .map(([nome, s]) => ({ nome, pct: s.total > 0 ? Math.round((s.no_prazo / s.total) * 100) : 0, total: s.total }))
              .sort((a, b) => b.pct - a.pct)
              .slice(0, 6)
              .map(item => (
                <div key={item.nome} className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 flex-1 truncate">{item.nome}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.pct >= 80 ? "bg-green-500" : item.pct >= 50 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${item.pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-8 text-right">{item.pct}%</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 5 mais urgentes */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">⚡ 5 Tarefas Mais Urgentes</h3>
        <div className="space-y-2">
          {urgentes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">Nenhuma tarefa urgente</p>}
          {urgentes.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(t)}>
              <span className="text-xs font-bold text-gray-400 w-4">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{t.titulo}</p>
                <p className="text-xs text-gray-400">{t.cliente_nome ?? "Tarefa interna"} · <AvatarResponsavel nome={t.responsavel} tipo={t.responsavel_tipo} /></p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <BadgePrioridade prioridade={t.prioridade} />
                <BadgeSLA sla_status={t.sla_status} data_prazo={t.data_prazo} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import {
  Plus, LayoutGrid, List, BarChart3, Search,
  RefreshCw, TrendingUp, Users, CheckCircle2,
  XCircle, Flame, DollarSign, Filter, Zap,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge }    from "@/components/ui/badge";
import {
  useLeadsCrm, Lead, LeadEtapa,
  ETAPA_LABEL, ETAPA_COR, TEMP_LABEL, TEMP_COR, CANAL_LABEL, FUNIL_COLS,
} from "@/hooks/use-leads-crm";
import { LeadModal }   from "@/pages/crm/LeadModal";
import { NovoLeadForm } from "@/pages/crm/NovoLeadForm";
import { cn }           from "@/lib/utils";

/* ─── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, color }:
  { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-start gap-3 shadow-sm">
      <div className={cn("grid h-10 w-10 place-items-center rounded-lg shrink-0", color)}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Lead card (Kanban) ─────────────────────────────────────────────────── */
function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group relative rounded-xl border bg-white p-3.5 shadow-sm cursor-pointer
                 hover:shadow-md hover:border-primary/30 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-sm leading-snug line-clamp-2">{lead.nome}</p>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", TEMP_COR[lead.temperatura])}>
          {lead.temperatura === "quente" ? "🔥" : lead.temperatura === "morno" ? "🌡️" : "🥶"}
        </span>
      </div>

      {lead.razao_social && (
        <p className="text-xs text-muted-foreground truncate mb-1">{lead.razao_social}</p>
      )}

      <div className="flex flex-wrap gap-1 mt-2">
        {lead.regime_tributario && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{lead.regime_tributario}</Badge>
        )}
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {CANAL_LABEL[lead.canal] ?? lead.canal}
        </Badge>
      </div>

      {lead.honorario_proposto && (
        <p className="text-xs font-semibold text-emerald-600 mt-2">
          R$ {lead.honorario_proposto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
        </p>
      )}

      {lead.proximo_passo && (
        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-1 italic">
          → {lead.proximo_passo}
        </p>
      )}

      <p className="text-[10px] text-muted-foreground/60 mt-2">{lead.responsavel}</p>
    </div>
  );
}

/* ─── View Lista ─────────────────────────────────────────────────────────── */
function ListaView({ leads, onSelect }: { leads: Lead[]; onSelect: (l: Lead) => void }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs font-medium text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3">Nome</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">Telefone</th>
            <th className="text-left px-4 py-3 hidden lg:table-cell">Regime</th>
            <th className="text-left px-4 py-3">Etapa</th>
            <th className="text-left px-4 py-3 hidden md:table-cell">Temperatura</th>
            <th className="text-right px-4 py-3 hidden lg:table-cell">Honorário</th>
            <th className="text-left px-4 py-3 hidden xl:table-cell">Responsável</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l, i) => (
            <tr
              key={l.id}
              onClick={() => onSelect(l)}
              className={cn(
                "cursor-pointer hover:bg-muted/30 transition-colors border-t",
                i % 2 === 0 ? "bg-white" : "bg-muted/10"
              )}
            >
              <td className="px-4 py-3">
                <p className="font-medium">{l.nome}</p>
                {l.razao_social && <p className="text-xs text-muted-foreground">{l.razao_social}</p>}
              </td>
              <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{l.telefone}</td>
              <td className="px-4 py-3 hidden lg:table-cell">
                {l.regime_tributario ? <Badge variant="outline">{l.regime_tributario}</Badge> : "—"}
              </td>
              <td className="px-4 py-3">
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", ETAPA_COR[l.etapa])}>
                  {ETAPA_LABEL[l.etapa]}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className={cn("text-xs", TEMP_COR[l.temperatura])}>{TEMP_LABEL[l.temperatura]}</span>
              </td>
              <td className="px-4 py-3 text-right hidden lg:table-cell font-medium text-emerald-600">
                {l.honorario_proposto
                  ? `R$ ${l.honorario_proposto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : "—"}
              </td>
              <td className="px-4 py-3 hidden xl:table-cell text-xs text-muted-foreground">{l.responsavel}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Nenhum lead encontrado</p>
        </div>
      )}
    </div>
  );
}

/* ─── CrmPage ─────────────────────────────────────────────────────────────── */
export default function CrmPage() {
  const [view,      setView]      = useState<"kanban" | "lista" | "stats" | "automacoes">("kanban");
  const [leadSel,   setLeadSel]   = useState<Lead | null>(null);
  const [novoLead,  setNovoLead]  = useState(false);
  const [fBusca,    setFBusca]    = useState("");
  const [fEtapa,    setFEtapa]    = useState("");
  const [fTemp,     setFTemp]     = useState("");
  const [fCanal,    setFCanal]    = useState("");
  const [showFilter,setShowFilter]= useState(false);

  const { leads, loading, refetch, stats } = useLeadsCrm();

  const filtered = useMemo(() => leads.filter(l => {
    if (fEtapa && l.etapa !== fEtapa) return false;
    if (fTemp  && l.temperatura !== fTemp) return false;
    if (fCanal && l.canal !== fCanal) return false;
    if (fBusca) {
      const q = fBusca.toLowerCase();
      return (
        l.nome.toLowerCase().includes(q) ||
        (l.razao_social ?? "").toLowerCase().includes(q) ||
        l.telefone.includes(q) ||
        (l.cnpj ?? "").includes(q)
      );
    }
    return true;
  }), [leads, fBusca, fEtapa, fTemp, fCanal]);

  return (
    <div className="flex flex-col h-full min-h-0 p-4 lg:p-6 gap-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">CRM — Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Funil comercial · {stats.total} leads · {stats.quentes} quentes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setNovoLead(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        <StatCard icon={Users}        label="Total Leads"   value={stats.total}          color="bg-blue-100 text-blue-600"    />
        <StatCard icon={Flame}        label="Quentes"       value={stats.quentes}         color="bg-red-100 text-red-500"      />
        <StatCard icon={TrendingUp}   label="Em Negociação" value={stats.emNegociacao}    color="bg-violet-100 text-violet-600"/>
        <StatCard icon={CheckCircle2} label="Fechados"      value={stats.fechadosGanhos}  color="bg-emerald-100 text-emerald-600"/>
        <StatCard icon={XCircle}      label="Perdidos"      value={stats.perdidos}         color="bg-slate-100 text-slate-500"  />
        <StatCard icon={DollarSign}   label="MRR Fechado"
          value={`R$ ${stats.mrr.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={DollarSign}   label="Pipeline"
          value={`R$ ${stats.pipeline.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
          color="bg-amber-100 text-amber-600" />
        <StatCard icon={BarChart3}    label="Taxa Conversão"
          value={stats.total ? `${Math.round((stats.fechadosGanhos / stats.total) * 100)}%` : "—"}
          color="bg-indigo-100 text-indigo-600" />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex gap-2 flex-wrap items-center">
        {/* Views */}
        <div className="flex border rounded-lg overflow-hidden">
          {(["kanban","lista","stats","automacoes"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {v === "kanban"     && <LayoutGrid className="h-3.5 w-3.5" />}
              {v === "lista"      && <List className="h-3.5 w-3.5" />}
              {v === "stats"      && <BarChart3 className="h-3.5 w-3.5" />}
              {v === "automacoes" && <Zap className="h-3.5 w-3.5" />}
              <span className="capitalize">{v}</span>
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, CNPJ, telefone..."
            className="pl-8 h-8 text-sm"
            value={fBusca}
            onChange={e => setFBusca(e.target.value)}
          />
        </div>

        <Button size="sm" variant="outline" onClick={() => setShowFilter(p => !p)}>
          <Filter className="h-3.5 w-3.5 mr-1" /> Filtros
        </Button>
      </div>

      {/* Filtros expandidos */}
      {showFilter && (
        <div className="flex gap-3 flex-wrap items-center p-3 bg-muted/40 rounded-xl">
          <Select value={fEtapa} onValueChange={setFEtapa}>
            <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="Etapa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas as etapas</SelectItem>
              {Object.entries(ETAPA_LABEL).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fTemp} onValueChange={setFTemp}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Temperatura" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {Object.entries(TEMP_LABEL).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fCanal} onValueChange={setFCanal}>
            <SelectTrigger className="h-8 w-44 text-sm"><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos os canais</SelectItem>
              {Object.entries(CANAL_LABEL).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          {(fEtapa || fTemp || fCanal) && (
            <Button size="sm" variant="ghost" onClick={() => { setFEtapa(""); setFTemp(""); setFCanal(""); }}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* ── Conteúdo ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : view === "kanban" ? (
          /* Kanban */
          <div className="flex gap-3 h-full min-h-[400px] overflow-x-auto pb-4">
            {FUNIL_COLS.map(col => {
              const colLeads = filtered.filter(l => l.etapa === col.etapa);
              return (
                <div
                  key={col.etapa}
                  className={cn(
                    "flex flex-col rounded-xl border-t-4 min-w-[220px] w-56 shrink-0 overflow-hidden",
                    col.accent, col.bg
                  )}
                >
                  <div className="px-3 py-2.5 border-b bg-white/60 flex items-center justify-between">
                    <span className="text-xs font-semibold">{ETAPA_LABEL[col.etapa]}</span>
                    <span className="text-xs bg-white rounded-full px-1.5 py-0.5 font-medium border">
                      {colLeads.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {colLeads.map(l => (
                      <LeadCard key={l.id} lead={l} onClick={() => setLeadSel(l)} />
                    ))}
                    {colLeads.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground/60 pt-6">Vazio</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === "lista" ? (
          <ListaView leads={filtered} onSelect={setLeadSel} />
        ) : view === "automacoes" ? (
          /* Automações CRM */
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Automações do CRM</h3>
                  <p className="text-sm text-muted-foreground">Sequências e gatilhos automáticos para leads</p>
                </div>
                <a href="/automacoes"><button className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">Gerenciar todas</button></a>
              </div>
              <div className="grid gap-3">
                {[
                  { nome: "Boas-vindas Lead Quente", gatilho: "Lead entra com temperatura 🔥", acao: "WhatsApp imediato", status: "ativa" },
                  { nome: "Follow-up 3 dias", gatilho: "Sem contato por 3 dias", acao: "Lembrete + task", status: "ativa" },
                  { nome: "Proposta enviada → Lembrete", gatilho: "7 dias na etapa Proposta", acao: "Notificação ao responsável", status: "inativa" },
                  { nome: "Lead ganho → Onboarding", gatilho: "Etapa muda para Fechado", acao: "Cria cliente + WhatsApp boas-vindas", status: "inativa" },
                ].map((a, i) => (
                  <div key={i} className="flex items-start justify-between p-3 rounded-lg border bg-muted/20 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="text-foreground/70">Gatilho:</span> {a.gatilho}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="text-foreground/70">Ação:</span> {a.acao}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${a.status === "ativa" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {a.status === "ativa" ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold mb-3">Métricas do Funil</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Taxa de Conversão", value: `${leads.length ? Math.round((leads.filter(l => l.etapa === "fechado_ganho").length / leads.length) * 100) : 0}%` },
                  { label: "Ticket Médio", value: leads.filter(l => l.honorario_proposto).length ? `R$ ${Math.round(leads.filter(l=>l.honorario_proposto).reduce((s,l)=>s+(l.honorario_proposto??0),0)/leads.filter(l=>l.honorario_proposto).length).toLocaleString("pt-BR")}` : "—" },
                  { label: "Leads Ativos", value: leads.filter(l => !["fechado_ganho","fechado_perdido"].includes(l.etapa)).length },
                  { label: "Pipeline Total", value: `R$ ${leads.filter(l=>l.honorario_proposto).reduce((s,l)=>s+(l.honorario_proposto??0),0).toLocaleString("pt-BR")}` },
                ].map((m, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-muted/30 text-center">
                    <p className="text-lg font-bold text-foreground">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Stats view */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold mb-4">Distribuição por Etapa</h3>
              <div className="space-y-3">
                {FUNIL_COLS.map(col => {
                  const n = leads.filter(l => l.etapa === col.etapa).length;
                  const pct = leads.length ? Math.round((n / leads.length) * 100) : 0;
                  return (
                    <div key={col.etapa}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{ETAPA_LABEL[col.etapa]}</span>
                        <span className="font-medium">{n} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <h3 className="font-semibold mb-4">Por Canal de Origem</h3>
              <div className="space-y-3">
                {Object.entries(CANAL_LABEL).map(([canal, label]) => {
                  const n = leads.filter(l => l.canal === canal).length;
                  if (n === 0) return null;
                  const pct = leads.length ? Math.round((n / leads.length) * 100) : 0;
                  return (
                    <div key={canal}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{label}</span>
                        <span className="font-medium">{n} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modais ── */}
      <LeadModal lead={leadSel} onClose={() => setLeadSel(null)} onRefresh={refetch} />

      <Dialog open={novoLead} onOpenChange={setNovoLead}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <NovoLeadForm onSave={() => { setNovoLead(false); refetch(); }} onCancel={() => setNovoLead(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

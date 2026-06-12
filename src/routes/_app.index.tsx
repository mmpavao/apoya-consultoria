import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowRight, Building2, Calendar,
  CheckCircle2, Clock, DollarSign, FileText, Info,
  Loader2, MessageSquare, Receipt, RefreshCw,
  TrendingUp, Users, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard, type AlertaDash } from "@/hooks/use-dashboard";
import { Button } from "@/components/ui/button";


/* ── Agentes Autônomos ────────────────────────────────────── */
interface AgenteMini {
  nome:         string;
  icone:        string;
  alertas:      number;
  total:        number;
  executado_em: string;
  loading:      boolean;
  error:        string | null;
  href:         string;
}

interface AgentesState {
  fiscal:      AgenteMini;
  rh:          AgenteMini;
  financeiro:  AgenteMini;
  orquestrador:{ loading: boolean; ultimo: string; alertas_total: number };
}

const mkAgente = (nome: string, icone: string, href: string): AgenteMini =>
  ({ nome, icone, alertas: 0, total: 0, executado_em: "", loading: false, error: null, href });

const AGENTES_DEFAULT: AgentesState = {
  fiscal:       mkAgente("Fiscal",     "🧾", "/fiscal"),
  rh:           mkAgente("RH / DP",    "👥", "/dp"),
  financeiro:   mkAgente("Financeiro", "💰", "/financeiro"),
  orquestrador: { loading: false, ultimo: "", alertas_total: 0 },
};

// interface legacy (mantido para AgenteCard)
interface AgenteStatus {
  vencidas: number; urgentes: number; no_prazo: number;
  total: number; executado_em: string; loading: boolean; error: string | null;
}
const AGENTE_DEFAULT: AgenteStatus = {
  vencidas: 0, urgentes: 0, no_prazo: 0, total: 0,
  executado_em: "", loading: false, error: null,
};

async function fetchAgenteFiscal(): Promise<AgenteStatus> {
  const resp = await fetch(
    "https://ajaqbdsalxfgrwpjbtbn.supabase.co/functions/v1/agente-fiscal",
    { method: "POST" }
  );
  const result = await resp.json();
  if (!result.success) throw new Error(result.error ?? "Erro no agente");
  return {
    vencidas:    result.resumo?.vencidas    ?? 0,
    urgentes:    result.resumo?.urgentes    ?? 0,
    no_prazo:    result.resumo?.no_prazo    ?? 0,
    total:       result.resumo?.total       ?? 0,
    executado_em: result.executado_em       ?? "",
    loading:     false,
    error:       null,
  };
}

async function fetchOrquestrador(): Promise<{ fiscal: number; rh: number; financeiro: number; ts: string }> {
  const resp = await fetch(
    "https://ajaqbdsalxfgrwpjbtbn.supabase.co/functions/v1/agente-orquestrador",
    { method: "POST" }
  );
  const r = await resp.json();
  return {
    fiscal:     r.resultados?.fiscal?.alertas_gerados     ?? 0,
    rh:         r.resultados?.rh?.alertas_gerados         ?? 0,
    financeiro: r.resultados?.financeiro?.alertas_gerados ?? 0,
    ts:         r.executado_em ?? new Date().toISOString(),
  };
}

function AgenteCard({
  status, onExecute,
}: { status: AgenteStatus; onExecute: () => void }) {
  const fmtHora = (iso: string) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
    catch { return "—"; }
  };

  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary">
            <Zap className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Agente Fiscal</p>
            <p className="text-xs text-muted-foreground">
              {status.executado_em ? `Última execução: ${fmtHora(status.executado_em)}` : "Nunca executado"}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onExecute}
          disabled={status.loading}
          className="h-8 rounded-full text-xs"
        >
          {status.loading
            ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
            : <RefreshCw className="h-3 w-3 mr-1" />}
          Executar
        </Button>
      </div>

      {status.error ? (
        <p className="text-xs text-destructive">{status.error}</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
            <AlertTriangle className="h-3 w-3" /> {status.vencidas} vencidas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.97_0.045_82)] px-3 py-1 text-xs font-medium text-[oklch(0.48_0.130_82)] ring-1 ring-amber-200">
            <Clock className="h-3 w-3" /> {status.urgentes} urgentes
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> {status.no_prazo} no prazo
          </span>
          <span className="ml-auto text-xs text-muted-foreground">{status.total} total</span>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · APOYA Gestão" }] }),
});

/* ── Helpers ──────────────────────────────────────────────── */
const fmtBRL = (v: number) =>
  v > 0
    ? v >= 1_000
      ? `R$ ${(v / 1_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
      : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
    : "R$ 0";

const statusCfg: Record<string, string> = {
  ativo:        "bg-emerald-50 text-emerald-700",
  inadimplente: "bg-[oklch(0.97_0.045_82)] text-[oklch(0.48_0.130_82)]",
  suspenso:     "bg-red-50     text-red-700",
  inativo:      "bg-muted      text-muted-foreground",
};

/* ── Componentes ──────────────────────────────────────────── */
function StatBig({
  label, value, sub, icon: Icon, dark, negative,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; dark?: boolean; negative?: boolean;
}) {
  return (
    <div className={
      dark
        ? "surface-card-dark p-6"
        : "surface-card p-6 transition-shadow hover:shadow-elevated"
    }>
      <div className="flex items-start justify-between">
        <span className={dark ? "text-sm text-sidebar-foreground/70" : "text-sm text-muted-foreground"}>
          {label}
        </span>
        <span className={
          "grid h-10 w-10 place-items-center rounded-full " +
          (dark
            ? "bg-primary text-primary-foreground"
            : negative
              ? "bg-destructive/10 text-destructive"
              : "bg-primary-soft text-primary")
        }>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className={"mt-4 font-display text-3xl font-bold tracking-tight " + (dark ? "text-white" : "text-foreground")}>
        {value}
      </p>
      {sub && (
        <p className={"mt-1 text-xs " + (dark ? "text-sidebar-foreground/60" : "text-muted-foreground")}>
          {sub}
        </p>
      )}
    </div>
  );
}

function MiniLink({
  to, label, value, sub, icon: Icon,
}: { to: string; label: string; value: string; sub: string; icon: React.ElementType }) {
  return (
    <Link
      to={to}
      className="surface-card group flex items-center gap-4 p-5 transition-shadow hover:shadow-elevated"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

const alertIconMap = {
  danger:  { Icon: AlertTriangle, ring: "ring-destructive/20", icon: "bg-destructive/10 text-destructive" },
  warning: { Icon: Clock,         ring: "ring-amber-200",      icon: "bg-amber-50 text-amber-700" },
  success: { Icon: CheckCircle2,  ring: "ring-emerald-200",    icon: "bg-emerald-50 text-emerald-700" },
  info:    { Icon: Info,          ring: "ring-blue-200",       icon: "bg-blue-50 text-blue-700" },
} as const;

function AlertaItem({ tipo, texto, sub }: AlertaDash) {
  const cfg = alertIconMap[tipo] ?? alertIconMap.info;
  const { Icon } = cfg;
  return (
    <div className={`flex items-start gap-3 rounded-2xl bg-muted/40 p-4 ring-1 ${cfg.ring}`}>
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${cfg.icon}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{texto}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

/* ── Skeleton de carregamento ─────────────────────────────── */
function DashSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-16 rounded-2xl bg-muted/60" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-muted/60" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/60" />)}
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────── */
function Dashboard() {
  const { profile, user } = useAuth();
  const { data, loading, error, refetch } = useDashboard();
  const [agenteStatus, setAgenteStatus] = React.useState<AgenteStatus>(AGENTE_DEFAULT);
  const [agentesState, setAgentesState] = React.useState<AgentesState>(AGENTES_DEFAULT);

  const runAgente = React.useCallback(async () => {
    setAgenteStatus(prev => ({ ...prev, loading: true, error: null }));
    setAgentesState(prev => ({
      ...prev,
      orquestrador: { ...prev.orquestrador, loading: true },
    }));
    try {
      const [fiscal, orch] = await Promise.all([
        fetchAgenteFiscal(),
        fetchOrquestrador(),
      ]);
      setAgenteStatus(fiscal);
      setAgentesState(prev => ({
        fiscal:      { ...prev.fiscal,     alertas: orch.fiscal,     total: fiscal.total, executado_em: orch.ts, loading: false, error: null },
        rh:          { ...prev.rh,         alertas: orch.rh,         total: 0,            executado_em: orch.ts, loading: false, error: null },
        financeiro:  { ...prev.financeiro, alertas: orch.financeiro, total: 0,            executado_em: orch.ts, loading: false, error: null },
        orquestrador:{ loading: false, ultimo: orch.ts, alertas_total: orch.fiscal + orch.rh + orch.financeiro },
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setAgenteStatus(prev => ({ ...prev, loading: false, error: msg }));
      setAgentesState(prev => ({ ...prev, orquestrador: { ...prev.orquestrador, loading: false } }));
    }
  }, []);

  React.useEffect(() => { runAgente(); }, [runAgente]);

  const nome = profile?.nome?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Contador";

  const acoes = [
    { to: "/fiscal/das",  label: "Emitir DAS",   icon: FileText },
    { to: "/fiscal/nfse", label: "Emitir NFS-e", icon: Receipt },
    { to: "/clientes",    label: "Novo cliente", icon: Building2 },
    { to: "/whatsapp",    label: "WhatsApp",     icon: MessageSquare },
  ];

  if (loading) return <DashSkeleton />;

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error ?? "Erro ao carregar dashboard"}</p>
        <Button variant="outline" onClick={refetch}><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</Button>
      </div>
    );
  }

  const { kpis, calFiscal, clientesRecentes, honorariosData, alertas } = data;

  const urgentesCount = alertas.filter(a => a.tipo === "danger").length;
  const vencSemana    = calFiscal.filter(c => c.urgente).length;

  const acumulado = honorariosData.reduce((s, m) => s + m.recebido, 0);

  return (
    <div className="space-y-8 animate-fade-up">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
          <h1 className="page-title mt-1">Olá, {nome} 👋</h1>
          <p className="page-subtitle">
            {urgentesCount > 0
              ? <>Você tem <span className="font-semibold text-destructive">{urgentesCount} alerta{urgentesCount > 1 ? "s" : ""} crítico{urgentesCount > 1 ? "s" : ""}</span>{vencSemana > 0 ? <> e <span className="font-semibold text-foreground">{vencSemana} vencimento{vencSemana > 1 ? "s" : ""}</span> esta semana</> : ""}.</>
              : "Tudo em dia. Bom trabalho! 🎉"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={refetch} title="Atualizar dados" className="h-9 w-9 rounded-full">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {acoes.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="hidden md:inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-soft transition-all hover:border-primary/40 hover:text-primary"
            >
              <a.icon className="h-4 w-4" /> {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── KPIs principais ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBig
          label="Clientes ativos"
          value={kpis.clientesAtivos}
          sub={`${kpis.clientesTotal} total · ${kpis.suspensos} suspenso${kpis.suspensos !== 1 ? "s" : ""}`}
          icon={Building2}
          dark
        />
        <StatBig
          label="Honorários (mês)"
          value={kpis.honorariosMes > 0 ? fmtBRL(kpis.honorariosMes) : "—"}
          sub={kpis.honorariosAtraso > 0 ? `${fmtBRL(kpis.honorariosAtraso)} em atraso` : "Sem atraso"}
          icon={DollarSign}
        />
        <StatBig
          label="Inadimplentes"
          value={kpis.inadimplentes}
          sub={kpis.inadimplentes > 0 ? "Régua de cobrança ativa" : "Todos em dia"}
          icon={AlertTriangle}
          negative={kpis.inadimplentes > 0}
        />
        <StatBig
          label="DAS em aberto"
          value={kpis.dasEmAberto}
          sub={kpis.dasVencendoHoje > 0 ? `${kpis.dasVencendoHoje} vence${kpis.dasVencendoHoje === 1 ? "" : "m"} hoje/amanhã` : "Sem urgência imediata"}
          icon={FileText}
          negative={kpis.dasVencendoHoje > 0}
        />
      </div>

      {/* ── Mini-cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MiniLink
          to="/obrigacoes"
          label="Obrigações do mês"
          value={String(kpis.obrigacoesMes)}
          sub={`${kpis.obrigacoesPendentes} pendente${kpis.obrigacoesPendentes !== 1 ? "s" : ""} · ${kpis.obrigacoesAtrasadas} atrasada${kpis.obrigacoesAtrasadas !== 1 ? "s" : ""}`}
          icon={Calendar}
        />
        <MiniLink
          to="/financeiro"
          label="NFS-e emitidas no mês"
          value={String(kpis.nfseEmitidaMes)}
          sub={kpis.honorariosAtraso > 0 ? `${fmtBRL(kpis.honorariosAtraso)} de cobranças vencidas` : "Cobranças em dia"}
          icon={DollarSign}
        />
        <MiniLink
          to="/whatsapp"
          label="Mensagens não lidas"
          value={String(kpis.wasMsgNaoLidas)}
          sub={kpis.wasMsgNaoLidas > 0 ? "Clientes aguardando resposta" : "Nenhuma mensagem pendente"}
          icon={MessageSquare}
        />
      </div>


      {/* ── Status de Clientes (Donut) + Gráfico Honorários ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Donut — distribuição de status */}
        <section className="surface-card">
          <div className="flex items-center gap-2 px-6 py-5 border-b border-border/50">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary">
              <Users className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-base font-semibold">Status dos Clientes</h2>
          </div>
          <div className="flex flex-col items-center px-6 py-5 gap-4">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Ativos",       value: kpis.clientesAtivos,                                        fill: "#22c55e" },
                    { name: "Inadimplentes",value: kpis.inadimplentes,                                         fill: "oklch(0.66 0.195 44)" },
                    { name: "Suspensos",    value: kpis.suspensos,                                             fill: "#ef4444" },
                    { name: "Outros",       value: Math.max(0, kpis.clientesTotal - kpis.clientesAtivos - kpis.inadimplentes - kpis.suspensos), fill: "#cbd5e1" },
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {[
                    "#22c55e",
                    "oklch(0.66 0.195 44)",
                    "#ef4444",
                    "#cbd5e1",
                  ].map((color, i) => (
                    <Cell key={i} fill={color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, name: string) => [v, name]}
                  contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid #e2e8f0" }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legenda */}
            <div className="w-full space-y-1.5">
              {[
                { label: "Ativos",        value: kpis.clientesAtivos,   color: "bg-emerald-400" },
                { label: "Inadimplentes", value: kpis.inadimplentes,    color: "bg-primary" },
                { label: "Suspensos",     value: kpis.suspensos,        color: "bg-red-400" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <span className="font-semibold text-foreground">
                    {item.value}
                    <span className="ml-1 text-muted-foreground font-normal">
                      ({kpis.clientesTotal > 0 ? Math.round(item.value / kpis.clientesTotal * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Gráfico de Honorários — 6 meses */}
        <section className="surface-card lg:col-span-2">
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              Honorários — últimos 6 meses
            </h2>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary/30" />Previsto</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Recebido</span>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-xs text-muted-foreground mb-1">Acumulado no período</p>
            <p className="font-display text-2xl font-bold text-foreground mb-4">{fmtBRL(acumulado)}</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={honorariosData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPrev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="oklch(0.66 0.195 44)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="oklch(0.66 0.195 44)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="oklch(0.66 0.195 44)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="oklch(0.66 0.195 44)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, ""]}
                  contentStyle={{ borderRadius: "12px", fontSize: "12px", border: "1px solid #e2e8f0" }}
                />
                <Area type="monotone" dataKey="previsto" stroke="oklch(0.66 0.195 44)"
                  strokeWidth={2} strokeDasharray="4 2" fill="url(#gradPrev)" dot={false} />
                <Area type="monotone" dataKey="recebido" stroke="oklch(0.66 0.195 44)"
                  strokeWidth={2.5} fill="url(#gradRec)" dot={{ r: 4, fill: "oklch(0.66 0.195 44)" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

      </div>


      {/* ── Agentes Autônomos ─────────────────────────────── */}
      <section className="surface-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary">
              <Zap className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-base font-semibold">Agentes Autônomos</h2>
            {agentesState.orquestrador.loading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {agentesState.orquestrador.alertas_total > 0 && (
              <span className="pill bg-destructive/10 text-destructive text-[11px]">
                {agentesState.orquestrador.alertas_total} alerta{agentesState.orquestrador.alertas_total > 1 ? "s" : ""}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={runAgente}
              disabled={agentesState.orquestrador.loading} className="h-8 rounded-full text-xs">
              {agentesState.orquestrador.loading
                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                : <RefreshCw className="h-3 w-3 mr-1" />}
              Executar todos
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
          {([
            { key: "fiscal",     cor: "text-blue-600",   bg: "bg-blue-50"   },
            { key: "rh",         cor: "text-violet-600", bg: "bg-violet-50" },
            { key: "financeiro", cor: "text-emerald-600",bg: "bg-emerald-50"},
          ] as const).map(({ key, cor, bg }) => {
            const ag = agentesState[key];
            const fmtHora = (iso: string) => {
              if (!iso) return "—";
              try { return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
              catch { return "—"; }
            };
            return (
              <a key={key} href={ag.href} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ${bg}`}>
                  {ag.icone}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{ag.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {ag.executado_em ? `Executado às ${fmtHora(ag.executado_em)}` : "Aguardando execução"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {ag.alertas > 0 ? (
                    <span className={`text-sm font-bold ${cor}`}>{ag.alertas}</span>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  <p className="text-[11px] text-muted-foreground">{ag.alertas > 0 ? "alertas" : "ok"}</p>
                </div>
              </a>
            );
          })}
        </div>
        {agentesState.orquestrador.ultimo && (
          <div className="px-6 py-2.5 border-t border-border/40 bg-muted/20">
            <p className="text-[11px] text-muted-foreground">
              Orquestrador executado às {new Date(agentesState.orquestrador.ultimo).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {" · "}{agentesState.orquestrador.alertas_total} alerta{agentesState.orquestrador.alertas_total !== 1 ? "s" : ""} gerado{agentesState.orquestrador.alertas_total !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </section>

      {/* ── Alertas + Calendário fiscal ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Alertas */}
        <section className="surface-card">
          <div className="flex items-center justify-between px-6 py-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-destructive/10 text-destructive">
                <Zap className="h-3.5 w-3.5" />
              </span>
              Alertas do dia
            </h2>
            {urgentesCount > 0 && (
              <span className="pill bg-destructive/10 text-destructive">{urgentesCount} urgente{urgentesCount > 1 ? "s" : ""}</span>
            )}
          </div>
          <div className="space-y-3 px-6 pb-6">
            {alertas.length === 0
              ? <p className="text-sm text-muted-foreground">Nenhum alerta 🎉</p>
              : alertas.map((a, i) => <AlertaItem key={i} {...a} />)
            }
          </div>
        </section>

        {/* Calendário fiscal */}
        <section className="surface-card">
          <div className="flex items-center justify-between px-6 py-5">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary">
                <Calendar className="h-3.5 w-3.5" />
              </span>
              Próximos vencimentos
            </h2>
            <Link to="/obrigacoes" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Ver tudo <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-6 pb-6 space-y-2.5">
            {calFiscal.length === 0
              ? <p className="text-sm text-muted-foreground">Nenhum vencimento próximo.</p>
              : calFiscal.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-3 transition-colors hover:border-primary/30"
                >
                  <div className={
                    "shrink-0 flex flex-col items-center justify-center rounded-xl h-12 w-14 " +
                    (item.urgente
                      ? "bg-destructive/10 text-destructive"
                      : "bg-muted text-foreground")
                  }>
                    <span className="font-display text-lg font-bold leading-none">{item.dia}</span>
                    <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-70">{item.mes}</span>
                  </div>
                  <p className="flex-1 text-sm font-medium">{item.label}</p>
                  {item.urgente && <span className="pill bg-destructive/10 text-destructive">Urgente</span>}
                </div>
              ))
            }
          </div>
        </section>
      </div>



      {/* ── Clientes recentes ───────────────────────────────── */}
      <section className="surface-card">
        <div className="flex items-center justify-between px-6 py-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary">
              <Users className="h-3.5 w-3.5" />
            </span>
            Clientes recentes
          </h2>
          <Link to="/clientes" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {clientesRecentes.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">Nenhum cliente cadastrado ainda.</p>
        ) : (
          <div>
            {clientesRecentes.map((c) => (
              <Link
                key={c.id}
                to={`/clientes/${c.id}` as any}
                className="flex items-center gap-4 border-t border-border/60 px-6 py-4 transition-colors hover:bg-muted/30"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                  {c.nome[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.regime}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={"pill " + (statusCfg[c.status] ?? statusCfg.inativo)}>
                    {c.status[0]?.toUpperCase() + c.status.slice(1)}
                  </span>
                  <span className="hidden sm:block text-sm font-medium text-muted-foreground w-24 text-right">{c.honorario}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

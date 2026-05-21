import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Building2, Calendar,
  CheckCircle2, Clock, DollarSign, FileText, MessageSquare, Receipt,
  TrendingUp, Users, Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · APOYA Gestão" }] }),
});

/* ─── Mock data ───────────────────────────────────────── */
const honorariosData = [
  { mes: "Jan", recebido: 38200, previsto: 40000 },
  { mes: "Fev", recebido: 41500, previsto: 40000 },
  { mes: "Mar", recebido: 39800, previsto: 42000 },
  { mes: "Abr", recebido: 43200, previsto: 42000 },
  { mes: "Mai", recebido: 45100, previsto: 44000 },
  { mes: "Jun", recebido: 0,     previsto: 46000 },
];

const alertas = [
  { tipo: "danger",  icon: AlertTriangle, texto: "3 clientes com DAS vencendo amanhã",  sub: "Ação necessária hoje" },
  { tipo: "warning", icon: Clock,         texto: "2 NFS-e com dados incompletos",       sub: "Revisar antes do envio" },
  { tipo: "warning", icon: AlertTriangle, texto: "DCTFWeb de maio ainda não enviada",   sub: "Prazo: último dia útil" },
  { tipo: "success", icon: CheckCircle2,  texto: "DAS de abril 100% emitido",           sub: "72/72 — enviado por WhatsApp" },
] as const;

const calFiscal = [
  { dia: "20", mes: "Mai", label: "DAS — Simples Nacional",   urgente: true  },
  { dia: "20", mes: "Mai", label: "DASMEI — vencimento",       urgente: true  },
  { dia: "31", mes: "Mai", label: "DCTFWeb — maio",            urgente: false },
  { dia: "10", mes: "Jun", label: "DIRBI — maio",              urgente: false },
  { dia: "15", mes: "Jun", label: "eSocial — competência maio",urgente: false },
];

const ultimosClientes = [
  { nome: "Padaria Pão Dourado Ltda", regime: "Simples",         status: "ativo",        honorario: "R$ 680" },
  { nome: "Clínica Saúde Total ME",   regime: "Lucro Presumido", status: "ativo",        honorario: "R$ 1.200" },
  { nome: "Tech Solutions Ltda",      regime: "Simples",         status: "inadimplente", honorario: "R$ 850" },
  { nome: "Maria Silva MEI",          regime: "MEI",             status: "ativo",        honorario: "R$ 120" },
  { nome: "Construção RJ Ltda",       regime: "Lucro Presumido", status: "suspenso",     honorario: "R$ 2.100" },
];

/* ─── Components ──────────────────────────────────────── */
const statusCfg: Record<string, string> = {
  ativo:        "bg-emerald-50 text-emerald-700",
  inadimplente: "bg-amber-50   text-amber-700",
  suspenso:     "bg-red-50     text-red-700",
  inativo:      "bg-muted      text-muted-foreground",
};

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
      className="group surface-card p-5 transition-all hover:border-primary/40 hover:shadow-elevated"
    >
      <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Icon className="h-4 w-4" /> {label}</span>
        <ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="font-display text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </Link>
  );
}

const alertaCfg = {
  danger:  { ring: "ring-destructive/20", icon: "bg-destructive/10 text-destructive" },
  warning: { ring: "ring-amber-200/60",   icon: "bg-amber-50 text-amber-700" },
  success: { ring: "ring-emerald-200/60", icon: "bg-emerald-50 text-emerald-700" },
} as const;

function AlertaItem({ tipo, icon: Icon, texto, sub }: typeof alertas[number]) {
  const cfg = alertaCfg[tipo];
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

/* ─── Page ────────────────────────────────────────────── */
function Dashboard() {
  const { profile, user } = useAuth();
  const nome = profile?.nome?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Contador";

  const acoes = [
    { to: "/fiscal/das",  label: "Emitir DAS",     icon: FileText },
    { to: "/fiscal/nfse", label: "Emitir NFS-e",   icon: Receipt },
    { to: "/clientes",    label: "Novo cliente",   icon: Building2 },
    { to: "/whatsapp",    label: "WhatsApp",       icon: MessageSquare },
  ];

  return (
    <div className="space-y-8 animate-fade-up">

      {/* ── Header da página ───────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Bem-vindo de volta</p>
          <h1 className="page-title mt-1">Olá, {nome} 👋</h1>
          <p className="page-subtitle">Você tem <span className="font-semibold text-primary">3 alertas</span> e <span className="font-semibold text-foreground">5 vencimentos</span> esta semana.</p>
        </div>
        <div className="flex gap-2">
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

      {/* ── KPIs principais ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBig label="Clientes ativos"  value="72"       sub="+3 este mês" icon={Building2} dark />
        <StatBig label="Honorários (Mai)" value="R$ 45,1k" sub="+4,4% vs Abr" icon={DollarSign} />
        <StatBig label="Inadimplentes"    value="6"        sub="2 críticos"   icon={AlertTriangle} negative />
        <StatBig label="DAS em aberto"    value="3"        sub="vencem amanhã" icon={FileText} />
      </div>

      {/* ── Mini-cards (módulos) ───────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MiniLink to="/obrigacoes" label="Obrigações do mês"   value="142"     sub="38 pendentes · 4 atrasadas" icon={Calendar} />
        <MiniLink to="/financeiro" label="Cobranças do mês"    value="R$ 51k"  sub="R$ 8,2k em atraso"          icon={DollarSign} />
        <MiniLink to="/whatsapp"   label="Mensagens não lidas" value="12"      sub="3 conversas humanas"        icon={MessageSquare} />
      </div>

      {/* ── Alertas + Calendário fiscal ────────────────── */}
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
            <span className="pill bg-destructive/10 text-destructive">3 urgentes</span>
          </div>
          <div className="space-y-3 px-6 pb-6">
            {alertas.map((a, i) => <AlertaItem key={i} {...a} />)}
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
            {calFiscal.map((item, i) => (
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
            ))}
          </div>
        </section>
      </div>

      {/* ── Honorários — gráfico ───────────────────────── */}
      <section className="surface-card">
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-emerald-700">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              Honorários 2025
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Recebido vs. previsto</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Acumulado</p>
            <p className="font-display text-xl font-bold tracking-tight">R$ 208.800</p>
          </div>
        </div>
        <div className="px-3 pb-4">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={honorariosData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRecebido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="oklch(0.66 0.195 44)" stopOpacity={0.30} />
                  <stop offset="95%" stopColor="oklch(0.66 0.195 44)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradPrevisto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="oklch(0.66 0.155 152)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="oklch(0.66 0.155 152)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="oklch(0.92 0.005 60)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "oklch(0.52 0.016 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.016 260)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, ""]}
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.005 60)", fontSize: 12, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.08)" }}
              />
              <Area type="monotone" dataKey="previsto" stroke="oklch(0.66 0.155 152)" strokeWidth={2} strokeDasharray="4 4" fill="url(#gradPrevisto)" dot={false} />
              <Area type="monotone" dataKey="recebido" stroke="oklch(0.66 0.195 44)" strokeWidth={2.5} fill="url(#gradRecebido)" dot={{ r: 3, fill: "oklch(0.66 0.195 44)" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Clientes recentes ──────────────────────────── */}
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
        <div>
          {ultimosClientes.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-t border-border/60 px-6 py-4 transition-colors hover:bg-muted/30"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
                {c.nome[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.regime}</p>
              </div>
              <span className={"pill " + (statusCfg[c.status] ?? statusCfg.inativo)}>
                {c.status[0].toUpperCase() + c.status.slice(1)}
              </span>
              <span className="hidden sm:block w-20 text-right text-sm font-semibold">{c.honorario}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

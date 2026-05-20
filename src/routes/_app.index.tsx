import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  Receipt,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · APOYA Gestão" }] }),
});

/* ── Mock data ─────────────────────────────────────────────── */
const honorariosData = [
  { mes: "Jan", recebido: 38200, previsto: 40000 },
  { mes: "Fev", recebido: 41500, previsto: 40000 },
  { mes: "Mar", recebido: 39800, previsto: 42000 },
  { mes: "Abr", recebido: 43200, previsto: 42000 },
  { mes: "Mai", recebido: 45100, previsto: 44000 },
  { mes: "Jun", recebido: 0,     previsto: 46000 },
];

const alertas = [
  { tipo: "danger",  icon: AlertTriangle, texto: "3 clientes com DAS vencendo amanhã",      sub: "Ação necessária hoje" },
  { tipo: "warning", icon: Clock,         texto: "2 NFS-e com dados incompletos",           sub: "Revisar antes do envio" },
  { tipo: "warning", icon: AlertTriangle, texto: "DCTFWeb de maio ainda não enviada",       sub: "Prazo: último dia útil" },
  { tipo: "success", icon: CheckCircle2,  texto: "DAS de abril 100% emitido",              sub: "72/72 clientes — enviado via WhatsApp" },
];

const calFiscal = [
  { dia: "20/05", label: "DAS — Simples Nacional",  urgente: true  },
  { dia: "20/05", label: "DASMEI — vencimento",      urgente: true  },
  { dia: "31/05", label: "DCTFWeb — maio",           urgente: false },
  { dia: "10/06", label: "DIRBI — maio",             urgente: false },
  { dia: "15/06", label: "eSocial — competência maio", urgente: false },
];

const ultimosClientes = [
  { nome: "Padaria Pão Dourado Ltda", regime: "Simples",          status: "ativo",         honorario: "R$ 680" },
  { nome: "Clínica Saúde Total ME",   regime: "Lucro Presumido",  status: "ativo",         honorario: "R$ 1.200" },
  { nome: "Tech Solutions Ltda",      regime: "Simples",          status: "inadimplente",  honorario: "R$ 850" },
  { nome: "Maria Silva MEI",          regime: "MEI",              status: "ativo",         honorario: "R$ 120" },
  { nome: "Construção RJ Ltda",       regime: "Lucro Presumido",  status: "suspenso",      honorario: "R$ 2.100" },
];

const acoesRapidas = [
  { to: "/fiscal/das",  label: "Emitir DAS em lote",   icon: FileText,     color: "bg-blue-50   text-blue-600"   },
  { to: "/fiscal/nfse", label: "Emitir NFS-e em lote", icon: Receipt,      color: "bg-purple-50 text-purple-600" },
  { to: "/clientes",    label: "Cadastrar cliente",     icon: Building2,    color: "bg-orange-50 text-orange-600" },
  { to: "/whatsapp",    label: "Disparar WhatsApp",     icon: MessageSquare,color: "bg-green-50  text-green-600"  },
  { to: "/obrigacoes",  label: "Ver obrigações",        icon: Calendar,     color: "bg-red-50    text-red-600"    },
  { to: "/fiscal/serpro", label: "Consultar SERPRO",   icon: Shield,       color: "bg-gray-50   text-gray-600"   },
];

/* ── Status badge ──────────────────────────────────────────── */
const statusCfg: Record<string, { label: string; cls: string }> = {
  ativo:        { label: "Ativo",         cls: "bg-green-100  text-green-700" },
  inadimplente: { label: "Inadimplente",  cls: "bg-yellow-100 text-yellow-800" },
  suspenso:     { label: "Suspenso",      cls: "bg-red-100    text-red-700"    },
  inativo:      { label: "Inativo",       cls: "bg-gray-100   text-gray-600"   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusCfg[status] ?? statusCfg.inativo;
  return <span className={`ds-badge ${cfg.cls}`}>{cfg.label}</span>;
}

/* ── Alerta item ───────────────────────────────────────────── */
const alertaCfg = {
  danger:  { bar: "bg-destructive",   bg: "bg-red-50",     icon: "text-destructive"  },
  warning: { bar: "bg-warning",       bg: "bg-yellow-50",  icon: "text-warning-foreground" },
  success: { bar: "bg-success",       bg: "bg-green-50",   icon: "text-success"      },
};

function AlertaItem({ tipo, icon: Icon, texto, sub }: typeof alertas[0]) {
  const cfg = alertaCfg[tipo as keyof typeof alertaCfg];
  return (
    <div className={`flex items-start gap-3 rounded-lg p-3 ${cfg.bg}`}>
      <div className={`mt-0.5 shrink-0 ${cfg.bar} h-full w-1 self-stretch rounded-full`} />
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${cfg.icon}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{texto}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

/* ── KPI card ──────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, delta, deltaUp, sub, iconCls }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; delta?: string; deltaUp?: boolean; sub?: string; iconCls: string;
}) {
  return (
    <div className="ds-card ds-card-hover p-5 flex items-start gap-4">
      <div className={`ds-icon-pill ${iconCls}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground leading-none">{value}</p>
        {(delta || sub) && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {delta && (
              <>
                {deltaUp
                  ? <ArrowUpRight className="h-3.5 w-3.5 text-success shrink-0" />
                  : <ArrowDownRight className="h-3.5 w-3.5 text-destructive shrink-0" />}
                <span className={`text-xs font-semibold ${deltaUp ? "text-success" : "text-destructive"}`}>{delta}</span>
              </>
            )}
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Dashboard principal ───────────────────────────────────── */
function Dashboard() {
  const { profile, user } = useAuth();
  const nome = profile?.nome?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Contador";
  const hoje = new Date();
  const diasDoMes = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  return (
    <div className="space-y-6">

      {/* ── Boas-vindas ─────────────────────────────────────── */}
      <div className="ds-card overflow-hidden">
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-6 py-5"
          style={{ background: "linear-gradient(135deg, var(--color-sidebar) 0%, oklch(0.24 0.030 255) 100%)" }}
        >
          <div>
            <p className="text-sm font-medium text-white/60">
              {diasDoMes[hoje.getDay()]}, {hoje.getDate()} de {meses[hoje.getMonth()]} de {hoje.getFullYear()}
            </p>
            <h1 className="mt-1 text-xl font-bold text-white">
              Olá, {nome}! 👋
            </h1>
            <p className="mt-0.5 text-sm text-white/70">
              Você tem <span className="font-semibold text-[var(--color-sidebar-accent)]">3 alertas</span> pendentes hoje.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-center">
              <div
                className="flex h-12 w-12 flex-col items-center justify-center rounded-xl text-white"
                style={{ background: "var(--color-sidebar-accent)" }}
              >
                <span className="text-lg font-bold leading-none">{hoje.getDate()}</span>
                <span className="text-[10px] uppercase tracking-wide opacity-80">{meses[hoje.getMonth()]}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y divide-border border-t border-border">
          {acoesRapidas.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.to}
                to={a.to}
                className="flex flex-col items-center gap-2 px-4 py-4 text-center transition-all hover:bg-muted group"
              >
                <div className={`ds-icon-pill ${a.color} group-hover:scale-110 transition-transform`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium text-foreground leading-tight">{a.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="ds-kpi-grid">
        <KpiCard icon={Building2}   label="Clientes Ativos" value="72"        delta="+3 este mês"  deltaUp iconCls="bg-blue-100 text-blue-600" />
        <KpiCard icon={DollarSign}  label="Honorários Maio" value="R$ 45.100" delta="+4,4%"        deltaUp iconCls="bg-green-100 text-green-600" />
        <KpiCard icon={AlertTriangle} label="Inadimplentes" value="6"         sub="2 críticos"             iconCls="bg-yellow-100 text-yellow-600" />
        <KpiCard icon={FileText}    label="DAS em Aberto"   value="3"         sub="venc. amanhã"           iconCls="bg-red-100 text-red-600" />
      </div>

      {/* ── Linha 2: Alertas + Calendário fiscal ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Alertas */}
        <div className="ds-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-foreground" />
              Alertas do dia
            </h2>
            <span className="ds-badge bg-red-100 text-red-700">3 urgentes</span>
          </div>
          <div className="p-4 space-y-2">
            {alertas.map((a, i) => <AlertaItem key={i} {...a} />)}
          </div>
        </div>

        {/* Calendário fiscal */}
        <div className="ds-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Próximos vencimentos
            </h2>
            <Link to="/obrigacoes" className="text-xs font-medium text-primary hover:underline">
              Ver tudo →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {calFiscal.map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-center min-w-[52px] ${
                    item.urgente
                      ? "bg-red-100 text-red-700"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-xs font-bold">{item.dia}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${item.urgente ? "text-destructive" : "text-foreground"}`}>
                    {item.label}
                  </p>
                </div>
                {item.urgente && (
                  <span className="shrink-0 ds-badge bg-red-100 text-red-700">Urgente</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Gráfico de honorários ────────────────────────────── */}
      <div className="ds-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Honorários 2025
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Recebido vs. previsto por mês</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Acumulado</p>
            <p className="font-bold text-foreground">R$ 208.800</p>
          </div>
        </div>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={honorariosData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRecebido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="oklch(0.66 0.195 44)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="oklch(0.66 0.195 44)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradPrevisto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="oklch(0.61 0.155 152)" stopOpacity={0.20} />
                  <stop offset="95%" stopColor="oklch(0.61 0.155 152)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0.005 260)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "oklch(0.50 0.016 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.50 0.016 260)" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, ""]}
                contentStyle={{ borderRadius: 10, border: "1px solid oklch(0.90 0.005 260)", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="previsto" name="Previsto" stroke="oklch(0.61 0.155 152)" strokeWidth={2}
                fill="url(#gradPrevisto)" strokeDasharray="5 3" dot={false} />
              <Area type="monotone" dataKey="recebido" name="Recebido" stroke="oklch(0.66 0.195 44)" strokeWidth={2.5}
                fill="url(#gradRecebido)" dot={{ r: 3, fill: "oklch(0.66 0.195 44)" }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Clientes recentes — CARDS, sem tabela lateral ────── */}
      <div className="ds-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Clientes recentes
          </h2>
          <Link to="/clientes" className="text-xs font-medium text-primary hover:underline">
            Ver todos →
          </Link>
        </div>

        {/* Mobile: lista de cards; Desktop: linhas */}
        <div className="divide-y divide-border">
          {ultimosClientes.map((c, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/50 transition-colors">
              {/* Avatar inicial */}
              <div
                className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: "var(--color-primary)" }}
              >
                {c.nome[0]}
              </div>

              {/* Nome + regime */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.nome}</p>
                <p className="text-xs text-muted-foreground">{c.regime}</p>
              </div>

              {/* Status */}
              <StatusBadge status={c.status} />

              {/* Honorário — oculto em telas muito pequenas */}
              <span className="hidden sm:block shrink-0 text-sm font-semibold text-foreground">
                {c.honorario}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

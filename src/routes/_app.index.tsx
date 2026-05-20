import { createFileRoute } from "@tanstack/react-router";
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
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · APOYA Gestão" }] }),
});

/* ─── Mock data ────────────────────────────────────────────── */
const honorariosData = [
  { mes: "Jan", recebido: 38200, previsto: 40000 },
  { mes: "Fev", recebido: 41500, previsto: 40000 },
  { mes: "Mar", recebido: 39800, previsto: 42000 },
  { mes: "Abr", recebido: 43200, previsto: 42000 },
  { mes: "Mai", recebido: 45100, previsto: 44000 },
  { mes: "Jun", recebido: 42700, previsto: 44000 },
];

const clientesRecentes = [
  { nome: "Padaria Pão Dourado Ltda", cnpj: "12.345.678/0001-90", regime: "Simples", status: "ativo", honorario: "R$ 680" },
  { nome: "Clínica Saúde Total ME", cnpj: "23.456.789/0001-01", regime: "Lucro Presumido", status: "ativo", honorario: "R$ 1.200" },
  { nome: "Tech Solutions Ltda", cnpj: "34.567.890/0001-12", regime: "Simples", status: "inadimplente", honorario: "R$ 850" },
  { nome: "Maria Silva MEI", cnpj: "45.678.901/0001-23", regime: "MEI", status: "ativo", honorario: "R$ 120" },
  { nome: "Construção RJ Ltda", cnpj: "56.789.012/0001-34", regime: "Lucro Presumido", status: "suspenso", honorario: "R$ 2.100" },
];

const alertas = [
  { tipo: "danger", texto: "3 clientes com DAS vencendo amanhã", sub: "Ação necessária hoje" },
  { tipo: "warning", texto: "2 NFS-e com dados incompletos", sub: "Revisar antes do envio em lote" },
  { tipo: "warning", texto: "DCTFWeb de maio ainda não enviada", sub: "Prazo: último dia útil do mês" },
  { tipo: "success", texto: "DAS de abril 100% emitido", sub: "72/72 clientes — enviado via WhatsApp" },
];

/* ─── Sub-components ───────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaUp,
  hint,
  iconBg,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
  deltaUp?: boolean;
  hint?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="ds-card p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          {label}
        </div>
        <div className="text-2xl font-bold text-foreground leading-none">{value}</div>
        {(delta || hint) && (
          <div className="mt-2 flex items-center gap-1.5">
            {delta && (
              <>
                {deltaUp ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-success shrink-0" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
                <span className={`text-xs font-medium ${deltaUp ? "text-success" : "text-destructive"}`}>
                  {delta}
                </span>
              </>
            )}
            {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
          </div>
        )}
      </div>
      <div className={`ds-icon-pill shrink-0 ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  ativo:        "bg-success/10 text-success border border-success/20",
  inadimplente: "bg-warning/15 text-warning-foreground border border-warning/25",
  suspenso:     "bg-destructive/10 text-destructive border border-destructive/20",
  inativo:      "bg-muted text-muted-foreground border border-border",
  em_analise:   "bg-info/10 text-info border border-info/20",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo", inadimplente: "Inadimplente", suspenso: "Suspenso",
  inativo: "Inativo", em_analise: "Em análise",
};

const alertStyles = {
  danger:  { bg: "bg-destructive/8 border-destructive/25", icon: AlertTriangle, iconColor: "text-destructive" },
  warning: { bg: "bg-warning/10 border-warning/30",        icon: Clock,          iconColor: "text-warning-foreground" },
  success: { bg: "bg-success/8 border-success/25",         icon: CheckCircle2,   iconColor: "text-success" },
};

/* ─── Main component ───────────────────────────────────────── */

function Dashboard() {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header da página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground capitalize mt-0.5">{hoje}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary-soft text-primary text-xs font-semibold px-3 py-1.5">
            75 clientes ativos
          </span>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Clientes ativos"
          value="75"
          delta="+3 este mês"
          deltaUp={true}
          iconBg="bg-primary/12"
          iconColor="text-primary"
        />
        <StatCard
          icon={DollarSign}
          label="Honorários / mês"
          value="R$ 45.100"
          delta="+4,2% vs abr"
          deltaUp={true}
          iconBg="bg-success/12"
          iconColor="text-success"
        />
        <StatCard
          icon={FileText}
          label="DAS pendentes"
          value="4"
          hint="de 47 clientes Simples"
          iconBg="bg-warning/12"
          iconColor="text-warning-foreground"
        />
        <StatCard
          icon={Receipt}
          label="NFS-e este mês"
          value="68 / 75"
          delta="7 pendentes"
          deltaUp={false}
          iconBg="bg-info/12"
          iconColor="text-info"
        />
      </div>

      {/* ── Gráfico + Alertas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de honorários */}
        <div className="lg:col-span-2 ds-card p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-foreground">Honorários 2026</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Recebido vs previsto</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary inline-block" />
                Recebido
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-border inline-block" />
                Previsto
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={honorariosData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRecebido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="oklch(0.68 0.20 47)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="oklch(0.68 0.20 47)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPrevisto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.006 260)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "oklch(0.52 0.018 260)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "oklch(0.52 0.018 260)" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ borderRadius: "0.75rem", border: "1px solid oklch(0.91 0.006 260)", fontSize: 12 }}
                formatter={(v: number) => [`R$ ${v.toLocaleString("pt-BR")}`, ""]}
              />
              <Area type="monotone" dataKey="previsto" stroke="#94a3b8" strokeWidth={2}
                fill="url(#gradPrevisto)" strokeDasharray="4 3" dot={false} />
              <Area type="monotone" dataKey="recebido" stroke="oklch(0.68 0.20 47)" strokeWidth={2.5}
                fill="url(#gradRecebido)" dot={{ r: 4, fill: "oklch(0.68 0.20 47)", strokeWidth: 2, stroke: "#fff" }}
                activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Alertas */}
        <div className="ds-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-foreground">Atenção necessária</h2>
            <span className="rounded-full bg-destructive/10 text-destructive text-[11px] font-semibold px-2 py-0.5">
              {alertas.filter((a) => a.tipo !== "success").length} itens
            </span>
          </div>
          {alertas.map((a, i) => {
            const style = alertStyles[a.tipo as keyof typeof alertStyles];
            const Icon = style.icon;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-xl border p-3 ${style.bg}`}
              >
                <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${style.iconColor}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground leading-snug">{a.texto}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Clientes recentes ── */}
      <div className="ds-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Clientes recentes</h2>
          <a href="/clientes" className="text-sm font-medium text-primary hover:underline">
            Ver todos →
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">CNPJ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Regime</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Honorário</th>
              </tr>
            </thead>
            <tbody>
              {clientesRecentes.map((c, i) => (
                <tr
                  key={i}
                  className="border-b border-border/60 hover:bg-muted/20 transition-colors cursor-pointer last:border-0"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-foreground truncate max-w-[200px]">{c.nome}</div>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs hidden md:table-cell">{c.cnpj}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <span className="rounded-full bg-primary-soft text-primary text-[11px] font-medium px-2.5 py-0.5">
                      {c.regime}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 ${statusStyles[c.status]}`}>
                      {statusLabels[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-foreground">{c.honorario}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

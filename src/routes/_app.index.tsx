import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Building2, Calendar, DollarSign, FileText, MessageSquare, Receipt, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · APOYA Gestão" }] }),
});

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}) {
  const toneCls = {
    default: "bg-primary-soft text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral do escritório · maio/2026"
      />

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium text-destructive">3 clientes atingem 45 dias de atraso amanhã</div>
          <div className="text-muted-foreground text-xs mt-0.5">Ação necessária antes da suspensão automática.</div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={DollarSign} label="Recebido este mês" value="R$ 42.350,00" hint="62 clientes pagaram" tone="success" />
        <StatCard icon={TrendingUp} label="Pendentes" value="R$ 8.940,00" hint="11 clientes" tone="warning" />
        <StatCard icon={AlertTriangle} label="Em atraso" value="R$ 3.120,00" hint="4 clientes" tone="destructive" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Calendar} label="Obrigações do mês" value="48 / 75" hint="64% concluídas" />
        <StatCard icon={Receipt} label="NFS-e emitidas" value="58 / 75" hint="17 pendentes" tone="info" />
        <StatCard icon={FileText} label="DAS gerados" value="41 / 52" hint="11 pendentes" tone="info" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={MessageSquare} label="WhatsApp" value="6 não lidas" hint="Última recebida há 12 min" />
        <StatCard icon={Building2} label="Clientes" value="75 ativos" hint="4 inadimplentes · 0 suspensos" />
      </section>

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        Os números acima são <span className="font-medium text-foreground">mockados</span>. Serão substituídos por dados reais ao conectar Supabase no módulo M7.
      </div>
    </div>
  );
}

/**
 * ModuleDashboard.tsx
 *
 * Dashboard padrão reutilizável para todos os módulos.
 * Aceita KPIs, alertas operacionais, últimas execuções e ações rápidas.
 */
import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Types ────────────────────────────────────────────── */
export interface ModuleKpi {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  hint?: string;
}

export interface ModuleQuickAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline";
}

export interface ModuleLogEntry {
  id: string;
  label: string;
  descricao?: string;
  status: "ok" | "erro" | "aviso" | "info";
  ts: string;
}

interface Props {
  kpis: ModuleKpi[];
  kpisLoading?: boolean;
  quickActions?: ModuleQuickAction[];
  logs?: ModuleLogEntry[];
  logsLoading?: boolean;
  emptyMessage?: string;
}

/* ── Helpers ──────────────────────────────────────────── */
const VARIANT_CLS: Record<string, string> = {
  default: "bg-muted/50 text-foreground border-border",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900",
  warning: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900",
  danger:  "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
  info:    "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
};

const LOG_STATUS_CLS: Record<string, string> = {
  ok:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  erro: "bg-red-50 text-red-700 border-red-200",
  aviso:"bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

const LOG_STATUS_ICON: Record<string, LucideIcon> = {
  ok:   CheckCircle2,
  erro: XCircle,
  aviso:AlertTriangle,
  info: Clock,
};

function fmtTs(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── KpiCard ──────────────────────────────────────────── */
function KpiCard({ kpi, loading }: { kpi: ModuleKpi; loading?: boolean }) {
  const Icon = kpi.icon;
  const cls = VARIANT_CLS[kpi.variant ?? "default"];
  return (
    <div className={cn("rounded-xl border px-4 py-3.5 space-y-2", cls)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider font-medium opacity-70">{kpi.label}</p>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      {loading ? (
        <div className="h-7 w-16 rounded bg-current/10 animate-pulse" />
      ) : (
        <p className="text-2xl font-bold tabular-nums leading-none">{kpi.value}</p>
      )}
      {kpi.hint && <p className="text-[11px] opacity-60">{kpi.hint}</p>}
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────── */
export function ModuleDashboard({
  kpis, kpisLoading,
  quickActions,
  logs, logsLoading,
  emptyMessage,
}: Props) {
  return (
    <div className="space-y-6">

      {/* KPIs */}
      <div className={cn(
        "grid gap-3",
        kpis.length <= 3 ? "grid-cols-1 sm:grid-cols-3" :
        kpis.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
        "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      )}>
        {kpis.map(k => (
          <KpiCard key={k.label} kpi={k} loading={kpisLoading} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">

        {/* Coluna principal: Ações rápidas */}
        <div className="lg:col-span-2 space-y-4">

          {/* Ações rápidas */}
          {quickActions && quickActions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Ações Rápidas
              </h3>
              <div className="flex flex-wrap gap-2">
                {quickActions.map(a => {
                  const Icon = a.icon;
                  return (
                    <Button
                      key={a.label}
                      variant={a.variant ?? "outline"}
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={a.onClick}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {a.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Coluna lateral: Últimas execuções */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Últimas Atividades
          </h3>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {logsLoading ? (
              <div className="divide-y divide-border">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex gap-2 px-3 py-3">
                    <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                      <div className="h-2.5 w-1/2 rounded bg-muted/60 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !logs?.length ? (
              <div className="px-4 py-8 text-center">
                <Clock className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground/60">
                  {emptyMessage ?? "Nenhuma atividade registrada"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {logs.map(log => {
                  const Icon = LOG_STATUS_ICON[log.status];
                  return (
                    <div key={log.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/30 transition-colors">
                      <span className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]",
                        LOG_STATUS_CLS[log.status]
                      )}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{log.label}</p>
                        {log.descricao && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{log.descricao}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{fmtTs(log.ts)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

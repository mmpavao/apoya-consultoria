import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ModuleKPI {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}

export interface ModuleHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  kpis?: ModuleKPI[];
}

const TONE_STYLES: Record<string, string> = {
  neutral:  "text-foreground",
  success:  "text-emerald-600",
  warning:  "text-amber-600",
  danger:   "text-red-600",
};

export default function ModuleHeader({ title, description, actions, kpis = [] }: ModuleHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Título + ações */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* KPIs */}
      {kpis.length > 0 && (
        <div className={cn("grid gap-3", {
          "grid-cols-1": kpis.length === 1,
          "grid-cols-2": kpis.length === 2,
          "grid-cols-3": kpis.length === 3,
          "grid-cols-4": kpis.length >= 4,
        })}>
          {kpis.slice(0, 4).map((kpi, i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-4 py-3.5">
              <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
              <p className={cn("text-2xl font-bold tabular-nums leading-none", TONE_STYLES[kpi.tone ?? "neutral"])}>
                {kpi.value}
              </p>
              {kpi.sub && <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

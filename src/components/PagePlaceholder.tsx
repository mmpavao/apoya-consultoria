import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────
   PageHeader — cabeçalho único de toda página
   ──────────────────────────────────────────────────────── */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-[26px] font-semibold leading-none tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   KpiGrid + KpiCard — padrão único de KPI
   Surface sempre branca, accent só no ícone.
   ──────────────────────────────────────────────────────── */
export function KpiGrid({
  cols = 4,
  children,
}: {
  cols?: 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
}) {
  const grid =
    cols === 2 ? "sm:grid-cols-2"
    : cols === 3 ? "sm:grid-cols-3"
    : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4"
    : cols === 5 ? "sm:grid-cols-3 lg:grid-cols-5"
    : "sm:grid-cols-3 lg:grid-cols-6";
  return <div className={cn("grid grid-cols-2 gap-3", grid)}>{children}</div>;
}

type KpiTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";
const TONE_ICON: Record<KpiTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger:  "bg-red-50 text-red-600",
  info:    "bg-blue-50 text-blue-600",
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: KpiTone;
}) {
  return (
    <div className="surface-card flex items-center gap-3 p-4">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", TONE_ICON[tone])}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-lg font-bold leading-tight tabular-nums text-foreground">
          {value}
        </p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Pagination — padrão único
   ──────────────────────────────────────────────────────── */
export function Pagination({
  page,
  totalPages,
  onChange,
  pageSize,
  total,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  pageSize?: number;
  total?: number;
}) {
  if (totalPages <= 1) return null;
  const from = pageSize && total ? Math.min((page - 1) * pageSize + 1, total) : null;
  const to   = pageSize && total ? Math.min(page * pageSize, total) : null;
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-1">
      <span className="text-xs text-muted-foreground">
        {from !== null ? `${from}–${to} de ${total}` : `Página ${page} de ${totalPages}`}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline" size="sm"
          className="h-8 w-8 rounded-xl p-0"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[68px] text-center text-xs font-semibold tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline" size="sm"
          className="h-8 w-8 rounded-xl p-0"
          disabled={page >= totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   PlaceholderBlock (mantém compat com rotas em construção)
   ──────────────────────────────────────────────────────── */
export function PlaceholderBlock({
  icon: Icon,
  title,
  description,
  module,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  module: string;
}) {
  return (
    <div className="surface-card border-dashed p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {module}
      </div>
    </div>
  );
}

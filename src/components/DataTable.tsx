/**
 * DataTable — Tabela densa estilo Linear / Prodexa
 * Usa as classes ds-table do design system (styles.css)
 * Sem shadcn Table — sem scroll horizontal.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export interface ColDef<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** classes para o <th> */
  headerClassName?: string;
  /** classes para cada <td> */
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  cols: ColDef<T>[];
  getKey: (row: T) => string;
  /** Habilita coluna de checkbox */
  selected?: Set<string>;
  onToggleAll?: () => void;
  onToggleRow?: (key: string) => void;
  emptyIcon?: ReactNode;
  emptyText?: string;
  /** Barra de filtros — fica acima da tabela */
  toolbar?: ReactNode;
  /** Classe extra aplicada a cada <tr> */
  rowClassName?: (row: T) => string;
}

export function DataTable<T>({
  rows,
  cols,
  getKey,
  selected,
  onToggleAll,
  onToggleRow,
  emptyIcon,
  emptyText = "Nenhum resultado",
  toolbar,
  rowClassName,
}: DataTableProps<T>) {
  const hasSelection = selected !== undefined && !!onToggleAll && !!onToggleRow;
  const allChecked   = hasSelection && rows.length > 0 && selected!.size === rows.length;
  const someChecked  = hasSelection && selected!.size > 0 && selected!.size < rows.length;

  return (
    <div className="ds-card overflow-hidden">
      {/* ── Toolbar ── */}
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
          {toolbar}
        </div>
      )}

      {/* ── Tabela ── */}
      <div className="ds-table-wrapper">
        <table className="ds-table">
          <thead>
            <tr>
              {hasSelection && (
                <th className="w-10 pl-4">
                  <Checkbox
                    checked={allChecked}
                    // @ts-expect-error indeterminate via ref
                    ref={(el: HTMLInputElement | null) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onCheckedChange={onToggleAll}
                    aria-label="Selecionar todos"
                  />
                </th>
              )}
              {cols.map((col) => (
                <th key={col.key} className={col.headerClassName}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={cols.length + (hasSelection ? 1 : 0)}
                  className="py-16 text-center"
                  style={{ overflow: "visible", whiteSpace: "normal" }}
                >
                  {emptyIcon && (
                    <div className="mb-2 flex justify-center opacity-30">{emptyIcon}</div>
                  )}
                  <p className="text-sm text-muted-foreground">{emptyText}</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key        = getKey(row);
                const isSelected = hasSelection && selected!.has(key);
                return (
                  <tr
                    key={key}
                    className={cn(
                      "group",
                      isSelected && "bg-primary/5",
                      rowClassName?.(row),
                    )}
                  >
                    {hasSelection && (
                      <td className="w-10 pl-4" style={{ overflow: "visible" }}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleRow!(key)}
                          aria-label="Selecionar linha"
                        />
                      </td>
                    )}
                    {cols.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   InlineBadge — badge dot colorido estilo Prodexa
   ───────────────────────────────────────────── */
const PAL: Record<string, string> = {
  gray:   "bg-gray-100   text-gray-600",
  blue:   "bg-blue-50    text-blue-700",
  green:  "bg-emerald-50 text-emerald-700",
  red:    "bg-red-50     text-red-700",
  amber:  "bg-amber-50   text-amber-700",
  violet: "bg-violet-50  text-violet-700",
  cyan:   "bg-cyan-50    text-cyan-700",
  indigo: "bg-indigo-50  text-indigo-700",
  orange: "bg-orange-50  text-orange-700",
};
const DOT: Record<string, string> = {
  gray:   "bg-gray-400",   blue:   "bg-blue-500",
  green:  "bg-emerald-500",red:    "bg-red-500",
  amber:  "bg-amber-500",  violet: "bg-violet-500",
  cyan:   "bg-cyan-500",   indigo: "bg-indigo-500",
  orange: "bg-orange-500",
};

export type BadgeColor = keyof typeof PAL;

export function InlineBadge({
  children, color = "gray", dot = false,
}: { children: ReactNode; color?: BadgeColor; dot?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
      PAL[color] ?? PAL.gray,
    )}>
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[color] ?? DOT.gray)} />}
      {children}
    </span>
  );
}

/* ─── Search ── */
export function TableSearch({
  value, onChange, placeholder = "Buscar…",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 min-w-[180px] rounded-lg pl-8 text-sm"
      />
    </div>
  );
}

/* ─── Footer ── */
export function TableFooter({
  total, filtered, selected,
}: { total: number; filtered: number; selected?: number }) {
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
      <span>{filtered} resultado{filtered !== 1 ? "s" : ""}</span>
      {filtered !== total && (
        <span className="text-muted-foreground/50">de {total} total</span>
      )}
      {!!selected && selected > 0 && (
        <span className="ml-auto font-semibold text-foreground">
          {selected} selecionado{selected !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

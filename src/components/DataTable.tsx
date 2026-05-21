/**
 * DataTable — estilo Figma-expert (rounded-3xl, sombras suaves, linhas leves)
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
  headerClassName?: string;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  cols: ColDef<T>[];
  getKey: (row: T) => string;
  selected?: Set<string>;
  onToggleAll?: () => void;
  onToggleRow?: (key: string) => void;
  onRowClick?: (row: T) => void;
  emptyIcon?: ReactNode;
  emptyText?: string;
  toolbar?: ReactNode;
  rowClassName?: (row: T) => string;
}

export function DataTable<T>({
  rows, cols, getKey,
  selected, onToggleAll, onToggleRow,
  emptyIcon, emptyText = "Nenhum resultado",
  toolbar, rowClassName, onRowClick,
}: DataTableProps<T>) {
  const hasSelection = selected !== undefined && !!onToggleAll && !!onToggleRow;
  const allChecked   = hasSelection && rows.length > 0 && selected!.size === rows.length;
  const someChecked  = hasSelection && selected!.size > 0 && selected!.size < rows.length;

  return (
    <div className="surface-card overflow-hidden">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-b border-border/70">
          {toolbar}
        </div>
      )}

      <div className="w-full overflow-hidden">
        <table className="ft-table">
          <thead>
            <tr>
              {hasSelection && (
                <th className="w-10 pl-5">
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
                <td colSpan={cols.length + (hasSelection ? 1 : 0)} className="py-20 text-center">
                  {emptyIcon && <div className="mb-3 flex justify-center opacity-30">{emptyIcon}</div>}
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
                      isSelected && "bg-primary/[0.04]",
                      rowClassName?.(row),
                      onRowClick && "cursor-pointer hover:bg-muted/40 transition-colors",
                    )}
                    onClick={onRowClick ? (e) => {
                      // Não navegar se clicou no checkbox ou em botões/links internos
                      const target = e.target as HTMLElement;
                      if (target.closest('button, a, input, [role="menuitem"], [data-no-rowclick]')) return;
                      onRowClick(row);
                    } : undefined}
                  >
                    {hasSelection && (
                      <td className="w-10 pl-5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleRow!(key)}
                          aria-label="Selecionar linha"
                        />
                      </td>
                    )}
                    {cols.map((col) => (
                      <td key={col.key} className={col.className}>{col.cell(row)}</td>
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

/* ─── InlineBadge — pílula leve ─────────────────────────── */
const PAL: Record<string, string> = {
  gray:   "bg-muted text-muted-foreground",
  blue:   "bg-blue-50    text-blue-700",
  green:  "bg-emerald-50 text-emerald-700",
  red:    "bg-red-50     text-red-700",
  amber:  "bg-[oklch(0.97_0.045_82)] text-[oklch(0.48_0.130_82)]",
  violet: "bg-violet-50  text-violet-700",
  cyan:   "bg-cyan-50    text-cyan-700",
  indigo: "bg-indigo-50  text-indigo-700",
  orange: "bg-primary-soft text-accent-foreground",
};
const DOT: Record<string, string> = {
  gray:   "bg-muted-foreground/60", blue:   "bg-blue-500",
  green:  "bg-emerald-500",         red:    "bg-red-500",
  amber:  "bg-[oklch(0.78_0.155_82)]",           violet: "bg-violet-500",
  cyan:   "bg-cyan-500",            indigo: "bg-indigo-500",
  orange: "bg-primary",
};

export type BadgeColor = keyof typeof PAL;

export function InlineBadge({
  children, color = "gray", dot = false,
}: { children: ReactNode; color?: BadgeColor; dot?: boolean }) {
  return (
    <span className={cn("pill", PAL[color] ?? PAL.gray)}>
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[color] ?? DOT.gray)} />}
      {children}
    </span>
  );
}

export function TableSearch({
  value, onChange, placeholder = "Buscar…",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 min-w-[220px] rounded-full pl-9 pr-4 text-sm bg-muted/40 border-transparent focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/15"
      />
    </div>
  );
}

export function TableFooter({
  total, filtered, selected,
}: { total: number; filtered: number; selected?: number }) {
  return (
    <div className="flex items-center gap-3 border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
      <span>{filtered} resultado{filtered !== 1 ? "s" : ""}</span>
      {filtered !== total && <span className="text-muted-foreground/50">de {total} total</span>}
      {!!selected && selected > 0 && (
        <span className="ml-auto font-semibold text-foreground">
          {selected} selecionado{selected !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

/**
 * CnaeSelect — Combobox de busca de CNAE com debounce via Focus NF-e
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useBuscarCnaes, type FocusCnae } from "@/hooks/use-focus-apis";

interface CnaeSelectProps {
  value?: string;
  onSelect?: (cnae: FocusCnae) => void;
  label?: string;
  className?: string;
}

export function CnaeSelect({ value = "", onSelect, label = "CNAE", className }: CnaeSelectProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const { data: cnaes, loading } = useBuscarCnaes(query);

  return (
    <div className={`space-y-1 relative ${className ?? ""}`}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder="Buscar por código ou descrição..."
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && cnaes && cnaes.length > 0 && (
        <div className="absolute z-50 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
          {cnaes.map((c) => (
            <button
              key={c.codigo}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
              onMouseDown={() => { onSelect?.(c); setQuery(`${c.codigo} — ${c.descricao}`); setOpen(false); }}
            >
              <span className="font-mono font-medium">{c.codigo}</span>
              <span className="ml-2 text-muted-foreground">{c.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CnaeSelect;

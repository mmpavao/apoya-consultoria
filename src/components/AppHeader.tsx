/**
 * AppHeader.tsx — SPRINT-A
 *
 * Header limpo com busca de cliente rápida (live search + kbd shortcut Cmd/Ctrl+K)
 * Referências: Vercel, Linear, Supabase dashboards.
 */
import React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, Search, X, Building2, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClientes } from "@/hooks/use-clientes";

type AppUser = {
  name: string;
  email: string;
  role: "admin" | "contador" | "assistente" | "cliente";
};

const ROLE_LABEL: Record<AppUser["role"], string> = {
  admin:       "Admin",
  contador:    "Contador",
  assistente:  "Assistente",
  cliente:     "Cliente",
};

/* ── Quick Search ─────────────────────────────────────── */
function QuickSearch({ onClose }: { onClose: () => void }) {
  const [q, setQ] = React.useState("");
  const { clientes } = useClientes();
  const navigate    = useNavigate();
  const inputRef    = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const results = React.useMemo(() => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return clientes
      .filter(c =>
        c.razaoSocial?.toLowerCase().includes(lower) ||
        c.nomeFantasia?.toLowerCase().includes(lower) ||
        c.cnpj?.includes(q)
      )
      .slice(0, 6);
  }, [q, clientes]);

  function go(id: string) {
    navigate({ to: "/clientes/$id" as any, params: { id } } as any);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-elevated overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar cliente, CNPJ, nome fantasia…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            onKeyDown={e => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results.length > 0) go(results[0].id);
            }}
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Resultados */}
        {q.trim() ? (
          results.length > 0 ? (
            <ul className="py-1.5 max-h-72 overflow-y-auto">
              {results.map(c => (
                <li key={c.id}>
                  <button
                    onClick={() => go(c.id)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-muted/60 transition-colors text-left group"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Building2 className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.razaoSocial}</p>
                      {c.nomeFantasia && (
                        <p className="text-xs text-muted-foreground truncate">{c.nomeFantasia}</p>
                      )}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground/60 shrink-0 hidden group-hover:block">
                      {c.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                    </span>
                    <ChevronsRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum cliente encontrado para "<strong>{q}</strong>"
            </div>
          )
        ) : (
          <div className="px-4 py-3 text-xs text-muted-foreground/50">
            Digite o nome ou CNPJ do cliente
          </div>
        )}

        {/* Footer kbd hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border/50 bg-muted/20">
          <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">↵</kbd> abrir
          </span>
          <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">esc</kbd> fechar
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── AppHeader ────────────────────────────────────────── */
export function AppHeader({
  user,
  onMenuClick,
}: {
  user: AppUser;
  onMenuClick: () => void;
  onLogout?: () => void;
}) {
  const [searchOpen, setSearchOpen] = React.useState(false);

  const initials = user.name
    .split(" ")
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Atalho global Cmd+K / Ctrl+K
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/40 bg-background/80 backdrop-blur-md px-4 md:px-6">

        {/* Hambúrguer mobile */}
        <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground shrink-0" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex flex-1 max-w-sm items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 h-9 text-sm text-muted-foreground hover:bg-muted/70 hover:border-border/70 transition-all group"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left text-[13px]">Buscar cliente…</span>
          <kbd className="hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground/60 group-hover:border-border/60">
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          {/* Mobile search icon */}
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden grid h-9 w-9 place-items-center rounded-xl border border-border bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Notificações */}
          <Link
            to="/administracao"
            className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Notificações"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive ring-1 ring-background" />
          </Link>

          {/* User chip */}
          <Link
            to="/configuracoes"
            className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 pl-2.5 pr-1.5 py-1 hover:bg-muted/70 transition-colors"
          >
            <div className="hidden sm:block text-right leading-tight">
              <p className="text-[13px] font-semibold text-foreground leading-none">{user.name}</p>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">{ROLE_LABEL[user.role]}</p>
            </div>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
              {initials}
            </div>
          </Link>
        </div>
      </header>

      {/* Modal de busca */}
      {searchOpen && <QuickSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}

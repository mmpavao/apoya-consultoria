import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppUser = {
  name: string;
  email: string;
  role: "admin" | "contador" | "assistente" | "cliente";
};

const roleLabels: Record<AppUser["role"], string> = {
  admin: "Admin",
  contador: "Contador",
  assistente: "Assistente",
  cliente: "Cliente",
};

export function AppHeader({
  user,
  onMenuClick,
}: {
  user: AppUser;
  onMenuClick: () => void;
  onLogout?: () => void;
}) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center gap-4 bg-transparent px-4 md:px-8">
      {/* Hambúrguer mobile */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Busca — pill, transparente sobre o fundo */}
      <div className="relative hidden md:flex flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar cliente, CNPJ, obrigação…"
          className="h-12 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm shadow-soft outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Sino */}
        <button
          className="relative grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition-colors hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
        </button>

        {/* User chip */}
        <div className="flex items-center gap-3 rounded-full border border-border bg-card pl-4 pr-1.5 py-1.5 shadow-soft">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-semibold text-foreground">{user.name}</div>
            <div className="text-[11px] text-muted-foreground">{roleLabels[user.role]}</div>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApoyaLogo } from "@/components/ApoyaLogo";

type AppUser = {
  name: string;
  email: string;
  role: "admin" | "contador" | "assistente" | "cliente";
};

const roleLabels: Record<AppUser["role"], string> = {
  admin: "Administrador",
  contador: "Contador",
  assistente: "Assistente",
  cliente: "Portal do cliente",
};

const roleColors: Record<AppUser["role"], string> = {
  admin:      "bg-destructive/15 text-destructive",
  contador:   "bg-primary-soft text-primary",
  assistente: "bg-info/15 text-info",
  cliente:    "bg-success/15 text-success",
};

export function AppHeader({
  user,
  onMenuClick,
  onLogout,
}: {
  user: AppUser;
  onMenuClick: () => void;
  onLogout?: () => void;
}) {
  const navigate = useNavigate();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    if (onLogout) onLogout();
    else navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/90 backdrop-blur-md px-4 md:px-8">
      {/* Mobile: hamburger + logo */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden text-muted-foreground"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="md:hidden">
        <ApoyaLogo variant="on-light" size="sm" withTagline={false} className="max-w-[90px]" />
      </div>

      {/* Search bar — estilo Elegent */}
      <div className="relative hidden md:flex flex-1 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar cliente, CNPJ, obrigação..."
          className="h-10 w-full rounded-xl border border-input bg-muted/50 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary focus:bg-card focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {/* Dot de alerta */}
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
        </Button>

        {/* Divider */}
        <div className="hidden sm:block h-8 w-px bg-border mx-1" />

        {/* User info */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold text-foreground">{user.name}</div>
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${roleColors[user.role]}`}
            >
              {roleLabels[user.role]}
            </span>
          </div>

          {/* Avatar */}
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
            style={{ background: "var(--color-primary)" }}
          >
            {initials}
          </div>
        </div>

        {/* Mobile: só avatar */}
        <div
          className="flex sm:hidden h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {initials}
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

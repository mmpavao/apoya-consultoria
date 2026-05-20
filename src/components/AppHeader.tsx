import { useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApoyaLogo } from "@/components/ApoyaLogo";
import { clearMockUser, type MockUser } from "@/lib/mock-auth";

const roleLabels: Record<MockUser["role"], string> = {
  admin: "Administrador",
  fiscal: "Fiscal",
  financeiro: "Financeiro",
  dp: "Depto. Pessoal",
};

export function AppHeader({ user, onMenuClick }: { user: MockUser; onMenuClick: () => void }) {
  const navigate = useNavigate();
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 backdrop-blur px-4 md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Logo compacto — somente mobile (sidebar fica escondida) */}
      <div className="md:hidden">
        <ApoyaLogo variant="on-light" size="sm" withTagline={false} className="max-w-[100px]" />
      </div>


      <div className="relative hidden md:flex flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar cliente, CNPJ, obrigação..."
          className="h-10 w-full rounded-xl border border-input bg-muted/40 pl-9 pr-3 text-sm outline-none focus:border-ring focus:bg-card"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden sm:block text-right leading-tight">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-[11px] text-muted-foreground">{roleLabels[user.role]}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
          {initials}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            clearMockUser();
            navigate({ to: "/login" });
          }}
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

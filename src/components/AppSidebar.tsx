import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Calendar,
  Receipt,
  DollarSign,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Match exato — só ativo se pathname === to */
  exact?: boolean;
};

const items: NavItem[] = [
  { to: "/",             label: "Dashboard",   icon: LayoutDashboard, exact: true },
  { to: "/clientes",     label: "Clientes",    icon: Building2 },
  { to: "/obrigacoes",   label: "Obrigações",  icon: Calendar },
  { to: "/fiscal/das",   label: "Fiscal",      icon: Receipt },
  { to: "/financeiro",   label: "Financeiro",  icon: DollarSign },
  { to: "/whatsapp",     label: "WhatsApp",    icon: MessageSquare },
];

const bottom: NavItem[] = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  if (item.to === "/fiscal/das") return pathname.startsWith("/fiscal");
  return pathname.startsWith(item.to);
}

function RailItem({ item, active, onClick }: { item: NavItem; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      title={item.label}
      className={cn(
        "group relative grid h-11 w-11 place-items-center rounded-xl transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-glow"
          : "text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      {/* tooltip ao hover */}
      <span
        className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-sidebar-accent px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground opacity-0 shadow-elevated transition-opacity group-hover:opacity-100"
      >
        {item.label}
      </span>
    </Link>
  );
}

export function AppSidebar({
  onNavigate,
  onLogout,
}: {
  onNavigate?: () => void;
  onLogout?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-full w-full flex-col items-center py-5">
      {/* Logo mark — só símbolo "A" */}
      <Link
        to="/"
        onClick={onNavigate}
        className="mb-7 grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold shadow-glow"
      >
        a
      </Link>

      {/* Nav principal */}
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {items.map((it) => (
          <RailItem
            key={it.to}
            item={it}
            active={isActive(pathname, it)}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* Footer: settings + logout */}
      <div className="flex flex-col items-center gap-1.5">
        {bottom.map((it) => (
          <RailItem
            key={it.to}
            item={it}
            active={isActive(pathname, it)}
            onClick={onNavigate}
          />
        ))}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Sair"
            className="grid h-11 w-11 place-items-center rounded-xl text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-destructive transition-all"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
    </div>
  );
}

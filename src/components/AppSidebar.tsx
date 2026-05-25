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
  ChevronsLeft,
  ChevronsRight,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  exact?: boolean;
};

const items: NavItem[] = [
  { to: "/",             label: "Dashboard",   icon: LayoutDashboard, exact: true },
  { to: "/clientes",     label: "Clientes",    icon: Building2 },
  { to: "/obrigacoes",   label: "Obrigações",  icon: Calendar },
  { to: "/fiscal/das",   label: "Fiscal",      icon: Receipt },
  { to: "/financeiro",   label: "Financeiro",  icon: DollarSign },
  { to: "/whatsapp",     label: "WhatsApp",    icon: MessageSquare },
  { to: "/automacoes",  label: "Automações",  icon: Bot            },
];

const bottom: NavItem[] = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  if (item.to === "/fiscal/das") return pathname.startsWith("/fiscal");
  return pathname.startsWith(item.to);
}

function NavLine({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center rounded-xl transition-all duration-200",
        collapsed ? "h-11 w-11 justify-center" : "h-11 w-full px-3 gap-3",
        active
          ? "bg-primary text-primary-foreground shadow-glow"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      {!collapsed && (
        <span className="text-sm font-medium truncate">{item.label}</span>
      )}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-sidebar-accent px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground opacity-0 shadow-elevated transition-opacity group-hover:opacity-100">
          {item.label}
        </span>
      )}
    </Link>
  );
}

export function AppSidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  onLogout,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onLogout?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col py-5",
        collapsed ? "items-center px-0" : "items-stretch px-3"
      )}
    >
      {/* Header: logo + (wordmark) + toggle */}
      <div
        className={cn(
          "mb-7 flex items-center",
          collapsed ? "flex-col gap-3" : "justify-between"
        )}
      >
        <Link
          to="/"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5",
            collapsed ? "justify-center" : ""
          )}
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-lg font-bold shadow-glow">
            a
          </span>
          {!collapsed && (
            <span className="font-display text-lg font-bold tracking-tight text-sidebar-foreground">
              apoya
            </span>
          )}
        </Link>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="hidden md:grid h-8 w-8 place-items-center rounded-lg text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Nav principal */}
      <nav
        className={cn(
          "flex flex-1 flex-col gap-1.5",
          collapsed ? "items-center" : "items-stretch"
        )}
      >
        {items.map((it) => (
          <NavLine
            key={it.to}
            item={it}
            active={isActive(pathname, it)}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "flex flex-col gap-1.5",
          collapsed ? "items-center" : "items-stretch"
        )}
      >
        {bottom.map((it) => (
          <NavLine
            key={it.to}
            item={it}
            active={isActive(pathname, it)}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        ))}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Sair"
            className={cn(
              "flex items-center rounded-xl text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-destructive transition-all",
              collapsed ? "h-11 w-11 justify-center" : "h-11 w-full px-3 gap-3"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Sair</span>}
          </button>
        )}
      </div>
    </div>
  );
}

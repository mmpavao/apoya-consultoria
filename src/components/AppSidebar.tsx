import { Link, useRouterState } from "@tanstack/react-router";
import {
  Workflow,
  Users2,
  BookOpen,
  FolderOpen,
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
  UserRoundSearch,
  Landmark,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

type NavItem =
  | { to: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; exact?: boolean; separator?: never; group?: never }
  | { separator: true; to?: never; label?: never; icon?: never; exact?: never; group?: never }
  | { group: string; to?: never; label?: never; icon?: never; exact?: never; separator?: never };

const items: NavItem[] = [
  { group: "GESTÃO" },
  { to: "/",           label: "Dashboard",    icon: LayoutDashboard, exact: true },
  { to: "/clientes",   label: "Clientes",     icon: Building2 },
  { to: "/crm",        label: "CRM",          icon: UserRoundSearch },

  { group: "OPERACIONAL" },
  { to: "/obrigacoes", label: "Obrigações",   icon: Calendar },
  { to: "/workflows",  label: "Workflows",    icon: Workflow },
  { to: "/societario", label: "Societário",   icon: Landmark },

  { group: "DEPARTAMENTOS" },
  { to: "/fiscal/das", label: "Fiscal",       icon: Receipt },
  { to: "/dp",         label: "Dep. Pessoal", icon: Users2 },
  { to: "/contabil",   label: "Contábil",     icon: BookOpen },
  { to: "/financeiro", label: "Financeiro",   icon: DollarSign },

  { group: "FERRAMENTAS" },
  { to: "/documentos", label: "Documentos",   icon: FolderOpen },
  { to: "/whatsapp",   label: "WhatsApp",     icon: MessageSquare },
  { to: "/automacoes", label: "Automações",   icon: Bot },
];

const bottom: NavItem[] = [
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.separator || "group" in item) return false;
  if (item.exact) return pathname === item.to;
  if (item.to === "/fiscal/das") return pathname.startsWith("/fiscal");
  return pathname.startsWith(item.to);
}

function getActiveGroup(pathname: string): string | null {
  const gestao        = ["/", "/clientes", "/crm"];
  const operacional   = ["/obrigacoes", "/workflows", "/societario"];
  const departamentos = ["/fiscal", "/dp", "/contabil", "/financeiro"];
  const ferramentas   = ["/documentos", "/whatsapp", "/automacoes"];
  if (gestao.some(p => pathname === p || (p !== "/" && pathname.startsWith(p)))) return "GESTÃO";
  if (operacional.some(p => pathname.startsWith(p)))   return "OPERACIONAL";
  if (departamentos.some(p => pathname.startsWith(p))) return "DEPARTAMENTOS";
  if (ferramentas.some(p => pathname.startsWith(p)))   return "FERRAMENTAS";
  return null;
}

function defaultOpenGroups(): string[] {
  try {
    const saved = localStorage.getItem("sidebar-open-groups");
    if (saved) return JSON.parse(saved) as string[];
  } catch {}
  return ["GESTÃO", "OPERACIONAL", "DEPARTAMENTOS", "FERRAMENTAS"];
}

function NavLine({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: Extract<NavItem, { to: string }>;
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
        collapsed ? "h-9 w-9 justify-center" : "h-9 w-full px-3 gap-2.5",
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
  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpenGroups);

  useEffect(() => {
    const activeGroup = getActiveGroup(pathname);
    if (activeGroup) {
      setOpenGroups(prev => {
        if (prev.includes(activeGroup)) return prev;
        const next = [...prev, activeGroup];
        localStorage.setItem("sidebar-open-groups", JSON.stringify(next));
        return next;
      });
    }
  }, [pathname]);

  function toggleGroup(group: string) {
    setOpenGroups(prev => {
      const next = prev.includes(group)
        ? prev.filter(g => g !== group)
        : [...prev, group];
      localStorage.setItem("sidebar-open-groups", JSON.stringify(next));
      return next;
    });
  }

  function renderAccordion(): React.ReactNode[] {
    const rendered: React.ReactNode[] = [];
    let currentGroup: string | null = null;
    let groupItems: NavItem[] = [];

    const flushGroup = () => {
      if (!currentGroup) return;
      const grp = currentGroup;
      const isOpen = collapsed || openGroups.includes(grp);
      rendered.push(
        <div key={`group-${grp}`} className="mb-0.5">
          {!collapsed && (
            <button
              onClick={() => toggleGroup(grp)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors",
                "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/40"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest">{grp}</span>
              <ChevronDown className={cn(
                "h-3 w-3 transition-transform duration-200",
                isOpen ? "rotate-0" : "-rotate-90"
              )} />
            </button>
          )}
          {isOpen && (
            <div className={cn("flex flex-col gap-0.5", !collapsed && "mt-0.5")}>
              {groupItems.map((it) =>
                "to" in it ? (
                  <NavLine
                    key={it.to}
                    item={it as Extract<NavItem, { to: string }>}
                    active={isActive(pathname, it)}
                    collapsed={collapsed}
                    onClick={onNavigate}
                  />
                ) : null
              )}
            </div>
          )}
        </div>
      );
      groupItems = [];
    };

    for (const it of items) {
      if ("group" in it && it.group) {
        flushGroup();
        currentGroup = it.group;
      } else {
        groupItems.push(it);
      }
    }
    flushGroup();
    return rendered;
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col py-5",
        collapsed ? "items-center px-0" : "items-stretch px-3"
      )}
    >
      {/* Header: logo + wordmark + toggle */}
      <div
        className={cn(
          "mb-5 flex items-center",
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

      {/* Nav com accordion */}
      <nav
        className={cn(
          "sidebar-nav flex flex-1 flex-col gap-0.5 overflow-y-auto",
          collapsed ? "items-center" : "items-stretch"
        )}
      >
        {renderAccordion()}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "mt-2 flex flex-col gap-1",
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
              collapsed ? "h-9 w-9 justify-center" : "h-9 w-full px-3 gap-2.5"
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

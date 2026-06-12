/**
 * AppSidebar.tsx — SPRINT-A
 *
 * Reorganização visual inspirada em Linear/Vercel:
 * - Grupos: VISÃO GERAL → CLIENTES → DEPARTAMENTOS → FERRAMENTAS → SISTEMA
 * - Indicador de alerta no item Fiscal (badge vermelho)
 * - Collapse animado com tooltips
 * - Setores filtram itens de DEPARTAMENTOS
 */
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Shield,
  Workflow,
  Users2,
  BookOpen,
  FolderOpen,
  LayoutDashboard,
  Building2,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import { useUserSetores } from "@/hooks/use-user-setores";

/* ── Types ─────────────────────────────────────────────── */
type NavItem =
  | { kind: "link"; to: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; exact?: boolean; setor?: string; badge?: string }
  | { kind: "group"; label: string }
  | { kind: "divider" };

/* ── Nav schema ─────────────────────────────────────────── */
const NAV: NavItem[] = [
  // ── Visão Geral
  { kind: "group",  label: "VISÃO GERAL" },
  { kind: "link",   to: "/",           label: "Dashboard",           icon: LayoutDashboard, exact: true },
  { kind: "link",   to: "/workflows",  label: "Central de Operações",icon: Workflow },

  // ── Clientes
  { kind: "group",  label: "CLIENTES" },
  { kind: "link",   to: "/clientes",   label: "Clientes",            icon: Building2,       setor: "clientes" },
  { kind: "link",   to: "/crm",        label: "CRM",                 icon: UserRoundSearch, setor: "clientes" },

  // ── Departamentos
  { kind: "group",  label: "DEPARTAMENTOS" },
  { kind: "link",   to: "/fiscal",     label: "Fiscal",              icon: Receipt,         setor: "fiscal" },
  { kind: "link",   to: "/dp",         label: "Dep. Pessoal",        icon: Users2,          setor: "dp" },
  { kind: "link",   to: "/contabil",   label: "Contábil",            icon: BookOpen,        setor: "contabil" },
  { kind: "link",   to: "/financeiro", label: "Financeiro",          icon: DollarSign,      setor: "financeiro" },
  { kind: "link",   to: "/societario", label: "Societário",          icon: Landmark,        setor: "societario" },

  // ── Ferramentas
  { kind: "group",  label: "FERRAMENTAS" },
  { kind: "link",   to: "/documentos", label: "Documentos",          icon: FolderOpen },
  { kind: "link",   to: "/whatsapp",   label: "WhatsApp",            icon: MessageSquare,   setor: "whatsapp" },
  { kind: "link",   to: "/automacoes", label: "Automações",          icon: Bot },
];

const BOTTOM_NAV: NavItem[] = [
  { kind: "link", to: "/administracao", label: "Administração", icon: Shield },
  { kind: "link", to: "/configuracoes", label: "Configurações", icon: Settings },
];

/* ── Helpers ────────────────────────────────────────────── */
function isActive(pathname: string, item: Extract<NavItem, { kind: "link" }>): boolean {
  if (item.exact) return pathname === item.to;
  if (item.to === "/fiscal") return pathname.startsWith("/fiscal");
  return pathname.startsWith(item.to);
}

/* ── NavLink ────────────────────────────────────────────── */
function NavLink({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: Extract<NavItem, { kind: "link" }>;
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
        "group relative flex items-center rounded-xl transition-all duration-150",
        collapsed ? "h-9 w-9 justify-center" : "h-9 w-full px-3 gap-2.5",
        active
          ? "bg-primary text-primary-foreground shadow-glow"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={active ? 2.2 : 2} />

      {!collapsed && (
        <span className="flex-1 text-sm font-medium truncate leading-none">
          {item.label}
        </span>
      )}

      {/* Badge opcional (ex: count de alertas) */}
      {!collapsed && item.badge && (
        <span className="ml-auto shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {item.badge}
        </span>
      )}

      {/* Tooltip no modo collapsed */}
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg bg-sidebar px-2.5 py-1.5 text-xs font-medium text-sidebar-foreground opacity-0 shadow-elevated ring-1 ring-sidebar-foreground/10 transition-opacity group-hover:opacity-100">
          {item.label}
          {item.badge && (
            <span className="ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
              {item.badge}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

/* ── Main ───────────────────────────────────────────────── */
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
  const { loading, inSetor } = useUserSetores();

  function renderNav(items: NavItem[]): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    let groupIdx = 0;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];

      if (it.kind === "divider") {
        nodes.push(<div key={`div-${i}`} className="my-2 h-px bg-sidebar-foreground/8 mx-2" />);
        continue;
      }

      if (it.kind === "group") {
        // Verificar se há ao menos 1 item visível neste grupo
        const nextGroupIdx = items.findIndex((x, j) => j > i && x.kind === "group");
        const groupItems = items.slice(i + 1, nextGroupIdx === -1 ? undefined : nextGroupIdx);
        const hasVisible = groupItems.some(x => {
          if (x.kind !== "link") return false;
          if (x.setor) return inSetor(x.setor);
          return true;
        });
        if (!hasVisible) continue;

        if (!collapsed) {
          nodes.push(
            <p
              key={`grp-${it.label}`}
              className={cn(
                "px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30",
                groupIdx === 0 ? "mt-0 mb-1" : "mt-5 mb-1"
              )}
            >
              {it.label}
            </p>
          );
        } else if (groupIdx > 0) {
          nodes.push(
            <div key={`grp-sep-${it.label}`} className="my-2 mx-auto h-px w-5 bg-sidebar-foreground/10" />
          );
        }
        groupIdx++;
        continue;
      }

      // Link
      if (it.setor && !inSetor(it.setor)) continue;

      nodes.push(
        <NavLink
          key={it.to}
          item={it}
          active={isActive(pathname, it)}
          collapsed={collapsed}
          onClick={onNavigate}
        />
      );
    }

    return nodes;
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col py-4",
        collapsed ? "items-center px-0" : "items-stretch px-3"
      )}
    >
      {/* ── Header: logo + toggle ──────────────────────── */}
      <div
        className={cn(
          "mb-5 flex shrink-0 items-center",
          collapsed ? "flex-col gap-3" : "justify-between"
        )}
      >
        <Link
          to="/"
          onClick={onNavigate}
          className={cn("flex items-center gap-2.5", collapsed && "justify-center")}
        >
          {/* Logo mark */}
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-display text-base font-bold shadow-glow select-none">
            a
          </span>
          {!collapsed && (
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold tracking-tight text-sidebar-foreground leading-none">
                apoya
              </p>
              <p className="text-[10px] text-sidebar-foreground/40 font-medium uppercase tracking-wider leading-none mt-0.5">
                contabilidade
              </p>
            </div>
          )}
        </Link>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="hidden md:grid h-7 w-7 place-items-center rounded-lg text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* ── Nav principal (scrollável) ─────────────────── */}
      <nav
        className={cn(
          "sidebar-nav flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5",
          collapsed ? "items-center" : "items-stretch"
        )}
      >
        {loading ? (
          <div className="flex flex-col gap-1.5 px-1 pt-1">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-9 rounded-xl bg-sidebar-foreground/8 animate-pulse",
                  collapsed ? "w-9" : "w-full"
                )}
              />
            ))}
          </div>
        ) : (
          renderNav(NAV)
        )}
      </nav>

      {/* ── Footer fixo ───────────────────────────────── */}
      <div
        className={cn(
          "mt-3 shrink-0 flex flex-col gap-0.5 border-t border-sidebar-foreground/8 pt-3",
          collapsed ? "items-center" : "items-stretch"
        )}
      >
        {BOTTOM_NAV.map(it => {
          if (it.kind !== "link") return null;
          return (
            <NavLink
              key={it.to}
              item={it}
              active={isActive(pathname, it)}
              collapsed={collapsed}
              onClick={onNavigate}
            />
          );
        })}

        {/* Logout */}
        {onLogout && (
          <button
            onClick={onLogout}
            title="Sair"
            className={cn(
              "flex items-center rounded-xl text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-destructive transition-all",
              collapsed ? "h-9 w-9 justify-center" : "h-9 w-full px-3 gap-2.5"
            )}
          >
            <LogOut className="h-[17px] w-[17px] shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Sair</span>}
          </button>
        )}

        {/* Versão */}
        {!collapsed && (
          <p className="mt-2 px-3 text-[10px] text-sidebar-foreground/25 font-mono">
            v{APP_VERSION}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * AppSidebar.tsx
 *
 * B2: itens de DEPARTAMENTOS filtrados pelos setores do usuário logado.
 * Se o usuário não tem o setor → item some do menu.
 * Dashboard, Workflows e ítens de GESTÃO/FERRAMENTAS são visíveis a todos.
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
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserSetores } from "@/hooks/use-user-setores";

type NavItem =
  | { to: string; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; exact?: boolean; setor?: string; separator?: never; group?: never }
  | { separator: true; to?: never; label?: never; icon?: never; exact?: never; setor?: never; group?: never }
  | { group: string; to?: never; label?: never; icon?: never; exact?: never; setor?: never; separator?: never };

// ─── Itens SEMPRE visíveis (sem setor) ────────────────────────────────────────
const GESTAO_ITEMS: NavItem[] = [
  { group: "GESTÃO" },
  { to: "/",           label: "Dashboard",    icon: LayoutDashboard, exact: true },
  { to: "/clientes",   label: "Clientes",     icon: Building2,       setor: "clientes" },
  { to: "/crm",        label: "CRM",          icon: UserRoundSearch, setor: "clientes" },
];

const OPERACIONAL_ITEMS: NavItem[] = [
  { group: "OPERACIONAL" },
  { to: "/obrigacoes", label: "Obrigações",   icon: Calendar,        setor: "obrigacoes" },
  { to: "/workflows",  label: "Workflows",    icon: Workflow },   // sempre visível (B2 spec)
  { to: "/societario", label: "Societário",   icon: Landmark,        setor: "societario" },
];

// ─── DEPARTAMENTOS: cada item tem setor obrigatório ───────────────────────────
const DEPT_ITEMS: NavItem[] = [
  { group: "DEPARTAMENTOS" },
  { to: "/fiscal",     label: "Fiscal",       icon: Receipt,     setor: "fiscal" },
  { to: "/dp",         label: "Dep. Pessoal", icon: Users2,      setor: "dp" },
  { to: "/contabil",   label: "Contábil",     icon: BookOpen,    setor: "contabil" },
  { to: "/financeiro", label: "Financeiro",   icon: DollarSign,  setor: "financeiro" },
];

const FERRAMENTAS_ITEMS: NavItem[] = [
  { group: "FERRAMENTAS" },
  { to: "/documentos", label: "Documentos",   icon: FolderOpen },
  { to: "/whatsapp",   label: "WhatsApp",     icon: MessageSquare, setor: "whatsapp" },
  { to: "/automacoes", label: "Automações",   icon: Bot },
];

const BOTTOM_ITEMS: NavItem[] = [
  { to: "/administracao", label: "Administração", icon: Shield },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.separator || "group" in item) return false;
  if (item.exact) return pathname === item.to;
  return pathname.startsWith(item.to);
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

function renderSection(
  items: NavItem[],
  pathname: string,
  collapsed: boolean,
  onNavigate?: () => void,
  inSetor?: (slug: string) => boolean,
  firstGroup?: boolean
): React.ReactNode[] {
  const rendered: React.ReactNode[] = [];
  let isFirst = firstGroup ?? true;

  // Calcular se a seção tem algum item visível (além do group header)
  const visibleItems = items.filter((it) => {
    if ("group" in it || it.separator) return false;
    if ("setor" in it && it.setor && inSetor) return inSetor(it.setor);
    return true;
  });

  for (const it of items) {
    if ("group" in it && it.group) {
      // Não renderizar o header do grupo se não há itens visíveis no grupo
      if (visibleItems.length === 0) continue;

      if (!collapsed) {
        rendered.push(
          <p
            key={`grp-${it.group}`}
            className={cn(
              "px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/35 mb-1",
              isFirst ? "mt-0" : "mt-4"
            )}
          >
            {it.group}
          </p>
        );
      } else {
        if (!isFirst) {
          rendered.push(
            <div key={`grp-sep-${it.group}`} className="my-2 h-px w-6 bg-sidebar-foreground/10 mx-auto" />
          );
        }
      }
      isFirst = false;
    } else if ("to" in it) {
      // Filtrar por setor se necessário
      if ("setor" in it && it.setor && inSetor && !inSetor(it.setor)) continue;

      rendered.push(
        <NavLine
          key={it.to}
          item={it as Extract<NavItem, { to: string }>}
          active={isActive(pathname, it)}
          collapsed={collapsed}
          onClick={onNavigate}
        />
      );
    }
  }

  return rendered;
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
  const { loading, inSetor } = useUserSetores();

  const allSections = [
    ...GESTAO_ITEMS,
    ...OPERACIONAL_ITEMS,
    ...DEPT_ITEMS,
    ...FERRAMENTAS_ITEMS,
  ];

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
          "mb-5 flex shrink-0 items-center",
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

      {/* Nav scrollável */}
      <nav
        className={cn(
          "sidebar-nav flex-1 overflow-y-auto min-h-0 flex flex-col gap-0.5",
          collapsed ? "items-center" : "items-stretch"
        )}
      >
        {loading ? (
          /* Skeleton enquanto carrega permissões */
          <div className="flex flex-col gap-1.5 px-2 pt-1">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-9 rounded-xl bg-sidebar-foreground/10 animate-pulse",
                  collapsed ? "w-9" : "w-full"
                )}
              />
            ))}
          </div>
        ) : (
          renderSection(
            allSections,
            pathname,
            collapsed,
            onNavigate,
            inSetor,
            true
          )
        )}
      </nav>

      {/* Footer fixo */}
      <div
        className={cn(
          "mt-3 shrink-0 flex flex-col gap-1 border-t border-sidebar-foreground/10 pt-3",
          collapsed ? "items-center" : "items-stretch"
        )}
      >
        {BOTTOM_ITEMS.map((it) => (
          <NavLine
            key={it.to}
            item={it as Extract<NavItem, { to: string }>}
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

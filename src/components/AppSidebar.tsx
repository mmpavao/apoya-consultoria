import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Calendar,
  FileText,
  Receipt,
  Shield,
  DollarSign,
  MessageSquare,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ApoyaLogo } from "@/components/ApoyaLogo";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const mainItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Building2 },
  { to: "/obrigacoes", label: "Obrigações", icon: Calendar },
];

const fiscalItems: NavItem[] = [
  { to: "/fiscal/das", label: "DAS em Lote", icon: FileText },
  { to: "/fiscal/nfse", label: "NFS-e em Lote", icon: Receipt },
  { to: "/fiscal/serpro", label: "SERPRO", icon: Shield },
];

const bottomItems: NavItem[] = [
  { to: "/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-[var(--color-sidebar-accent)] text-white shadow-sm"
          : "text-[var(--color-sidebar-muted)] hover:bg-white/8 hover:text-white",
      )}
    >
      <Icon
        className={cn(
          "h-[18px] w-[18px] shrink-0",
          active ? "text-white" : "text-[var(--color-sidebar-muted)] group-hover:text-white",
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-sidebar-muted)]">
      {label}
    </p>
  );
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fiscalActive = pathname.startsWith("/fiscal");
  const [fiscalOpen, setFiscalOpen] = useState(fiscalActive);

  return (
    /* ocupa a altura completa do fixed container pai */
    <div className="flex h-full w-full flex-col" onClick={onNavigate}>

      {/* ── Logo ── */}
      <div
        className="flex shrink-0 items-center gap-3 px-5 py-5"
        style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}
      >
        <ApoyaLogo variant="on-dark" size="md" withTagline={false} className="max-w-[130px]" />
        <span
          className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
          style={{
            background: "oklch(0.68 0.20 47 / 0.20)",
            color: "var(--color-sidebar-accent)",
          }}
        >
          Gestão
        </span>
      </div>

      {/* ── Navegação scrollável ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        <SectionLabel label="Principal" />
        {mainItems.map((it) => (
          <NavLink key={it.to} item={it} active={pathname === it.to} />
        ))}

        {/* Grupo Fiscal com accordion */}
        <SectionLabel label="Fiscal" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setFiscalOpen((v) => !v); }}
          className={cn(
            "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
            fiscalActive
              ? "text-white"
              : "text-[var(--color-sidebar-muted)] hover:bg-white/8 hover:text-white",
          )}
        >
          <FileText className={cn("h-[18px] w-[18px] shrink-0", fiscalActive ? "text-[var(--color-sidebar-accent)]" : "text-[var(--color-sidebar-muted)] group-hover:text-white")} />
          <span className="flex-1 text-left">Fiscal</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", fiscalOpen && "rotate-180")} />
        </button>

        {fiscalOpen && (
          <div className="ml-3 pl-3 space-y-0.5" style={{ borderLeft: "2px solid var(--color-sidebar-border)" }}>
            {fiscalItems.map((it) => (
              <NavLink key={it.to} item={it} active={pathname === it.to} />
            ))}
          </div>
        )}

        <SectionLabel label="Gestão" />
        {bottomItems.map((it) => (
          <NavLink key={it.to} item={it} active={pathname === it.to} />
        ))}
      </nav>

      {/* ── Rodapé ── */}
      <div
        className="shrink-0 px-5 py-3 text-[11px]"
        style={{
          borderTop: "1px solid var(--color-sidebar-border)",
          color: "var(--color-sidebar-muted)",
        }}
      >
        APOYA Gestão · v2.0
      </div>
    </div>
  );
}

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
import logo from "@/assets/apoya-logo.png";

type Item = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };

const mainItems: Item[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Building2 },
  { to: "/obrigacoes", label: "Obrigações", icon: Calendar },
];

const fiscalItems: Item[] = [
  { to: "/fiscal/das", label: "DAS em Lote", icon: FileText },
  { to: "/fiscal/nfse", label: "NFS-e em Lote", icon: Receipt },
  { to: "/fiscal/serpro", label: "SERPRO", icon: Shield },
];

const bottomItems: Item[] = [
  { to: "/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fiscalActive = pathname.startsWith("/fiscal");
  const [fiscalOpen, setFiscalOpen] = useState(fiscalActive);

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
          <img src={logo} alt="APOYA" className="h-6 w-6 object-contain" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide">APOYA</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">Gestão</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" onClick={onNavigate}>
        {mainItems.map((it) => (
          <NavLink key={it.to} item={it} active={pathname === it.to} />
        ))}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFiscalOpen((v) => !v);
          }}
          className={cn(
            "mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            fiscalActive
              ? "text-sidebar-foreground"
              : "text-sidebar-foreground/80 hover:bg-white/5",
          )}
        >
          <span className="flex items-center gap-3">
            <Shield className="h-4 w-4" />
            Fiscal
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", fiscalOpen && "rotate-180")} />
        </button>
        {fiscalOpen && (
          <div className="ml-3 space-y-1 border-l border-sidebar-border pl-3">
            {fiscalItems.map((it) => (
              <NavLink key={it.to} item={it} active={pathname === it.to} />
            ))}
          </div>
        )}

        <div className="pt-4 mt-4 border-t border-sidebar-border space-y-1">
          {bottomItems.map((it) => (
            <NavLink key={it.to} item={it} active={pathname === it.to} />
          ))}
        </div>
      </nav>

      <div className="px-5 py-4 text-[10px] text-sidebar-foreground/40 border-t border-sidebar-border">
        v1.0 · Uso interno APOYA
      </div>
    </aside>
  );
}

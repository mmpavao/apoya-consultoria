import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { initRealtime } from "@/lib/realtime-singleton";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppShell,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const location = new URL(request.url);
      const from = location.pathname + location.search;
      throw redirect({ to: "/login", search: { from: from !== "/" ? from : undefined } });
    }
  },
});

function AppShell() {
  // Inicializa o channel master de realtime (singleton — roda apenas 1x)
  initRealtime();

  const navigate = useNavigate();
  const { loading, user, profile, roles, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("apoya:sidebar-collapsed") === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("apoya:sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);


  useEffect(() => {
    if (!loading && !user) {
      const from = window.location.pathname + window.location.search;
      navigate({ to: "/login", search: { from: from !== "/" ? from : undefined } });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    /*
      Estrutura:
        fixed sidebar (left-0, inset-y-0) — nunca faz scroll
        main column tem padding-left = sidebar width via CSS class
    */
    <div className="app-shell" data-sidebar-collapsed={collapsed ? "true" : "false"}>

      {/* ─── SIDEBAR — Desktop (fixed) ─────────────────── */}
      <aside className="app-sidebar hidden md:flex flex-col">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onLogout={handleLogout}
        />
      </aside>

      {/* ─── DRAWER — Mobile (overlay) ─────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 app-sidebar flex flex-col">
            <AppSidebar onNavigate={() => setMobileOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}


      {/* ─── CONTEÚDO PRINCIPAL ────────────────────────── */}
      <div className="app-main">
        <AppHeader
          user={{
            name: profile?.nome ?? user.email ?? "Usuário",
            email: user.email ?? "",
            role: (roles[0] ?? "contador") as "admin" | "contador" | "assistente" | "cliente",
          }}
          onMenuClick={() => setMobileOpen(true)}
          onLogout={handleLogout}
        />
        <main className="app-content">
          <div className="app-content-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login-dev")({
  // Rota exclusiva de desenvolvimento — bloqueada em produção
  beforeLoad: () => {
    if (import.meta.env.PROD) {
      throw redirect({ to: "/login" });
    }
  },
  component: LoginDev,
  validateSearch: (s: Record<string, unknown>) => ({
    t: (s.t as string) ?? "",
    r: (s.r as string) ?? "",
    u: (s.u as string) ?? "",
  }),
});

function LoginDev() {
  const { t, r, u } = Route.useSearch();
  const nav = useNavigate();

  useEffect(() => {
    if (!t) return;
    const session = {
      access_token: t,
      refresh_token: r,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Date.now() / 1000 + 3600,
      user: u ? JSON.parse(decodeURIComponent(u)) : {},
    };
    localStorage.setItem("sb-ajaqbdsalxfgrwpjbtbn-auth-token", JSON.stringify(session));
    nav({ to: "/" });
  }, [t]);

  return <div style={{ padding: 32 }}>Autenticando...</div>;
}

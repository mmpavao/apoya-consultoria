import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login-dev")({
  component: LoginDev,
  validateSearch: (s: Record<string, unknown>) => ({
    t: (s.t as string) ?? "",
    r: (s.r as string) ?? "",
    u: (s.u as string) ?? "",
  }),
});

/** Decodifica query-string: TanStack Router já faz decodeURIComponent mas não converte "+" em espaço */
function safeParseUser(raw: string): object {
  if (!raw) return {};
  try {
    // "+" é espaço em application/x-www-form-urlencoded — substituir antes de parsear
    const cleaned = raw.replace(/\+/g, " ");
    return JSON.parse(cleaned);
  } catch {
    try {
      // fallback: tentar decodificar novamente (caso venha ainda codificado)
      return JSON.parse(decodeURIComponent(raw.replace(/\+/g, " ")));
    } catch {
      return {};
    }
  }
}

function LoginDev() {
  const { t, r, u } = Route.useSearch();
  const nav = useNavigate();

  useEffect(() => {
    if (!t) { nav({ to: "/login" }); return; }
    try {
      const session = {
        access_token: t,
        refresh_token: r,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: safeParseUser(u),
      };
      localStorage.setItem("sb-ajaqbdsalxfgrwpjbtbn-auth-token", JSON.stringify(session));
    } catch (err) {
      console.warn("[login-dev] falha ao gravar sessão:", err);
    }
    nav({ to: "/" });
  }, [t]);

  return (
    <div style={{ padding: 32, fontFamily: "sans-serif", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
      <p style={{ color: "#666" }}>Autenticando…</p>
    </div>
  );
}

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApoyaLogo } from "@/components/ApoyaLogo";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar · APOYA Gestão" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
});

function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        navigate({ to: "/" });
      } else {
        await signUp(email, password, nome || email.split("@")[0]);
        // Se confirmação de email estiver desativada, já está logado:
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: "/" });
        else setInfo("Verifique seu e-mail para confirmar o cadastro e depois faça login.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(
        msg.includes("Invalid login") ? "E-mail ou senha incorretos."
        : msg.includes("already registered") ? "Este e-mail já está cadastrado."
        : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-8 lg:p-12">
        <ApoyaLogo variant="on-dark" size="lg" className="max-w-[200px] lg:max-w-[240px]" />
        <div className="space-y-6 max-w-md">
          <h2 className="text-2xl lg:text-3xl font-semibold leading-tight">
            Gestão contábil <span className="text-primary">automatizada</span> para o escritório APOYA.
          </h2>
          <p className="text-sm text-sidebar-foreground/70">
            DAS em lote, NFS-e, cobranças Asaas e WhatsApp num só lugar.
          </p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Auth Supabase + RLS por papel</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Primeiro cadastro vira admin</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Portal do cliente isolado por RLS</li>
          </ul>
        </div>
        <div className="text-[11px] text-sidebar-foreground/40">© 2026 APOYA Contabilidade</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex justify-center">
            <ApoyaLogo variant="on-light" size="lg" className="max-w-[180px]" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Bem-vindo de volta" : "Criar conta"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin" ? "Entre com seu e-mail e senha." : "Primeiro usuário cadastrado vira administrador."}
            </p>
          </div>

          <div className="inline-flex rounded-lg bg-muted p-1 text-xs">
            <button type="button"
              onClick={() => { setMode("signin"); setError(null); setInfo(null); }}
              className={`px-3 py-1.5 rounded-md ${mode === "signin" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
              Entrar
            </button>
            <button type="button"
              onClick={() => { setMode("signup"); setError(null); setInfo(null); }}
              className={`px-3 py-1.5 rounded-md ${mode === "signup" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}>
              Cadastrar
            </button>
          </div>

          <div className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Nome completo</label>
                <input value={nome} onChange={(e) => setNome(e.target.value)} required
                  className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium">E-mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Senha</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring" />
            </div>
          </div>

          {error && <div className="rounded-lg bg-destructive/10 text-destructive text-xs p-3">{error}</div>}
          {info && <div className="rounded-lg bg-info/10 text-info text-xs p-3">{info}</div>}

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
            {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </Button>
        </form>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, ArrowRight, CheckCircle2, BarChart3, FileText, MessageSquare } from "lucide-react";
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

/* ── Features exibidas no painel esquerdo ── */
const features = [
  {
    icon: FileText,
    title: "Automação fiscal completa",
    desc: "DAS e NFS-e emitidos em lote com um clique para todos os clientes.",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp integrado",
    desc: "Cobranças, lembretes e documentos enviados automaticamente.",
  },
  {
    icon: BarChart3,
    title: "Painel em tempo real",
    desc: "Visão unificada de obrigações, honorários e inadimplência.",
  },
];

/* ── Componente principal ── */
function LoginPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reset = () => { setError(null); setInfo(null); };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        navigate({ to: "/" });
      } else {
        await signUp(email, password, nome || email.split("@")[0]);
        const { data } = await supabase.auth.getSession();
        if (data.session) navigate({ to: "/" });
        else setInfo("Verifique seu e-mail para confirmar o cadastro e depois faça login.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      setError(
        msg.includes("Invalid login")      ? "E-mail ou senha incorretos."
        : msg.includes("already registered") ? "Este e-mail já está cadastrado."
        : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-[1fr_1fr] lg:grid-cols-[55%_45%]">

      {/* ── Painel esquerdo — brand ── */}
      <div
        className="hidden md:flex flex-col justify-between p-10 lg:p-14 relative overflow-hidden"
        style={{ background: "var(--color-sidebar)" }}
      >
        {/* Decoração de fundo — círculos sutis */}
        <div
          className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-[0.06]"
          style={{ background: "var(--color-sidebar-accent)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full opacity-[0.05]"
          style={{ background: "var(--color-sidebar-accent)" }}
        />

        {/* Logo */}
        <ApoyaLogo variant="on-dark" size="xl" withTagline={false} className="max-w-[260px] relative z-10" />

        {/* Conteúdo central */}
        <div className="relative z-10 space-y-8 max-w-md">
          <div className="space-y-3">
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight text-white">
              Seu escritório contábil{" "}
              <span style={{ color: "var(--color-sidebar-accent)" }}>no piloto automático.</span>
            </h2>
            <p className="text-base leading-relaxed text-white/75">
              Gerencie 75+ clientes, automatize obrigações fiscais e nunca mais perca um prazo.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-start gap-4">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "oklch(0.68 0.20 47 / 0.18)" }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color: "var(--color-sidebar-accent)" }} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {f.title}
                    </div>
                    <div className="text-xs mt-0.5 leading-relaxed text-white/65">
                      {f.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-[11px] text-white/45">
          © 2026 APOYA Consultoria e Contabilidade · Todos os direitos reservados
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div
        className="flex items-center justify-center px-6 py-10 md:px-10"
        style={{ background: "var(--color-background)" }}
      >
        <div className="w-full max-w-sm space-y-7">

          {/* Logo mobile */}
          <div className="flex justify-center md:hidden">
            <ApoyaLogo variant="on-light" size="lg" withTagline={false} className="max-w-[160px]" />
          </div>

          {/* Título */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {mode === "signin" ? "Bem-vindo de volta" : "Criar sua conta"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Acesse o painel de gestão da APOYA."
                : "Cadastre-se para começar a usar o sistema."}
            </p>
          </div>

          {/* Tab signin / signup */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); reset(); }}
                className={[
                  "flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                  mode === m
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {m === "signin" ? "Entrar" : "Cadastrar"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Nome completo</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Daniel Araújo"
                  required
                  className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@apoya.com.br"
                className="h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">Senha</label>
                {mode === "signin" && (
                  <button type="button" className="text-xs text-primary hover:underline">
                    Esqueci a senha
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-input bg-card px-4 pr-11 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Feedback */}
            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/8 text-destructive text-xs px-4 py-3 leading-relaxed">
                {error}
              </div>
            )}
            {info && (
              <div className="flex items-start gap-2 rounded-xl border border-success/20 bg-success/8 text-success text-xs px-4 py-3 leading-relaxed">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {info}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl text-sm font-semibold gap-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Aguarde...
                </span>
              ) : (
                <>
                  {mode === "signin" ? "Entrar no sistema" : "Criar minha conta"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          {/* Rodapé do form */}
          <p className="text-center text-xs text-muted-foreground">
            Acesso restrito a colaboradores da APOYA Contabilidade.
          </p>
        </div>
      </div>
    </div>
  );
}

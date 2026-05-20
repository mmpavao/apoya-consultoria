import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setMockUser } from "@/lib/mock-auth";
import logo from "@/assets/apoya-logo.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar · APOYA Gestão" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("daniel@apoya.com.br");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setMockUser({
        name: "Daniel Araújo",
        email,
        role: "admin",
      });
      navigate({ to: "/" });
    }, 400);
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between bg-sidebar text-sidebar-foreground p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white">
            <img src={logo} alt="APOYA" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide">APOYA</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
              Auditoria, Consultoria e Contabilidade
            </div>
          </div>
        </div>

        <div className="space-y-6 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Gestão contábil <span className="text-primary">automatizada</span> para o escritório APOYA.
          </h2>
          <p className="text-sm text-sidebar-foreground/70">
            DAS em lote, NFS-e, cobranças Asaas e WhatsApp num só lugar. Uso exclusivo da equipe interna.
          </p>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80">
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> 75 clientes ativos</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Integração SERPRO · NFE.io · Evolution API</li>
            <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Régua de cobrança automática</li>
          </ul>
        </div>

        <div className="text-[11px] text-sidebar-foreground/40">© 2026 APOYA Contabilidade · Uso interno</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar">
              <img src={logo} alt="APOYA" className="h-7 w-7 object-contain invert" />
            </div>
            <div>
              <div className="text-sm font-semibold">APOYA Gestão</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Uso interno</div>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entre com seu e-mail corporativo APOYA.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-ring"
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl">
            {loading ? "Entrando..." : "Entrar"}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Auth mockado nesta etapa · Supabase Auth será conectado no módulo M7.
          </p>
        </form>
      </div>
    </div>
  );
}

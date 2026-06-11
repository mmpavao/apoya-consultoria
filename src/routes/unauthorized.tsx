/**
 * Rota /unauthorized
 * Exibida quando o usuário não tem acesso ao setor tentado.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unauthorized")({
  component: UnauthorizedPage,
  head: () => ({ meta: [{ title: "Acesso Negado · APOYA Gestão" }] }),
});

function UnauthorizedPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
      <div className="rounded-full bg-red-100 p-4">
        <ShieldAlert className="h-10 w-10 text-red-600" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Você não tem permissão para acessar este módulo.
          Solicite ao administrador a concessão de acesso ao setor correspondente.
        </p>
      </div>
      <Link to="/">
        <Button variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Voltar ao início
        </Button>
      </Link>
    </div>
  );
}

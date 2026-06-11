/**
 * SectorGuard.tsx
 * 
 * Wrapper de rota que verifica acesso ao setor.
 * Se o usuário logado não tem o setor: redireciona para /unauthorized.
 * Se ainda carregando: spinner.
 * Se tem acesso: renderiza children.
 *
 * B2: usado nos layouts das rotas de departamento.
 */
import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useUserSetores } from "@/hooks/use-user-setores";

interface SectorGuardProps {
  setor: string;
  children: React.ReactNode;
}

export function SectorGuard({ setor, children }: SectorGuardProps) {
  const { loading, inSetor } = useUserSetores();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm">Verificando permissões…</span>
      </div>
    );
  }

  if (!inSetor(setor)) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
}

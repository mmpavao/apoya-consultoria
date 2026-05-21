/**
 * PermissionGuard — HOC global para proteger rotas e componentes por permissão.
 *
 * Uso em rota:
 *   <PermissionGuard slug="fiscal.gerar_das">
 *     <MeuComponente />
 *   </PermissionGuard>
 *
 * Uso em componente (esconde elemento sem redirect):
 *   <PermissionGuard slug="financeiro.cobrar" fallback={null}>
 *     <BotaoCobrança />
 *   </PermissionGuard>
 *
 * Admin sempre passa. Sem permissão → exibe fallback ou redireciona.
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useMinhasPermissoes } from "@/hooks/use-setores";
import { ShieldOff } from "lucide-react";

interface PermissionGuardProps {
  /** Slug da permissão exigida, ex: 'fiscal.gerar_das' */
  slug?: string;
  /** Slug do setor exigido (acesso a qualquer permissão do setor), ex: 'fiscal' */
  setor?: string;
  /** Role mínimo exigido (além de permissões) */
  role?: "admin" | "contador" | "assistente" | "agente" | "supervisor";
  /** O que renderizar quando autorizado */
  children: ReactNode;
  /**
   * Fallback quando não autorizado.
   * - undefined (padrão): redireciona para "/"
   * - null: esconde sem renderizar nada
   * - ReactNode: renderiza o fallback
   */
  fallback?: ReactNode | null;
  /** Mostrar tela de "acesso negado" ao invés de redirecionar */
  showDenied?: boolean;
}

export function PermissionGuard({
  slug,
  setor,
  children,
  fallback,
  showDenied = false,
}: PermissionGuardProps) {
  const { can, inSetor, isAdmin, loading } = useMinhasPermissoes();
  const navigate = useNavigate();

  const authorized = isAdmin
    || (slug  ? can(slug)      : true)
    || (setor ? inSetor(setor) : true);

  useEffect(() => {
    if (!loading && !authorized && fallback === undefined && !showDenied) {
      navigate({ to: "/" });
    }
  }, [loading, authorized, fallback, showDenied, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    // Modo "null" — esconde completamente
    if (fallback === null) return null;

    // Modo fallback customizado
    if (fallback !== undefined) return <>{fallback}</>;

    // Modo showDenied — tela de acesso negado
    if (showDenied) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Acesso restrito</p>
            <p className="text-sm text-muted-foreground mt-1">
              Você não tem permissão para acessar este módulo.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Solicite acesso ao administrador do sistema.
            </p>
          </div>
        </div>
      );
    }

    // Está redirecionando (useEffect em curso)
    return null;
  }

  return <>{children}</>;
}

/**
 * Hook: usePermission
 * Retorna { can, inSetor, isAdmin } para uso condicional inline.
 *
 * Exemplo:
 *   const { can } = usePermission();
 *   if (!can('fiscal.gerar_das')) return <DisabledButton />;
 */
export { useMinhasPermissoes as usePermission };

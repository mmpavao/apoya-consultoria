/**
 * use-user-setores.ts
 * 
 * Hook que lê user_setores do usuário logado.
 * Retorna Set<slug> dos setores acessíveis.
 *
 * Admin (role=admin na user_roles) → acesso a tudo (Set com '*').
 * Outros → apenas os setores presentes em user_setores.
 *
 * B2: usado pelo menu lateral e guards de rota.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// Slugs de todos os módulos com rota protegida
export const SETOR_SLUGS = [
  "fiscal",
  "financeiro",
  "dp",
  "contabil",
  "societario",
  "tributario",
  "clientes",
  "whatsapp",
  "obrigacoes",
  "configuracoes",
] as const;

export type SetorSlug = typeof SETOR_SLUGS[number];

export interface UserSetoresState {
  loading: boolean;
  isAdmin: boolean;
  /** Set de slugs acessíveis. Se isAdmin=true, contém todos. */
  setores: Set<string>;
  /** true se o usuário tem acesso ao setor (admin sempre retorna true) */
  inSetor: (slug: string) => boolean;
}

export function useUserSetores(): UserSetoresState {
  // Deriva do useAuth (sessão gerenciada via onAuthStateChange) em vez de chamar
  // getUser() de rede no mount — isso evitava o /unauthorized em refresh/deep-link
  // de rota com setor: a query rodava antes do auth assentar e negava acesso.
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [setores, setSetores] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    // Enquanto o auth não assentou, fica carregando (SectorGuard mostra spinner,
    // NÃO redireciona). Sem usuário após assentar → acesso vazio.
    if (authLoading) { setLoading(true); return; }
    if (!user) { setIsAdmin(false); setSetores(new Set()); setLoading(false); return; }

    (async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { data: roleRow } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (cancelled) return;
        const admin = !!roleRow;

        if (admin) {
          const { data: allSetores } = await db.from("setores").select("slug").eq("ativo", true);
          if (cancelled) return;
          setIsAdmin(true);
          setSetores(new Set<string>((allSetores ?? []).map((s: { slug: string }) => s.slug)));
        } else {
          const { data: rows } = await db.from("user_setores").select("setor_slug").eq("user_id", user.id);
          if (cancelled) return;
          setIsAdmin(false);
          setSetores(new Set<string>((rows ?? []).map((r: { setor_slug: string }) => r.setor_slug)));
        }
      } catch {
        // Falha silenciosa — usuário fica com Set vazio (acesso negado)
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authLoading, user?.id]);

  const inSetor = useCallback(
    (slug: string) => isAdmin || setores.has(slug),
    [isAdmin, setores]
  );

  return { loading, isAdmin, setores, inSetor };
}

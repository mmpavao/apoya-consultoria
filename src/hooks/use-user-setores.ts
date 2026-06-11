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
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [setores, setSetores] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) { setLoading(false); return; }

        // 1. Verificar role
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;
        const { data: roleRow } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        const admin = !!roleRow;
        if (cancelled) return;

        if (admin) {
          // Admin: todos os setores
          const { data: allSetores } = await db
            .from("setores")
            .select("slug")
            .eq("ativo", true);
          const slugs = new Set<string>((allSetores ?? []).map((s: { slug: string }) => s.slug));
          setIsAdmin(true);
          setSetores(slugs);
        } else {
          // Buscar setores do usuário
          const { data: rows } = await db
            .from("user_setores")
            .select("setor_slug")
            .eq("user_id", user.id);
          const slugs = new Set<string>((rows ?? []).map((r: { setor_slug: string }) => r.setor_slug));
          setIsAdmin(false);
          setSetores(slugs);
        }
      } catch {
        // Falha silenciosa — usuário fica com Set vazio (acesso negado)
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    // Re-executar quando auth mudar
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      if (!cancelled) load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const inSetor = useCallback(
    (slug: string) => isAdmin || setores.has(slug),
    [isAdmin, setores]
  );

  return { loading, isAdmin, setores, inSetor };
}

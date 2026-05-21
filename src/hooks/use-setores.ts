/**
 * Hook: useSetores
 * Gerencia setores e permissões por setor.
 * Admin vê e edita tudo. Outros usuários leem apenas.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Permissao {
  id: string;
  setor_id: string;
  slug: string;
  label: string;
  descricao?: string;
}

export interface Setor {
  id: string;
  slug: string;
  nome: string;
  descricao?: string;
  icone?: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  permissoes?: Permissao[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useSetores() {
  const [setores, setSetores]   = useState<Setor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: setoresData, error: sErr } = await db
        .from("setores")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      if (sErr) throw sErr;

      const { data: permsData, error: pErr } = await db
        .from("permissoes")
        .select("*")
        .order("label");

      if (pErr) throw pErr;

      const permsBySetor = new Map<string, Permissao[]>();
      for (const p of permsData ?? []) {
        if (!permsBySetor.has(p.setor_id)) permsBySetor.set(p.setor_id, []);
        permsBySetor.get(p.setor_id)!.push(p);
      }

      setSetores(
        (setoresData ?? []).map((s: Record<string, unknown>) => ({
          ...(s as Setor),
          permissoes: permsBySetor.get(s.id as string) ?? [],
        }))
      );
    } catch (e) {
      toast.error("Erro ao carregar setores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { setores, loading, saving, refetch: fetch };
}

// ── Permissões do usuário logado ────────────────────────────────────────
export interface MinhasPermissoes {
  slugs: Set<string>;        // ex: Set(['fiscal.gerar_das', 'clientes.visualizar'])
  setorSlugs: Set<string>;   // ex: Set(['fiscal', 'clientes'])
  isAdmin: boolean;
}

export function useMinhasPermissoes() {
  const [data, setData]       = useState<MinhasPermissoes>({ slugs: new Set(), setorSlugs: new Set(), isAdmin: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Verificar se é admin
        const { data: { user } } = await db.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: roleRow } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        const isAdmin = roleRow?.role === "admin";

        if (isAdmin) {
          // Admin tem tudo — buscar todos os slugs
          const { data: allPerms } = await db
            .from("permissoes")
            .select("slug, setores(slug)");

          const slugs     = new Set<string>((allPerms ?? []).map((p: { slug: string }) => p.slug));
          const setorSlugs = new Set<string>((allPerms ?? []).map((p: { setores?: { slug: string } }) => p.setores?.slug).filter(Boolean) as string[]);
          setData({ slugs, setorSlugs, isAdmin: true });
        } else {
          // Buscar apenas as permissões atribuídas
          const { data: uspRows } = await db
            .from("user_setor_permissoes")
            .select("permissoes(slug), setores(slug)")
            .eq("user_id", user.id);

          const slugs      = new Set<string>((uspRows ?? []).map((r: { permissoes?: { slug: string } }) => r.permissoes?.slug).filter(Boolean) as string[]);
          const setorSlugs = new Set<string>((uspRows ?? []).map((r: { setores?: { slug: string } }) => r.setores?.slug).filter(Boolean) as string[]);
          setData({ slugs, setorSlugs, isAdmin: false });
        }
      } catch {
        // silencioso — usuário sem permissões fica com Set vazio
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const can  = useCallback((slug: string) => data.isAdmin || data.slugs.has(slug),       [data]);
  const inSetor = useCallback((slug: string) => data.isAdmin || data.setorSlugs.has(slug), [data]);

  return { ...data, can, inSetor, loading };
}

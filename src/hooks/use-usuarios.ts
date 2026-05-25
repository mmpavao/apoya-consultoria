/**
 * Hook: useUsuarios
 * Gerencia usuários via tabelas profiles + user_roles no Supabase.
 * Apenas admin pode listar e modificar outros usuários.
 *
 * Histórico:
 * - Campo correto do banco: profiles.nome (não full_name)
 * - Role "agente" adicionado para os agentes IA do sistema
 * - Ordenação: admins → contadores → assistentes → agentes
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type UsuarioRole = "admin" | "contador" | "assistente" | "cliente" | "agente";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  role: UsuarioRole;
  isAgent: boolean;
  ativo: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<UsuarioRole, string> = {
  admin:      "Administrador",
  contador:   "Contador",
  assistente: "Assistente",
  cliente:    "Cliente",
  agente:     "Agente IA",
};

const ROLE_ORDER: Record<UsuarioRole, number> = {
  admin:      0,
  contador:   1,
  assistente: 2,
  cliente:    3,
  agente:     4,
};

export { ROLE_LABELS };

function fromProfile(p: Record<string, unknown>, roles: string[]): Usuario {
  const role = (roles[0] as UsuarioRole) ?? "assistente";
  return {
    id:        p.id as string,
    // CORREÇÃO: banco usa "nome", não "full_name"
    email:     (p.email as string) ?? "",
    nome:      (p.nome ?? p.full_name ?? p.email ?? "") as string,
    role,
    isAgent:   role === "agente",
    ativo:     true,
    createdAt: p.created_at as string,
  };
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const db = supabase as any;

      // Busca profiles com campo "nome" (correto para este projeto)
      const { data: profiles, error: pErr } = await db
        .from("profiles")
        .select("id, email, nome, created_at")
        .order("created_at");

      if (pErr) throw pErr;

      const { data: roleRows, error: rErr } = await db
        .from("user_roles")
        .select("user_id, role");

      if (rErr) throw rErr;

      // Usar apenas o PRIMEIRO role de cada usuário (sem duplicatas)
      const roleMap = new Map<string, string[]>();
      for (const r of roleRows ?? []) {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      }

      const list = (profiles ?? []).map((p: Record<string, unknown>) =>
        fromProfile(p, roleMap.get(p.id as string) ?? [])
      );

      // Ordenar: admins primeiro, agentes por último
      list.sort((a: { role: UsuarioRole }, b: { role: UsuarioRole }) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));

      setUsuarios(list);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar usuários";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const updateRole = useCallback(async (userId: string, role: UsuarioRole) => {
    try {
      const db = supabase as any;
      // Garantir apenas 1 role por usuário: delete + insert
      await db.from("user_roles").delete().eq("user_id", userId);
      const { error: err } = await db
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (err) throw err;
      toast.success("Perfil atualizado");
      await fetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar perfil");
    }
  }, [fetch]);

  return { usuarios, loading, error, refresh: fetch, updateRole, ROLE_LABELS };
}

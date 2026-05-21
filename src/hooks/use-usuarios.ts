/**
 * Hook: useUsuarios
 * Gerencia usuários via tabelas profiles + user_roles no Supabase.
 * Apenas admin pode listar e modificar outros usuários.
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type UsuarioRole = "admin" | "contador" | "assistente" | "cliente";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  role: UsuarioRole;
  ativo: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<UsuarioRole, string> = {
  admin:      "Administrador",
  contador:   "Contador",
  assistente: "Assistente",
  cliente:    "Cliente",
};

export { ROLE_LABELS };

function fromProfile(p: Record<string, unknown>, roles: string[]): Usuario {
  return {
    id:        p.id as string,
    email:     (p.email as string) ?? "",
    nome:      (p.full_name ?? p.nome ?? p.email ?? "") as string,
    role:      (roles[0] as UsuarioRole) ?? "assistente",
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;

      const { data: profiles, error: pErr } = await db
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at");

      if (pErr) throw pErr;

      const { data: roleRows, error: rErr } = await db
        .from("user_roles")
        .select("user_id, role");

      if (rErr) throw rErr;

      const roleMap = new Map<string, string[]>();
      for (const r of roleRows ?? []) {
        if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
        roleMap.get(r.user_id)!.push(r.role);
      }

      setUsuarios((profiles ?? []).map((p: Record<string, unknown>) =>
        fromProfile(p, roleMap.get(p.id as string) ?? [])
      ));
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      // Remover roles anteriores
      await db.from("user_roles").delete().eq("user_id", userId);
      // Inserir novo role
      const { error: err } = await db
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (err) throw err;
      toast.success("Role atualizado");
      await fetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar role");
    }
  }, [fetch]);

  return { usuarios, loading, error, refresh: fetch, updateRole, ROLE_LABELS };
}

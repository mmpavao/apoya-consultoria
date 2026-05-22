/**
 * Hook de gerenciamento de instâncias WhatsApp.
 * Tabela: wa_instance (RLS: admin pode tudo, staff pode ler)
 * 
 * FIX: Removido filtro por user_id (sistema single-tenant — scope por escritório).
 *      Adicionado aguardo correto da sessão antes de buscar.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type WaInstanceStatus =
  | "creating" | "connecting" | "connected" | "disconnected" | "error";

export type WaInstance = {
  id: string;
  nome: string;
  display_name: string;
  departamentos: string[];
  numero: string | null;
  status: WaInstanceStatus;
  qr_code: string | null;
  last_qr_at: string | null;
  last_connected_at: string | null;
  created_at: string;
};

export function useWaInstances() {
  const { session, loading: authLoading } = useAuth();
  const [instances, setInstances]   = useState<WaInstance[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInstances = useCallback(async () => {
    // Aguarda auth resolver antes de tentar
    if (authLoading) return;
    if (!session?.user?.id) {
      setLoading(false);
      setError("Sessão não autenticada");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Sistema single-tenant: busca todas as instâncias do escritório
      // RLS garante que só admin/staff conseguem acessar
      const { data, error: supaError } = await supabase
        .from("wa_instance")
        .select("id,nome,display_name,departamentos,numero,status,qr_code,last_qr_at,last_connected_at,created_at")
        .order("created_at", { ascending: false });

      if (supaError) {
        console.error("[useWaInstances] Supabase error:", supaError);
        setError(supaError.message);
        return;
      }

      const mapped: WaInstance[] = (data || []).map((row: any) => ({
        id: row.id,
        nome: row.nome ?? "",
        display_name: row.display_name ?? row.nome ?? "",
        departamentos: Array.isArray(row.departamentos) ? row.departamentos : [],
        numero: row.numero ?? null,
        status: (row.status ?? "disconnected") as WaInstanceStatus,
        qr_code: row.qr_code ?? null,
        last_qr_at: row.last_qr_at ?? null,
        last_connected_at: row.last_connected_at ?? null,
        created_at: row.created_at,
      }));

      setInstances(mapped);
    } catch (e: any) {
      console.error("[useWaInstances] catch:", e);
      setError(e.message ?? "Erro ao carregar instâncias");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, authLoading]);

  // Fetch quando a sessão resolver
  useEffect(() => {
    if (!authLoading) {
      fetchInstances();
    }
  }, [fetchInstances, authLoading]);

  // Polling: a cada 8s enquanto há instância em connecting/creating
  useEffect(() => {
    const hasActive = instances.some(
      (i) => i.status === "connecting" || i.status === "creating",
    );
    if (hasActive) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(fetchInstances, 8000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [instances, fetchInstances]);

  const createInstance = useCallback(
    async (displayName: string, departamentos: string[]) => {
      if (!session?.user?.id) throw new Error("Não autenticado");

      const { data, error: supaError } = await supabase
        .from("wa_instance")
        .insert([{
          display_name: displayName,
          nome: displayName,
          departamentos,
          status: "creating",
          numero: null,
          qr_code: null,
          last_qr_at: null,
          last_connected_at: null,
        }])
        .select()
        .single();

      if (supaError) throw supaError;
      toast.success(`Instância "${displayName}" criada`);
      await fetchInstances();
      return data;
    },
    [session?.user?.id, fetchInstances],
  );

  const connectInstance = useCallback(
    async (instanceId: string) => {
      if (!session?.user?.id) throw new Error("Não autenticado");

      const { data, error: supaError } = await supabase
        .from("wa_instance")
        .update({ status: "connecting" })
        .eq("id", instanceId)
        .select()
        .single();

      if (supaError) throw supaError;
      await fetchInstances();
      return data;
    },
    [session?.user?.id, fetchInstances],
  );

  const refreshStatus = useCallback(
    async (instanceId: string) => {
      if (!session?.user?.id) throw new Error("Não autenticado");

      const { data, error: supaError } = await supabase
        .from("wa_instance")
        .select("*")
        .eq("id", instanceId)
        .single();

      if (supaError) throw supaError;
      await fetchInstances();
      return data;
    },
    [session?.user?.id, fetchInstances],
  );

  const logoutInstance = useCallback(
    async (instanceId: string) => {
      if (!session?.user?.id) throw new Error("Não autenticado");

      const { error: supaError } = await supabase
        .from("wa_instance")
        .update({
          status: "disconnected",
          numero: null,
          qr_code: null,
          last_qr_at: null,
          last_connected_at: null,
        })
        .eq("id", instanceId);

      if (supaError) throw supaError;
      toast.success("Instância desconectada");
      await fetchInstances();
    },
    [session?.user?.id, fetchInstances],
  );

  const deleteInstance = useCallback(
    async (instanceId: string) => {
      if (!session?.user?.id) throw new Error("Não autenticado");

      const { error: supaError } = await supabase
        .from("wa_instance")
        .delete()
        .eq("id", instanceId);

      if (supaError) throw supaError;
      toast.success("Instância removida");
      setInstances((prev) => prev.filter((i) => i.id !== instanceId));
    },
    [session?.user?.id],
  );

  return {
    instances,
    loading,
    error,
    refresh: fetchInstances,
    createInstance,
    connectInstance,
    refreshStatus,
    logoutInstance,
    deleteInstance,
  };
}

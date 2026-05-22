/**
 * Hook de gerenciamento de instâncias WhatsApp.
 * Migrado para Supabase (tabela wa_instance).
 * 
 * BUG-04 FIX: Instâncias agora persistem no banco (não apenas localStorage).
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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
  const { session } = useAuth();
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Buscar instâncias do Supabase
   */
  const fetchInstances = useCallback(async () => {
    if (!session?.user?.id) {
      console.warn("[useWaInstances] User not authenticated");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: supaError } = await supabase
        .from("wa_instance")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (supaError) {
        console.error("[useWaInstances] Supabase error:", supaError);
        setError(supaError.message);
        return;
      }

      // Mapear campos do banco para o tipo WaInstance
      const mapped: WaInstance[] = (data || []).map((row: any) => ({
        id: row.id,
        nome: row.nome || "",
        display_name: row.display_name || "",
        departamentos: row.departamentos || [],
        numero: row.numero || null,
        status: (row.status || "disconnected") as WaInstanceStatus,
        qr_code: row.qr_code || null,
        last_qr_at: row.last_qr_at || null,
        last_connected_at: row.last_connected_at || null,
        created_at: row.created_at,
      }));

      setInstances(mapped);
    } catch (e: any) {
      console.error("[useWaInstances/fetchInstances] catch error:", e);
      setError(e.message || "Erro ao carregar instâncias");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  // Fetch inicial ao montar
  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  /**
   * Polling: atualiza a cada 8s enquanto há instância em connecting/creating
   */
  useEffect(() => {
    const hasActiveInstance = instances.some(
      (i) => i.status === "connecting" || i.status === "creating",
    );
    if (hasActiveInstance) {
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

  /**
   * Criar nova instância
   */
  const createInstance = useCallback(
    async (displayName: string, departamentos: string[]) => {
      if (!session?.user?.id) {
        throw new Error("Não autenticado");
      }

      try {
        const { data, error: supaError } = await supabase
          .from("wa_instance")
          .insert([
            {
              user_id: session.user.id,
              display_name: displayName,
              nome: displayName,
              departamentos,
              status: "creating",
              numero: null,
              qr_code: null,
              last_qr_at: null,
              last_connected_at: null,
            },
          ])
          .select()
          .single();

        if (supaError) {
          console.error("[useWaInstances/createInstance] Supabase error:", supaError);
          throw supaError;
        }

        await fetchInstances();
        return data;
      } catch (e: any) {
        console.error("[useWaInstances/createInstance] catch error:", e);
        throw e;
      }
    },
    [session?.user?.id, fetchInstances],
  );

  /**
   * Conectar instância (inicia processo de QR code)
   */
  const connectInstance = useCallback(
    async (instanceId: string) => {
      if (!session?.user?.id) {
        throw new Error("Não autenticado");
      }

      try {
        // Atualizar status para "connecting"
        const { data, error: supaError } = await supabase
          .from("wa_instance")
          .update({ status: "connecting" })
          .eq("id", instanceId)
          .eq("user_id", session.user.id)
          .select()
          .single();

        if (supaError) {
          console.error("[useWaInstances/connectInstance] Supabase error:", supaError);
          throw supaError;
        }

        await fetchInstances();
        return data;
      } catch (e: any) {
        console.error("[useWaInstances/connectInstance] catch error:", e);
        throw e;
      }
    },
    [session?.user?.id, fetchInstances],
  );

  /**
   * Atualizar status da instância
   */
  const refreshStatus = useCallback(
    async (instanceId: string) => {
      if (!session?.user?.id) {
        throw new Error("Não autenticado");
      }

      try {
        const { data, error: supaError } = await supabase
          .from("wa_instance")
          .select("*")
          .eq("id", instanceId)
          .eq("user_id", session.user.id)
          .single();

        if (supaError) {
          console.error("[useWaInstances/refreshStatus] Supabase error:", supaError);
          throw supaError;
        }

        await fetchInstances();
        return data;
      } catch (e: any) {
        console.error("[useWaInstances/refreshStatus] catch error:", e);
        throw e;
      }
    },
    [session?.user?.id, fetchInstances],
  );

  /**
   * Fazer logout na instância
   */
  const logoutInstance = useCallback(
    async (instanceId: string) => {
      if (!session?.user?.id) {
        throw new Error("Não autenticado");
      }

      try {
        const { error: supaError } = await supabase
          .from("wa_instance")
          .update({
            status: "disconnected",
            numero: null,
            qr_code: null,
            last_qr_at: null,
            last_connected_at: null,
          })
          .eq("id", instanceId)
          .eq("user_id", session.user.id);

        if (supaError) {
          console.error("[useWaInstances/logoutInstance] Supabase error:", supaError);
          throw supaError;
        }

        await fetchInstances();
      } catch (e: any) {
        console.error("[useWaInstances/logoutInstance] catch error:", e);
        throw e;
      }
    },
    [session?.user?.id, fetchInstances],
  );

  /**
   * Deletar instância
   */
  const deleteInstance = useCallback(
    async (instanceId: string) => {
      if (!session?.user?.id) {
        throw new Error("Não autenticado");
      }

      try {
        const { error: supaError } = await supabase
          .from("wa_instance")
          .delete()
          .eq("id", instanceId)
          .eq("user_id", session.user.id);

        if (supaError) {
          console.error("[useWaInstances/deleteInstance] Supabase error:", supaError);
          throw supaError;
        }

        setInstances((prev) => prev.filter((i) => i.id !== instanceId));
      } catch (e: any) {
        console.error("[useWaInstances/deleteInstance] catch error:", e);
        throw e;
      }
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

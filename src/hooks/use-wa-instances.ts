/**
 * Hook: useWaInstances
 * Gerencia instâncias Evolution via server functions.
 * Usa supabaseAdmin na server fn (sem RLS) → sem loading infinito.
 */
import { useEffect, useState, useCallback } from "react";
import { useRealtimeTable } from "@/lib/realtime-singleton";
import { useServerFn } from "@tanstack/react-start";
import {
  listInstances,
  createInstance,
  connectInstance,
  refreshStatus,
  deleteInstance,
  logoutInstance,
} from "@/lib/whatsapp/instance.functions";

export interface WaInstance {
  id: string;
  nome: string;
  display_name: string;
  departamentos: string[];
  numero: string | null;
  status: "created" | "creating" | "connecting" | "connected" | "disconnected";
  qr_code: string | null;
  last_qr_at: string | null;
  last_connected_at: string | null;
  created_at: string;
}

export function useWaInstances() {
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [creating, setCreating]   = useState(false);

  const fnList    = useServerFn(listInstances);
  const fnCreate  = useServerFn(createInstance);
  const fnConnect = useServerFn(connectInstance);
  const fnRefresh = useServerFn(refreshStatus);
  const fnDelete  = useServerFn(deleteInstance);
  const fnLogout  = useServerFn(logoutInstance);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fnList();
      setInstances((r.instances ?? []) as WaInstance[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar instâncias";
      console.error("[useWaInstances] reload error:", msg);
      setError(msg);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [fnList]);

  // Carregamento inicial
  useEffect(() => { reload(); }, [reload]);

  // Realtime: recarrega quando wa_instance mudar
  useRealtimeTable("wa_instance", reload);

  return {
    instances,
    loading,
    error,
    creating,
    reload,

    async create(displayName: string, departamentos: string[]) {
      setCreating(true);
      try {
        const r = await fnCreate({ data: { displayName, departamentos } });
        await reload();
        return r;
      } finally {
        setCreating(false);
      }
    },

    async connect(instanceId: string) {
      try {
        const r = await fnConnect({ data: { instanceId } });
        setInstances((cur) =>
          cur.map((inst) =>
            inst.id === instanceId
              ? {
                  ...inst,
                  status: r.connected ? "connected" : "connecting",
                  qr_code: r.qr ?? inst.qr_code,
                  last_qr_at: r.qr ? new Date().toISOString() : inst.last_qr_at,
                }
              : inst,
          ),
        );
        await reload();
        return r;
      } catch (e) {
        await reload();
        throw e;
      }
    },

    async refresh(instanceId: string) {
      try {
        await fnRefresh({ data: { instanceId } });
      } catch { /* ignore */ }
      await reload();
    },

    async logout(instanceId: string) {
      await fnLogout({ data: { instanceId } });
      await reload();
    },

    async remove(instanceId: string) {
      await fnDelete({ data: { instanceId } });
      await reload();
    },
  };
}

import { useEffect, useState, useCallback } from "react";
import { useRealtimeTable } from "@/lib/realtime-singleton";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
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
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fnList = useServerFn(listInstances);
  const fnCreate = useServerFn(createInstance);
  const fnConnect = useServerFn(connectInstance);
  const fnRefresh = useServerFn(refreshStatus);
  const fnDelete = useServerFn(deleteInstance);
  const fnLogout = useServerFn(logoutInstance);

  const reload = useCallback(async () => {
    try {
      const r = await fnList();
      setInstances(r.instances as WaInstance[]);
    } finally {
      setLoading(false);
    }
  }, [fnList]);

  // Realtime via singleton centralizado (evita conflito de channels)
  useRealtimeTable("wa_instance", reload);
  return {
    instances,
    loading,
    creating,
    async create(displayName: string, departamentos: string[]) {
      setCreating(true);
      try {
        const r = await fnCreate({ data: { displayName, departamentos } });
        await reload();
        return r;
      } finally { setCreating(false); }
    },
    async connect(instanceId: string) {
      const r = await fnConnect({ data: { instanceId } });
      setInstances((cur) => cur.map((inst) => inst.id === instanceId ? {
        ...inst,
        status: r.connected ? "connected" : "connecting",
        qr_code: r.qr ?? inst.qr_code,
        last_qr_at: r.qr ? new Date().toISOString() : inst.last_qr_at,
      } : inst));
      await reload();
      return r;
    },
    async refresh(instanceId: string) {
      await fnRefresh({ data: { instanceId } });
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
    reload,
  };
}

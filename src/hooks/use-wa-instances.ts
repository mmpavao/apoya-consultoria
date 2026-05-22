/**
 * Hook de gerenciamento de instâncias WhatsApp.
 * Usa API routes (/api/wa/instances) em vez de server fns para garantir
 * compatibilidade com Cloudflare Workers SSR.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";

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

// ─── helper de fetch autenticado ──────────────────────────────────────────

async function waApi(
  method: "GET" | "POST",
  token: string,
  body?: object,
): Promise<any> {
  const res = await fetch("/api/wa/instances", {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

// ─── hook principal ───────────────────────────────────────────────────────

export function useWaInstances() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInstances = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await waApi("GET", token);
      setInstances(data.instances ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Erro ao carregar instâncias");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Polling: atualiza a cada 8 segundos enquanto há instância em connecting/creating
  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  useEffect(() => {
    const hasActiveInstance = instances.some(
      (i) => i.status === "connecting" || i.status === "creating",
    );
    if (hasActiveInstance) {
      pollingRef.current = setInterval(fetchInstances, 8000);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [instances, fetchInstances]);

  // ── ações ──────────────────────────────────────────────────────────────

  const createInstance = useCallback(
    async (displayName: string, departamentos: string[]) => {
      if (!token) throw new Error("Não autenticado");
      const data = await waApi("POST", token, { action: "create", displayName, departamentos });
      await fetchInstances();
      return data;
    },
    [token, fetchInstances],
  );

  const connectInstance = useCallback(
    async (instanceId: string) => {
      if (!token) throw new Error("Não autenticado");
      const data = await waApi("POST", token, { action: "connect", instanceId });
      await fetchInstances();
      return data;
    },
    [token, fetchInstances],
  );

  const refreshStatus = useCallback(
    async (instanceId: string) => {
      if (!token) throw new Error("Não autenticado");
      const data = await waApi("POST", token, { action: "refresh", instanceId });
      await fetchInstances();
      return data;
    },
    [token, fetchInstances],
  );

  const logoutInstance = useCallback(
    async (instanceId: string) => {
      if (!token) throw new Error("Não autenticado");
      await waApi("POST", token, { action: "logout", instanceId });
      await fetchInstances();
    },
    [token, fetchInstances],
  );

  const deleteInstance = useCallback(
    async (instanceId: string) => {
      if (!token) throw new Error("Não autenticado");
      await waApi("POST", token, { action: "delete", instanceId });
      setInstances((prev) => prev.filter((i) => i.id !== instanceId));
    },
    [token],
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

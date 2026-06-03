/**
 * use-nfse-local v3 — Focus NF-e
 *
 * 1. Carrega do Supabase (resposta imediata)
 * 2. "Sincronizar" → POST /api/nfse { action: "sincronizar_emitidas" | "sincronizar_recebidas" }
 * 3. Persiste no banco e relê
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface NfseEmitidaRow {
  id: string;
  cliente_id: string;
  numero?: string;
  status: string;
  competencia?: string;
  data_emissao?: string;
  valor_servico?: number;
  tomador_nome?: string;
  tomador_cnpj_cpf?: string;
  pdf_url?: string;
  focus_ref?: string;
  created_at?: string;
}

export interface NfseRecebidaRow {
  id: string;
  cliente_id: string;
  numero?: string;
  competencia?: string;
  data_emissao?: string;
  valor_servico?: number;
  prestador_nome?: string;
  prestador_cnpj?: string;
  pdf_url?: string;
  fonte?: string;
  focus_ref?: string;
  created_at?: string;
}

export interface SyncInfo {
  total?: number;
  upserted?: number;
  fonte_label?: string;
  ultima_sync?: string;
}

// ── Hook: NFS-e EMITIDAS ──────────────────────────────────────────────────────

export function useNfseEmitidas(clienteId?: string, competencia?: string) {
  const { session } = useAuth();
  const [notas, setNotas]       = useState<NfseEmitidaRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({});

  const loadFromDb = useCallback(async (): Promise<NfseEmitidaRow[]> => {
    if (!clienteId) return [];
    let q = supabase
      .from("nfse_emitida")
      .select("id,cliente_id,numero,status,competencia,data_emissao,valor_servico,tomador_nome,tomador_cnpj_cpf,pdf_url,created_at")
      .eq("cliente_id", clienteId)
      .order("data_emissao", { ascending: false })
      .limit(500);
    if (competencia) q = q.eq("competencia", competencia);
    const { data, error: e } = await q;
    if (e) throw e;
    return (data ?? []) as NfseEmitidaRow[];
  }, [clienteId, competencia]);

  const refetch = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try { setNotas(await loadFromDb()); }
    catch (e: any) { setError(e?.message ?? "Erro ao carregar"); }
    finally { setLoading(false); }
  }, [loadFromDb, clienteId]);

  const sincronizar = useCallback(async (cnpj: string) => {
    if (!session?.access_token || !clienteId || !cnpj) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/nfse", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action:     "sincronizar_emitidas",
          cliente_id: clienteId,
          cnpj,
          ...(competencia ? { competencia } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      setSyncInfo({ total: d.total, upserted: d.upserted, fonte_label: "Focus NF-e", ultima_sync: new Date().toISOString() });
      setNotas(await loadFromDb());
    } catch (e: any) {
      setError(e?.message ?? "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [session?.access_token, clienteId, competencia, loadFromDb]);

  useEffect(() => { refetch(); }, [refetch]);

  return { notas, loading, syncing, error, syncInfo, refetch, sincronizar };
}

// ── Hook: NFS-e RECEBIDAS ─────────────────────────────────────────────────────

export function useNfseRecebidas(clienteId?: string, competencia?: string) {
  const { session } = useAuth();
  const [notas, setNotas]       = useState<NfseRecebidaRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({});

  const loadFromDb = useCallback(async (): Promise<NfseRecebidaRow[]> => {
    if (!clienteId) return [];
    let q = supabase
      .from("nfse_recebida")
      .select("id,cliente_id,numero,competencia,data_emissao,valor_servico,prestador_nome,prestador_cnpj,pdf_url,fonte,created_at")
      .eq("cliente_id", clienteId)
      .order("data_emissao", { ascending: false })
      .limit(500);
    if (competencia) q = q.eq("competencia", competencia);
    const { data, error: e } = await q;
    if (e) throw e;
    return (data ?? []) as NfseRecebidaRow[];
  }, [clienteId, competencia]);

  const refetch = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try { setNotas(await loadFromDb()); }
    catch (e: any) { setError(e?.message ?? "Erro ao carregar"); }
    finally { setLoading(false); }
  }, [loadFromDb, clienteId]);

  const sincronizar = useCallback(async (cnpj: string) => {
    if (!session?.access_token || !clienteId || !cnpj) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/nfse", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action:     "sincronizar_recebidas",
          cliente_id: clienteId,
          cnpj,
          ...(competencia ? { competencia } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      setSyncInfo({ total: d.total, fonte_label: "Focus NF-e", ultima_sync: new Date().toISOString() });
      setNotas(await loadFromDb());
    } catch (e: any) {
      setError(e?.message ?? "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [session?.access_token, clienteId, competencia, loadFromDb]);

  useEffect(() => { refetch(); }, [refetch]);

  return { notas, loading, syncing, error, syncInfo, refetch, sincronizar };
}

/**
 * use-nfse — hook de NFS-e via NFE.io
 *
 * BUG-03 FIX: authHeader robusto
 * FIX-2026-05: REMOVIDO navigate() que causava redirect para dashboard
 *              quando token era null ao montar componente (race condition)
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface NfseEmitida {
  id:               string;
  nfseio_id?:       string;
  empresa_id?:      string;
  numero?:          string;
  competencia?:     string;
  data_emissao?:    string;
  tomador_nome?:    string;
  tomador_cnpj_cpf?:string;
  valor_servico?:   number;
  status:           "rascunho" | "processando" | "emitida" | "cancelada" | "erro";
  descricao?:       string;
  codigo_servico?:  string;
  aliquota_iss?:    number;
  valor_iss?:       number;
  valor_cofins?:    number;
  valor_pis?:       number;
  codigo_verificacao?: string;
}

export interface NfseRecebida {
  id:               string;
  empresa_id?:      string;
  numero?:          string;
  competencia?:     string;
  data_emissao?:    string;
  prestador_nome?:  string;
  prestador_cnpj?:  string;
  valor_servico?:   number;
  valor_iss?:       number;
  status?:          string;
  descricao?:       string;
}

// ── helper de autenticação ──────────────────────────────────────────────────
function buildAuthHeader(token: string | null): HeadersInit | null {
  if (!token || token.trim() === "") return null;
  return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
}

export function useNfse() {
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token ?? null;
  const [loading, setLoading] = useState(false);

  // ── Listar emitidas ────────────────────────────────────────────────────
  const listarEmitidas = useCallback(async (
    clienteId?: string, competencia?: string
  ): Promise<NfseEmitida[]> => {
    // Se auth ainda carregando, aguardar silenciosamente
    if (authLoading) return [];
    // Se sem token, retornar vazio sem redirect (o guard de rota cuida disso)
    if (!token) return [];

    const authHeader = buildAuthHeader(token);
    if (!authHeader) return [];

    const params = new URLSearchParams({ tipo: "emitidas" });
    if (clienteId) params.set("cliente_id", clienteId);
    if (competencia) params.set("competencia", competencia);

    try {
      const r = await fetch(`/api/nfse?${params}`, { headers: authHeader });
      if (r.status === 401) {
        console.error("[useNfse/listarEmitidas] 401 — token inválido");
        return [];
      }
      const d = await r.json().catch(() => ({}));
      return d?.notas ?? [];
    } catch (e) {
      console.error("[useNfse/listarEmitidas] fetch error:", e);
      return [];
    }
  }, [token, authLoading]);

  // ── Listar recebidas ───────────────────────────────────────────────────
  const listarRecebidas = useCallback(async (
    clienteId?: string, competencia?: string
  ): Promise<NfseRecebida[]> => {
    if (authLoading) return [];
    if (!token) return [];

    const authHeader = buildAuthHeader(token);
    if (!authHeader) return [];

    const params = new URLSearchParams({ tipo: "recebidas" });
    if (clienteId) params.set("cliente_id", clienteId);
    if (competencia) params.set("competencia", competencia);

    try {
      const r = await fetch(`/api/nfse?${params}`, { headers: authHeader });
      if (r.status === 401) {
        console.error("[useNfse/listarRecebidas] 401 — token inválido");
        return [];
      }
      const d = await r.json().catch(() => ({}));
      return d?.notas ?? [];
    } catch (e) {
      console.error("[useNfse/listarRecebidas] fetch error:", e);
      return [];
    }
  }, [token, authLoading]);

  // ── Emitir ─────────────────────────────────────────────────────────────
  const emitir = useCallback(async (
    clienteId: string,
    dados: {
      tomador_cnpj_cpf: string;
      tomador_nome: string;
      tomador_email?: string;
      descricao: string;
      valor_servico: number;
      codigo_servico?: string;
      competencia?: string;
      aliquota_iss?: number;
      municipio_codigo?: string;
      regime_especial_tributacao?: string;
    }
  ): Promise<NfseEmitida | null> => {
    if (!token) { toast.error("Sessão expirada. Faça login novamente."); return null; }

    const authHeader = buildAuthHeader(token);
    if (!authHeader) return null;

    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ cliente_id: clienteId, ...dados }),
      });
      if (r.status === 401) {
        toast.error("Sessão expirada. Faça login novamente.");
        return null;
      }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const errorMsg = d.error ?? `HTTP ${r.status}`;
        toast.error("Falha ao emitir NFS-e: " + errorMsg);
        return null;
      }
      toast.success("NFS-e enviada para emissão com sucesso!");
      return d?.nota ?? null;
    } catch (e) {
      toast.error("Erro ao emitir NFS-e: " + (e instanceof Error ? e.message : "Tente novamente"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ── Cancelar ───────────────────────────────────────────────────────────
  const cancelar = useCallback(async (notaId: string, motivo?: string): Promise<boolean> => {
    if (!token) return false;
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return false;

    setLoading(true);
    try {
      const r = await fetch(`/api/nfse/${notaId}/cancelar`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ motivo: motivo ?? "Cancelado pelo usuário" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error("Falha ao cancelar: " + (d.error ?? `HTTP ${r.status}`));
        return false;
      }
      toast.success("NFS-e cancelada com sucesso");
      return true;
    } catch (e) {
      toast.error("Erro ao cancelar NFS-e");
      return false;
    } finally {
      setLoading(false);
    }
  }, [token]);

  // ── Baixar PDF ─────────────────────────────────────────────────────────
  const baixarPdf = useCallback(async (notaId: string, nfseioId?: string): Promise<string | null> => {
    if (!token) return null;
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return null;

    try {
      const r = await fetch(`/api/nfse/${notaId}/pdf`, { headers: authHeader });
      if (!r.ok) return null;
      const d = await r.json().catch(() => null);
      return d?.pdf_b64 ?? null;
    } catch {
      return null;
    }
  }, [token]);

  // ── Baixar XML ─────────────────────────────────────────────────────────
  const baixarXml = useCallback(async (notaId: string): Promise<string | null> => {
    if (!token) return null;
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return null;

    try {
      const r = await fetch(`/api/nfse/${notaId}/xml`, { headers: authHeader });
      if (!r.ok) return null;
      const d = await r.json().catch(() => null);
      return d?.xml ?? null;
    } catch {
      return null;
    }
  }, [token]);

  // ── Sincronizar recebidas ──────────────────────────────────────────────
  const sincronizarRecebidas = useCallback(async (clienteId: string, competencia: string): Promise<boolean> => {
    if (!token) return false;
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return false;

    setLoading(true);
    try {
      const r = await fetch("/api/nfse/sincronizar", {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ cliente_id: clienteId, competencia, tipo: "recebidas" }),
      });
      if (!r.ok) {
        toast.error("Falha ao sincronizar notas recebidas");
        return false;
      }
      toast.success("Sincronização iniciada com sucesso");
      return true;
    } catch {
      toast.error("Erro ao sincronizar notas");
      return false;
    } finally {
      setLoading(false);
    }
  }, [token]);

  return { listarEmitidas, listarRecebidas, emitir, cancelar, baixarPdf, baixarXml, sincronizarRecebidas, loading };
}

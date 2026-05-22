/**
 * Hook useNfse — proxy para /api/nfse
 * Lida com listagem, emissão, cancelamento, PDF e XML de NFS-e.
 * 
 * BUG-03 FIX: Validação robusta de token + erro explícito se não autenticado
 */
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export type NfseStatus = "rascunho" | "processando" | "emitida" | "cancelada" | "erro";

export interface NfseEmitida {
  id: string;
  cliente_id: string;
  numero?: string;
  status: NfseStatus;
  competencia?: string;
  data_emissao?: string;
  valor_servico?: number;
  tomador_nome?: string;
  tomador_cnpj_cpf?: string;
  pdf_url?: string;
  nfseio_id?: string;
  created_at: string;
}

export interface NfseRecebida {
  id: string;
  cliente_id: string;
  numero?: string;
  competencia?: string;
  data_emissao?: string;
  valor_servico?: number;
  prestador_nome?: string;
  prestador_cnpj?: string;
  pdf_url?: string;
  fonte: "nfeio" | "manual" | "serpro";
  created_at: string;
}

/**
 * Construir Authorization header com validação de token
 * @param token Access token do Supabase
 * @returns Authorization header válido ou null se token inválido
 */
function buildAuthHeader(token: string | null): Record<string, string> | null {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return null; // Token inválido
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function useNfse() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  /**
   * Validar autenticação e redirecionar se necessário
   */
  const ensureAuth = useCallback(() => {
    if (!token) {
      console.warn("[useNfse] Token ausente — redirecionando para login");
      toast.error("Sessão expirada. Faça login novamente.");
      navigate({ to: "/login", search: { from: "/fiscal/nfse" } });
      return false;
    }
    return true;
  }, [token, navigate]);

  // ── Listar emitidas ────────────────────────────────────────────────────
  const listarEmitidas = useCallback(async (
    clienteId?: string, competencia?: string
  ): Promise<NfseEmitida[]> => {
    if (!ensureAuth()) return [];
    
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return [];
    
    const params = new URLSearchParams({ tipo: "emitidas" });
    if (clienteId) params.set("cliente_id", clienteId);
    if (competencia) params.set("competencia", competencia);
    
    try {
      const r = await fetch(`/api/nfse?${params}`, { headers: authHeader });
      if (r.status === 401) {
        console.error("[useNfse/listarEmitidas] 401 — token inválido");
        ensureAuth();
        return [];
      }
      const d = await r.json().catch(() => ({}));
      return d?.notas ?? [];
    } catch (e) {
      console.error("[useNfse/listarEmitidas] fetch error:", e);
      return [];
    }
  }, [token, ensureAuth]);

  // ── Listar recebidas ───────────────────────────────────────────────────
  const listarRecebidas = useCallback(async (
    clienteId?: string, competencia?: string
  ): Promise<NfseRecebida[]> => {
    if (!ensureAuth()) return [];
    
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return [];
    
    const params = new URLSearchParams({ tipo: "recebidas" });
    if (clienteId) params.set("cliente_id", clienteId);
    if (competencia) params.set("competencia", competencia);
    
    try {
      const r = await fetch(`/api/nfse?${params}`, { headers: authHeader });
      if (r.status === 401) {
        console.error("[useNfse/listarRecebidas] 401 — token inválido");
        ensureAuth();
        return [];
      }
      const d = await r.json().catch(() => ({}));
      return d?.notas ?? [];
    } catch (e) {
      console.error("[useNfse/listarRecebidas] fetch error:", e);
      return [];
    }
  }, [token, ensureAuth]);

  // ── Emitir ─────────────────────────────────────────────────────────────
  const emitir = useCallback(async (
    clienteId: string,
    nota: {
      description: string;
      servicesAmount: number;
      cityServiceCode: string;
      issRate?: number;
      issRetained?: boolean;
      competencia?: string;
      borrower: {
        name: string;
        federalTaxNumber: string | number;
        email?: string;
        address: {
          country: string;
          postalCode?: string;
          street?: string;
          number?: string;
          district?: string;
          state: string;
          city: { code: string; name: string };
        };
      };
    }
  ) => {
    if (!ensureAuth()) return null;
    
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return null;
    
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ action: "emitir", cliente_id: clienteId, nota }),
      });
      
      if (r.status === 401) {
        console.error("[useNfse/emitir] 401 — token inválido");
        ensureAuth();
        return null;
      }
      
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        const errorMsg = d.error ?? `HTTP ${r.status}`;
        toast.error("Falha ao emitir NFS-e: " + errorMsg);
        console.error("[useNfse/emitir] Error:", errorMsg);
        return null;
      }
      toast.success(`NFS-e #${d.numero} emitida com sucesso!`);
      return d;
    } catch (e) {
      console.error("[useNfse/emitir] catch error:", e);
      toast.error("Erro ao emitir NFS-e: " + (e instanceof Error ? e.message : "Tente novamente"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, ensureAuth]);

  // ── Cancelar ───────────────────────────────────────────────────────────
  const cancelar = useCallback(async (notaId: string, motivo?: string) => {
    if (!ensureAuth()) return false;
    
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return false;
    
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ action: "cancelar", nota_id: notaId, motivo }),
      });
      
      if (r.status === 401) {
        console.error("[useNfse/cancelar] 401 — token inválido");
        ensureAuth();
        return false;
      }
      
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        const errorMsg = d.error ?? `HTTP ${r.status}`;
        toast.error("Falha ao cancelar NFS-e: " + errorMsg);
        console.error("[useNfse/cancelar] Error:", errorMsg);
        return false;
      }
      toast.success("NFS-e cancelada");
      return true;
    } catch (e) {
      console.error("[useNfse/cancelar] catch error:", e);
      toast.error("Erro ao cancelar NFS-e: " + (e instanceof Error ? e.message : "Tente novamente"));
      return false;
    } finally {
      setLoading(false);
    }
  }, [token, ensureAuth]);

  // ── Baixar PDF ─────────────────────────────────────────────────────────
  const baixarPdf = useCallback(async (notaId: string, nfseioId?: string): Promise<string | null> => {
    if (!ensureAuth()) return null;
    
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return null;
    
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ action: "pdf", nota_id: notaId, nfseio_id: nfseioId }),
      });
      
      if (r.status === 401) {
        console.error("[useNfse/baixarPdf] 401 — token inválido");
        ensureAuth();
        return null;
      }
      
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        const errorMsg = d.error ?? `HTTP ${r.status}`;
        toast.error("PDF não disponível: " + errorMsg);
        console.error("[useNfse/baixarPdf] Error:", errorMsg);
        return null;
      }
      return d.pdf_base64 ?? null;
    } catch (e) {
      console.error("[useNfse/baixarPdf] catch error:", e);
      toast.error("Erro ao baixar PDF: " + (e instanceof Error ? e.message : "Tente novamente"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, ensureAuth]);

  // ── Baixar XML ─────────────────────────────────────────────────────────
  const baixarXml = useCallback(async (notaId: string, nfseioId?: string): Promise<string | null> => {
    if (!ensureAuth()) return null;
    
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return null;
    
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ action: "xml", nota_id: notaId, nfseio_id: nfseioId }),
      });
      
      if (r.status === 401) {
        console.error("[useNfse/baixarXml] 401 — token inválido");
        ensureAuth();
        return null;
      }
      
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        const errorMsg = d.error ?? `HTTP ${r.status}`;
        toast.error("XML não disponível: " + errorMsg);
        console.error("[useNfse/baixarXml] Error:", errorMsg);
        return null;
      }
      return d.xml ?? null;
    } catch (e) {
      console.error("[useNfse/baixarXml] catch error:", e);
      toast.error("Erro ao baixar XML: " + (e instanceof Error ? e.message : "Tente novamente"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, ensureAuth]);

  // ── Sincronizar recebidas ──────────────────────────────────────────────
  const sincronizarRecebidas = useCallback(async (
    clienteId: string, cnpj: string
  ) => {
    if (!ensureAuth()) return null;
    
    const authHeader = buildAuthHeader(token);
    if (!authHeader) return null;
    
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ action: "sincronizar_recebidas", cliente_id: clienteId, cnpj }),
      });
      
      if (r.status === 401) {
        console.error("[useNfse/sincronizarRecebidas] 401 — token inválido");
        ensureAuth();
        return null;
      }
      
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        const errorMsg = d.error ?? `HTTP ${r.status}`;
        toast.error("Falha ao sincronizar: " + errorMsg);
        console.error("[useNfse/sincronizarRecebidas] Error:", errorMsg);
        return null;
      }
      toast.success(`${d.inserted} notas recebidas importadas (total ${d.total})`);
      return d;
    } catch (e) {
      console.error("[useNfse/sincronizarRecebidas] catch error:", e);
      toast.error("Erro ao sincronizar: " + (e instanceof Error ? e.message : "Tente novamente"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [token, ensureAuth]);

  return {
    loading,
    listarEmitidas,
    listarRecebidas,
    emitir,
    cancelar,
    baixarPdf,
    baixarXml,
    sincronizarRecebidas,
  };
}

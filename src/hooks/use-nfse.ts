/**
 * Hook useNfse — proxy para /api/nfse
 * Lida com listagem, emissão, cancelamento, PDF e XML de NFS-e.
 */
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
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

export function useNfse() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [loading, setLoading] = useState(false);

  const authHeader = useCallback(() =>
    ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }),
    [token]);

  // ── Listar emitidas ────────────────────────────────────────────────────
  const listarEmitidas = useCallback(async (
    clienteId?: string, competencia?: string
  ): Promise<NfseEmitida[]> => {
    if (!token) return [];
    const params = new URLSearchParams({ tipo: "emitidas" });
    if (clienteId) params.set("cliente_id", clienteId);
    if (competencia) params.set("competencia", competencia);
    const r = await fetch(`/api/nfse?${params}`, { headers: authHeader() });
    const d = await r.json().catch(() => ({}));
    return d?.notas ?? [];
  }, [token, authHeader]);

  // ── Listar recebidas ───────────────────────────────────────────────────
  const listarRecebidas = useCallback(async (
    clienteId?: string, competencia?: string
  ): Promise<NfseRecebida[]> => {
    if (!token) return [];
    const params = new URLSearchParams({ tipo: "recebidas" });
    if (clienteId) params.set("cliente_id", clienteId);
    if (competencia) params.set("competencia", competencia);
    const r = await fetch(`/api/nfse?${params}`, { headers: authHeader() });
    const d = await r.json().catch(() => ({}));
    return d?.notas ?? [];
  }, [token, authHeader]);

  // ── Emitir ─────────────────────────────────────────────────────────────
  const emitir = useCallback(async (
    clienteId: string,
    nota: {
      /** Descrição do serviço */
      description: string;
      /** Valor total */
      servicesAmount: number;
      /** Código de serviço LC116 / municipal */
      cityServiceCode: string;
      /** Alíquota ISS (0.05 = 5%) */
      issRate?: number;
      /** ISS retido na fonte? */
      issRetained?: boolean;
      /** Competência YYYY-MM */
      competencia?: string;
      /** Tomador */
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
    if (!token) return null;
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ action: "emitir", cliente_id: clienteId, nota }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        toast.error("Falha ao emitir NFS-e: " + (d.error ?? `HTTP ${r.status}`));
        return null;
      }
      toast.success(`NFS-e #${d.numero} emitida com sucesso!`);
      return d;
    } finally {
      setLoading(false);
    }
  }, [token, authHeader]);

  // ── Cancelar ───────────────────────────────────────────────────────────
  const cancelar = useCallback(async (notaId: string, motivo?: string) => {
    if (!token) return false;
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ action: "cancelar", nota_id: notaId, motivo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        toast.error("Falha ao cancelar NFS-e: " + (d.error ?? `HTTP ${r.status}`));
        return false;
      }
      toast.success("NFS-e cancelada");
      return true;
    } finally {
      setLoading(false);
    }
  }, [token, authHeader]);

  // ── Baixar PDF ─────────────────────────────────────────────────────────
  const baixarPdf = useCallback(async (notaId: string, nfseioId?: string): Promise<string | null> => {
    if (!token) return null;
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ action: "pdf", nota_id: notaId, nfseio_id: nfseioId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        toast.error("PDF não disponível: " + (d.error ?? `HTTP ${r.status}`));
        return null;
      }
      return d.pdf_base64 ?? null;
    } finally {
      setLoading(false);
    }
  }, [token, authHeader]);

  // ── Baixar XML ─────────────────────────────────────────────────────────
  const baixarXml = useCallback(async (notaId: string, nfseioId?: string): Promise<string | null> => {
    if (!token) return null;
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ action: "xml", nota_id: notaId, nfseio_id: nfseioId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        toast.error("XML não disponível: " + (d.error ?? `HTTP ${r.status}`));
        return null;
      }
      return d.xml ?? null;
    } finally {
      setLoading(false);
    }
  }, [token, authHeader]);

  // ── Sincronizar recebidas ──────────────────────────────────────────────
  const sincronizarRecebidas = useCallback(async (
    clienteId: string, cnpj: string
  ) => {
    if (!token) return null;
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ action: "sincronizar_recebidas", cliente_id: clienteId, cnpj }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) {
        toast.error("Falha ao sincronizar: " + (d.error ?? `HTTP ${r.status}`));
        return null;
      }
      toast.success(`${d.inserted} notas recebidas importadas (total ${d.total})`);
      return d;
    } finally {
      setLoading(false);
    }
  }, [token, authHeader]);

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

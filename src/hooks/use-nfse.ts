/**
 * use-nfse — hook de NFS-e via Focus NF-e (/api/nfse)
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export interface NfseEmitida {
  id:               string;
  focus_ref?:       string;
  cliente_id?:      string;
  numero?:          string;
  competencia?:     string;
  data_emissao?:    string;
  tomador_nome?:    string;
  tomador_cnpj_cpf?:string;
  valor_servico?:   number;
  status:           "rascunho" | "processando" | "emitida" | "cancelada" | "erro";
  descricao_servico?: string;
  codigo_servico?:  string;
  aliquota_iss?:    number;
  valor_iss?:       number;
  pdf_url?:         string;
}

export interface NfseRecebida {
  id:              string;
  cliente_id?:     string;
  numero?:         string;
  competencia?:    string;
  data_emissao?:   string;
  prestador_nome?: string;
  prestador_cnpj?: string;
  valor_servico?:  number;
  valor_iss?:      number;
  descricao_servico?: string;
  fonte?:          string;
  pdf_url?:        string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export function useNfse() {
  const { session, loading: authLoading } = useAuth();
  const token = session?.access_token ?? null;
  const [loading, setLoading] = useState(false);

  // ── Listar emitidas ──────────────────────────────────────────────────────
  const listarEmitidas = useCallback(async (
    clienteId?: string, competencia?: string
  ): Promise<NfseEmitida[]> => {
    if (authLoading || !token) return [];
    const params = new URLSearchParams({ tipo: "emitidas" });
    if (clienteId)   params.set("cliente_id", clienteId);
    if (competencia) params.set("competencia", competencia);
    try {
      const r = await fetch(`/api/nfse?${params}`, { headers: authHeaders(token) });
      if (!r.ok) return [];
      const d = await r.json().catch(() => ({}));
      return d?.notas ?? [];
    } catch { return []; }
  }, [token, authLoading]);

  // ── Listar recebidas ─────────────────────────────────────────────────────
  const listarRecebidas = useCallback(async (
    clienteId?: string, competencia?: string
  ): Promise<NfseRecebida[]> => {
    if (authLoading || !token) return [];
    const params = new URLSearchParams({ tipo: "recebidas" });
    if (clienteId)   params.set("cliente_id", clienteId);
    if (competencia) params.set("competencia", competencia);
    try {
      const r = await fetch(`/api/nfse?${params}`, { headers: authHeaders(token) });
      if (!r.ok) return [];
      const d = await r.json().catch(() => ({}));
      return d?.notas ?? [];
    } catch { return []; }
  }, [token, authLoading]);

  // ── Emitir ───────────────────────────────────────────────────────────────
  const emitir = useCallback(async (
    clienteId: string,
    dados: {
      tomador: {
        cnpj?: string; cpf?: string;
        razao_social: string; email?: string;
        endereco?: {
          logradouro?: string; numero?: string; bairro?: string;
          complemento?: string; cep?: string;
          municipio?: string; uf?: string;
          codigo_municipio?: string;
        };
      };
      servico: {
        discriminacao: string;
        valor_servicos: number;
        item_lista_servico?: string;
        codigo_tributacao_municipio?: string;
        aliquota_iss?: number;
        iss_retido?: boolean;
        codigo_municipio?: string;
        valor_deducoes?: number;
      };
      prestador?: { inscricao_municipal?: string; codigo_municipio?: string };
      competencia?: string;
      data_emissao?: string;
      natureza_operacao?: string;
      optante_simples_nacional?: boolean;
      regime_especial_tributacao?: string;
      incentivo_fiscal?: boolean;
    }
  ): Promise<NfseEmitida | null> => {
    if (!token) { toast.error("Sessão expirada"); return null; }
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method:  "POST",
        headers: authHeaders(token),
        body:    JSON.stringify({ action: "emitir", cliente_id: clienteId, nota: dados }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error("Falha ao emitir: " + (d.error ?? `HTTP ${r.status}`)); return null; }
      toast.success("NFS-e enviada para emissão!");
      return d?.nota ?? { id: d.id, focus_ref: d.focus_ref, status: d.status, numero: d.numero };
    } catch (e: any) {
      toast.error("Erro: " + e?.message);
      return null;
    } finally { setLoading(false); }
  }, [token]);

  // ── Cancelar ─────────────────────────────────────────────────────────────
  const cancelar = useCallback(async (notaId: string, motivo?: string): Promise<boolean> => {
    if (!token) return false;
    setLoading(true);
    try {
      const r = await fetch("/api/nfse", {
        method:  "POST",
        headers: authHeaders(token),
        body:    JSON.stringify({ action: "cancelar", nota_id: notaId, motivo }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error("Falha ao cancelar: " + (d.error ?? "")); return false; }
      toast.success("NFS-e cancelada");
      return true;
    } catch { toast.error("Erro ao cancelar"); return false; }
    finally { setLoading(false); }
  }, [token]);

  // ── Consultar status ─────────────────────────────────────────────────────
  const consultar = useCallback(async (notaId: string) => {
    if (!token) return null;
    try {
      const r = await fetch("/api/nfse", {
        method:  "POST",
        headers: authHeaders(token),
        body:    JSON.stringify({ action: "consultar", nota_id: notaId }),
      });
      const d = await r.json().catch(() => null);
      return d?.ok ? d : null;
    } catch { return null; }
  }, [token]);

  // ── PDF ───────────────────────────────────────────────────────────────────
  const obterPdf = useCallback(async (notaId: string): Promise<string | null> => {
    if (!token) return null;
    try {
      const r = await fetch("/api/nfse", {
        method:  "POST",
        headers: authHeaders(token),
        body:    JSON.stringify({ action: "pdf", nota_id: notaId }),
      });
      const d = await r.json().catch(() => null);
      return d?.pdf_url ?? null;
    } catch { return null; }
  }, [token]);

  // ── XML ───────────────────────────────────────────────────────────────────
  const obterXml = useCallback(async (notaId: string): Promise<string | null> => {
    if (!token) return null;
    try {
      const r = await fetch("/api/nfse", {
        method:  "POST",
        headers: authHeaders(token),
        body:    JSON.stringify({ action: "xml", nota_id: notaId }),
      });
      const d = await r.json().catch(() => null);
      return d?.xml ?? null;
    } catch { return null; }
  }, [token]);

  return { listarEmitidas, listarRecebidas, emitir, cancelar, consultar, obterPdf, obterXml, loading };
}

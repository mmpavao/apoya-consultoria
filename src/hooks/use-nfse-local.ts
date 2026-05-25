/**
 * use-nfse-local v2 — usa nfe_buscar_cascata (MCP v2.3.0)
 *
 * Fluxo:
 *  1. Carrega do banco (Supabase) — resposta instantânea.
 *  2. Se usuário clica "Sincronizar", chama nfe_buscar_cascata via MCP.
 *  3. Persiste resultado no banco (nfse_emitida / nfse_recebida).
 *  4. Relê do banco e atualiza a UI.
 *
 * Retorna: camada_usada (1-4), logCascata, fonte_label para exibição.
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
  nfseio_id?: string;
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
  created_at?: string;
}

export interface CascataInfo {
  camada_usada?: number;
  log_cascata?: string[];
  total?: number;
  fonte_label?: string;
}

const CAMADA_LABEL: Record<number, string> = {
  1: "SEFAZ",
  2: "SERPRO",
  3: "Infosimples",
  4: "NFE.io",
};

const CAMADA_COR: Record<number, string> = {
  1: "text-emerald-600",
  2: "text-blue-600",
  3: "text-amber-600",
  4: "text-orange-600",
};

export { CAMADA_LABEL, CAMADA_COR };

async function callMcpCascata(
  token: string,
  cnpj: string,
  tipo: "emitidas" | "recebidas" | "todas",
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  try {
    const res = await fetch("/api/serpro/call", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ tool: "nfe_buscar_cascata", params: { cnpj_cliente: cnpj, tipo } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error ?? "HTTP " + res.status };

    const texts: string[] = (data.content ?? [])
      .filter((c: { type: string }) => c.type === "text")
      .map((c: { text?: string }) => c.text ?? "");
    const raw = texts.join("");
    try {
      const parsed = JSON.parse(raw);
      const inner = (parsed?.result ?? parsed) as Record<string, unknown>;
      return { ok: true, result: inner };
    } catch {
      return { ok: false, error: "Resposta MCP inválida" };
    }
  } catch (e: unknown) {
    const err = e as Error;
    return { ok: false, error: err?.message ?? "Erro de rede" };
  }
}

function mapStatusEmitida(s: string): string {
  const m: Record<string, string> = {
    Issued: "emitida", IssueFailed: "erro", Cancelled: "cancelada",
    CancelFailed: "erro", emitida: "emitida", cancelada: "cancelada",
    processando: "processando", erro: "erro",
  };
  return m[s] ?? "processando";
}

async function persistEmitidas(clienteId: string, notas: Record<string, unknown>[]): Promise<void> {
  if (!notas?.length) return;
  const rows = notas.map((n) => ({
    cliente_id: clienteId,
    nfseio_id: (n.id ?? n.nfseio_id ?? null) as string | null,
    numero: n.numero ? String(n.numero) : null,
    status: mapStatusEmitida(String(n.status ?? n.flowStatus ?? "")),
    competencia: (n.competencia ?? (n.issuedOn as string)?.substring(0, 7) ?? null) as string | null,
    data_emissao: (n.data_emissao ?? (n.issuedOn as string)?.substring(0, 10) ?? null) as string | null,
    tomador_nome: (n.tomador_nome ?? (n.borrower as Record<string, unknown>)?.name ?? null) as string | null,
    tomador_cnpj_cpf: (n.tomador_cnpj_cpf ?? String((n.borrower as Record<string, unknown>)?.federalTaxNumber ?? "") || null) as string | null,
    descricao_servico: (n.descricao_servico ?? n.description ?? null) as string | null,
    codigo_servico: (n.codigo_servico ?? n.cityServiceCode ?? null) as string | null,
    valor_servico: (n.valor_servico ?? n.servicesAmount ?? 0) as number,
    aliquota_iss: ((n.aliquota_iss ?? (((n.issRate as number) ?? 0) * 100)) as number),
    valor_iss: (n.valor_iss ?? n.issTaxAmount ?? 0) as number,
    issretido: (n.issretido ?? ((n.issAmountWithheld as number) ?? 0) > 0) as boolean,
    pdf_url: (n.pdf_url ?? null) as string | null,
    erro_msg: (n.erro_msg ?? (n.flowStatus !== "Issued" ? n.flowMessage : null) ?? null) as string | null,
  }));
  await supabase.from("nfse_emitida").upsert(rows, { onConflict: "nfseio_id", ignoreDuplicates: false });
}

async function persistRecebidas(clienteId: string, cnpjTomador: string, notas: Record<string, unknown>[]): Promise<void> {
  if (!notas?.length) return;
  const rows = notas.map((n) => ({
    cliente_id: clienteId,
    cnpj_tomador: cnpjTomador,
    prestador_nome: (n.prestador_nome ?? (n.emitente as Record<string, unknown>)?.nome ?? null) as string | null,
    prestador_cnpj: (n.prestador_cnpj ?? String((n.emitente as Record<string, unknown>)?.cnpj ?? "") || null) as string | null,
    prestador_municipio: (n.prestador_municipio ?? null) as string | null,
    numero: n.numero ? String(n.numero) : null,
    codigo_verificacao: (n.codigo_verificacao ?? n.codigoVerificacao ?? null) as string | null,
    data_emissao: (n.data_emissao ?? (n.dataEmissao as string)?.substring(0, 10) ?? null) as string | null,
    competencia: (n.competencia ?? (n.dataEmissao as string)?.substring(0, 7) ?? null) as string | null,
    valor_servico: (n.valor_servico ?? n.valorServico ?? 0) as number,
    valor_iss: (n.valor_iss ?? (n.impostos as Record<string, unknown>)?.iss ?? 0) as number,
    aliquota_iss: (n.aliquota_iss ?? 0) as number,
    issretido: (n.issretido ?? false) as boolean,
    descricao_servico: (n.descricao_servico ?? n.discriminacao ?? null) as string | null,
    codigo_servico: (n.codigo_servico ?? n.itemListaServico ?? null) as string | null,
    fonte: (n.fonte ?? "cascata") as string,
    pdf_url: (n.pdf_url ?? null) as string | null,
  }));
  await supabase.from("nfse_recebida").upsert(rows, { ignoreDuplicates: true });
}

// ── Hook: NFS-e EMITIDAS ──────────────────────────────────────────────────

export function useNfseEmitidas(clienteId?: string, competencia?: string) {
  const { session } = useAuth();
  const [notas, setNotas] = useState<NfseEmitidaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cascata, setCascata] = useState<CascataInfo>({});

  const loadFromDb = useCallback(async (): Promise<NfseEmitidaRow[]> => {
    if (!clienteId) return [];
    let q = supabase
      .from("nfse_emitida")
      .select("id,cliente_id,numero,status,competencia,data_emissao,valor_servico,tomador_nome,tomador_cnpj_cpf,pdf_url,nfseio_id,created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (competencia) q = q.eq("competencia", competencia);
    const { data, error: err } = await q;
    if (err) throw err;
    return (data ?? []) as NfseEmitidaRow[];
  }, [clienteId, competencia]);

  const refetch = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      setNotas(await loadFromDb());
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [loadFromDb, clienteId]);

  const sincronizar = useCallback(async (cnpj: string) => {
    if (!session?.access_token || !clienteId) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await callMcpCascata(session.access_token, cnpj, "emitidas");
      if (!res.ok) throw new Error(res.error);

      const result = res.result ?? {};
      setCascata({
        camada_usada: result.camada_usada as number | undefined,
        log_cascata: result.log_cascata as string[] | undefined,
        total: result.total as number | undefined,
        fonte_label: result.camada_usada ? CAMADA_LABEL[result.camada_usada as number] : undefined,
      });

      const emitidas = (result.emitidas ?? result.notas ?? result.data ?? []) as Record<string, unknown>[];
      await persistEmitidas(clienteId, emitidas);
      setNotas(await loadFromDb());
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [session?.access_token, clienteId, loadFromDb]);

  useEffect(() => { refetch(); }, [refetch]);

  return { notas, loading, syncing, error, cascata, refetch, sincronizar };
}

// ── Hook: NFS-e RECEBIDAS ─────────────────────────────────────────────────

export function useNfseRecebidas(clienteId?: string, competencia?: string) {
  const { session } = useAuth();
  const [notas, setNotas] = useState<NfseRecebidaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cascata, setCascata] = useState<CascataInfo>({});

  const loadFromDb = useCallback(async (): Promise<NfseRecebidaRow[]> => {
    if (!clienteId) return [];
    let q = supabase
      .from("nfse_recebida")
      .select("id,cliente_id,numero,competencia,data_emissao,valor_servico,prestador_nome,prestador_cnpj,pdf_url,fonte,created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (competencia) q = q.eq("competencia", competencia);
    const { data, error: err } = await q;
    if (err) throw err;
    return (data ?? []) as NfseRecebidaRow[];
  }, [clienteId, competencia]);

  const refetch = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      setNotas(await loadFromDb());
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [loadFromDb, clienteId]);

  const sincronizar = useCallback(async (cnpj: string) => {
    if (!session?.access_token || !clienteId) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await callMcpCascata(session.access_token, cnpj, "recebidas");
      if (!res.ok) throw new Error(res.error);

      const result = res.result ?? {};
      setCascata({
        camada_usada: result.camada_usada as number | undefined,
        log_cascata: result.log_cascata as string[] | undefined,
        total: result.total as number | undefined,
        fonte_label: result.camada_usada ? CAMADA_LABEL[result.camada_usada as number] : undefined,
      });

      const recebidas = (result.recebidas ?? result.notas ?? result.data ?? []) as Record<string, unknown>[];
      await persistRecebidas(clienteId, cnpj, recebidas);
      setNotas(await loadFromDb());
    } catch (e: unknown) {
      const err = e as Error;
      setError(err?.message ?? "Erro ao sincronizar");
    } finally {
      setSyncing(false);
    }
  }, [session?.access_token, clienteId, loadFromDb]);

  useEffect(() => { refetch(); }, [refetch]);

  return { notas, loading, syncing, error, cascata, refetch, sincronizar };
}

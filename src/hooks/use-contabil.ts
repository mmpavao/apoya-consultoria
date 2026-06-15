/**
 * Hook: use-contabil.ts
 * Contabilidade — Lançamentos, Plano de Contas, Períodos, Extratos Bancários
 * Escopo: Simples Nacional apenas
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Lancamento {
  id: string; empresa_id: string; data_lancamento: string;
  historico: string; conta_debito: string; conta_credito: string;
  valor: number; tipo: string; criado_por?: string; criado_por_tipo?: string;
  competencia?: string; created_at: string;
}

export interface PlanoContas {
  id: string; empresa_id?: string; codigo: string; nome: string;
  tipo: string; nivel: number; codigo_pai?: string; ativo: boolean;
  created_at: string;
}

export interface PeriodoContabil {
  id: string; empresa_id: string; competencia: string;
  status: "aberto" | "fechado"; aberto_em?: string;
  fechado_em?: string; fechado_por?: string; created_at: string;
}

export interface ExtratoBancario {
  id: string; empresa_id: string; competencia: string;
  data_movimento: string; descricao: string; valor: number;
  tipo: "credito" | "debito"; conciliado: boolean;
  lancamento_id?: string; created_at: string;
}

export interface TotaisLancamentos {
  totalDebito: number;
  totalCredito: number;
}

// ─── Lançamentos ─────────────────────────────────────────────────────────────

export function useLancamentos(empresaId: string, mesReferencia: string) {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [totais, setTotais] = useState<TotaisLancamentos>({ totalDebito: 0, totalCredito: 0 });

  const fetch = useCallback(async () => {
    if (!empresaId || !mesReferencia) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("lancamentos_contabeis")
        // alias: a coluna real é mes_referencia; a UI/tipo usa competencia
        .select("*, competencia:mes_referencia")
        .eq("empresa_id", empresaId)
        .eq("mes_referencia", mesReferencia)
        .order("data_lancamento");
      if (error) throw error;
      const list = data ?? [];
      setLancamentos(list);
      setTotais({
        totalDebito:  list.filter((l: Lancamento) => l.tipo === "debito").reduce((s: number, l: Lancamento) => s + Number(l.valor), 0),
        totalCredito: list.filter((l: Lancamento) => l.tipo === "credito").reduce((s: number, l: Lancamento) => s + Number(l.valor), 0),
      });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar lançamentos"); }
    finally { setLoading(false); }
  }, [empresaId, mesReferencia]);

  useEffect(() => { fetch(); }, [fetch]);
  return { lancamentos, loading, totais, refresh: fetch };
}

export interface NovoLancamentoInput {
  empresa_id: string;
  data_lancamento: string;   // 'YYYY-MM-DD'
  historico: string;
  conta_debito: string;
  conta_credito: string;
  valor: number;
  tipo?: string;
}

export function useCriarLancamento() {
  const [loading, setLoading] = useState(false);
  const criarLancamento = useCallback(async (input: NovoLancamentoInput) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const mes_referencia = input.data_lancamento.slice(0, 7); // 'YYYY-MM'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("lancamentos_contabeis").insert({
        empresa_id:      input.empresa_id,
        data_lancamento: input.data_lancamento,
        data_competencia: input.data_lancamento,   // NOT NULL — usa a data do lançamento
        mes_referencia,                            // NOT NULL
        historico:       input.historico,
        conta_debito:    input.conta_debito,
        conta_credito:   input.conta_credito,
        valor:           input.valor,
        tipo:            input.tipo ?? null,
        status:          "lancado",
        created_by:      user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Lançamento registrado");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao criar lançamento"); return false; }
    finally { setLoading(false); }
  }, []);
  return { criarLancamento, loading };
}

// ─── Plano de Contas ─────────────────────────────────────────────────────────

export function usePlanoContas(empresaId: string) {
  const [contas, setContas] = useState<PlanoContas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("plano_contas")
          .select("*")
          .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
          .eq("ativo", true)
          .order("codigo");
        if (error) throw error;
        setContas(data ?? []);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar plano de contas"); }
      finally { setLoading(false); }
    })();
  }, [empresaId]);

  return { contas, loading };
}

// ─── Períodos Contábeis ──────────────────────────────────────────────────────

export function usePeriodosContabeis(empresaId?: string) {
  const [periodos, setPeriodos] = useState<PeriodoContabil[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // aliases: colunas reais são mes_referencia e created_at; UI usa competencia/aberto_em
      let q = (supabase as any).from("periodos_contabeis")
        .select("*, competencia:mes_referencia, aberto_em:created_at")
        .order("mes_referencia", { ascending: false });
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      setPeriodos(data ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar períodos"); }
    finally { setLoading(false); }
  }, [empresaId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { periodos, loading, refresh: fetch };
}

export function useAbrirPeriodo() {
  const [loading, setLoading] = useState(false);
  const abrirPeriodo = useCallback(async (empresaId: string, competencia: string) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("periodos_contabeis")
        .insert({ empresa_id: empresaId, mes_referencia: competencia, status: "aberto" });
      if (error) throw error;
      toast.success(`Período ${competencia} aberto`);
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao abrir período"); return false; }
    finally { setLoading(false); }
  }, []);
  return { abrirPeriodo, loading };
}

export function useFecharPeriodo() {
  const [loading, setLoading] = useState(false);
  const fecharPeriodo = useCallback(async (periodoId: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("periodos_contabeis")
        .update({ status: "fechado", fechado_em: new Date().toISOString(), fechado_por: user?.id })
        .eq("id", periodoId);
      if (error) throw error;
      toast.success("Período fechado com sucesso");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao fechar período"); return false; }
    finally { setLoading(false); }
  }, []);
  return { fecharPeriodo, loading };
}

// ─── Extratos Bancários ──────────────────────────────────────────────────────

export function useExtratosBancarios(empresaId: string, mesReferencia: string) {
  const [extratos, setExtratos] = useState<ExtratoBancario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!empresaId || !mesReferencia) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("extrato_bancario")
        .select("*")
        .eq("empresa_id", empresaId)
        .eq("mes_referencia", mesReferencia)
        .order("data_movimento");
      if (error) throw error;
      setExtratos(data ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar extratos"); }
    finally { setLoading(false); }
  }, [empresaId, mesReferencia]);

  useEffect(() => { fetch(); }, [fetch]);

  const conciliados = extratos.filter(e => e.conciliado).length;
  const pendentes   = extratos.filter(e => !e.conciliado).length;

  return { extratos, loading, conciliados, pendentes, refresh: fetch };
}

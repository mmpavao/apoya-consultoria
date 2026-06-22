/**
 * Hook: use-dp.ts
 * Departamento Pessoal — Funcionários, Folha Mensal, Férias, Rescisões
 * Escopo: Simples Nacional apenas
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calcFolhaTotais, calcFolhaFuncionario } from "@/lib/folha-calc";
import { calcRescisao } from "@/lib/rescisao-calc";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TipoContrato   = "clt" | "pj" | "estagiario" | "autonomo";
export type StatusFunc     = "ativo" | "afastado" | "demitido";
export type StatusFolha    = "aberta" | "fechada" | "enviada";
export type StatusFerias   = "pendente" | "agendada" | "paga" | "vencida";
export type TipoRescisao   =
  | "sem_justa_causa" | "com_justa_causa" | "pedido_demissao"
  | "acordo" | "aposentadoria";

export interface Funcionario {
  id: string; empresa_id: string; nome: string; cpf: string;
  pis?: string; cargo?: string; departamento?: string;
  salario_base: number; data_admissao: string; data_demissao?: string;
  tipo_contrato: TipoContrato; jornada?: string;
  banco?: string; agencia?: string; conta?: string; tipo_conta?: string;
  dependentes: number; status: StatusFunc; observacoes?: string;
  created_at: string; updated_at: string;
  dias_sem_ferias?: number;
}

export interface FolhaMensal {
  id: string; empresa_id: string; competencia: string;
  total_funcionarios: number; total_proventos: number;
  total_descontos: number; total_liquido: number;
  total_fgts: number; total_inss_empresa: number;
  status: StatusFolha; fechado_em?: string; fechado_por?: string;
  observacoes?: string; created_at: string; updated_at: string;
}

export interface Ferias {
  id: string; funcionario_id: string; empresa_id: string;
  periodo_aquisitivo_ini: string; periodo_aquisitivo_fim: string;
  gozo_inicio?: string; gozo_fim?: string; dias_gozo: number;
  abono_pecuniario: boolean; dias_abono: number;
  valor_ferias?: number; valor_abono?: number; valor_total?: number;
  status: StatusFerias; created_at: string;
  funcionario?: { nome: string; cargo?: string };
}

export interface Rescisao {
  id: string; funcionario_id: string; empresa_id: string;
  tipo: TipoRescisao; data_aviso?: string; data_demissao: string;
  saldo_salario: number; ferias_vencidas: number; ferias_proporcionais: number;
  decimo_proporcional: number; multa_fgts: number;
  inss_desconto: number; irrf_desconto: number;
  total_bruto: number; total_liquido: number; fgts_saldo: number;
  homologada: boolean; homologada_em?: string; pdf_url?: string;
  observacoes?: string; created_at: string;
}

// ─── Funcionários ────────────────────────────────────────────────────────────

export function useFuncionarios(empresaId?: string) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any).from("funcionarios").select("*").order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      const hoje = Date.now();
      const enriched = (data ?? []).map((f: Funcionario) => ({
        ...f,
        dias_sem_ferias: f.status === "ativo"
          ? Math.floor((hoje - new Date(f.data_admissao).getTime()) / 86400000)
          : 0,
      }));
      setFuncionarios(enriched);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar funcionários");
    } finally { setLoading(false); }
  }, [empresaId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { funcionarios, loading, refresh: fetch };
}

export function useFuncionarioById(id: string) {
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("funcionarios").select("*").eq("id", id).single();
      setFuncionario(data ?? null);
      setLoading(false);
    })();
  }, [id]);
  return { funcionario, loading };
}

export function useCreateFuncionario() {
  const [loading, setLoading] = useState(false);
  const create = useCallback(async (data: Omit<Funcionario, "id" | "created_at" | "updated_at" | "dias_sem_ferias">) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("funcionarios").insert(data);
      if (error) throw error;
      toast.success("Funcionário cadastrado");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao cadastrar"); return false; }
    finally { setLoading(false); }
  }, []);
  return { create, loading };
}

export function useUpdateFuncionario() {
  const [loading, setLoading] = useState(false);
  const update = useCallback(async (id: string, data: Partial<Funcionario>) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("funcionarios")
        .update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Funcionário atualizado");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao atualizar"); return false; }
    finally { setLoading(false); }
  }, []);
  return { update, loading };
}

export function useDemitirFuncionario() {
  const [loading, setLoading] = useState(false);
  const demitir = useCallback(async (funcionarioId: string, dataDemissao: string, tipo: TipoRescisao, observacoes?: string) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      // Busca os dados ANTES de marcar demitido (evita crash por null e
      // estado inconsistente: funcionário demitido sem rescisão)
      const { data: func, error: e0 } = await db.from("funcionarios")
        .select("empresa_id, salario_base, dependentes, data_admissao").eq("id", funcionarioId).single();
      if (e0 || !func) throw new Error("Funcionário não encontrado");
      const { error: e1 } = await db.from("funcionarios")
        .update({ status: "demitido", data_demissao: dataDemissao, updated_at: new Date().toISOString() })
        .eq("id", funcionarioId);
      if (e1) throw e1;
      // CALCULA as verbas rescisórias (antes a rescisão nascia zerada)
      const verbas = calcRescisao({
        salarioBase: Number(func.salario_base) || 0,
        dependentes: func.dependentes ?? 0,
        dataAdmissao: func.data_admissao,
        dataDemissao,
        tipo: tipo as any,
      });
      const { error: e2 } = await db.from("rescisoes")
        .insert({ funcionario_id: funcionarioId, empresa_id: func.empresa_id, tipo, data_demissao: dataDemissao, observacoes: observacoes?.trim() || null, ...verbas });
      if (e2) throw e2;
      toast.success("Funcionário demitido — rescisão calculada (valores estimados, confira)");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao demitir"); return false; }
    finally { setLoading(false); }
  }, []);
  return { demitir, loading };
}

// ─── Folha Mensal ────────────────────────────────────────────────────────────

export function useFolhaMensal(empresaId: string, competencia: string) {
  const [folha, setFolha] = useState<FolhaMensal | null>(null);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    if (!empresaId || !competencia) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("folha_mensal")
        .select("*").eq("empresa_id", empresaId).eq("competencia", competencia).maybeSingle();
      if (error) throw error;
      setFolha(data ?? null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar folha"); }
    finally { setLoading(false); }
  }, [empresaId, competencia]);
  useEffect(() => { fetch(); }, [fetch]);
  return { folha, loading, refresh: fetch };
}

export function useCreateFolha() {
  const [loading, setLoading] = useState(false);
  const createFolha = useCallback(async (empresaId: string, competencia: string) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      // Busca os ativos e CALCULA a folha (antes a folha nascia zerada)
      const { data: funcs, error: funcErr } = await db.from("funcionarios")
        .select("id, salario_base, dependentes")
        .eq("empresa_id", empresaId).eq("status", "ativo");
      if (funcErr) throw funcErr;
      const ativos = (funcs ?? []) as { id: string; salario_base: number; dependentes?: number | null }[];
      const totais = calcFolhaTotais(ativos);
      const { data: folha, error } = await db.from("folha_mensal").insert({
        empresa_id: empresaId,
        competencia,
        status: "aberta",
        ...totais,
      }).select("id").single();
      if (error) throw error;
      // Gera uma LINHA por funcionário (detalhe proventos/descontos/líquido).
      if (folha?.id && ativos.length) {
        const linhas = ativos.map(f => {
          const r = calcFolhaFuncionario(Number(f.salario_base) || 0, f.dependentes ?? 0);
          return {
            folha_id: folha.id, funcionario_id: f.id,
            salario_base: Number(f.salario_base) || 0,
            proventos: r.bruto, inss: r.inss, irrf: r.irrf, fgts: r.fgts,
            descontos: r.descontos, liquido: r.liquido,
          };
        });
        const { error: eLinhas } = await db.from("folha_linha").insert(linhas);
        if (eLinhas) throw eLinhas;
      }
      toast.success(`Folha ${competencia} aberta — ${totais.total_funcionarios} funcionário(s)`);
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao criar folha"); return false; }
    finally { setLoading(false); }
  }, []);
  return { createFolha, loading };
}

export function useFecharFolha() {
  const [loading, setLoading] = useState(false);
  const fecharFolha = useCallback(async (folhaId: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("folha_mensal")
        .update({ status: "fechada", fechado_em: new Date().toISOString(), fechado_por: user?.id, updated_at: new Date().toISOString() })
        .eq("id", folhaId);
      if (error) throw error;
      toast.success("Folha fechada");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao fechar folha"); return false; }
    finally { setLoading(false); }
  }, []);
  return { fecharFolha, loading };
}

export interface FolhaLinha {
  id: string; folha_id: string; funcionario_id: string;
  salario_base: number; proventos: number; inss: number; irrf: number;
  fgts: number; descontos: number; liquido: number; observacoes?: string | null;
  funcionario?: { nome: string; cargo?: string } | null;
}

export function useFolhaLinhas(folhaId?: string) {
  const [linhas, setLinhas] = useState<FolhaLinha[]>([]);
  const [loading, setLoading] = useState(false);
  const fetch = useCallback(async () => {
    if (!folhaId) { setLinhas([]); return; }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("folha_linha")
        .select("*, funcionario:funcionario_id(nome, cargo)")
        .eq("folha_id", folhaId)
        .order("created_at");
      if (error) throw error;
      setLinhas((data ?? []) as FolhaLinha[]);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar detalhe da folha"); }
    finally { setLoading(false); }
  }, [folhaId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { linhas, loading, refresh: fetch };
}

export function useEditarFolhaLinha() {
  const [loading, setLoading] = useState(false);
  const editarLinha = useCallback(async (id: string, patch: Partial<Pick<FolhaLinha, "proventos" | "inss" | "irrf" | "fgts" | "descontos" | "liquido" | "observacoes">>) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("folha_linha").update(patch).eq("id", id);
      if (error) throw error;
      toast.success("Linha atualizada");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao editar linha"); return false; }
    finally { setLoading(false); }
  }, []);
  return { editarLinha, loading };
}

export function useSalvarFolhaObs() {
  const [loading, setLoading] = useState(false);
  const salvarObs = useCallback(async (folhaId: string, observacoes: string) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("folha_mensal")
        .update({ observacoes, updated_at: new Date().toISOString() }).eq("id", folhaId);
      if (error) throw error;
      toast.success("Observações salvas");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar observações"); return false; }
    finally { setLoading(false); }
  }, []);
  return { salvarObs, loading };
}

// ─── Férias ──────────────────────────────────────────────────────────────────

export function useFerias(empresaId?: string) {
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // Traz TODOS os status — a FeriasTab filtra client-side (pendente/vencida/
      // agendada/paga). Antes filtrava só pendente/vencida, então férias recém
      // AGENDADA (status inicial) ou marcada PAGA sumia da tela na hora.
      let q = (supabase as any).from("ferias")
        .select("*, funcionario:funcionario_id(nome, cargo)")
        .order("periodo_aquisitivo_fim");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      setFerias(data ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar férias"); }
    finally { setLoading(false); }
  }, [empresaId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { ferias, loading, refresh: fetch };
}

export function useCreateFerias() {
  const [loading, setLoading] = useState(false);
  const create = useCallback(async (data: Omit<Ferias, "id" | "created_at">) => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("ferias").insert(data);
      if (error) throw error;
      toast.success("Férias agendadas");
      return true;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao agendar férias"); return false; }
    finally { setLoading(false); }
  }, []);
  return { create, loading };
}

export function useFeriasFuncionario(funcionarioId: string) {
  const [ferias, setFerias] = useState<Ferias[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!funcionarioId) return;
    (async () => {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("ferias")
        .select("*").eq("funcionario_id", funcionarioId).order("created_at", { ascending: false });
      setFerias(data ?? []);
      setLoading(false);
    })();
  }, [funcionarioId]);
  return { ferias, loading };
}

// ─── Rescisões ───────────────────────────────────────────────────────────────

export function useRescisoes(empresaId?: string) {
  const [rescisoes, setRescisoes] = useState<Rescisao[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any).from("rescisoes").select("*").order("data_demissao", { ascending: false });
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      setRescisoes(data ?? []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar rescisões"); }
    finally { setLoading(false); }
  }, [empresaId]);
  useEffect(() => { fetch(); }, [fetch]);
  return { rescisoes, loading, refresh: fetch };
}

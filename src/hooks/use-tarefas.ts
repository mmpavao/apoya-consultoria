import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TarefaStatus = 
  | "aberta" | "em_andamento" | "aguardando_aprovacao" | "aprovada" 
  | "rejeitada" | "concluida" | "cancelada" | "bloqueada";

export type TarefaTipo =
  | "fiscal" | "dp" | "financeiro" | "societario" | "compliance"
  | "contabilidade" | "atendimento" | "comercial" | "interno";

export type TarefaPrioridade = "critica" | "alta" | "media" | "baixa";
export type SlaStatus = "no_prazo" | "atencao" | "atrasada" | "expirada";

export interface Subtarefa {
  id: string;
  titulo: string;
  status: "aberta" | "concluida";
  responsavel?: string;
  data_prazo?: string;
}

export interface ComentarioItem {
  id: string;
  autor: string;
  autor_tipo: "agente" | "humano";
  texto: string;
  timestamp: string;
}

export interface HistoricoItem {
  campo: string;
  de: string;
  para: string;
  por: string;
  em: string;
}

export interface AnexoItem {
  nome: string;
  url: string;
  tipo: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: TarefaTipo;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  cliente_id?: string;
  cliente_nome?: string;
  responsavel: string;
  responsavel_tipo: "agente" | "humano";
  criado_por: string;
  criado_por_tipo: "agente" | "humano";
  requer_aprovacao: boolean;
  aprovador?: string;
  aprovador_tipo?: "agente" | "humano";
  aprovado_em?: string;
  aprovado_por?: string;
  motivo_rejeicao?: string;
  data_prazo?: string;
  sla_horas?: number;
  sla_status?: SlaStatus;
  tarefa_pai_id?: string;
  subtarefas: Subtarefa[];
  subtarefas_total: number;
  subtarefas_concluidas: number;
  tags: string[];
  anexos: AnexoItem[];
  comentarios: ComentarioItem[];
  historico: HistoricoItem[];
  origem?: string;
  concluida_em?: string;
  created_at: string;
  updated_at: string;
}

export type TarefaFilters = {
  status?: TarefaStatus;
  tipo?: TarefaTipo;
  prioridade?: TarefaPrioridade;
  responsavel?: string;
  cliente_id?: string;
  sla_status?: SlaStatus;
  search?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
};

// SLA em horas por tipo
const SLA_POR_TIPO: Record<TarefaTipo | string, number> = {
  fiscal: 72,
  dp: 24,
  financeiro: 72,
  societario: 72,
  compliance: 72,
  contabilidade: 72,
  atendimento: 48,
  comercial: 48,
  interno: 72,
};

export function calcularSlaHoras(tipo: TarefaTipo, tags?: string[]): number {
  if (tipo === "fiscal" && tags?.includes("urgente")) return 4;
  return SLA_POR_TIPO[tipo] ?? 72;
}

export function calcularSlaStatus(data_prazo: string | undefined, status: TarefaStatus): SlaStatus {
  if (!data_prazo || status === "concluida" || status === "cancelada") return "no_prazo";
  const now = new Date();
  const prazo = new Date(data_prazo);
  const diffMs = prazo.getTime() - now.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffMs < 0) return diffH < -24 ? "expirada" : "atrasada";
  return diffH < 0.25 * (SLA_POR_TIPO["interno"]) ? "atencao" : "no_prazo";
}

export function useTarefas(filters?: TarefaFilters) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTarefas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("tarefas").select("*").order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.tipo) query = query.eq("tipo", filters.tipo);
      if (filters?.prioridade) query = query.eq("prioridade", filters.prioridade);
      if (filters?.responsavel) query = query.eq("responsavel", filters.responsavel);
      if (filters?.cliente_id) query = query.eq("cliente_id", filters.cliente_id);
      if (filters?.sla_status) query = query.eq("sla_status", filters.sla_status);
      if (filters?.search) query = query.ilike("titulo", `%${filters.search}%`);
      if (filters?.periodo_inicio) query = query.gte("created_at", filters.periodo_inicio);
      if (filters?.periodo_fim) query = query.lte("created_at", filters.periodo_fim);
      const { data, error: err } = await query;
      if (err) throw err;
      const items = (data ?? []) as unknown as Tarefa[];
      // Recalcular sla_status no frontend
      const enriched = items.map(t => ({
        ...t,
        sla_status: calcularSlaStatus(t.data_prazo, t.status),
        subtarefas: Array.isArray(t.subtarefas) ? t.subtarefas : [],
        comentarios: Array.isArray(t.comentarios) ? t.comentarios : [],
        historico: Array.isArray(t.historico) ? t.historico : [],
        tags: Array.isArray(t.tags) ? t.tags : [],
        anexos: Array.isArray(t.anexos) ? t.anexos : [],
      }));
      setTarefas(enriched);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar tarefas");
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { fetchTarefas(); }, [fetchTarefas]);

  const criarTarefa = useCallback(async (data: Partial<Tarefa>) => {
    const sla = calcularSlaHoras(data.tipo ?? "interno", data.tags);
    const payload = {
      ...data,
      sla_horas: sla,
      subtarefas: data.subtarefas ?? [],
      comentarios: [],
      historico: [{
        campo: "status",
        de: "",
        para: "aberta",
        por: data.criado_por ?? "sistema",
        em: new Date().toISOString(),
      }],
      tags: data.tags ?? [],
      anexos: [],
    };
    const { data: row, error: err } = await supabase.from("tarefas").insert(payload).select().single();
    if (err) throw err;
    await fetchTarefas();
    return row as unknown as Tarefa;
  }, [fetchTarefas]);

  const atualizarTarefa = useCallback(async (id: string, updates: Partial<Tarefa>, quem: string) => {
    // Buscar tarefa atual para historico
    const atual = tarefas.find(t => t.id === id);
    const historico_entry: HistoricoItem[] = [];
    if (atual) {
      for (const key of Object.keys(updates) as (keyof Tarefa)[]) {
        const de = String(atual[key] ?? "");
        const para = String(updates[key] ?? "");
        if (de !== para) {
          historico_entry.push({ campo: key, de, para, por: quem, em: new Date().toISOString() });
        }
      }
    }
    const historico_atual = atual?.historico ?? [];
    const payload = {
      ...updates,
      historico: [...historico_atual, ...historico_entry],
    };
    if (updates.status === "concluida") {
      (payload as Record<string, unknown>).concluida_em = new Date().toISOString();
    }
    const { error: err } = await supabase.from("tarefas").update(payload).eq("id", id);
    if (err) throw err;
    await fetchTarefas();
  }, [tarefas, fetchTarefas]);

  const adicionarComentario = useCallback(async (id: string, comentario: Omit<ComentarioItem, "id" | "timestamp">) => {
    const atual = tarefas.find(t => t.id === id);
    const novo: ComentarioItem = {
      id: crypto.randomUUID(),
      ...comentario,
      timestamp: new Date().toISOString(),
    };
    const comentarios = [...(atual?.comentarios ?? []), novo];
    const { error: err } = await supabase.from("tarefas").update({ comentarios }).eq("id", id);
    if (err) throw err;
    await fetchTarefas();
  }, [tarefas, fetchTarefas]);

  const deletarTarefa = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("tarefas").delete().eq("id", id);
    if (err) throw err;
    await fetchTarefas();
  }, [fetchTarefas]);

  return { tarefas, loading, error, refetch: fetchTarefas, criarTarefa, atualizarTarefa, adicionarComentario, deletarTarefa };
}

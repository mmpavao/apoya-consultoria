// Contrato compartilhado dos agentes APOYA (edge functions / Deno).
// Padroniza: log de execução, criação idempotente de tarefa no pipeline e o
// shape de resposta. Todos os experts usam estes helpers → consistência.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface AgentResult {
  success: boolean;
  executado_em: string;
  resumo: Record<string, unknown>;
  alertas: Array<Record<string, unknown>>;
  acoes?: Array<Record<string, unknown>>;
}

// Registra a execução do agente em agente_logs (coluna real: detalhes jsonb).
export async function logAgentRun(
  sb: SB,
  agente: string,
  acao: string,
  resultado: "OK" | "ALERTA" | "ERRO",
  detalhes: Record<string, unknown>,
): Promise<void> {
  try {
    await sb.from("agente_logs").insert({
      agente, acao, resultado, detalhes,
      executado_em: new Date().toISOString(),
    });
  } catch (_) { /* log nunca derruba o agente */ }
}

// Cria uma tarefa no pipeline de forma IDEMPOTENTE (dedup por metadados.dedup_key).
// Retorna "criada" | "existente" | "erro". Um dono por tarefa: o setor do expert.
export async function upsertPipelineTask(
  sb: SB,
  t: {
    setor: string;
    titulo: string;
    etapa_pipeline: string;
    dedup_key: string;
    prioridade?: "baixa" | "normal" | "alta" | "critica";
    descricao?: string;
    cliente_id?: string | null;
    requer_aprovacao?: boolean;
    criado_por: string;        // ex: "agente-financeiro"
    meta?: Record<string, unknown>;
  },
): Promise<"criada" | "existente" | "erro"> {
  try {
    const { data: existentes } = await sb.from("tarefas")
      .select("id, metadados")
      .eq("setor", t.setor)
      .not("status", "in", "(concluida,cancelada)");
    const jaExiste = (existentes ?? []).some(
      (r: { metadados?: { dedup_key?: string } }) => r.metadados?.dedup_key === t.dedup_key,
    );
    if (jaExiste) return "existente";

    const { error } = await sb.from("tarefas").insert({
      titulo: t.titulo,
      descricao: t.descricao ?? "",
      tipo: t.setor,
      setor: t.setor,
      etapa_pipeline: t.etapa_pipeline,
      status: "aberta",
      prioridade: t.prioridade ?? "normal",
      cliente_id: t.cliente_id ?? null,
      responsavel: t.criado_por,
      responsavel_tipo: "agente",
      criado_por: t.criado_por,
      criado_por_tipo: "agente",
      requer_aprovacao: t.requer_aprovacao ?? false,
      metadados: { origem: t.criado_por, dedup_key: t.dedup_key, ...(t.meta ?? {}) },
    });
    return error ? "erro" : "criada";
  } catch (_) {
    return "erro";
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}

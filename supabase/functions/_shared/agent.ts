// Contrato compartilhado dos agentes APOYA (edge functions / Deno).
// Padroniza: log de execução, criação idempotente de tarefa no pipeline e o
// shape de resposta. Todos os experts usam estes helpers → consistência.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

// CORS padrão dos agentes — o dashboard chama via browser (preflight OPTIONS).
// Sem isso o navegador bloqueia a resposta mesmo com 200.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Exige um JWT de USUÁRIO válido (para edge functions chamadas pelo app).
// Cria o próprio client (anon) e valida via getUser. Retorna null se ok, ou a
// Response 401 (com CORS) para o handler devolver. A anon key NÃO passa (não é usuário).
export async function requireUser(req: Request, cors: Record<string, string> = {}): Promise<Response | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).Deno?.env;
  const url = env?.get("SUPABASE_URL");
  const anon = env?.get("SUPABASE_ANON_KEY");
  const unauthorized = () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  if (!token || !url || !anon) return unauthorized();
  try {
    const sb = createClient(url, anon);
    const { data, error } = await sb.auth.getUser(token);
    if (!error && data?.user) return null;
  } catch (_) { /* 401 */ }
  return unauthorized();
}

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
  // A coluna agente_logs.resultado tem CHECK constraint: só aceita
  // 'sucesso' | 'erro' | 'parcial'. Normaliza para não falhar o insert.
  const r = resultado === "ERRO" ? "erro" : resultado === "ALERTA" ? "parcial" : "sucesso";
  try {
    await sb.from("agente_logs").insert({
      agente, acao, resultado: r, detalhes,
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
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Auth dos agentes via SECRET DEDICADO (AGENTS_GATE_SECRET) — verificável de
// ponta a ponta (diferente da service-role-key, que o runtime divergia).
// Aceita: (a) token == gateSecret (orquestrador→experts e cron) OU (b) JWT de
// usuário válido (UI). FAIL-OPEN só se o secret NÃO estiver configurado
// (rollout seguro: se ninguém setou, nada quebra; quando setar, vira fail-closed).
export async function requireAuth(req: Request, sb: SB, gateSecret?: string | null): Promise<Response | null> {
  if (!gateSecret) return null; // gate desligado até o secret existir (rollout safe)
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token && token === gateSecret) return null;        // interno (orquestrador/cron)
  if (token) {
    try { const { data, error } = await sb.auth.getUser(token); if (!error && data?.user) return null; } catch (_) { /* 401 */ }
  }
  return json({ error: "Unauthorized" }, 401);
}

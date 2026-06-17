// Agente Societário — OBSERVADOR do setor societário.
// O domínio societário tem pipeline próprio (processos_societarios, exibido na
// aba "Pipeline" do módulo, com prazo/vencido no card). Por isso o agente NÃO
// cria tarefa duplicada — apenas DETECTA processos atrasados e ALERTA (log +
// resumo lido pelo orquestrador). A ação fica com o humano no próprio kanban.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAgentRun, json, requireAuth } from "../_shared/agent.ts";

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, error: "Missing Supabase configuration" }, 500);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const denied = await requireAuth(req, sb, SUPABASE_SERVICE_ROLE_KEY);
  if (denied) return denied;

  try {
    const hoje = new Date().toISOString().slice(0, 10);

    const { data: processos, error } = await sb
      .from("processos_societarios")
      .select("id, cliente_id, nome_empresa, fase, tipo, prazo, status")
      .neq("fase", "concluido");
    if (error) throw error;

    const ativos    = processos ?? [];
    const atrasados = ativos.filter((p) => p.prazo && p.prazo < hoje);

    await logAgentRun(sb, "SOCIETARIO", "MONITORAMENTO_PROCESSOS",
      atrasados.length > 0 ? "ALERTA" : "OK",
      { processos_ativos: ativos.length, processos_atrasados: atrasados.length });

    return json({
      success: true,
      executado_em: new Date().toISOString(),
      resumo: {
        processos_ativos: ativos.length,
        processos_atrasados: atrasados.length,
      },
      alertas: atrasados.map((p) => ({ tipo: "PROCESSO_ATRASADO", empresa: p.nome_empresa, fase: p.fase, prazo: p.prazo })),
    });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

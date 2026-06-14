// Agente Societário — EXPERT EXECUTOR autônomo do setor societário.
// Materializa/tria processos ativos (fase != concluido) que estão ATRASADOS
// (prazo vencido) no pipeline societário (idempotente, entrada solicitado).
// PARA antes de protocolar (gate humano: etapa aguardando_assinatura). Resumo
// lido pelo orquestrador.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAgentRun, upsertPipelineTask, json } from "../_shared/agent.ts";

Deno.serve(async (_req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, error: "Missing Supabase configuration" }, 500);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const hoje = new Date().toISOString().slice(0, 10);

    // Processos ativos (não concluídos)
    const { data: processos, error } = await sb
      .from("processos_societarios")
      .select("id, cliente_id, nome_empresa, fase, tipo, prazo, status")
      .neq("fase", "concluido");
    if (error) throw error;

    const ativos     = processos ?? [];
    const atrasados  = ativos.filter((p) => p.prazo && p.prazo < hoje);

    // AÇÃO: tria processos ATRASADOS no pipeline societário (entrada solicitado).
    let criadas = 0, existentes = 0;
    for (const p of atrasados) {
      const r = await upsertPipelineTask(sb, {
        setor: "societario",
        titulo: `Processo atrasado — ${p.nome_empresa ?? "empresa"} · ${p.tipo ?? "processo"}`,
        descricao: `Processo na fase "${p.fase}" com prazo vencido (${p.prazo}). Triado pelo agente-societario; protocolo/assinatura requer ação humana.`,
        etapa_pipeline: "solicitado",
        dedup_key: `processo:${p.id}`,
        prioridade: "alta",
        cliente_id: p.cliente_id ?? null,
        criado_por: "agente-societario",
        meta: { processo_id: p.id, fase: p.fase, tipo: p.tipo, prazo: p.prazo },
      });
      if (r === "criada") criadas++; else if (r === "existente") existentes++;
    }

    await logAgentRun(sb, "SOCIETARIO", "TRIAGEM_PROCESSOS",
      atrasados.length > 0 ? "ALERTA" : "OK",
      { processos_ativos: ativos.length, processos_atrasados: atrasados.length,
        tarefas_criadas: criadas, tarefas_existentes: existentes });

    return json({
      success: true,
      executado_em: new Date().toISOString(),
      resumo: {
        processos_ativos: ativos.length,
        processos_atrasados: atrasados.length,
        tarefas_criadas: criadas, tarefas_existentes: existentes,
      },
      acoes: [{ tipo: "TRIAGEM_PIPELINE", criadas, existentes, gate: "protocolo/assinatura = ação humana" }],
      alertas: atrasados.map((p) => ({ tipo: "PROCESSO_ATRASADO", empresa: p.nome_empresa, fase: p.fase, prazo: p.prazo })),
    });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

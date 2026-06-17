// Agente Fiscal — EXPERT EXECUTOR autônomo do setor fiscal.
// Materializa/tria cada obrigação vencida ou urgente no pipeline fiscal
// (idempotente, etapa de entrada a_apurar). PARA antes de transmitir (gate
// humano: etapa pronto_transmitir requer aprovação). Mantém o resumo lido pelo
// dashboard ({vencidas,urgentes,no_prazo,total}) e pelo orquestrador
// ({obrigacoes_vencidas,sem_responsavel}).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAgentRun, upsertPipelineTask, json, requireAuth } from "../_shared/agent.ts";

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, error: "Missing Supabase configuration" }, 500);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const denied = await requireAuth(req, sb, Deno.env.get("AGENTS_GATE_SECRET"));
  if (denied) return denied;

  try {
    const hoje    = new Date().toISOString().slice(0, 10);
    const em7dias = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    const { data: abertas, error } = await sb
      .from("obrigacoes")
      .select("id, cliente_id, cliente_nome, tipo, competencia, vencimento, status, responsavel")
      .not("status", "in", "(concluida,cancelada)");
    if (error) throw error;

    const lista          = abertas ?? [];
    const vencidas       = lista.filter((o) => o.vencimento && o.vencimento < hoje);
    const urgentes       = lista.filter((o) => o.vencimento && o.vencimento >= hoje && o.vencimento <= em7dias);
    const noPrazo        = lista.filter((o) => o.vencimento && o.vencimento > em7dias);
    const semResponsavel = lista.filter((o) => !o.responsavel || String(o.responsavel).trim() === "");

    // AÇÃO autônoma: tria vencidas + urgentes no pipeline fiscal (entrada a_apurar).
    let criadas = 0, existentes = 0;
    for (const o of [...vencidas, ...urgentes]) {
      const venc = o.vencimento <  hoje;
      const r = await upsertPipelineTask(sb, {
        setor: "fiscal",
        titulo: `${venc ? "Obrigação vencida" : "Obrigação a vencer"} — ${o.cliente_nome ?? "cliente"} · ${o.tipo ?? "obrigação"}`,
        descricao: `Competência ${o.competencia ?? "—"} · vencimento ${o.vencimento}. Triada pelo agente-fiscal; transmissão requer aprovação humana.`,
        etapa_pipeline: "a_apurar",
        dedup_key: `obrigacao:${o.id}`,
        prioridade: venc ? "alta" : "normal",
        cliente_id: o.cliente_id ?? null,
        criado_por: "agente-fiscal",
        meta: { obrigacao_id: o.id, tipo: o.tipo, vencimento: o.vencimento, vencida: venc },
      });
      if (r === "criada") criadas++; else if (r === "existente") existentes++;
    }

    await logAgentRun(sb, "FISCAL", "TRIAGEM_OBRIGACOES",
      vencidas.length > 0 ? "ALERTA" : "OK",
      { vencidas: vencidas.length, urgentes: urgentes.length, sem_responsavel: semResponsavel.length,
        total: lista.length, tarefas_criadas: criadas, tarefas_existentes: existentes });

    return json({
      success: true,
      executado_em: new Date().toISOString(),
      resumo: {
        vencidas: vencidas.length, urgentes: urgentes.length, no_prazo: noPrazo.length, total: lista.length,
        obrigacoes_vencidas: vencidas.length, sem_responsavel: semResponsavel.length,
        tarefas_criadas: criadas, tarefas_existentes: existentes,
      },
      acoes: [{ tipo: "TRIAGEM_PIPELINE", criadas, existentes, gate: "transmissão = ação humana" }],
      alertas: [
        ...vencidas.map((o) => ({ tipo: "OBRIGACAO_VENCIDA", cliente: o.cliente_nome, obrigacao: o.tipo, vencimento: o.vencimento })),
        ...urgentes.map((o) => ({ tipo: "OBRIGACAO_URGENTE", cliente: o.cliente_nome, obrigacao: o.tipo, vencimento: o.vencimento })),
      ],
    });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

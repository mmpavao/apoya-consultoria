// Agente RH/DP — EXPERT EXECUTOR autônomo do setor pessoal.
// Materializa/tria cada folha em aberto no pipeline DP (idempotente, etapa de
// entrada coleta_dados). PARA antes do fechamento/transmissão eSocial (gate
// humano: etapa conferencia requer aprovação). Mantém o resumo lido pelo
// orquestrador ({folhas_abertas, ferias_proximas_30d}).
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
    const hoje      = new Date().toISOString().slice(0, 10);
    const limite30d = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

    // Folhas em aberto (status 'aberto' — valor real usado em produção)
    const { data: folhas, error: errF } = await sb
      .from("folha_mensal")
      .select("id, empresa_id, competencia, status")
      .eq("status", "aberto");
    if (errF) throw errF;

    // Férias aprovadas vencendo em 30 dias (observação)
    const { data: ferias } = await sb
      .from("ferias")
      .select("id, empresa_id, gozo_inicio, status")
      .gte("gozo_inicio", hoje).lte("gozo_inicio", limite30d).eq("status", "aprovada");

    // Mapa empresa_id → razão social (para títulos legíveis)
    const lista = folhas ?? [];
    const ids = [...new Set(lista.map((f) => f.empresa_id).filter(Boolean))];
    const nomeMap: Record<string, string> = {};
    if (ids.length) {
      const { data: cls } = await sb.from("clientes").select("id, razao_social").in("id", ids);
      for (const c of cls ?? []) nomeMap[c.id] = c.razao_social;
    }

    // AÇÃO autônoma: tria folhas em aberto no pipeline DP (entrada coleta_dados).
    let criadas = 0, existentes = 0;
    for (const f of lista) {
      const r = await upsertPipelineTask(sb, {
        setor: "dp",
        titulo: `Folha em aberto — ${nomeMap[f.empresa_id] ?? "empresa"} (${f.competencia ?? "—"})`,
        descricao: `Folha da competência ${f.competencia ?? "—"} ainda em aberto. Triada pelo agente-rh; fechamento/eSocial requer aprovação humana.`,
        etapa_pipeline: "coleta_dados",
        dedup_key: `folha:${f.id}`,
        prioridade: "normal",
        criado_por: "agente-rh",
        meta: { folha_id: f.id, competencia: f.competencia, empresa_id: f.empresa_id },
      });
      if (r === "criada") criadas++; else if (r === "existente") existentes++;
    }

    await logAgentRun(sb, "RH", "TRIAGEM_FOLHAS",
      lista.length > 0 ? "ALERTA" : "OK",
      { folhas_abertas: lista.length, ferias_proximas_30d: (ferias ?? []).length,
        tarefas_criadas: criadas, tarefas_existentes: existentes });

    return json({
      success: true,
      executado_em: new Date().toISOString(),
      resumo: {
        folhas_abertas: lista.length,
        ferias_proximas_30d: (ferias ?? []).length,
        tarefas_criadas: criadas, tarefas_existentes: existentes,
      },
      acoes: [{ tipo: "TRIAGEM_PIPELINE", criadas, existentes, gate: "fechamento/eSocial = ação humana" }],
      alertas: [
        ...lista.map((f) => ({ tipo: "FOLHA_ABERTA", empresa: nomeMap[f.empresa_id] ?? f.empresa_id, competencia: f.competencia })),
        ...(ferias ?? []).map((f) => ({ tipo: "FERIAS_PROXIMA", inicio: f.gozo_inicio })),
      ],
    });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

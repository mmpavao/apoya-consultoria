// Agente Contábil — EXPERT EXECUTOR autônomo do setor contábil.
// Materializa/tria cada período contábil em aberto no pipeline contábil
// (idempotente, etapa de entrada importar_extrato). PARA antes do fechamento
// (gate humano: etapa revisao requer aprovação). Resumo lido pelo orquestrador.
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
    // Períodos em aberto (status 'aberto' — valor real do schema)
    const { data: periodos, error } = await sb
      .from("periodos_contabeis")
      .select("id, empresa_id, mes_referencia, status")
      .eq("status", "aberto");
    if (error) throw error;

    const lista = periodos ?? [];
    const ids = [...new Set(lista.map((p) => p.empresa_id).filter(Boolean))];
    const nomeMap: Record<string, string> = {};
    if (ids.length) {
      const { data: cls } = await sb.from("clientes").select("id, razao_social").in("id", ids);
      for (const c of cls ?? []) nomeMap[c.id] = c.razao_social;
    }

    // AÇÃO: tria períodos abertos no pipeline contábil (entrada importar_extrato).
    let criadas = 0, existentes = 0;
    for (const p of lista) {
      const r = await upsertPipelineTask(sb, {
        setor: "contabil",
        titulo: `Período aberto — ${nomeMap[p.empresa_id] ?? "empresa"} (${p.mes_referencia ?? "—"})`,
        descricao: `Período contábil ${p.mes_referencia ?? "—"} em aberto. Triado pelo agente-contabil; fechamento requer aprovação humana (etapa revisão).`,
        etapa_pipeline: "importar_extrato",
        dedup_key: `periodo:${p.id}`,
        prioridade: "normal",
        criado_por: "agente-contabil",
        meta: { periodo_id: p.id, mes_referencia: p.mes_referencia, empresa_id: p.empresa_id },
      });
      if (r === "criada") criadas++; else if (r === "existente") existentes++;
    }

    await logAgentRun(sb, "CONTABIL", "TRIAGEM_PERIODOS",
      lista.length > 0 ? "ALERTA" : "OK",
      { periodos_abertos: lista.length, tarefas_criadas: criadas, tarefas_existentes: existentes });

    return json({
      success: true,
      executado_em: new Date().toISOString(),
      resumo: {
        periodos_abertos: lista.length,
        tarefas_criadas: criadas, tarefas_existentes: existentes,
      },
      acoes: [{ tipo: "TRIAGEM_PIPELINE", criadas, existentes, gate: "fechamento de período = ação humana" }],
      alertas: lista.map((p) => ({ tipo: "PERIODO_ABERTO", empresa: nomeMap[p.empresa_id] ?? p.empresa_id, competencia: p.mes_referencia })),
    });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

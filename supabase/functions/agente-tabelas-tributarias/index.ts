// Agente Tabelas Tributárias — MONITOR (não executor).
// Pilar 1 (contrato):
//   role:       vigia das tabelas INSS/IRRF/salário-mínimo usadas pela folha.
//   objective:  garantir que a folha/rescisão usem as tabelas VIGENTES.
//   success:    nenhuma mudança de vigência passa sem uma tarefa de revisão
//               (mensurável: ano_atual != vigência → tarefa criada).
//   constraints: NUNCA altera tabelas/folha sozinho — só PROPÕE com gate humano;
//               não fabrica valores.
//   scope:      monitorar + propor. Aplicar (atualizar folha-calc + deploy) = humano.
// Governança: tarefa com requer_aprovacao=true + log em agente_logs + idempotência.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAgentRun, upsertPipelineTask, json, requireAuth, CORS } from "../_shared/agent.ts";

// Vigência das tabelas embutidas em src/lib/folha-calc.ts. Ao atualizar a folha,
// bump aqui também (este agente é o lembrete robusto da virada de ano).
const VIGENCIA = "2026";
const FONTES = "Salário mínimo + INSS: gov.br/Receita Federal; IRRF: Lei 15.270/2025.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, error: "Missing Supabase configuration" }, 500);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const denied = await requireAuth(req, sb, Deno.env.get("AGENTS_GATE_SECRET"));
  if (denied) return denied;

  try {
    const anoAtual = String(new Date().getFullYear());
    const desatualizada = anoAtual !== VIGENCIA;

    // AÇÃO: se a vigência mudou, cria UMA tarefa de revisão (gate humano).
    // Não aplica nada — atualizar a folha é decisão revisada por humano.
    let tarefa: "criada" | "existente" | "erro" | "n/a" = "n/a";
    if (desatualizada) {
      tarefa = await upsertPipelineTask(sb, {
        setor: "dp",
        titulo: `Revisar tabelas INSS/IRRF ${anoAtual} (folha usa ${VIGENCIA})`,
        descricao: `As tabelas embutidas na folha são de ${VIGENCIA}. Verificar e atualizar `
          + `INSS/IRRF/salário mínimo para ${anoAtual} em src/lib/folha-calc.ts (com testes). ${FONTES}`,
        etapa_pipeline: "folha",
        dedup_key: `tabelas-tributarias:${anoAtual}`,
        prioridade: "alta",
        requer_aprovacao: true,
        criado_por: "agente-tabelas-tributarias",
        meta: { ano_atual: anoAtual, vigencia: VIGENCIA, fontes: FONTES },
      });
    }

    await logAgentRun(sb, "TRIBUTARIO", "CHECK_TABELAS",
      desatualizada ? "ALERTA" : "OK",
      { ano_atual: anoAtual, vigencia: VIGENCIA, desatualizada, tarefa });

    return json({
      success: true,
      executado_em: new Date().toISOString(),
      resumo: {
        vigencia: VIGENCIA,
        ano_atual: anoAtual,
        tabelas_desatualizadas: desatualizada,
        tarefa_criada: tarefa === "criada" ? 1 : 0,
      },
      acoes: [{ tipo: "CHECK_TABELAS", desatualizada, tarefa, gate: "atualização = ação humana" }],
      alertas: desatualizada
        ? [{ tipo: "TABELAS_DESATUALIZADAS", mensagem: `Folha usa tabelas ${VIGENCIA}, ano atual ${anoAtual}`, ano: anoAtual, vigencia: VIGENCIA }]
        : [],
    });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

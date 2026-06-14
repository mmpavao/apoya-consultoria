// Agente Financeiro — EXPERT EXECUTOR autônomo do setor financeiro.
// Não só observa: materializa e tria cada cobrança no pipeline financeiro
// (idempotente, um dono por tarefa). Roteia pela etapa conforme dias de atraso.
// PARA antes de mover dinheiro / disparar cobrança externa — isso é gate humano
// (etapas de aprovação do pipeline). Mantém o resumo lido pelo orquestrador.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAgentRun, upsertPipelineTask, json } from "../_shared/agent.ts";

const fmtBRL = (v: number) => "R$ " + Number(v ?? 0).toFixed(2);

// Roteia a cobrança para a etapa do pipeline conforme dias de atraso.
function etapaPorAtraso(dias: number): string {
  if (dias <= -5) return "lembrete_d5";   // ainda vai vencer (5+ dias)
  if (dias < 1)   return "em_dia";          // perto do vencimento / em dia
  if (dias < 15)  return "cobranca_d1";     // vencido recente
  return "negociacao";                       // atraso relevante
}

Deno.serve(async (_req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ success: false, error: "Missing Supabase configuration" }, 500);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const hoje    = new Date().toISOString().slice(0, 10);
    const amanha  = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    // 1. Cobranças em aberto (não pagas/canceladas)
    const { data: cobrancas, error: errCob } = await sb
      .from("cobrancas")
      .select("id, cliente_id, cliente_nome, valor, vencimento, dias_atraso, status")
      .not("status", "in", "(paga,cancelada)");
    if (errCob) throw errCob;

    const lista      = cobrancas ?? [];
    const vencidas   = lista.filter((c) => c.vencimento && c.vencimento < hoje);
    const hojeAmanha = lista.filter((c) => c.vencimento && c.vencimento >= hoje && c.vencimento <= amanha);

    // 2. NFS-e com erro (observação, sem ação automática)
    const { data: nfseErro } = await sb
      .from("nfse_emitida").select("id, cliente_id, tomador_nome, erro_msg").eq("status", "erro");

    // 3. AÇÃO autônoma: materializa/tria cada cobrança vencida no pipeline
    //    financeiro (idempotente por cobrança). Não dispara cobrança externa.
    let criadas = 0, existentes = 0;
    for (const c of vencidas) {
      const dias  = Math.floor((Date.parse(hoje) - Date.parse(c.vencimento)) / 86_400_000);
      const etapa = etapaPorAtraso(dias);
      const r = await upsertPipelineTask(sb, {
        setor: "financeiro",
        titulo: `Cobrança vencida — ${c.cliente_nome ?? "cliente"} (${fmtBRL(c.valor)})`,
        descricao: `Vencimento ${c.vencimento} · ${dias} dia(s) de atraso. Triada pelo agente-financeiro; envio de cobrança/baixa requer ação humana.`,
        etapa_pipeline: etapa,
        dedup_key: `cobranca:${c.id}`,
        prioridade: dias >= 15 ? "alta" : "normal",
        cliente_id: c.cliente_id ?? null,
        criado_por: "agente-financeiro",
        meta: { cobranca_id: c.id, dias_atraso: dias, valor: c.valor, etapa },
      });
      if (r === "criada") criadas++; else if (r === "existente") existentes++;
    }

    const totalVencido = vencidas.reduce((s, c) => s + Number(c.valor ?? 0), 0);

    await logAgentRun(sb, "FINANCEIRO", "TRIAGEM_COBRANCAS",
      vencidas.length > 0 ? "ALERTA" : "OK",
      { vencidas: vencidas.length, tarefas_criadas: criadas, tarefas_existentes: existentes,
        total_vencido_brl: totalVencido, vencendo_ate_amanha: hojeAmanha.length, nfse_com_erro: (nfseErro ?? []).length });

    return json({
      success: true,
      executado_em: new Date().toISOString(),
      // resumo lido pelo orquestrador (extrairAlertas) e pelo dashboard
      resumo: {
        cobrancas_vencidas: vencidas.length,
        total_vencido_brl:  totalVencido,
        vencendo_hoje:      hojeAmanha.length,
        nfse_com_erro:      (nfseErro ?? []).length,
        tarefas_criadas:    criadas,
        tarefas_existentes: existentes,
      },
      acoes: [{ tipo: "TRIAGEM_PIPELINE", criadas, existentes, gate: "envio de cobrança/baixa = ação humana" }],
      alertas: [
        ...vencidas.map((c) => ({ tipo: "COBRANCA_VENCIDA", cliente: c.cliente_nome, valor: c.valor, vencimento: c.vencimento })),
        ...(nfseErro ?? []).map((n) => ({ tipo: "NFSE_ERRO", tomador: n.tomador_nome, erro: n.erro_msg })),
      ],
    });
  } catch (err) {
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

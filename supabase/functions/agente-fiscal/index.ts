// Agente Fiscal — observa obrigações fiscais e materializa pendências.
// Contrato de retorno (consumido por dois lados):
//   dashboard  (_app.index.tsx)        → resumo: { vencidas, urgentes, no_prazo, total }
//   orquestrador (extrairAlertas)      → resumo: { obrigacoes_vencidas, sem_responsavel }
// Tabela: obrigacoes (status, vencimento, responsavel, cliente_nome, tipo, competencia)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing Supabase configuration" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const hoje    = new Date().toISOString().slice(0, 10);
    const em7dias = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    // Todas as obrigações ainda em aberto (não concluídas/canceladas)
    const { data: abertas, error: errAbertas } = await supabase
      .from("obrigacoes")
      .select("id, cliente_id, cliente_nome, tipo, competencia, vencimento, status, responsavel")
      .not("status", "in", "(concluida,cancelada)");
    if (errAbertas) throw errAbertas;

    const lista = abertas ?? [];
    const vencidas       = lista.filter(o => o.vencimento && o.vencimento < hoje);
    const urgentes       = lista.filter(o => o.vencimento && o.vencimento >= hoje && o.vencimento <= em7dias);
    const noPrazo        = lista.filter(o => o.vencimento && o.vencimento > em7dias);
    const semResponsavel = lista.filter(o => !o.responsavel || String(o.responsavel).trim() === "");

    // Log — obrigações vencidas (idempotente por dia: 1 log de ciclo, não 1 por item)
    await supabase.from("agente_logs").insert({
      agente: "FISCAL",
      acao: "CICLO_FISCAL",
      resultado: vencidas.length > 0 ? "ALERTA" : "OK",
      detalhes: {
        vencidas: vencidas.length,
        urgentes: urgentes.length,
        sem_responsavel: semResponsavel.length,
        total: lista.length,
        exemplos_vencidas: vencidas.slice(0, 10).map(o => ({
          cliente: o.cliente_nome, tipo: o.tipo, vencimento: o.vencimento, obrigacao_id: o.id,
        })),
      },
      executado_em: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        executado_em: new Date().toISOString(),
        resumo: {
          // chaves lidas pelo dashboard
          vencidas:  vencidas.length,
          urgentes:  urgentes.length,
          no_prazo:  noPrazo.length,
          total:     lista.length,
          // chaves lidas pelo orquestrador (extrairAlertas)
          obrigacoes_vencidas: vencidas.length,
          sem_responsavel:     semResponsavel.length,
        },
        alertas: [
          ...vencidas.map(o => ({
            tipo: "OBRIGACAO_VENCIDA",
            cliente: o.cliente_nome,
            obrigacao: o.tipo,
            vencimento: o.vencimento,
          })),
          ...urgentes.map(o => ({
            tipo: "OBRIGACAO_URGENTE",
            cliente: o.cliente_nome,
            obrigacao: o.tipo,
            vencimento: o.vencimento,
          })),
        ],
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

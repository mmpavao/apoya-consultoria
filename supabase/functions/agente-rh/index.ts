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
    const today = new Date();
    const mesAtual = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const hoje = today.toISOString().slice(0, 10);
    const trintaDias = new Date(today);
    trintaDias.setDate(today.getDate() + 30);
    const limite30d = trintaDias.toISOString().slice(0, 10);

    /* ── 1. Folhas em aberto ───────────────────────────── */
    const { data: folhasAbertas, error: errFolhas } = await supabase
      .from("folha_mensal")
      .select("id, empresa_id, competencia, status")
      .eq("status", "aberto");
    if (errFolhas) throw errFolhas;

    /* ── 2. Férias próximas (30 dias) ─────────────────── */
    const { data: feriasProximas, error: errFerias } = await supabase
      .from("ferias")
      .select("id, funcionario_id, empresa_id, gozo_inicio, gozo_fim, dias_gozo, status")
      .gte("gozo_inicio", hoje)
      .lte("gozo_inicio", limite30d)
      .eq("status", "aprovada");
    if (errFerias) throw errFerias;

    /* ── 3. Funcionários ativos ───────────────────────── */
    const { data: funcionariosAtivos, error: errFunc } = await supabase
      .from("funcionarios")
      .select("id, nome, empresa_id")
      .eq("status", "ativo");
    if (errFunc) throw errFunc;

    /* ── 4. Funcionários sem folha no mês atual ────────── */
    const empresasComFolhaMes = new Set(
      (folhasAbertas ?? [])
        .filter(f => f.competencia === mesAtual)
        .map(f => f.empresa_id)
    );
    const funcionariosSemFolha = (funcionariosAtivos ?? []).filter(
      f => !empresasComFolhaMes.has(f.empresa_id)
    ).length;

    /* ── 5. Logs para folhas em aberto ────────────────── */
    for (const folha of (folhasAbertas ?? [])) {
      await supabase.from("agente_logs").insert({
        agente: "RH",
        acao: "FOLHA_EM_ABERTO",
        resultado: "ALERTA",
        cliente_id: folha.empresa_id ?? null,
        detalhes: {
          competencia: folha.competencia,
          empresa_id: folha.empresa_id,
          folha_id: folha.id,
        },
      });
    }

    /* ── 6. Logs para férias próximas ─────────────────── */
    for (const ferias of (feriasProximas ?? [])) {
      await supabase.from("agente_logs").insert({
        agente: "RH",
        acao: "FERIAS_PROXIMAS",
        resultado: "ALERTA",
        cliente_id: ferias.empresa_id ?? null,
        detalhes: {
          funcionario_id: ferias.funcionario_id,
          gozo_inicio: ferias.gozo_inicio,
          gozo_fim: ferias.gozo_fim,
          dias_gozo: ferias.dias_gozo,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        executado_em: new Date().toISOString(),
        resumo: {
          folhas_abertas: (folhasAbertas ?? []).length,
          ferias_proximas_30d: (feriasProximas ?? []).length,
          funcionarios_sem_folha: funcionariosSemFolha,
          total_funcionarios_ativos: (funcionariosAtivos ?? []).length,
        },
        alertas: [
          ...(folhasAbertas ?? []).map(f => ({
            tipo: "FOLHA_EM_ABERTO",
            empresa_id: f.empresa_id,
            competencia: f.competencia,
          })),
          ...(feriasProximas ?? []).map(f => ({
            tipo: "FERIAS_PROXIMAS",
            funcionario_id: f.funcionario_id,
            gozo_inicio: f.gozo_inicio,
            dias_gozo: f.dias_gozo,
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

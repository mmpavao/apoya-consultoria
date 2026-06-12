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
    const hoje = new Date().toISOString().slice(0, 10);
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const em7dias = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    /* ── 1. Cobranças vencidas (não pagas, não canceladas) ── */
    const { data: vencidas, error: errVenc } = await supabase
      .from("cobrancas")
      .select("id, cliente_id, cliente_nome, valor, vencimento, dias_atraso, status, regua_stage")
      .not("status", "in", "(paga,cancelada)")
      .lt("vencimento", hoje);
    if (errVenc) throw errVenc;

    /* ── 2. Cobranças vencendo hoje ou amanhã ─────────────── */
    const { data: vencendoHoje, error: errHoje } = await supabase
      .from("cobrancas")
      .select("id, cliente_id, cliente_nome, valor, vencimento, status")
      .not("status", "in", "(paga,cancelada)")
      .gte("vencimento", hoje)
      .lte("vencimento", amanha);
    if (errHoje) throw errHoje;

    /* ── 3. Cobranças vencendo em até 7 dias ──────────────── */
    const { data: vencendo7d, error: err7d } = await supabase
      .from("cobrancas")
      .select("id, cliente_id, cliente_nome, valor, vencimento, status")
      .not("status", "in", "(paga,cancelada)")
      .gt("vencimento", amanha)
      .lte("vencimento", em7dias);
    if (err7d) throw err7d;

    /* ── 4. Honorários recebidos no mês atual ─────────────── */
    const mesAtual = hoje.slice(0, 7);
    const { data: pagasMes, error: errPagas } = await supabase
      .from("cobrancas")
      .select("valor, competencia")
      .eq("status", "paga")
      .like("competencia", `${mesAtual}%`);
    if (errPagas) throw errPagas;

    const honorariosMes = (pagasMes ?? []).reduce((s, c) => s + Number(c.valor ?? 0), 0);

    /* ── 5. NFS-e com erro pendente ───────────────────────── */
    const { data: nfseErro, error: errNfse } = await supabase
      .from("nfse_emitida")
      .select("id, cliente_id, tomador_nome, valor_servico, status, erro_msg")
      .eq("status", "erro");
    if (errNfse) throw errNfse;

    /* ── 6. Logs — cobranças vencidas ─────────────────────── */
    for (const cob of (vencidas ?? [])) {
      await supabase.from("agente_logs").insert({
        agente: "FINANCEIRO",
        acao: "COBRANCA_VENCIDA",
        resultado: "ALERTA",
        cliente_id: cob.cliente_id ?? null,
        detalhes: {
          cliente_nome: cob.cliente_nome,
          valor: cob.valor,
          vencimento: cob.vencimento,
          dias_atraso: cob.dias_atraso,
          regua_stage: cob.regua_stage,
          cobranca_id: cob.id,
        },
      });
    }

    /* ── 7. Logs — NFS-e com erro ─────────────────────────── */
    for (const nf of (nfseErro ?? [])) {
      await supabase.from("agente_logs").insert({
        agente: "FINANCEIRO",
        acao: "NFSE_ERRO",
        resultado: "ALERTA",
        cliente_id: nf.cliente_id ?? null,
        detalhes: {
          tomador_nome: nf.tomador_nome,
          valor_servico: nf.valor_servico,
          erro_msg: nf.erro_msg,
          nfse_id: nf.id,
        },
      });
    }

    /* ── 8. Logs — vencendo hoje ──────────────────────────── */
    for (const cob of (vencendoHoje ?? [])) {
      await supabase.from("agente_logs").insert({
        agente: "FINANCEIRO",
        acao: "VENCENDO_HOJE",
        resultado: "ALERTA",
        cliente_id: cob.cliente_id ?? null,
        detalhes: {
          cliente_nome: cob.cliente_nome,
          valor: cob.valor,
          vencimento: cob.vencimento,
          cobranca_id: cob.id,
        },
      });
    }

    const totalVencido = (vencidas ?? []).reduce((s, c) => s + Number(c.valor ?? 0), 0);

    return new Response(
      JSON.stringify({
        success: true,
        executado_em: new Date().toISOString(),
        resumo: {
          cobrancas_vencidas:   (vencidas ?? []).length,
          total_vencido_brl:    totalVencido,
          vencendo_hoje:        (vencendoHoje ?? []).length,
          vencendo_7d:          (vencendo7d ?? []).length,
          honorarios_mes_brl:   honorariosMes,
          nfse_com_erro:        (nfseErro ?? []).length,
        },
        alertas: [
          ...(vencidas ?? []).map(c => ({
            tipo: "COBRANCA_VENCIDA",
            cliente: c.cliente_nome,
            valor: c.valor,
            vencimento: c.vencimento,
            dias_atraso: c.dias_atraso,
          })),
          ...(vencendoHoje ?? []).map(c => ({
            tipo: "VENCENDO_HOJE",
            cliente: c.cliente_nome,
            valor: c.valor,
            vencimento: c.vencimento,
          })),
          ...(nfseErro ?? []).map(n => ({
            tipo: "NFSE_ERRO",
            tomador: n.tomador_nome,
            valor: n.valor_servico,
            erro: n.erro_msg,
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

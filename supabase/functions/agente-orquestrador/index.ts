import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function chamarAgente(slug: string): Promise<{ agente: string; success: boolean; alertas: number; resumo: Record<string, unknown>; erro?: string }> {
  const url = `${SUPABASE_URL}/functions/v1/${slug}`;
  try {
    // Chamada interna autenticada com a service-role (defesa em profundidade:
    // funciona com verify_jwt on ou off).
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { agente: slug, success: data.success ?? false, alertas: data.alertas?.length ?? 0, resumo: data.resumo ?? {} };
  } catch (e) {
    return { agente: slug, success: false, alertas: 0, resumo: {}, erro: e instanceof Error ? e.message : String(e) };
  }
}

interface AlertaCritico { agente: string; tipo: string; mensagem: string; prioridade: string; dados?: Record<string, unknown>; }

function extrairAlertas(r: { agente: string; resumo: Record<string, unknown> }): AlertaCritico[] {
  const alertas: AlertaCritico[] = [];
  const m = r.resumo;
  if (r.agente === "agente-fiscal") {
    const v = Number(m.obrigacoes_vencidas ?? 0);
    if (v > 0) alertas.push({ agente: "FISCAL", tipo: "OBRIGACOES_VENCIDAS", mensagem: `${v} obrigação(ões) fiscal(is) vencida(s)`, prioridade: v >= 5 ? "critica" : "alta", dados: { total: v } });
    const s = Number(m.sem_responsavel ?? 0);
    if (s > 0) alertas.push({ agente: "FISCAL", tipo: "SEM_RESPONSAVEL", mensagem: `${s} obrigação(ões) sem responsável`, prioridade: "alta", dados: { total: s } });
  }
  if (r.agente === "agente-rh") {
    const f = Number(m.folhas_abertas ?? 0);
    if (f > 0) alertas.push({ agente: "RH", tipo: "FOLHAS_ABERTAS", mensagem: `${f} folha(s) não processada(s)`, prioridade: f >= 3 ? "critica" : "alta", dados: { total: f } });
    const fe = Number(m.ferias_proximas_30d ?? 0);
    if (fe > 0) alertas.push({ agente: "RH", tipo: "FERIAS_PROXIMAS", mensagem: `${fe} funcionário(s) com férias vencendo em 30d`, prioridade: "media", dados: { total: fe } });
  }
  if (r.agente === "agente-financeiro") {
    const v = Number(m.cobrancas_vencidas ?? 0);
    if (v > 0) alertas.push({ agente: "FINANCEIRO", tipo: "COBRANCAS_VENCIDAS", mensagem: `${v} cobrança(s) vencida(s) — R$ ${Number(m.total_vencido_brl ?? 0).toFixed(2)}`, prioridade: v >= 5 ? "critica" : "alta", dados: { total: v } });
    const n = Number(m.nfse_com_erro ?? 0);
    if (n > 0) alertas.push({ agente: "FINANCEIRO", tipo: "NFSE_ERRO", mensagem: `${n} NFS-e com erro de emissão`, prioridade: "alta", dados: { total: n } });
    const h = Number(m.vencendo_hoje ?? 0);
    if (h > 0) alertas.push({ agente: "FINANCEIRO", tipo: "VENCENDO_HOJE", mensagem: `${h} cobrança(s) vencendo hoje`, prioridade: "media", dados: { total: h } });
  }
  return alertas;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ success: false, error: "ENV ausentes" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;
  const inicio = Date.now();

  // 1. Executar 3 agentes em paralelo
  const [fiscal, rh, financeiro] = await Promise.all([
    chamarAgente("agente-fiscal"),
    chamarAgente("agente-rh"),
    chamarAgente("agente-financeiro"),
  ]);

  // 2. Consolidar alertas
  const todos: AlertaCritico[] = [fiscal, rh, financeiro].flatMap(extrairAlertas);
  const criticos = todos.filter(a => a.prioridade === "critica");
  const altos    = todos.filter(a => a.prioridade === "alta");
  const medios   = todos.filter(a => a.prioridade === "media");

  // 3. Criar tarefas automáticas para CRÍTICOS — IDEMPOTENTE.
  //    Dedup por (agente, tipo): se já existe uma tarefa [AUTO] aberta para o
  //    mesmo alerta, não recria (evita duplicar a cada ciclo/cron).
  const tarefasCriadas: string[] = [];
  const abertasKeys = new Set<string>();
  try {
    const { data: abertas } = await supabase.from("tarefas")
      .select("metadados, descricao")
      .eq("criado_por", "agente-orquestrador")
      .not("status", "in", "(concluida,cancelada)");
    for (const t of (abertas ?? []) as { metadados?: { dedup_key?: string }; descricao?: string }[]) {
      const k = t.metadados?.dedup_key;
      if (k) { abertasKeys.add(k); continue; }
      // fallback p/ tarefas legadas (sem dedup_key): extrai de "Agente: X | Tipo: Y"
      const m = (t.descricao ?? "").match(/Agente:\s*(\w+)\s*\|\s*Tipo:\s*(\w+)/);
      if (m) abertasKeys.add(`${m[1]}:${m[2]}`);
    }
  } catch (_) { /* sem leitura → segue e tenta criar */ }

  for (const alerta of criticos) {
    // Um dono por tarefa: setores com EXPERT EXECUTOR próprio gerenciam o
    // próprio pipeline (granular). O orquestrador não cria tarefa agregada p/
    // eles — só consolida/reflete. (FINANCEIRO já é executor; outros entram
    // nesta lista conforme viram experts.)
    if (alerta.agente === "FINANCEIRO") continue;
    const dedupKey = `${alerta.agente}:${alerta.tipo}`;
    if (abertasKeys.has(dedupKey)) continue; // já existe tarefa aberta p/ este alerta
    try {
      await supabase.from("tarefas").insert({
        titulo: `[AUTO] ${alerta.mensagem}`,
        descricao: `Criado pelo Orquestrador em ${new Date().toISOString().slice(0, 10)}. Agente: ${alerta.agente} | Tipo: ${alerta.tipo}`,
        tipo: alerta.agente === "FISCAL" ? "fiscal" : alerta.agente === "RH" ? "dp" : "financeiro",
        status: "aberta",
        prioridade: "critica",
        responsavel: "Orquestrador",
        responsavel_tipo: "agente",
        criado_por: "agente-orquestrador",
        criado_por_tipo: "agente",
        requer_aprovacao: false,
        metadados: { origem: "orquestrador", agente: alerta.agente, tipo: alerta.tipo, dedup_key: dedupKey },
      });
      abertasKeys.add(dedupKey); // evita duplicar no mesmo ciclo também
      tarefasCriadas.push(alerta.mensagem);
    } catch (_) { /* silencioso */ }
  }

  // 4. Log do ciclo
  await supabase.from("agente_logs").insert({
    agente: "ORQUESTRADOR",
    acao: "CICLO_COMPLETO",
    // coluna real é 'detalhes' (jsonb) — não 'detalhe'
    detalhes: {
      duracao_ms: Date.now() - inicio,
      agentes: [fiscal, rh, financeiro].map(r => ({ agente: r.agente, success: r.success, alertas: r.alertas })),
      criticos: criticos.length, altos: altos.length, medios: medios.length,
      tarefas_criadas: tarefasCriadas.length,
    },
    executado_em: new Date().toISOString(),
  });

  return new Response(JSON.stringify({
    success: true,
    executado_em: new Date().toISOString(),
    duracao_ms: Date.now() - inicio,
    agentes: {
      fiscal:     { success: fiscal.success,     alertas: fiscal.alertas,     resumo: fiscal.resumo },
      rh:         { success: rh.success,         alertas: rh.alertas,         resumo: rh.resumo },
      financeiro: { success: financeiro.success, alertas: financeiro.alertas, resumo: financeiro.resumo },
    },
    // Contrato lido pelo dashboard (_app.index.tsx): resultados.X.alertas_gerados
    resultados: {
      fiscal:     { alertas_gerados: fiscal.alertas,     success: fiscal.success,     resumo: fiscal.resumo },
      rh:         { alertas_gerados: rh.alertas,         success: rh.success,         resumo: rh.resumo },
      financeiro: { alertas_gerados: financeiro.alertas, success: financeiro.success, resumo: financeiro.resumo },
    },
    consolidado: {
      total_alertas: todos.length,
      criticos: criticos.length,
      altos: altos.length,
      medios: medios.length,
      tarefas_criadas_automaticamente: tarefasCriadas.length,
    },
    alertas_criticos: criticos,
    alertas_altos:    altos,
    alertas_medios:   medios,
    tarefas_criadas:  tarefasCriadas,
  }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
});

// Orquestrador (supervisor) do time APOYA.
// Delega aos 5 experts por setor (fan-out), consolida alertas, REFLETE sobre a
// meta e registra o run guarda-chuva. Orçamento global (max_steps/tempo).
// Cada expert é DONO do próprio pipeline (um dono por tarefa) — o orquestrador
// não cria tarefa de setor com expert; só consolida + coordena.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Orçamento GLOBAL do time (não por agente).
const MAX_STEPS = 8;            // teto de invocações de agente por ciclo
const TIME_BUDGET_MS = 90_000;  // teto de tempo do ciclo

// Os 5 setores com pipeline + expert executor. Todos são EXPERT_SECTORS:
// donos do próprio pipeline (o orquestrador não cria tarefa agregada p/ eles).
const AGENTES = ["agente-fiscal", "agente-rh", "agente-financeiro", "agente-contabil", "agente-societario"];
const EXPERT_SECTORS = new Set(["FISCAL", "RH", "FINANCEIRO", "CONTABIL", "SOCIETARIO"]);

async function chamarAgente(slug: string): Promise<{ agente: string; success: boolean; alertas: number; resumo: Record<string, unknown>; erro?: string }> {
  const url = `${SUPABASE_URL}/functions/v1/${slug}`;
  try {
    // Chamada interna autenticada com service-role (defesa em profundidade).
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
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
  const a: AlertaCritico[] = [];
  const m = r.resumo;
  if (r.agente === "agente-fiscal") {
    const v = Number(m.obrigacoes_vencidas ?? 0);
    if (v > 0) a.push({ agente: "FISCAL", tipo: "OBRIGACOES_VENCIDAS", mensagem: `${v} obrigação(ões) fiscal(is) vencida(s)`, prioridade: v >= 5 ? "critica" : "alta", dados: { total: v } });
    const s = Number(m.sem_responsavel ?? 0);
    if (s > 0) a.push({ agente: "FISCAL", tipo: "SEM_RESPONSAVEL", mensagem: `${s} obrigação(ões) sem responsável`, prioridade: "alta", dados: { total: s } });
  }
  if (r.agente === "agente-rh") {
    const f = Number(m.folhas_abertas ?? 0);
    if (f > 0) a.push({ agente: "RH", tipo: "FOLHAS_ABERTAS", mensagem: `${f} folha(s) não processada(s)`, prioridade: f >= 3 ? "critica" : "alta", dados: { total: f } });
    const fe = Number(m.ferias_proximas_30d ?? 0);
    if (fe > 0) a.push({ agente: "RH", tipo: "FERIAS_PROXIMAS", mensagem: `${fe} funcionário(s) com férias vencendo em 30d`, prioridade: "media", dados: { total: fe } });
  }
  if (r.agente === "agente-financeiro") {
    const v = Number(m.cobrancas_vencidas ?? 0);
    if (v > 0) a.push({ agente: "FINANCEIRO", tipo: "COBRANCAS_VENCIDAS", mensagem: `${v} cobrança(s) vencida(s) — R$ ${Number(m.total_vencido_brl ?? 0).toFixed(2)}`, prioridade: v >= 5 ? "critica" : "alta", dados: { total: v } });
    const n = Number(m.nfse_com_erro ?? 0);
    if (n > 0) a.push({ agente: "FINANCEIRO", tipo: "NFSE_ERRO", mensagem: `${n} NFS-e com erro de emissão`, prioridade: "alta", dados: { total: n } });
  }
  if (r.agente === "agente-contabil") {
    const p = Number(m.periodos_abertos ?? 0);
    if (p > 0) a.push({ agente: "CONTABIL", tipo: "PERIODOS_ABERTOS", mensagem: `${p} período(s) contábil(is) em aberto`, prioridade: p >= 5 ? "critica" : "media", dados: { total: p } });
  }
  if (r.agente === "agente-societario") {
    const at = Number(m.processos_atrasados ?? 0);
    if (at > 0) a.push({ agente: "SOCIETARIO", tipo: "PROCESSOS_ATRASADOS", mensagem: `${at} processo(s) societário(s) atrasado(s)`, prioridade: at >= 3 ? "critica" : "alta", dados: { total: at } });
  }
  return a;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ success: false, error: "ENV ausentes" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) as any;
  const inicio = Date.now();

  // 1. DELEGAÇÃO — fan-out aos experts, respeitando o orçamento global de steps.
  const aChamar = AGENTES.slice(0, MAX_STEPS);
  const resultados = await Promise.all(aChamar.map(chamarAgente));
  const byKey: Record<string, { success: boolean; alertas: number; resumo: Record<string, unknown>; erro?: string }> = {};
  for (const r of resultados) byKey[r.agente.replace("agente-", "")] = r;

  // 2. CONSOLIDAÇÃO de alertas
  const todos    = resultados.flatMap(extrairAlertas);
  const criticos = todos.filter(a => a.prioridade === "critica");
  const altos    = todos.filter(a => a.prioridade === "alta");
  const medios   = todos.filter(a => a.prioridade === "media");

  // 3. Tarefas agregadas só p/ setores SEM expert (hoje: nenhum — todos têm).
  //    Idempotente por (agente, tipo). Mantido p/ setores futuros sem expert.
  const tarefasCriadas: string[] = [];
  const abertasKeys = new Set<string>();
  try {
    const { data: abertas } = await supabase.from("tarefas")
      .select("metadados, descricao").eq("criado_por", "agente-orquestrador")
      .not("status", "in", "(concluida,cancelada)");
    for (const t of (abertas ?? []) as { metadados?: { dedup_key?: string }; descricao?: string }[]) {
      const k = t.metadados?.dedup_key;
      if (k) { abertasKeys.add(k); continue; }
      const mm = (t.descricao ?? "").match(/Agente:\s*(\w+)\s*\|\s*Tipo:\s*(\w+)/);
      if (mm) abertasKeys.add(`${mm[1]}:${mm[2]}`);
    }
  } catch (_) { /* segue */ }
  for (const alerta of criticos) {
    if (EXPERT_SECTORS.has(alerta.agente)) continue;
    const dedupKey = `${alerta.agente}:${alerta.tipo}`;
    if (abertasKeys.has(dedupKey)) continue;
    try {
      await supabase.from("tarefas").insert({
        titulo: `[AUTO] ${alerta.mensagem}`,
        descricao: `Criado pelo Orquestrador em ${new Date().toISOString().slice(0, 10)}. Agente: ${alerta.agente} | Tipo: ${alerta.tipo}`,
        tipo: "outros", status: "aberta", prioridade: "critica",
        responsavel: "Orquestrador", responsavel_tipo: "agente",
        criado_por: "agente-orquestrador", criado_por_tipo: "agente", requer_aprovacao: false,
        metadados: { origem: "orquestrador", agente: alerta.agente, tipo: alerta.tipo, dedup_key: dedupKey },
      });
      abertasKeys.add(dedupKey); tarefasCriadas.push(alerta.mensagem);
    } catch (_) { /* silencioso */ }
  }

  // 4. REFLEXÃO — a meta (todos os setores triados sem erro) foi atingida?
  const duracao_ms   = Date.now() - inicio;
  const setoresFalha = resultados.filter(r => !r.success).map(r => ({ agente: r.agente, erro: r.erro }));
  const reflexao = {
    meta: "Todos os setores triados sem erro, dentro do orçamento",
    meta_atingida: setoresFalha.length === 0 && duracao_ms <= TIME_BUDGET_MS,
    setores_ok: resultados.filter(r => r.success).length,
    setores_total: resultados.length,
    setores_falha: setoresFalha,
    dentro_do_orcamento: duracao_ms <= TIME_BUDGET_MS,
    total_tarefas_triadas: resultados.reduce((s, r) => s + (Number(r.resumo?.tarefas_criadas ?? 0)), 0),
  };

  // 5. Run guarda-chuva do time
  await supabase.from("agente_logs").insert({
    agente: "agente-orquestrador", acao: "CICLO_COMPLETO",
    // resultado tem CHECK: 'sucesso' | 'erro' | 'parcial'
    resultado: reflexao.meta_atingida ? "sucesso" : "parcial",
    detalhes: {
      duracao_ms, max_steps: MAX_STEPS, steps_usados: aChamar.length,
      agentes: resultados.map(r => ({ agente: r.agente, success: r.success, alertas: r.alertas, erro: r.erro })),
      criticos: criticos.length, altos: altos.length, medios: medios.length,
      reflexao,
    },
    executado_em: new Date().toISOString(),
  });

  // resultados.X.alertas_gerados é o contrato lido pelo dashboard
  const resultadosOut: Record<string, unknown> = {};
  const agentesOut: Record<string, unknown> = {};
  for (const [k, r] of Object.entries(byKey)) {
    resultadosOut[k] = { alertas_gerados: r.alertas, success: r.success, resumo: r.resumo };
    agentesOut[k]    = { success: r.success, alertas: r.alertas, resumo: r.resumo };
  }

  return new Response(JSON.stringify({
    success: true,
    executado_em: new Date().toISOString(),
    duracao_ms,
    agentes: agentesOut,
    resultados: resultadosOut,
    consolidado: { total_alertas: todos.length, criticos: criticos.length, altos: altos.length, medios: medios.length, tarefas_criadas_automaticamente: tarefasCriadas.length },
    reflexao,
    alertas_criticos: criticos, alertas_altos: altos, alertas_medios: medios,
    tarefas_criadas: tarefasCriadas,
  }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
});

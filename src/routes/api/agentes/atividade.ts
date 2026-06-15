/**
 * GET /api/agentes/atividade?setor=fiscal
 * Atividade do agente do setor — lê agente_logs com service role (a RLS bloqueia
 * leitura direta pelo usuário). Retorna o status do agente + feed de atividades
 * no formato consumido pelo ModuleDashboard.
 *
 * Auth: qualquer usuário autenticado (logs operacionais, sem PII sensível).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// setor (rota) → valor real de agente_logs.agente gravado pelos experts
const SETOR_AGENTE: Record<string, string> = {
  fiscal: "FISCAL", financeiro: "FINANCEIRO", dp: "RH", contabil: "CONTABIL", societario: "SOCIETARIO",
};

// resultado do banco → status do ModuleDashboard
function mapStatus(r?: string): "ok" | "erro" | "aviso" | "info" {
  if (r === "sucesso") return "ok";
  if (r === "erro") return "erro";
  if (r === "parcial") return "aviso";
  return "info";
}

// Resumo legível do que o agente fez (a partir de detalhes jsonb)
function descreve(d: Record<string, any> | null | undefined): string {
  if (!d || typeof d !== "object") return "";
  const partes: string[] = [];
  if (d.tarefas_criadas != null) partes.push(`${d.tarefas_criadas} tarefa(s) criada(s)`);
  if (d.vencidas != null) partes.push(`${d.vencidas} vencida(s)`);
  if (d.folhas_abertas != null) partes.push(`${d.folhas_abertas} folha(s) aberta(s)`);
  if (d.periodos_abertos != null) partes.push(`${d.periodos_abertos} período(s) aberto(s)`);
  if (d.processos_atrasados != null) partes.push(`${d.processos_atrasados} processo(s) atrasado(s)`);
  if (d.cobrancas_vencidas != null) partes.push(`${d.cobrancas_vencidas} cobrança(s) vencida(s)`);
  return partes.join(" · ");
}

const ACAO_LABEL: Record<string, string> = {
  TRIAGEM_OBRIGACOES: "Triagem de obrigações",
  TRIAGEM_COBRANCAS: "Triagem de cobranças",
  TRIAGEM_FOLHAS: "Triagem de folhas",
  TRIAGEM_PERIODOS: "Triagem de períodos",
  MONITORAMENTO_PROCESSOS: "Monitoramento de processos",
  CICLO_COMPLETO: "Ciclo do orquestrador",
};

export const Route = createFileRoute("/api/agentes/atividade")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        // Auth: exige usuário autenticado
        const token = (request.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
        if (!token) return json({ error: "Não autenticado" }, 401);
        const { data: u, error: uErr } = await (supabaseAdmin as any).auth.getUser(token);
        if (uErr || !u?.user) return json({ error: "Sessão inválida" }, 401);

        const url = new URL(request.url);
        const setor = url.searchParams.get("setor") ?? "";
        const agenteNome = SETOR_AGENTE[setor];
        if (!agenteNome) return json({ error: "setor inválido" }, 400);

        const db = supabaseAdmin as any;
        const { data: rows, error } = await db
          .from("agente_logs")
          .select("id, agente, acao, resultado, detalhes, executado_em")
          .eq("agente", agenteNome)
          .order("executado_em", { ascending: false })
          .limit(10);
        if (error) return json({ error: error.message }, 502);

        const lista = rows ?? [];
        const ultimo = lista[0];

        return json({
          agente: ultimo
            ? {
                ultima_execucao: ultimo.executado_em,
                ultimo_resultado: mapStatus(ultimo.resultado),
                total_alertas: ultimo.detalhes?.tarefas_criadas
                  ?? ultimo.detalhes?.vencidas
                  ?? ultimo.detalhes?.processos_atrasados
                  ?? ultimo.detalhes?.folhas_abertas
                  ?? ultimo.detalhes?.periodos_abertos
                  ?? null,
              }
            : null,
          logs: lista.map((r: any) => ({
            id: r.id,
            label: ACAO_LABEL[r.acao] ?? r.acao,
            descricao: descreve(r.detalhes),
            status: mapStatus(r.resultado),
            ts: r.executado_em,
          })),
        });
      },
    },
  },
});

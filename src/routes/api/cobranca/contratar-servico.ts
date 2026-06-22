/**
 * POST /api/cobranca/contratar-servico
 * Associa um serviço do catálogo a um cliente.
 * Auth: staff financeiro (admin, contador, supervisor).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse, requireFinanceStaff } from "@/lib/api-auth";

export const Route = createFileRoute("/api/cobranca/contratar-servico")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireFinanceStaff(request);
        if (auth instanceof Response) return auth;

        let body: {
          cliente_id: string;
          catalogo_id: string;
          valor_contratado?: number;
          desconto?: number;
          periodicidade?: string;
          data_inicio?: string;
          data_fim?: string;
          observacoes?: string;
        };
        try { body = await request.json(); }
        catch { return jsonResponse({ error: "Body inválido" }, 400); }

        const { cliente_id, catalogo_id } = body;
        if (!cliente_id || !catalogo_id) {
          return jsonResponse({ error: "cliente_id e catalogo_id são obrigatórios" }, 400);
        }

        const db = supabaseAdmin as any;

        const { data: contrato } = await db
          .from("contrato_cliente")
          .select("id,status,titulo")
          .eq("cliente_id", cliente_id)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle();

        if (!contrato) {
          return jsonResponse({
            error: "Cliente não possui contrato ativo. Assine o contrato de prestação de serviços antes de contratar serviços avulsos.",
            code: "SEM_CONTRATO",
          }, 409);
        }

        const { data: cat } = await db
          .from("servico_catalogo")
          .select("*").eq("id", catalogo_id).single();
        if (!cat) return jsonResponse({ error: "Serviço não encontrado no catálogo" }, 404);

        const { data: cli } = await db
          .from("clientes")
          .select("id,razao_social,cnpj,dia_vencimento")
          .eq("id", cliente_id).single();
        if (!cli) return jsonResponse({ error: "Cliente não encontrado" }, 404);

        const desconto      = body.desconto ?? 0;
        const valorContrat  = body.valor_contratado ?? cat.valor_padrao ?? 0;
        const periodicidade = (body.periodicidade ?? "mensal") as string;
        const dataInicio    = body.data_inicio ?? new Date().toISOString().split("T")[0];

        const { data: cs, error: csErr } = await db
          .from("cliente_servico")
          .insert({
            cliente_id,
            catalogo_id,
            nome_servico:     cat.nome,
            valor_contratado: valorContrat,
            desconto,
            periodicidade,
            data_inicio:      dataInicio,
            data_fim:         body.data_fim ?? null,
            status:           "ativo",
            observacoes:      body.observacoes ?? null,
          })
          .select()
          .single();

        if (csErr) {
          console.error("[contratar-servico] Erro insert cliente_servico:", JSON.stringify(csErr));
          return jsonResponse({ error: csErr.message, details: csErr.details, hint: csErr.hint }, 500);
        }

        return jsonResponse({ ok: true, cliente_servico: cs, contrato_id: contrato.id });
      },
    },
  },
});

/**
 * POST /api/cobranca/criar
 * Cria uma cobrança no banco de dados (sem emitir no Asaas ainda).
 *
 * REGRA: cliente DEVE ter contrato ativo (contrato_cliente.status=ativo).
 * Auth: staff financeiro (admin, contador, supervisor).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse, requireFinanceStaff } from "@/lib/api-auth";

export const Route = createFileRoute("/api/cobranca/criar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireFinanceStaff(request);
        if (auth instanceof Response) return auth;

        let body: {
          cliente_id: string;
          valor: number;
          competencia?: string;
          vencimento?: string;
          descricao?: string;
          forma?: string;
          recorrente?: boolean;
        };
        try { body = await request.json(); }
        catch { return jsonResponse({ error: "Body inválido" }, 400); }

        const { cliente_id, valor, descricao, forma = "UNDEFINED", recorrente = false } = body;
        if (!cliente_id || !valor) return jsonResponse({ error: "cliente_id e valor são obrigatórios" }, 400);

        const db = supabaseAdmin as any;

        const { data: contrato } = await db
          .from("contrato_cliente")
          .select("id,status")
          .eq("cliente_id", cliente_id)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle();

        if (!contrato) {
          return jsonResponse({
            error: "Cliente não possui contrato ativo. Assine o contrato de prestação de serviços antes de gerar cobranças.",
            code: "SEM_CONTRATO",
          }, 409);
        }

        const { data: cliente, error: cErr } = await db
          .from("clientes")
          .select("id,razao_social,cnpj,dia_vencimento,regime")
          .eq("id", cliente_id)
          .single();

        if (cErr || !cliente) return jsonResponse({ error: "Cliente não encontrado" }, 404);

        const now  = new Date();
        const comp = body.competencia ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        const [ano, mes] = comp.split("-").map(Number);
        const diaVenc    = cliente.dia_vencimento ?? 10;
        const vencimento = body.vencimento ?? new Date(ano, mes - 1, diaVenc).toISOString().split("T")[0];

        const { data: existente } = await db
          .from("cobrancas")
          .select("id,status")
          .eq("cliente_id", cliente_id)
          .eq("competencia", comp)
          .not("status", "eq", "cancelada")
          .maybeSingle();

        if (existente) {
          return jsonResponse({ error: `Cobrança já existe para ${comp}`, cobranca_id: existente.id, status: existente.status }, 409);
        }

        const desc = descricao ?? `Mensalidade APOYA — ${comp}`;

        const { data: nova, error: iErr } = await db.from("cobrancas").insert({
          cliente_id,
          cliente_nome: cliente.razao_social,
          cnpj:         cliente.cnpj,
          descricao:    desc,
          valor,
          forma,
          vencimento,
          competencia:  comp,
          status:       "pendente",
          regua_stage:  "ok",
          dias_atraso:  0,
          recorrente,
        }).select().single();

        if (iErr) return jsonResponse({ error: iErr.message }, 500);

        return jsonResponse({ ok: true, cobranca: nova });
      },
    },
  },
});

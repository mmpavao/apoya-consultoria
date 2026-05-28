/**
 * POST /api/cobranca/contratar-servico
 * Associa um serviço do catálogo a um cliente e cria a primeira cobrança pendente.
 *
 * Body:
 *   cliente_id    : uuid
 *   catalogo_id   : uuid (do servico_catalogo)
 *   valor_acordado?: number  (se omitir, usa valor_padrao do catálogo)
 *   periodicidade?: "mensal" | "avulso" | "anual"
 *   data_inicio?  : "YYYY-MM-DD"
 *   observacoes?  : string
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromReq(req: Request) {
  const auth  = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export const Route = createFileRoute("/api/cobranca/contratar-servico")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getUserFromReq(request);
        if (!user) return json({ error: "Unauthorized" }, 401);

        let body: {
          cliente_id: string;
          catalogo_id: string;
          valor_acordado?: number;
          periodicidade?: string;
          data_inicio?: string;
          observacoes?: string;
        };
        try { body = await request.json(); }
        catch { return json({ error: "Body inválido" }, 400); }

        const { cliente_id, catalogo_id, periodicidade = "mensal", observacoes } = body;
        if (!cliente_id || !catalogo_id) return json({ error: "cliente_id e catalogo_id são obrigatórios" }, 400);

        const db = supabaseAdmin as any;

        // Buscar catálogo
        const { data: cat } = await db.from("servico_catalogo")
          .select("*").eq("id", catalogo_id).single();
        if (!cat) return json({ error: "Serviço não encontrado no catálogo" }, 404);

        // Buscar cliente
        const { data: cli } = await db.from("clientes")
          .select("id,razao_social,cnpj,dia_vencimento").eq("id", cliente_id).single();
        if (!cli) return json({ error: "Cliente não encontrado" }, 404);

        const valorFinal = body.valor_acordado ?? cat.valor_padrao ?? 0;
        const dataInicio = body.data_inicio ?? new Date().toISOString().split("T")[0];

        // Criar relacionamento cliente_servico
        const { data: cs, error: csErr } = await db.from("cliente_servico").insert({
          cliente_id,
          catalogo_id,
          nome_servico:     cat.nome,
          valor_contratado: cat.valor_padrao ?? 0,
          desconto:         0,
          valor_final:      valorFinal,
          periodicidade,
          data_inicio:      dataInicio,
          status:           "ativo",
          observacoes:      observacoes ?? null,
        }).select().single();

        if (csErr) return json({ error: csErr.message }, 500);

        // Se mensal, criar cobrança do mês corrente
        let cobranca = null;
        if (periodicidade === "mensal") {
          const now = new Date();
          const comp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const diaVenc = cli.dia_vencimento ?? 10;
          const vencimento = new Date(now.getFullYear(), now.getMonth(), diaVenc)
            .toISOString().split("T")[0];

          const { data: cob } = await db.from("cobrancas").insert({
            cliente_id,
            cliente_nome:     cli.razao_social,
            cnpj:             cli.cnpj,
            descricao:        `${cat.nome} — ${comp}`,
            valor:            valorFinal,
            forma:            "UNDEFINED",
            vencimento,
            competencia:      comp,
            status:           "pendente",
            regua_stage:      "ok",
            dias_atraso:      0,
            created_by:       user.id,
          }).select().single();

          cobranca = cob;
        }

        return json({ ok: true, cliente_servico: cs, cobranca });
      },
    },
  },
});

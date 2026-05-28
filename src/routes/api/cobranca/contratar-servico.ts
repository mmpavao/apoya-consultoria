/**
 * POST /api/cobranca/contratar-servico
 * Associa um serviço do catálogo a um cliente.
 *
 * REGRA DE NEGÓCIO: Cliente DEVE ter contrato ativo (contrato_cliente.status=ativo).
 * Sem contrato → 409 com mensagem clara.
 *
 * Body:
 *   cliente_id      : uuid
 *   catalogo_id     : uuid
 *   valor_contratado?: number  (se omitir, usa valor_padrao do catálogo)
 *   desconto?       : number   (default 0)
 *   periodicidade?  : "mensal" | "avulso" | "anual"
 *   data_inicio?    : "YYYY-MM-DD"
 *   observacoes?    : string
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
          valor_contratado?: number;
          desconto?: number;
          periodicidade?: string;
          data_inicio?: string;
          data_fim?: string;
          observacoes?: string;
        };
        try { body = await request.json(); }
        catch { return json({ error: "Body inválido" }, 400); }

        const { cliente_id, catalogo_id } = body;
        if (!cliente_id || !catalogo_id) {
          return json({ error: "cliente_id e catalogo_id são obrigatórios" }, 400);
        }

        const db = supabaseAdmin as any;

        // ── REGRA: verificar contrato ativo ─────────────────────────────
        const { data: contrato } = await db
          .from("contrato_cliente")
          .select("id,status,titulo")
          .eq("cliente_id", cliente_id)
          .eq("status", "ativo")
          .limit(1)
          .maybeSingle();

        if (!contrato) {
          return json({
            error: "Cliente não possui contrato ativo. Assine o contrato de prestação de serviços antes de contratar serviços avulsos.",
            code: "SEM_CONTRATO",
          }, 409);
        }

        // ── Buscar catálogo ─────────────────────────────────────────────
        const { data: cat } = await db
          .from("servico_catalogo")
          .select("*").eq("id", catalogo_id).single();
        if (!cat) return json({ error: "Serviço não encontrado no catálogo" }, 404);

        // ── Buscar cliente ──────────────────────────────────────────────
        const { data: cli } = await db
          .from("clientes")
          .select("id,razao_social,cnpj,dia_vencimento")
          .eq("id", cliente_id).single();
        if (!cli) return json({ error: "Cliente não encontrado" }, 404);

        const desconto      = body.desconto ?? 0;
        const valorContrat  = body.valor_contratado ?? cat.valor_padrao ?? 0;
        const valorFinal    = Math.max(0, valorContrat - desconto);
        const periodicidade = (body.periodicidade ?? "mensal") as string;
        const dataInicio    = body.data_inicio ?? new Date().toISOString().split("T")[0];

        // ── Inserir cliente_servico ─────────────────────────────────────
        const { data: cs, error: csErr } = await db
          .from("cliente_servico")
          .insert({
            cliente_id,
            catalogo_id,
            nome_servico:     cat.nome,
            valor_contratado: valorContrat,
            desconto,
            valor_final:      valorFinal,
            periodicidade,
            data_inicio:      dataInicio,
            data_fim:         body.data_fim ?? null,
            status:           "ativo",
            observacoes:      body.observacoes ?? null,
          })
          .select()
          .single();

        if (csErr) return json({ error: csErr.message }, 500);

        return json({ ok: true, cliente_servico: cs, contrato_id: contrato.id });
      },
    },
  },
});

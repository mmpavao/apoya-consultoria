/**
 * POST /api/cobranca/criar
 * Cria uma cobrança no banco de dados (sem emitir no Asaas ainda).
 * Após criar, chame /api/cobranca/emitir?mode=individual para gerar no Asaas.
 *
 * Body:
 *   cliente_id    : uuid
 *   valor         : number
 *   competencia   : "YYYY-MM"  (ex: "2026-06")
 *   vencimento    : "YYYY-MM-DD"
 *   descricao?    : string
 *   forma?        : "PIX" | "BOLETO" | "UNDEFINED"  (default UNDEFINED = aceita os dois)
 *   recorrente?   : boolean  (padrão: false)
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

export const Route = createFileRoute("/api/cobranca/criar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const user = await getUserFromReq(request);
        if (!user) return json({ error: "Unauthorized" }, 401);

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
        catch { return json({ error: "Body inválido" }, 400); }

        const { cliente_id, valor, descricao, forma = "UNDEFINED", recorrente = false } = body;
        if (!cliente_id || !valor) return json({ error: "cliente_id e valor são obrigatórios" }, 400);

        const db = supabaseAdmin as any;

        // Buscar dados do cliente
        const { data: cliente, error: cErr } = await db
          .from("clientes")
          .select("id,razao_social,cnpj,dia_vencimento,regime")
          .eq("id", cliente_id)
          .single();

        if (cErr || !cliente) return json({ error: "Cliente não encontrado" }, 404);

        const now = new Date();
        const comp = body.competencia ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

        // Calcular vencimento
        const [ano, mes] = comp.split("-").map(Number);
        const diaVenc = cliente.dia_vencimento ?? 10;
        const vencimento = body.vencimento ?? new Date(ano, mes - 1, diaVenc).toISOString().split("T")[0];

        // Verificar se já existe cobrança para este cliente/competência
        const { data: existente } = await db
          .from("cobrancas")
          .select("id,status")
          .eq("cliente_id", cliente_id)
          .eq("competencia", comp)
          .not("status", "eq", "cancelada")
          .maybeSingle();

        if (existente) {
          return json({ error: `Cobrança já existe para ${comp}`, cobranca_id: existente.id, status: existente.status }, 409);
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
          created_by:   user.id,
        }).select().single();

        if (iErr) return json({ error: iErr.message }, 500);

        return json({ ok: true, cobranca: nova });
      },
    },
  },
});

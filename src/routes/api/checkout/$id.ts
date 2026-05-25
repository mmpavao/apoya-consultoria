/**
 * GET /api/checkout/:id — Dados públicos de uma cobrança para o checkout
 * SEM autenticação — rota pública.
 * Retorna apenas campos necessários para o checkout (sem dados sensíveis).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const Route = createFileRoute("/api/checkout/$id")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const { id } = params;
        const db = supabaseAdmin as any;

        const { data, error } = await db
          .from("cobrancas")
          .select(`
            id, cliente_nome, descricao, valor, vencimento,
            status, pix_copia_cola, boleto_url,
            asaas_invoice_url, link_pagamento
          `)
          .eq("id", id)
          .single();

        if (error || !data) return json({ error: "Cobrança não encontrada" }, 404);

        return json({
          id:              data.id,
          clienteNome:     data.cliente_nome,
          descricao:       data.descricao,
          valor:           Number(data.valor),
          vencimento:      data.vencimento,
          status:          data.status,
          pixCopiaCola:    data.pix_copia_cola ?? null,
          boletoUrl:       data.boleto_url ?? null,
          asaasInvoiceUrl: data.asaas_invoice_url ?? null,
          linkPagamento:   data.link_pagamento ?? null,
        });
      },
    },
  },
});

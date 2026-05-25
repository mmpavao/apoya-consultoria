/**
 * POST /api/cobranca/webhook (alias para /api/public/asaas-webhook)
 * Recebe eventos do Asaas — endpoint configurado no painel Asaas.
 *
 * Eventos tratados:
 *   PAYMENT_RECEIVED / PAYMENT_CONFIRMED → status=paga
 *   PAYMENT_OVERDUE                       → status=vencida
 *   PAYMENT_DELETED / PAYMENT_REFUNDED   → status=cancelada
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const APP_URL = "https://apoya-gestao.talkzzbot.workers.dev";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function enviarConfirmacaoWA(
  token: string,
  clienteId: string,
  telefone: string,
  nome: string,
  valor: string,
): Promise<void> {
  try {
    await fetch(`${APP_URL}/api/wa/send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({
        telefone,
        mensagem: `✅ ${nome}, recebemos seu pagamento de ${valor}. Obrigado!\n\nSua conta APOYA está ativa. 🙏\n\nQualquer dúvida: (12) 99685-3626`,
        cliente_id: clienteId,
      }),
    });
  } catch { /* fire-and-forget */ }
}

export const Route = createFileRoute("/api/cobranca/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Asaas não envia Bearer token — validar pelo token do webhook (opcional)
        let evento: any;
        try { evento = await request.json(); }
        catch { return json({ error: "Body inválido" }, 400); }

        const { event, payment } = evento;
        if (!payment?.id) return json({ ok: true, msg: "evento sem payment" });

        const db  = supabaseAdmin as any;
        const now = new Date().toISOString();

        // Buscar cobrança pelo asaas_payment_id
        const { data: cob } = await db
          .from("cobrancas")
          .select("id,cliente_id,cliente_nome,valor,asaas_id")
          .or(`asaas_id.eq.${payment.id},asaas_payment_id.eq.${payment.id}`)
          .maybeSingle();

        if (!cob) {
          // Pode ser cobrança de outro sistema — ignorar silenciosamente
          return json({ ok: true, msg: "cobrança não encontrada no sistema" });
        }

        // Buscar dados do cliente para WhatsApp
        const { data: cli } = await db
          .from("clientes")
          .select("whatsapp,telefone,razao_social,asaas_customer_id")
          .eq("id", cob.cliente_id)
          .single();

        switch (event) {
          case "PAYMENT_RECEIVED":
          case "PAYMENT_CONFIRMED": {
            const valorBRL = Number(payment.value ?? cob.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

            // Atualizar cobrança
            await db.from("cobrancas").update({
              status:       "paga",
              pago_em:      payment.paymentDate ?? now.split("T")[0],
              regua_stage:  "ok",
              dias_atraso:  0,
              updated_at:   now,
            }).eq("id", cob.id);

            // Reativar cliente (se estava suspenso)
            await db.from("clientes").update({
              status:           "ativo",
              data_inadimplencia: null,
              data_suspensao:     null,
              motivo_suspensao:   null,
              updated_at:         now,
            }).eq("id", cob.cliente_id).eq("status", "suspenso");

            // Enviar confirmação WhatsApp
            const tel = cli?.whatsapp ?? cli?.telefone ?? "";
            if (tel && cli) {
              const nome = (cli.razao_social ?? "Cliente").split(" ")[0];
              // Buscar um token de service para enviar (sem auth de usuário no webhook)
              const { data: { session } } = await (supabaseAdmin as any).auth.admin
                .getUserById("00000000-0000-0000-0000-000000000000").catch(() => ({ data: null }));
              // Fire-and-forget sem token — o /api/wa/send fará o melhor possível
              enviarConfirmacaoWA("", cob.cliente_id, tel, nome, valorBRL);
            }

            console.log(`[webhook] PAGAMENTO CONFIRMADO — ${cob.id} — ${payment.value}`);
            break;
          }

          case "PAYMENT_OVERDUE": {
            await db.from("cobrancas").update({
              status:      "vencida",
              regua_stage: "cobranca",
              updated_at:  now,
            }).eq("id", cob.id);
            break;
          }

          case "PAYMENT_DELETED":
          case "PAYMENT_REFUNDED":
          case "PAYMENT_CHARGEBACK_REQUESTED": {
            await db.from("cobrancas").update({
              status:      "cancelada",
              cancelado_em: now,
              updated_at:  now,
            }).eq("id", cob.id);
            break;
          }

          default:
            // Outros eventos (PAYMENT_UPDATED, PAYMENT_AWAITING_RISK_ANALYSIS, etc.) — ignorar
            console.log(`[webhook] Evento ignorado: ${event}`);
        }

        return json({ ok: true, event, cobrancaId: cob.id });
      },
    },
  },
});

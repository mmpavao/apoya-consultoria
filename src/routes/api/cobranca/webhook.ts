/**
 * POST /api/cobranca/webhook  (alias para /api/public/asaas-webhook)
 * Recebe eventos do Asaas.
 *
 * Eventos tratados:
 *   PAYMENT_RECEIVED / PAYMENT_CONFIRMED → paga + confirma WA + email
 *   PAYMENT_OVERDUE                       → vencida
 *   PAYMENT_DELETED / PAYMENT_REFUNDED   → cancelada
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { evo } from "@/integrations/evolution/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Envia WhatsApp via Evolution API direto — sem necessidade de auth de usuário */
async function notificarWAPagamento(
  db: any,
  clienteId: string,
  telefone: string,
  nome: string,
  valor: string,
  linkFatura: string,
): Promise<void> {
  try {
    const { data: instancia } = await db
      .from("wa_instance")
      .select("nome, evolution_base_url, evolution_apikey")
      .eq("ativo", true)
      .limit(1)
      .single();

    if (!instancia?.nome) return;

    const baseUrl = instancia.evolution_base_url
      ?? process.env.EVOLUTION_BASE_URL
      ?? "https://evolution-api-production-f159.up.railway.app";
    const apiKey = instancia.evolution_apikey ?? process.env.EVOLUTION_API_KEY ?? "";
    const instance = instancia.nome;

    const phone = telefone.replace(/\D/g, "");
    const numero = phone.startsWith("55") ? phone : `55${phone}`;

    const msg = `✅ *Pagamento confirmado!*\n\n`
      + `Olá *${nome}*! Recebemos seu pagamento de *${valor}*.\n\n`
      + `Sua conta APOYA está ativa e os serviços continuam normalmente. 🎉\n\n`
      + `Qualquer dúvida: (12) 99685-3626\n`
      + `_meucontador.io — by Apoya Contábil_`;

    await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": apiKey },
      body: JSON.stringify({ number: numero, text: msg }),
    });
  } catch (e) {
    console.warn("[webhook] Falha ao enviar WA confirmação:", e);
  }
}

/** Envia email de confirmação via Asaas notification API */
async function notificarEmailPagamento(
  asaasKey: string,
  paymentId: string,
): Promise<void> {
  try {
    await fetch(`https://www.asaas.com/api/v3/payments/${paymentId}/sendBillingEmailCopy`, {
      method: "POST",
      headers: { "access_token": asaasKey },
    });
  } catch (e) {
    console.warn("[webhook] Falha ao enviar email Asaas:", e);
  }
}

export const Route = createFileRoute("/api/cobranca/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let evento: any;
        try { evento = await request.json(); }
        catch { return json({ error: "Body inválido" }, 400); }

        const { event, payment } = evento;
        if (!payment?.id) return json({ ok: true, msg: "evento sem payment" });

        const db  = supabaseAdmin as any;
        const now = new Date().toISOString();
        const asaasKey = process.env.ASAAS_API_KEY ?? "";

        // Buscar cobrança pelo asaas_payment_id
        const { data: cob } = await db
          .from("cobrancas")
          .select("id,cliente_id,cliente_nome,valor,asaas_id,link_pagamento")
          .or(`asaas_id.eq.${payment.id},asaas_payment_id.eq.${payment.id}`)
          .maybeSingle();

        if (!cob) {
          console.log(`[webhook] Cobrança não encontrada para payment ${payment.id} — ignorando`);
          return json({ ok: true, msg: "cobrança não encontrada" });
        }

        // Buscar dados do cliente
        const { data: cli } = await db
          .from("clientes")
          .select("whatsapp,telefone,email,razao_social,status")
          .eq("id", cob.cliente_id)
          .single();

        switch (event) {
          case "PAYMENT_RECEIVED":
          case "PAYMENT_CONFIRMED": {
            const valor = Number(payment.value ?? cob.valor);
            const valorBRL = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

            // Atualizar cobrança → paga
            await db.from("cobrancas").update({
              status:      "paga",
              pago_em:     payment.paymentDate ?? now.split("T")[0],
              regua_stage: "ok",
              dias_atraso: 0,
              updated_at:  now,
            }).eq("id", cob.id);

            // Reativar cliente suspenso (se aplicável)
            if (cli?.status === "suspenso") {
              await db.from("clientes").update({
                status:             "ativo",
                data_inadimplencia: null,
                data_suspensao:     null,
                motivo_suspensao:   null,
                updated_at:         now,
              }).eq("id", cob.cliente_id);
            }

            // ── Notificações ──────────────────────────────────────────
            const tel  = cli?.whatsapp ?? cli?.telefone ?? "";
            const nome = (cli?.razao_social ?? "Cliente").split(" ")[0];
            const link = cob.link_pagamento ?? `https://apoya-gestao.talkzzbot.workers.dev/checkout/${cob.id}`;

            if (tel) {
              notificarWAPagamento(db, cob.cliente_id, tel, nome, valorBRL, link)
                .catch(() => {});
            }

            if (asaasKey && payment.id) {
              notificarEmailPagamento(asaasKey, payment.id).catch(() => {});
            }

            console.log(`[webhook] ✅ PAGAMENTO CONFIRMADO — ${cob.id} — ${valorBRL}`);
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
            console.log(`[webhook] Evento ignorado: ${event}`);
        }

        return json({ ok: true, event, cobrancaId: cob.id });
      },
    },
  },
});

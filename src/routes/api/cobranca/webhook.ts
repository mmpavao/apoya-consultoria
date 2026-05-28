/**
 * POST /api/cobranca/webhook
 * Recebe eventos do Asaas e atualiza o banco + notifica cliente.
 *
 * FLUXO COMPLETO:
 *   1. Recebe evento Asaas
 *   2. Busca cobrança por asaas_id
 *   3. Se não achar → cria (upsert) a cobrança automaticamente
 *   4. Atualiza status conforme evento
 *   5. PAYMENT_RECEIVED/CONFIRMED → notifica WhatsApp + email
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Enviar WhatsApp via Evolution API ────────────────────────────────────────
async function notificarWA(db: any, clienteId: string, mensagem: string): Promise<void> {
  try {
    const { data: cli } = await db.from("clientes").select("whatsapp,telefone,razao_social").eq("id", clienteId).single();
    const tel = (cli?.whatsapp ?? cli?.telefone ?? "").replace(/\D/g, "");
    if (!tel) return;
    const numero = tel.startsWith("55") ? tel : `55${tel}`;

    const { data: inst } = await db.from("wa_instance").select("nome,evolution_base_url,evolution_apikey").eq("ativo", true).limit(1).single();
    if (!inst?.nome) return;

    const baseUrl = inst.evolution_base_url ?? process.env.EVOLUTION_BASE_URL ?? "";
    const apiKey  = inst.evolution_apikey   ?? process.env.EVOLUTION_API_KEY  ?? "";

    await fetch(`${baseUrl}/message/sendText/${inst.nome}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: numero, text: mensagem }),
    });
    console.log(`[webhook] WhatsApp enviado para ${numero}`);
  } catch (e) {
    console.warn("[webhook] Falha WA:", e);
  }
}

// ── Enviar email de confirmação via Asaas ───────────────────────────────────
async function notificarEmail(asaasKey: string, paymentId: string): Promise<void> {
  try {
    await fetch(`https://www.asaas.com/api/v3/payments/${paymentId}/sendBillingEmailCopy`, {
      method: "POST",
      headers: { "access_token": asaasKey },
    });
    console.log(`[webhook] Email enviado para payment ${paymentId}`);
  } catch (e) {
    console.warn("[webhook] Falha email:", e);
  }
}

// ── Buscar ou criar cobrança a partir do payment Asaas ───────────────────────
async function upsertCobranca(db: any, payment: any): Promise<any | null> {
  // 1. Tentar achar no banco
  const { data: existente } = await db
    .from("cobrancas")
    .select("*")
    .or(`asaas_id.eq.${payment.id},asaas_payment_id.eq.${payment.id}`)
    .maybeSingle();
  if (existente) return existente;

  // 2. Não achou — tentar criar a partir dos dados do Asaas
  // Buscar customer no Asaas para identificar o cliente no banco
  const asaasKey = process.env.ASAAS_API_KEY ?? "";
  if (!asaasKey || !payment.customer) return null;

  try {
    // Buscar customer no Asaas
    const custRes = await fetch(`https://www.asaas.com/api/v3/customers/${payment.customer}`, {
      headers: { "access_token": asaasKey },
    });
    const customer = await custRes.json() as any;
    const cpfCnpj = (customer?.cpfCnpj ?? "").replace(/\D/g, "");
    if (!cpfCnpj) return null;

    // Buscar cliente no banco pelo CNPJ
    const { data: cli } = await db.from("clientes").select("id,razao_social,cnpj").eq("cnpj", cpfCnpj).maybeSingle();
    if (!cli) {
      console.warn(`[webhook] Cliente CNPJ ${cpfCnpj} não encontrado no banco`);
      return null;
    }

    const now = new Date().toISOString();
    const comp = payment.dueDate
      ? payment.dueDate.substring(0, 7).replace("-", "-")
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    // Criar cobrança retroativa
    const { data: nova, error: insErr } = await db.from("cobrancas").insert({
      cliente_id:       cli.id,
      cliente_nome:     cli.razao_social,
      cnpj:             cli.cnpj,
      descricao:        payment.description ?? `Cobrança Asaas ${payment.id}`,
      valor:            payment.value ?? 0,
      forma:            "UNDEFINED",
      vencimento:       payment.dueDate ?? now.split("T")[0],
      competencia:      comp,
      status:           "pendente",
      asaas_id:         payment.id,
      asaas_payment_id: payment.id,
      regua_stage:      "ok",
      dias_atraso:      0,
      created_at:       now,
      updated_at:       now,
    }).select().single();

    if (insErr) {
      console.error("[webhook] Erro ao criar cobrança retroativa:", insErr.message);
      return null;
    }

    console.log(`[webhook] Cobrança retroativa criada: ${nova.id} para ${cli.razao_social}`);
    return nova;
  } catch (e) {
    console.error("[webhook] Erro no upsert de cobrança:", e);
    return null;
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

        console.log(`[webhook] Evento: ${event} | payment: ${payment.id} | valor: R$${payment.value}`);

        const db       = supabaseAdmin as any;
        const now      = new Date().toISOString();
        const asaasKey = process.env.ASAAS_API_KEY ?? "";

        // Buscar ou criar cobrança
        const cob = await upsertCobranca(db, payment);
        if (!cob) {
          console.warn(`[webhook] Não foi possível resolver cobrança para payment ${payment.id}`);
          return json({ ok: true, msg: "cobrança não resolvida — ignorado" });
        }

        // Buscar dados do cliente
        const { data: cli } = await db
          .from("clientes")
          .select("razao_social,whatsapp,telefone,email,status")
          .eq("id", cob.cliente_id)
          .single();

        switch (event) {
          // ── PAGAMENTO RECEBIDO / CONFIRMADO ─────────────────────────────
          case "PAYMENT_RECEIVED":
          case "PAYMENT_CONFIRMED": {
            const valor = Number(payment.value ?? cob.valor);
            const valorBRL = valor.toLocaleString("pt-BR", {
              style: "currency", currency: "BRL",
            });

            // Atualizar cobrança
            await db.from("cobrancas").update({
              status:      "paga",
              pago_em:     payment.paymentDate ? new Date(payment.paymentDate).toISOString() : now,
              regua_stage: "ok",
              dias_atraso: 0,
              updated_at:  now,
            }).eq("id", cob.id);

            // Reativar cliente suspenso
            if (cli?.status === "suspenso") {
              await db.from("clientes").update({
                status:             "ativo",
                data_inadimplencia: null,
                data_suspensao:     null,
                motivo_suspensao:   null,
                updated_at:         now,
              }).eq("id", cob.cliente_id);
            }

            // ── Notificações assíncronas ─────────────────────────────────
            const nomePrimeiro = (cli?.razao_social ?? "Cliente").split(" ")[0];
            const link = cob.link_pagamento ?? `https://apoya-gestao.talkzzbot.workers.dev/checkout/${cob.id}`;

            const msgWA = `✅ *Pagamento confirmado!*\n\n`
              + `Olá *${nomePrimeiro}*!\n\n`
              + `Recebemos seu pagamento de *${valorBRL}* referente ao mês *${cob.competencia ?? ""}*.\n\n`
              + `Sua conta está ativa e todos os serviços continuam normalmente. 🎉\n\n`
              + `_meucontador.io — by Apoya Contábil_`;

            notificarWA(db, cob.cliente_id, msgWA).catch(() => {});

            if (asaasKey && payment.id) {
              notificarEmail(asaasKey, payment.id).catch(() => {});
            }

            console.log(`[webhook] ✅ PAGAMENTO CONFIRMADO — ${cob.id} — ${valorBRL} — ${cli?.razao_social}`);
            break;
          }

          // ── VENCIDA ─────────────────────────────────────────────────────
          case "PAYMENT_OVERDUE": {
            const diasAtraso = payment.daysOverdue ?? 1;
            await db.from("cobrancas").update({
              status:      "vencida",
              regua_stage: "cobranca",
              dias_atraso: diasAtraso,
              updated_at:  now,
            }).eq("id", cob.id);

            console.log(`[webhook] ⚠️ VENCIDA — ${cob.id} — ${diasAtraso} dias`);
            break;
          }

          // ── CANCELADA / ESTORNADA ────────────────────────────────────────
          case "PAYMENT_DELETED":
          case "PAYMENT_REFUNDED":
          case "PAYMENT_PARTIALLY_REFUNDED":
          case "PAYMENT_CHARGEBACK_REQUESTED": {
            await db.from("cobrancas").update({
              status:       "cancelada",
              cancelado_em: now,
              updated_at:   now,
            }).eq("id", cob.id);

            const msgCancel = `ℹ️ *Cobrança cancelada*\n\nSua cobrança de R$ ${cob.valor} foi cancelada/estornada.\n_meucontador.io — by Apoya Contábil_`;
            notificarWA(db, cob.cliente_id, msgCancel).catch(() => {});

            console.log(`[webhook] 🚫 CANCELADA — ${cob.id}`);
            break;
          }

          // ── RESTAURADA ───────────────────────────────────────────────────
          case "PAYMENT_RESTORED": {
            await db.from("cobrancas").update({
              status:       "pendente",
              cancelado_em: null,
              updated_at:   now,
            }).eq("id", cob.id);
            break;
          }

          // ── ATUALIZADA ───────────────────────────────────────────────────
          case "PAYMENT_UPDATED": {
            const updates: Record<string, unknown> = { updated_at: now };
            if (payment.value) updates.valor = payment.value;
            if (payment.dueDate) updates.vencimento = payment.dueDate;
            await db.from("cobrancas").update(updates).eq("id", cob.id);
            break;
          }

          default:
            console.log(`[webhook] Evento não tratado: ${event}`);
        }

        return json({ ok: true, event, cobrancaId: cob.id, cliente: cli?.razao_social });
      },
    },
  },
});

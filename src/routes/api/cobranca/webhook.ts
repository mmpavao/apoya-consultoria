/**
 * POST /api/cobranca/webhook
 * Recebe eventos do Asaas → atualiza banco → notifica cliente.
 *
 * PAYMENT_RECEIVED / PAYMENT_CONFIRMED:
 *   1. Atualiza cobrança → "paga"
 *   2. Envia WhatsApp de confirmação imediata
 *   3. Dispara edge function "nfse-pos-pagamento" (async, sem aguardar)
 *      que cuida de: emitir NFS-e NFE.io → baixar PDF → email + WhatsApp com PDF
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── WhatsApp texto ────────────────────────────────────────────────────────────
async function notificarWA(db: any, clienteId: string, mensagem: string): Promise<void> {
  try {
    const { data: cli } = await db.from("clientes").select("whatsapp,telefone").eq("id", clienteId).single();
    const tel = (cli?.whatsapp ?? cli?.telefone ?? "").replace(/\D/g, "");
    if (!tel) return;
    const numero = tel.startsWith("55") ? tel : `55${tel}`;
    const { data: inst } = await db.from("wa_instance")
      .select("nome,evolution_base_url,evolution_apikey").eq("ativo", true).limit(1).single();
    if (!inst?.nome) return;
    const baseUrl = inst.evolution_base_url ?? process.env.EVOLUTION_BASE_URL ?? "";
    const apiKey  = inst.evolution_apikey   ?? process.env.EVOLUTION_API_KEY  ?? "";
    await fetch(`${baseUrl}/message/sendText/${inst.nome}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: numero, text: mensagem }),
    });
  } catch (e) { console.warn("[webhook] Falha WA:", e); }
}

// ── Disparar NFS-e via rota interna do Worker (fire-and-forget) ──────────────
// Chama /api/nfse/emitir-cobranca como serviço interno: autentica via x-internal
// = APOYA_SERVICE_TOKEN (segredo real), não mais a string fixa "webhook".
async function dispararNfse(cobrancaId: string, _clienteId: string): Promise<void> {
  try {
    const serviceToken = process.env.APOYA_SERVICE_TOKEN
      ?? (globalThis as any).__env__?.APOYA_SERVICE_TOKEN ?? "";
    const workerUrl      = process.env.WORKER_BASE_URL ?? "https://apoya-gestao.talkzzbot.workers.dev";

    const res = await fetch(`${workerUrl}/api/nfse/emitir-cobranca`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "x-internal":    serviceToken,
      },
      body: JSON.stringify({ cobranca_id: cobrancaId }),
    });

    let data: any = {};
    try { data = await res.json(); } catch {}
    console.log(`[webhook] NFS-e dispatch → ${res.status} | ${data?.ok ? "✅" : "⚠️"} ${data?.numero ?? data?.erro ?? ""}`);
  } catch (e) {
    console.warn("[webhook] Falha dispatch NFS-e:", e);
  }
}

// ── Buscar ou criar cobrança a partir do payment Asaas ───────────────────────
async function upsertCobranca(db: any, payment: any): Promise<any | null> {
  const { data: existente } = await db
    .from("cobrancas")
    .select("*")
    .or(`asaas_id.eq.${payment.id},asaas_payment_id.eq.${payment.id}`)
    .maybeSingle();
  if (existente) return existente;

  const asaasKey = process.env.ASAAS_API_KEY ?? "";
  if (!asaasKey || !payment.customer) return null;

  try {
    const custRes = await fetch(
      `https://api.asaas.com/v3/customers/${payment.customer}`,
      { headers: { "access_token": asaasKey } }
    );
    if (!custRes.ok) return null;
    const cust    = await custRes.json() as any;
    const cpfCnpj = (cust.cpfCnpj ?? "").replace(/\D/g, "");
    const { data: cli } = await db.from("clientes").select("id,razao_social,cnpj")
      .eq("cnpj", cpfCnpj).maybeSingle();
    if (!cli) return null;

    const comp = payment.dueDate?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
    const { data: nova } = await db.from("cobrancas").insert({
      cliente_id:       cli.id,
      cliente_nome:     cli.razao_social,
      cnpj:             cli.cnpj,
      descricao:        payment.description ?? `Mensalidade APOYA — ${comp}`,
      valor:            payment.value ?? 0,
      forma:            payment.billingType ?? "UNDEFINED",
      vencimento:       payment.dueDate ?? new Date().toISOString().split("T")[0],
      competencia:      comp,
      status:           "pendente",
      asaas_id:         payment.id,
      asaas_payment_id: payment.id,
      link_pagamento:   payment.invoiceUrl ?? null,
      regua_stage:      "ok",
      dias_atraso:      0,
    }).select().single();
    return nova ?? null;
  } catch (e) {
    console.warn("[webhook] upsert falhou:", e);
    return null;
  }
}

// ── ROTA PRINCIPAL ─────────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/cobranca/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // ── SEC-003: Validação de authToken Asaas (FAIL-CLOSED) ───────────
        // Fonte de verdade: token gravado pelo setup-webhook em integracao_config
        // (tipo=asaas → config.webhook_token), com env como override. Sem token
        // configurado → rejeita (não processa evento de pagamento não verificado).
        const receivedToken = request.headers.get("asaas-access-token") ?? "";
        let expectedToken = (globalThis as any).__env__?.ASAAS_WEBHOOK_TOKEN
          ?? process.env.ASAAS_WEBHOOK_TOKEN ?? "";
        if (!expectedToken) {
          try {
            const { data: cfg } = await (supabaseAdmin as any)
              .from("integracao_config").select("config").eq("tipo", "asaas").single();
            expectedToken = cfg?.config?.webhook_token ?? "";
          } catch { /* ignore — cai no fail-closed abaixo */ }
        }
        if (!expectedToken || receivedToken !== expectedToken) {
          console.warn("[webhook] Token Asaas ausente/inválido — rejeitado");
          return json({ error: "Unauthorized" }, 401);
        }
        // ─────────────────────────────────────────────────────────────────
        let evento: any;
        try { evento = await request.json(); }
        catch { return json({ error: "Body inválido" }, 400); }

        const { event, payment } = evento;
        if (!payment?.id) return json({ ok: true, msg: "evento sem payment" });

        console.log(`[webhook] ${event} | ${payment.id} | R$${payment.value}`);

        const db  = supabaseAdmin as any;
        const now = new Date().toISOString();

        const cob = await upsertCobranca(db, payment);
        if (!cob) {
          console.warn(`[webhook] Cobrança não resolvida para payment ${payment.id}`);
          return json({ ok: true, msg: "cobrança não resolvida — ignorado" });
        }

        const { data: cli } = await db.from("clientes")
          .select("razao_social,whatsapp,telefone,email,status")
          .eq("id", cob.cliente_id).single();

        switch (event) {
          // ── PAGAMENTO CONFIRMADO ──────────────────────────────────────────
          case "PAYMENT_RECEIVED":
          case "PAYMENT_CONFIRMED": {
            // Idempotência: re-entrega Asaas não re-dispara NFS-e nem re-notifica
            if (cob.status === "paga") {
              console.log(`[webhook] ↩ idempotente — cobrança ${cob.id} já paga (nfse=${cob.nfse_status ?? "?"})`);
              break;
            }

            const valor    = Number(payment.value ?? cob.valor);
            const valorBRL = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const nome     = (cli?.razao_social ?? "Cliente").split(" ")[0];

            // 1. Atualizar cobrança
            await db.from("cobrancas").update({
              status:      "paga",
              pago_em:     payment.paymentDate ? new Date(payment.paymentDate).toISOString() : now,
              regua_stage: "ok",
              dias_atraso: 0,
              updated_at:  now,
            }).eq("id", cob.id);

            // 2. Reativar cliente suspenso
            if (cli?.status === "suspenso") {
              await db.from("clientes").update({
                status:             "ativo",
                data_inadimplencia: null,
                data_suspensao:     null,
                motivo_suspensao:   null,
              }).eq("id", cob.cliente_id);
            }

            // 3. Mensagem de confirmação imediata (antes da nota)
            const msgConfirm = `✅ *Pagamento confirmado!*

`
              + `Olá *${nome}*! Recebemos seu pagamento de *${valorBRL}* — competência *${cob.competencia ?? ""}*.

`
              + `Estamos emitindo sua Nota Fiscal. Você receberá o PDF em instantes. 🧾

`
              + `_Apoya Contábil · apoya.com.br_`;
            notificarWA(db, cob.cliente_id, msgConfirm).catch(() => {});

            // 4. Disparar NFS-e apenas se emissão for automática
            // Verificar contrato ativo do cliente para checar campo emissao_nf
            try {
              const { data: contratoAtivo } = await db
                .from("contrato_cliente")
                .select("emissao_nf")
                .eq("cliente_id", cob.cliente_id)
                .eq("status", "ativo")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              const emissaoNf = contratoAtivo?.emissao_nf ?? "automatica";
              if (emissaoNf !== "manual" && cob.nfse_status !== "emitida") {
                dispararNfse(cob.id, cob.cliente_id).catch(() => {});
              } else if (cob.nfse_status === "emitida") {
                console.log(`[webhook] NFS-e já emitida para ${cob.id} — skip dispatch`);
              } else {
                console.log(`[webhook] 📋 NFS-e manual para ${cob.id} — aguarda ação do escritório`);
              }
            } catch {
              // fallback: emitir automaticamente se não conseguir buscar contrato
              if (cob.nfse_status !== "emitida") {
                dispararNfse(cob.id, cob.cliente_id).catch(() => {});
              }
            }

            console.log(`[webhook] ✅ PAGO — ${cob.id} — ${valorBRL} — ${cli?.razao_social}`);
            break;
          }

          // ── VENCIDA ───────────────────────────────────────────────────────
          case "PAYMENT_OVERDUE": {
            const dias = payment.daysOverdue ?? 1;
            await db.from("cobrancas").update({
              status:      "vencida",
              regua_stage: "cobranca",
              dias_atraso: dias,
              updated_at:  now,
            }).eq("id", cob.id);

            const valorBRL = Number(cob.valor ?? 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
            const link     = cob.link_pagamento ?? "";
            const nome     = (cli?.razao_social ?? "Cliente").split(" ")[0];
            const msgVenc = `⚠️ *Fatura em aberto*

Olá *${nome}*, sua fatura de *${valorBRL}* venceu há ${dias} dia(s).

Regularize aqui:
${link}

_Apoya Contábil_`;
            notificarWA(db, cob.cliente_id, msgVenc).catch(() => {});
            break;
          }

          // ── CANCELADA ─────────────────────────────────────────────────────
          case "PAYMENT_DELETED":
          case "PAYMENT_REFUNDED":
          case "PAYMENT_PARTIALLY_REFUNDED":
          case "PAYMENT_CHARGEBACK_REQUESTED": {
            await db.from("cobrancas").update({
              status:       "cancelada",
              cancelado_em: now,
              updated_at:   now,
            }).eq("id", cob.id);
            const valorBRL = Number(cob.valor ?? 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
            notificarWA(db, cob.cliente_id,
              `ℹ️ Sua cobrança de ${valorBRL} foi cancelada/estornada.
_Apoya Contábil_`).catch(() => {});
            break;
          }

          case "PAYMENT_RESTORED": {
            await db.from("cobrancas").update({ status: "pendente", cancelado_em: null, updated_at: now }).eq("id", cob.id);
            break;
          }

          case "PAYMENT_UPDATED": {
            const up: Record<string, unknown> = { updated_at: now };
            if (payment.value)   up.valor      = payment.value;
            if (payment.dueDate) up.vencimento = payment.dueDate;
            await db.from("cobrancas").update(up).eq("id", cob.id);
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

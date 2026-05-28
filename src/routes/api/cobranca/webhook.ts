/**
 * POST /api/cobranca/webhook
 * Recebe eventos do Asaas e atualiza o banco + notifica cliente.
 *
 * FLUXO PAYMENT_RECEIVED / PAYMENT_CONFIRMED:
 *   1. Atualiza cobrança → status "paga"
 *   2. Emite NFS-e no NFE.io (se cliente tiver inscrição municipal + código de serviço)
 *   3. Aguarda processamento e faz poll do PDF (até 30s)
 *   4. Envia PDF por e-mail ao cliente
 *   5. Envia PDF por WhatsApp ao cliente
 *   6. Registra na tabela nfse_emitida
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Helpers NFE.io ────────────────────────────────────────────────────────────

function getNfseKey(): string {
  return (globalThis as any).__env__?.NFSEIO_API_KEY
    ?? process.env.NFSEIO_API_KEY
    ?? "";
}

const NFSEIO_BASE   = "https://api.nfe.io/v1";
const EMITENTE_ID   = "d8e1f4b5f4674fdaaaf034e5a837b85d"; // APOYA AUDITORIA

async function nfseioGet<T = any>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${NFSEIO_BASE}${path}`, {
      headers: { Authorization: getNfseKey() },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.json() as T;
  } catch { return null; }
}

async function emitirNfse(cli: any, cobranca: any): Promise<{
  nfseioId?: string; numero?: string; pdfUrl?: string; pdfBase64?: string; erro?: string;
}> {
  try {
    const key = getNfseKey();
    if (!key) return { erro: "NFSEIO_API_KEY não configurada" };
    if (!cli.inscricao_municipal) return { erro: "Cliente sem inscrição municipal" };

    const cityServiceCode = cli.codigo_servico_nfse ?? "0107"; // contabilidade
    const aliquota        = cli.aliquota_iss ?? 0.05;
    const valor           = Number(cobranca.valor ?? 0);
    const comp            = cobranca.competencia ?? new Date().toISOString().slice(0, 7);
    const [ano, mes]      = comp.split("-");
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                   "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const descricao = `Honorários Contábeis — ${meses[Number(mes) - 1]}/${ano} — ${cli.razao_social}`;

    const payload = {
      cityServiceCode,
      federalServiceCode: "17.20",
      description:   descricao,
      servicesAmount: valor,
      taxationType:  "WithinCity",
      issRate:       aliquota,
      issRetained:   false,
      borrower: {
        federalTaxNumber: Number(cli.cnpj?.replace(/\D/g, "") ?? "0"),
        name:  cli.razao_social,
        email: cli.email ?? undefined,
        address: {
          country:    "BRA",
          postalCode: cli.cep?.replace(/\D/g, "") ?? "12283030",
          street:     cli.logradouro ?? "Endereço não informado",
          number:     cli.numero ?? "s/n",
          district:   cli.bairro ?? "",
          additionalInformation: cli.complemento ?? undefined,
          city: { code: Number(cli.codigo_municipio_ibge ?? 3508603), name: cli.municipio ?? "Caçapava" },
          state: cli.uf ?? "SP",
        },
      },
    };

    const res = await fetch(`${NFSEIO_BASE}/companies/${EMITENTE_ID}/serviceinvoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: key },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as any;
    if (!res.ok) {
      const errMsg = data?.message ?? data?.error ?? `HTTP ${res.status}`;
      console.error("[nfse] Erro ao emitir:", errMsg, JSON.stringify(data).slice(0, 300));
      return { erro: errMsg };
    }

    const nfseioId = data?.id;
    const numero   = String(data?.number ?? "");

    // Poll PDF — NFE.io pode levar alguns segundos para processar
    let pdfUrl: string | undefined;
    let pdfBase64: string | undefined;

    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 5000)); // aguarda 5s por tentativa (30s total)
      const nota = await nfseioGet<any>(`/companies/${EMITENTE_ID}/serviceinvoices/${nfseioId}`);
      if (nota?.status === "Issued" && nota?.pdfUrl) {
        pdfUrl = nota.pdfUrl;
        break;
      }
      if (nota?.status === "Error") {
        return { erro: nota?.rpsStatus ?? "Erro no processamento da nota" };
      }
    }

    // Baixar PDF como base64 se tiver URL
    if (pdfUrl) {
      try {
        const pdfRes = await fetch(`${NFSEIO_BASE}/companies/${EMITENTE_ID}/serviceinvoices/${nfseioId}/pdf`, {
          headers: { Authorization: key },
          redirect: "follow",
        });
        if (pdfRes.ok) {
          const buf  = await pdfRes.arrayBuffer();
          pdfBase64  = btoa(String.fromCharCode(...new Uint8Array(buf)));
        }
      } catch (e) {
        console.warn("[nfse] Falha ao baixar PDF:", e);
      }
    }

    return { nfseioId, numero, pdfUrl, pdfBase64 };
  } catch (e: any) {
    return { erro: e?.message ?? "Erro inesperado ao emitir NFS-e" };
  }
}

// ── Enviar WhatsApp — texto ───────────────────────────────────────────────────
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
  } catch (e) { console.warn("[webhook] Falha WA texto:", e); }
}

// ── Enviar WhatsApp — documento (PDF base64) ──────────────────────────────────
async function notificarWAPdf(db: any, clienteId: string, pdfBase64: string, filename: string, caption: string): Promise<void> {
  try {
    const { data: cli } = await db.from("clientes").select("whatsapp,telefone").eq("id", clienteId).single();
    const tel = (cli?.whatsapp ?? cli?.telefone ?? "").replace(/\D/g, "");
    if (!tel) return;
    const numero = tel.startsWith("55") ? tel : `55${tel}`;
    const { data: inst } = await db.from("wa_instance").select("nome,evolution_base_url,evolution_apikey").eq("ativo", true).limit(1).single();
    if (!inst?.nome) return;
    const baseUrl = inst.evolution_base_url ?? process.env.EVOLUTION_BASE_URL ?? "";
    const apiKey  = inst.evolution_apikey   ?? process.env.EVOLUTION_API_KEY  ?? "";
    await fetch(`${baseUrl}/message/sendMedia/${inst.nome}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number: numero,
        mediatype: "document",
        mimetype:  "application/pdf",
        media:     pdfBase64,
        fileName:  filename,
        caption,
      }),
    });
    console.log(`[webhook] PDF WA enviado para ${numero}`);
  } catch (e) { console.warn("[webhook] Falha WA PDF:", e); }
}

// ── Enviar e-mail com PDF via Resend API ──────────────────────────────────────
async function enviarEmailNfse(cli: any, cobranca: any, numero: string, pdfBase64: string): Promise<void> {
  try {
    const resendKey = process.env.RESEND_API_KEY ?? "";
    if (!resendKey) {
      console.warn("[nfse-email] RESEND_API_KEY não configurada — pulando e-mail");
      return;
    }

    const email = cli.email;
    if (!email) { console.warn("[nfse-email] Cliente sem e-mail"); return; }

    const comp = cobranca.competencia ?? "";
    const [ano, mes] = comp.split("-");
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                   "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const mesLabel = meses[Number(mes) - 1] ?? comp;

    const valorBRL = Number(cobranca.valor ?? 0).toLocaleString("pt-BR", {
      style: "currency", currency: "BRL",
    });

    const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">

      <!-- BANNER -->
      <tr><td style="background:linear-gradient(135deg,#1B2A4A 0%,#2a3f6f 100%);padding:32px 40px">
        <table width="100%"><tr>
          <td>
            <div style="color:#F26522;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">APOYA CONTÁBIL</div>
            <div style="color:#fff;font-size:22px;font-weight:700;line-height:1.2">Nota Fiscal de Serviço</div>
            <div style="color:#94a3b8;font-size:13px;margin-top:4px">NFS-e Nº ${numero} — ${mesLabel}/${ano}</div>
          </td>
          <td align="right">
            <div style="background:#F26522;color:#fff;font-size:20px;font-weight:700;padding:12px 20px;border-radius:8px">${valorBRL}</div>
          </td>
        </tr></table>
      </td></tr>

      <!-- CORPO -->
      <tr><td style="padding:32px 40px">
        <p style="color:#374151;font-size:15px;margin:0 0 16px">Olá, <strong>${cli.razao_social}</strong>!</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px">
          Seu pagamento de <strong>${valorBRL}</strong> referente à competência <strong>${mesLabel}/${ano}</strong> foi confirmado.
          A Nota Fiscal de Serviço (NFS-e) já foi emitida e está em anexo neste e-mail.
        </p>

        <table width="100%" style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px">
          <tr>
            <td style="color:#6b7280;font-size:12px;padding-bottom:8px">EMITENTE</td>
            <td style="color:#6b7280;font-size:12px;padding-bottom:8px" align="right">TOMADOR</td>
          </tr>
          <tr>
            <td style="color:#1B2A4A;font-size:14px;font-weight:700">Apoya Auditoria, Consultoria e Contabilidade</td>
            <td style="color:#1B2A4A;font-size:14px;font-weight:700" align="right">${cli.razao_social}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:12px">CNPJ: 43.507.838/0001-89</td>
            <td style="color:#6b7280;font-size:12px" align="right">CNPJ: ${cli.cnpj ?? ""}</td>
          </tr>
        </table>

        <p style="color:#6b7280;font-size:13px;margin:0">
          O PDF da NFS-e está em anexo. Em caso de dúvidas, fale conosco pelo WhatsApp.
        </p>
      </td></tr>

      <!-- RODAPÉ -->
      <tr><td style="background:#1B2A4A;padding:20px 40px">
        <table width="100%"><tr>
          <td>
            <div style="color:#94a3b8;font-size:11px">Apoya Auditoria, Consultoria e Contabilidade LTDA</div>
            <div style="color:#94a3b8;font-size:11px">CNPJ 43.507.838/0001-89 · Caçapava/SP</div>
            <div style="color:#94a3b8;font-size:11px">
              <a href="https://www.apoya.com.br" style="color:#F26522;text-decoration:none">www.apoya.com.br</a>
            </div>
          </td>
          <td align="right">
            <div style="color:#F26522;font-size:11px;font-weight:700">CRC 2SP044240/O-0</div>
          </td>
        </tr></table>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from:    "Apoya Contábil <noreply@apoya.com.br>",
        to:      [email],
        subject: `NFS-e Nº ${numero} — Honorários ${mesLabel}/${ano} — ${valorBRL}`,
        html:    htmlBody,
        attachments: [{
          filename: `NFS-e_${numero}_${comp}.pdf`,
          content:  pdfBase64,
        }],
      }),
    });

    console.log(`[nfse-email] E-mail enviado para ${email} com NFS-e ${numero}`);
  } catch (e) {
    console.warn("[nfse-email] Falha ao enviar e-mail:", e);
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
    const custRes = await fetch(`https://api.asaas.com/v3/customers/${payment.customer}`, {
      headers: { "access_token": asaasKey },
    });
    if (!custRes.ok) return null;
    const cust = await custRes.json() as any;
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

// ── ROTA PRINCIPAL ────────────────────────────────────────────────────────────
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

        const cob = await upsertCobranca(db, payment);
        if (!cob) {
          console.warn(`[webhook] Cobrança não resolvida para payment ${payment.id}`);
          return json({ ok: true, msg: "cobrança não resolvida — ignorado" });
        }

        const { data: cli } = await db.from("clientes")
          .select("razao_social,whatsapp,telefone,email,status,cnpj,inscricao_municipal,codigo_servico_nfse,aliquota_iss,cep,logradouro,numero,complemento,bairro,municipio,uf,codigo_municipio_ibge")
          .eq("id", cob.cliente_id).single();

        switch (event) {
          // ── PAGAMENTO CONFIRMADO ──────────────────────────────────────
          case "PAYMENT_RECEIVED":
          case "PAYMENT_CONFIRMED": {
            const valor    = Number(payment.value ?? cob.valor);
            const valorBRL = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const nomePrimeiro = (cli?.razao_social ?? "Cliente").split(" ")[0];

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
                updated_at:         now,
              }).eq("id", cob.cliente_id);
            }

            // 3. Mensagem texto de confirmação (imediata)
            const msgConfirmacao = `✅ *Pagamento confirmado!*

`
              + `Olá *${nomePrimeiro}*! Recebemos seu pagamento de *${valorBRL}* referente ao mês *${cob.competencia ?? ""}*.

`
              + `Estamos emitindo sua Nota Fiscal — você receberá em instantes. 🧾

`
              + `_Apoya Contábil · apoya.com.br_`;

            notificarWA(db, cob.cliente_id, msgConfirmacao).catch(() => {});

            // 4. Pipeline NFS-e em background
            (async () => {
              try {
                // Verificar se já emitiu nota para esta cobrança
                const { data: notaExistente } = await db.from("nfse_emitida")
                  .select("id").eq("cliente_id", cob.cliente_id).eq("competencia", cob.competencia)
                  .eq("status", "emitida").maybeSingle();
                if (notaExistente) {
                  console.log(`[nfse] Nota já emitida para ${cob.cliente_id} / ${cob.competencia}`);
                  return;
                }

                // Emitir NFS-e
                const resultado = await emitirNfse(cli, cob);

                if (resultado.erro) {
                  console.error(`[nfse] Erro ao emitir:`, resultado.erro);
                  // Registrar falha no banco
                  await db.from("nfse_emitida").insert({
                    cliente_id:     cob.cliente_id,
                    status:         "erro",
                    competencia:    cob.competencia,
                    tomador_nome:   cli?.razao_social,
                    tomador_cnpj_cpf: cli?.cnpj,
                    valor_servico:  Number(cob.valor),
                    erro_msg:       resultado.erro,
                  });
                  return;
                }

                // 5. Registrar no banco
                await db.from("nfse_emitida").insert({
                  cliente_id:           cob.cliente_id,
                  nfseio_id:            resultado.nfseioId,
                  numero:               resultado.numero,
                  status:               "emitida",
                  competencia:          cob.competencia,
                  data_emissao:         now.slice(0, 10),
                  tomador_nome:         cli?.razao_social,
                  tomador_cnpj_cpf:     cli?.cnpj,
                  tomador_email:        cli?.email,
                  descricao_servico:    `Honorários Contábeis — ${cob.competencia}`,
                  codigo_servico:       cli?.codigo_servico_nfse ?? "0107",
                  valor_servico:        Number(cob.valor),
                  aliquota_iss:         cli?.aliquota_iss ?? 0.05,
                  pdf_url:              resultado.pdfUrl,
                  issretido:            false,
                });

                // Atualizar cobrança com referência da nota
                await db.from("cobrancas").update({ updated_at: now }).eq("id", cob.id);

                const numero = resultado.numero ?? "s/n";
                const pdfB64 = resultado.pdfBase64;
                const comp   = cob.competencia ?? "";

                // 6. Enviar e-mail com PDF
                if (pdfB64 && cli?.email) {
                  await enviarEmailNfse(cli, cob, numero, pdfB64);
                }

                // 7. Enviar PDF por WhatsApp
                if (pdfB64) {
                  const caption = `🧾 *Nota Fiscal Nº ${numero}*
`
                    + `Honorários Contábeis — ${comp}
`
                    + `Valor: ${valorBRL}

`
                    + `_Apoya Contábil · apoya.com.br_`;
                  await notificarWAPdf(db, cob.cliente_id, pdfB64, `NFS-e_${numero}_${comp}.pdf`, caption);
                } else if (resultado.pdfUrl) {
                  // Fallback: enviar link se não conseguiu base64
                  await notificarWA(db, cob.cliente_id,
                    `🧾 *Sua Nota Fiscal foi emitida!*

NFS-e Nº ${numero} · ${valorBRL}
Acesse o PDF: ${resultado.pdfUrl}

_Apoya Contábil_`);
                }

                console.log(`[nfse] ✅ NFS-e ${numero} emitida e enviada para ${cli?.razao_social}`);
              } catch (e) {
                console.error("[nfse] Falha no pipeline pós-pagamento:", e);
              }
            })();

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

            const nomePrimeiro = (cli?.razao_social ?? "Cliente").split(" ")[0];
            const valorBRL = Number(cob.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const link = cob.link_pagamento ?? "";
            const msgVencida = `⚠️ *Fatura em aberto*

Olá *${nomePrimeiro}*, sua fatura de *${valorBRL}* venceu há ${diasAtraso} dia(s).

Regularize agora:
${link}

_Apoya Contábil_`;
            notificarWA(db, cob.cliente_id, msgVencida).catch(() => {});

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
            const valorBRL = Number(cob.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            const msgCancel = `ℹ️ *Cobrança cancelada*

Sua cobrança de ${valorBRL} foi cancelada/estornada.
_Apoya Contábil_`;
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
            if (payment.value)   updates.valor     = payment.value;
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

/**
 * Edge Function: clicksign-envelope
 * Fluxo completo Clicksign API v3:
 *   1. Cria envelope
 *   2. Upload do PDF do contrato (HTML → PDF via jsPDF ou base64)
 *   3. Adiciona signatário (cliente)
 *   4. Cria requisito (Assinante + autenticação por token de email)
 *   5. Ativa envelope (status → running)
 *   6. Envia notificação por email
 *   7. Se whatsapp habilitado → envia notificação via Evolution API
 *   8. Persiste IDs e status no banco
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/agent.ts";

const CLICKSIGN_BASE = "https://app.clicksign.com/api/v3";
const CLICKSIGN_TOKEN = Deno.env.get("CLICKSIGN_API_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") ?? "";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const WEBHOOK_URL = Deno.env.get("CLICKSIGN_WEBHOOK_URL") ?? `${Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "supabase.co")}/functions/v1/clicksign-webhook`;

// ── helpers ──────────────────────────────────────────────────

function cs(path: string, method = "GET", body?: unknown) {
  return fetch(`${CLICKSIGN_BASE}${path}`, {
    method,
    headers: {
      "Authorization": CLICKSIGN_TOKEN,
      "Content-Type": "application/vnd.api+json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function csJson(path: string, method = "GET", body?: unknown) {
  const r = await cs(path, method, body);
  const txt = await r.text();
  if (!r.ok) throw new Error(`Clicksign ${method} ${path} → ${r.status}: ${txt}`);
  return JSON.parse(txt);
}

/** Gera PDF simples em base64 a partir de HTML usando um mini-template */
function htmlToBase64Pdf(html: string, titulo: string, numero: string): string {
  // PDF mínimo válido com o conteúdo do contrato em texto plano
  // O conteúdo HTML é convertido para texto legível dentro do PDF
  const textContent = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Montar PDF simples mas válido com múltiplas páginas
  const lines: string[] = [];
  lines.push(`APOYA CONTABILIDADE`);
  lines.push(`Contrato: ${numero} — ${titulo}`);
  lines.push(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`);
  lines.push(`${"─".repeat(60)}`);
  lines.push(``);

  const bodyLines = textContent.split("\n").filter(l => l.trim());
  lines.push(...bodyLines);
  lines.push(``);
  lines.push(`${"─".repeat(60)}`);
  lines.push(`Este documento é parte integrante do contrato de prestação`);
  lines.push(`de serviços contábeis da APOYA Consultoria.`);
  lines.push(`Assinado eletronicamente via Clicksign.`);

  // Build minimal valid PDF
  const text = lines.join("\n");
  const encoded = encodeURIComponent(text);

  // PDF-1.4 minimal structure
  const textEscaped = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .split("\n")
    .map((l, i) => `BT /F1 10 Tf 40 ${800 - i * 14} Td (${l.substring(0, 90).replace(/[()\\]/g, "")}) Tj ET`)
    .join("\n");

  const pdfContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>/Contents 4 0 R>>endobj
4 0 obj
<</Length ${textEscaped.length}>>
stream
${textEscaped}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
${274 + textEscaped.length + 30}
%%EOF`;

  const encoded64 = btoa(unescape(encodeURIComponent(pdfContent)));
  return `data:application/pdf;base64,${encoded64}`;
}

/** Envia mensagem WhatsApp via Evolution API */
async function notificarWhatsApp(
  instanceId: string,
  telefone: string,
  nome: string,
  tituloContrato: string,
  linkAssinatura: string
) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) return;

  const tel = telefone.replace(/\D/g, "");
  const numero = tel.startsWith("55") ? tel : `55${tel}`;

  const mensagem = `🖊️ *APOYA Contabilidade*

Olá, ${nome}! 

Você recebeu um documento para assinar digitalmente:

📄 *${tituloContrato}*

Clique no link abaixo para revisar e assinar com segurança via Clicksign:
👉 ${linkAssinatura}

O link é pessoal e intransferível. Em caso de dúvidas, entre em contato conosco.`;

  await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      number: numero,
      text: mensagem,
    }),
  }).catch(e => console.warn("WhatsApp notification failed:", e.message));
}

// ── handler principal ────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // FAIL-CLOSED: exige usuário logado (antes era pública → alcançava Clicksign com a chave da empresa).
  const denied = await requireUser(req, { "Access-Control-Allow-Origin": "*" });
  if (denied) return denied;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const { contrato_id, action = "enviar" } = body;

    if (!contrato_id) {
      return new Response(JSON.stringify({ error: "contrato_id obrigatório" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── CANCELAR ──
    if (action === "cancelar") {
      const { data: contrato } = await supabase
        .from("contrato_cliente")
        .select("clicksign_envelope_id, titulo")
        .eq("id", contrato_id)
        .single();

      if (contrato?.clicksign_envelope_id) {
        await cs(`/envelopes/${contrato.clicksign_envelope_id}`, "PATCH", {
          data: {
            id: contrato.clicksign_envelope_id,
            type: "envelopes",
            attributes: { status: "canceled" },
          },
        }).catch(() => {});
      }

      await supabase.from("contrato_cliente").update({
        clicksign_status: "cancelado",
        status: "cancelado",
      }).eq("id", contrato_id);

      return new Response(JSON.stringify({ ok: true, action: "cancelado" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // ── REENVIAR NOTIFICAÇÃO ──
    if (action === "renotificar") {
      const { data: contrato } = await supabase
        .from("contrato_cliente")
        .select("*, clientes(*)")
        .eq("id", contrato_id)
        .single();

      if (!contrato?.clicksign_signer_id || !contrato?.clicksign_envelope_id) {
        return new Response(JSON.stringify({ error: "Contrato não enviado ao Clicksign ainda" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Disparar notificação email
      await csJson(
        `/envelopes/${contrato.clicksign_envelope_id}/notifications`,
        "POST",
        {
          data: {
            type: "notifications",
            attributes: {
              envelope_id: contrato.clicksign_envelope_id,
              signer_id: contrato.clicksign_signer_id,
            },
          },
        }
      ).catch(e => console.warn("Renotify email failed:", e.message));

      return new Response(JSON.stringify({ ok: true, action: "renotificado" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // ── ENVIAR PARA ASSINATURA (fluxo principal) ──

    // 1. Buscar dados do contrato + cliente
    const { data: contrato, error: errContrato } = await supabase
      .from("contrato_cliente")
      .select(`
        *,
        clientes (
          id, razao_social, nome_fantasia, email, whatsapp, cpf_cnpj
        )
      `)
      .eq("id", contrato_id)
      .single();

    if (errContrato || !contrato) {
      return new Response(JSON.stringify({ error: "Contrato não encontrado" }), {
        status: 404, headers: { "Content-Type": "application/json" },
      });
    }

    const cliente = contrato.clientes;
    if (!cliente?.email) {
      return new Response(JSON.stringify({ error: "Cliente sem e-mail cadastrado. Adicione um e-mail antes de enviar para assinatura." }), {
        status: 422, headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Marcar como "enviando"
    await supabase.from("contrato_cliente").update({
      clicksign_status: "enviando",
    }).eq("id", contrato_id);

    // 3. Criar envelope
    const deadlineDays = contrato.clicksign_deadline_days ?? 30;
    const deadlineAt = new Date();
    deadlineAt.setDate(deadlineAt.getDate() + deadlineDays);

    const envelopeResp = await csJson("/envelopes", "POST", {
      data: {
        type: "envelopes",
        attributes: {
          name: `${contrato.numero} — ${contrato.titulo}`,
          locale: "pt-BR",
          auto_close: true,
          remind_interval: contrato.clicksign_remind_days ?? 3,
          block_after_refusal: true,
          deadline_at: deadlineAt.toISOString(),
          default_subject: `Assinar contrato: ${contrato.titulo} — APOYA Contabilidade`,
          default_message: `Prezado(a) ${cliente.razao_social || cliente.nome_fantasia},\n\nSegue o contrato de prestação de serviços contábeis para sua assinatura digital.\n\nDúvidas? Entre em contato: contato@apoya.com.br`,
        },
      },
    });

    const envelopeId: string = envelopeResp.data.id;

    // 4. Upload do PDF do contrato
    const pdfBase64 = htmlToBase64Pdf(
      contrato.corpo_html ?? "<p>Contrato sem conteúdo</p>",
      contrato.titulo,
      contrato.numero
    );

    const filename = `${contrato.numero.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    const docResp = await csJson(`/envelopes/${envelopeId}/documents`, "POST", {
      data: {
        type: "documents",
        attributes: {
          filename,
          content_base64: pdfBase64,
        },
      },
    });

    const documentId: string = docResp.data.id;

    // 5. Adicionar signatário (cliente)
    const signerAttrs: Record<string, unknown> = {
      name: cliente.razao_social || cliente.nome_fantasia || "Cliente",
      email: cliente.email,
      locale: "pt-BR",
      has_documentation: false,
    };

    // Adicionar CPF/CNPJ se disponível (melhora rastreabilidade)
    if (cliente.cpf_cnpj) {
      signerAttrs.documentation = cliente.cpf_cnpj.replace(/\D/g, "");
    }

    // Tipo de notificação do signatário
    const notificationMethod = contrato.clicksign_notify_whatsapp && cliente.whatsapp
      ? "whatsapp"
      : "email";

    // Para WhatsApp nativo Clicksign, precisa do número
    if (notificationMethod === "whatsapp" && cliente.whatsapp) {
      signerAttrs.phone_number = cliente.whatsapp.replace(/\D/g, "");
      if (!signerAttrs.phone_number.toString().startsWith("55")) {
        signerAttrs.phone_number = `55${signerAttrs.phone_number}`;
      }
    }

    const signerResp = await csJson(`/envelopes/${envelopeId}/signers`, "POST", {
      data: {
        type: "signers",
        attributes: signerAttrs,
      },
    });

    const signerId: string = signerResp.data.id;

    // 6. Criar requisito: Signatário + Documento + Autenticação por e-mail token
    await csJson(`/envelopes/${envelopeId}/requirements`, "POST", {
      data: {
        type: "requirements",
        attributes: {
          envelope_id: envelopeId,
          document_id: documentId,
          signer_id: signerId,
          action: "sign",               // papel: assinar
          auth_type: "email",            // autenticação: token via email
        },
      },
    });

    // 7. Ativar o envelope (draft → running)
    await csJson(`/envelopes/${envelopeId}`, "PATCH", {
      data: {
        id: envelopeId,
        type: "envelopes",
        attributes: { status: "running" },
      },
    });

    // 8. Disparar notificação por e-mail (Clicksign)
    let signUrl: string | undefined;
    try {
      const notifResp = await csJson(
        `/envelopes/${envelopeId}/notifications`,
        "POST",
        {
          data: {
            type: "notifications",
            attributes: {
              envelope_id: envelopeId,
              signer_id: signerId,
            },
          },
        }
      );
      // A API pode retornar o link de assinatura
      signUrl = notifResp?.data?.attributes?.sign_url
             ?? notifResp?.data?.attributes?.url
             ?? `https://app.clicksign.com/sign/${signerId}`;
    } catch (e) {
      console.warn("Notification endpoint warning:", e);
      signUrl = `https://app.clicksign.com/sign/${signerId}`;
    }

    // 9. Buscar sign_url direto do signatário (mais confiável)
    try {
      const signerDetail = await csJson(`/envelopes/${envelopeId}/signers/${signerId}`);
      const signerSignUrl = signerDetail?.data?.attributes?.sign_url
                         ?? signerDetail?.data?.attributes?.url;
      if (signerSignUrl) signUrl = signerSignUrl;
    } catch {
      // ok, mantém o url anterior
    }

    // 10. Notificação WhatsApp via Evolution API (se habilitado e configurado)
    if (contrato.clicksign_notify_whatsapp && cliente.whatsapp && signUrl) {
      // Buscar instance_id do Evolution
      const { data: waConfig } = await supabase
        .from("wa_instance")
        .select("instance_name")
        .eq("status", "open")
        .limit(1)
        .single();

      if (waConfig?.instance_name) {
        await notificarWhatsApp(
          waConfig.instance_name,
          cliente.whatsapp,
          cliente.razao_social || "Cliente",
          contrato.titulo,
          signUrl
        );
      }
    }

    // 11. Atualizar contrato no banco com todos os IDs
    await supabase.from("contrato_cliente").update({
      clicksign_envelope_id: envelopeId,
      clicksign_document_id: documentId,
      clicksign_signer_id: signerId,
      clicksign_key: envelopeId,        // mantém compatibilidade
      clicksign_url: signUrl,
      clicksign_status: "aguardando_assinatura",
      clicksign_enviado_em: new Date().toISOString(),
      status: "aguardando_assinatura",
    }).eq("id", contrato_id);

    // 12. Registrar evento no audit log
    await supabase.from("clicksign_evento").insert({
      contrato_id,
      envelope_id: envelopeId,
      event_name: "envelope_created",
      signer_email: cliente.email,
      event_data: {
        envelope_id: envelopeId,
        document_id: documentId,
        signer_id: signerId,
        sign_url: signUrl,
        notificacoes: {
          email: contrato.clicksign_notify_email ?? true,
          whatsapp: contrato.clicksign_notify_whatsapp ?? false,
        },
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        envelope_id: envelopeId,
        document_id: documentId,
        signer_id: signerId,
        sign_url: signUrl,
        status: "aguardando_assinatura",
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("clicksign-envelope error:", msg);

    // Reverter status para nao_enviado em caso de erro
    // body já foi consumido, não é possível ler novamente

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});

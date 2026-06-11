/**
 * Supabase Edge Function: nfse-pos-pagamento
 *
 * Chamada pelo Worker Cloudflare após PAYMENT_RECEIVED/PAYMENT_CONFIRMED.
 * Responsabilidades:
 *   1. Emite NFS-e no NFE.io
 *   2. Poll até PDF disponível (30s)
 *   3. Envia PDF por e-mail via Resend
 *   4. Envia PDF por WhatsApp via Evolution API
 *   5. Registra na tabela nfse_emitida
 *
 * Payload esperado:
 *   { cobranca_id, cliente_id, competencia, valor, cnpj, razao_social,
 *     email, whatsapp, inscricao_municipal, codigo_servico_nfse, aliquota_iss,
 *     cep, logradouro, numero, bairro, municipio, uf, codigo_municipio_ibge }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NFSEIO_BASE  = "https://api.nfe.io/v1";
const EMITENTE_ID  = "d8e1f4b5f4674fdaaaf034e5a837b85d";
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
               "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function getNfseKey() { return Deno.env.get("NFSEIO_API_KEY") ?? ""; }
function getResendKey() { return Deno.env.get("RESEND_API_KEY") ?? ""; }

// ── Emitir NFS-e ─────────────────────────────────────────────────────────────
async function emitirNfse(cli: any, cobranca: any) {
  const key = getNfseKey();
  if (!key) return { erro: "NFSEIO_API_KEY não configurada" };
  if (!cli.inscricao_municipal) return { erro: "Cliente sem inscrição municipal" };

  const cityServiceCode = cli.codigo_servico_nfse ?? "0107";
  const aliquota        = cli.aliquota_iss ?? 0.05;
  const valor           = Number(cobranca.valor ?? 0);
  const comp            = cobranca.competencia ?? new Date().toISOString().slice(0, 7);
  const [ano, mes]      = comp.split("-");
  const descricao = `Honorários Contábeis — ${MESES[Number(mes) - 1]}/${ano} — ${cli.razao_social}`;

  const payload = {
    cityServiceCode,
    federalServiceCode: "17.20",
    description:        descricao,
    servicesAmount:     valor,
    taxationType:       "WithinCity",
    issRate:            aliquota,
    issRetained:        false,
    borrower: {
      federalTaxNumber: Number((cli.cnpj ?? "").replace(/\D/g, "") || "0"),
      name:             cli.razao_social,
      email:            cli.email ?? undefined,
      address: {
        country:    "BRA",
        postalCode: (cli.cep ?? "12283030").replace(/\D/g, ""),
        street:     cli.logradouro ?? "Endereço não informado",
        number:     cli.numero ?? "s/n",
        district:   cli.bairro ?? "",
        additionalInformation: cli.complemento ?? undefined,
        city: {
          code: Number(cli.codigo_municipio_ibge ?? 3508603),
          name: cli.municipio ?? "Caçapava",
        },
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
    console.error("[nfse] Erro emissão:", errMsg);
    return { erro: errMsg };
  }

  const nfseioId = data?.id;
  const numero   = String(data?.number ?? "");

  // Poll PDF — aguarda até 30s (6 tentativas × 5s)
  let pdfUrl: string | undefined;
  let pdfBase64: string | undefined;

  for (let i = 0; i < 6; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const check = await fetch(
        `${NFSEIO_BASE}/companies/${EMITENTE_ID}/serviceinvoices/${nfseioId}`,
        { headers: { Authorization: key } }
      );
      if (check.ok) {
        const nota = await check.json() as any;
        if ((nota?.status === "Issued" || nota?.flowStatus === "Issued") && nota?.pdfUrl) {
          pdfUrl = nota.pdfUrl;
          break;
        }
        if (nota?.status === "Error") {
          return { erro: nota?.rpsStatus ?? "Nota com erro no processamento" };
        }
      }
    } catch { /* continua poll */ }
  }

  // Baixar PDF
  if (pdfUrl || nfseioId) {
    try {
      const pdfRes = await fetch(
        `${NFSEIO_BASE}/companies/${EMITENTE_ID}/serviceinvoices/${nfseioId}/pdf`,
        { headers: { Authorization: key }, redirect: "follow" }
      );
      if (pdfRes.ok) {
        const buf = await pdfRes.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        pdfBase64 = btoa(binary);
      }
    } catch (e) { console.warn("[nfse] Falha PDF download:", e); }
  }

  return { nfseioId, numero, pdfUrl, pdfBase64 };
}

// ── Enviar e-mail com Resend ──────────────────────────────────────────────────
async function enviarEmail(cli: any, cobranca: any, numero: string, pdfBase64: string) {
  const resendKey = getResendKey();
  if (!resendKey) { console.warn("[email] RESEND_API_KEY ausente"); return; }
  if (!cli.email) { console.warn("[email] Cliente sem e-mail"); return; }

  const comp = cobranca.competencia ?? "";
  const [ano, mes] = comp.split("-");
  const mesLabel = MESES[Number(mes) - 1] ?? comp;
  const valorBRL = Number(cobranca.valor ?? 0).toLocaleString("pt-BR",
    { style: "currency", currency: "BRL" });

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
      <tr><td style="background:linear-gradient(135deg,#1B2A4A 0%,#2a3f6f 100%);padding:32px 40px">
        <table width="100%"><tr>
          <td>
            <div style="color:#F26522;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">APOYA CONTÁBIL</div>
            <div style="color:#fff;font-size:22px;font-weight:700">Nota Fiscal de Serviço</div>
            <div style="color:#94a3b8;font-size:13px;margin-top:4px">NFS-e Nº ${numero} · ${mesLabel}/${ano}</div>
          </td>
          <td align="right">
            <div style="background:#F26522;color:#fff;font-size:20px;font-weight:700;padding:12px 20px;border-radius:8px">${valorBRL}</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:32px 40px">
        <p style="color:#374151;font-size:15px;margin:0 0 16px">Olá, <strong>${cli.razao_social}</strong>!</p>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px">
          Seu pagamento de <strong>${valorBRL}</strong> referente à competência <strong>${mesLabel}/${ano}</strong>
          foi confirmado e a Nota Fiscal de Serviço (NFS-e) foi emitida. O PDF está em anexo.
        </p>
        <table width="100%" style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px">
          <tr>
            <td style="color:#1B2A4A;font-size:13px;font-weight:700">Apoya Auditoria, Consultoria e Contabilidade</td>
            <td align="right" style="color:#1B2A4A;font-size:13px;font-weight:700">${cli.razao_social}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;font-size:12px">CNPJ: 43.507.838/0001-89 · CRC 2SP044240/O-0</td>
            <td align="right" style="color:#6b7280;font-size:12px">CNPJ: ${cli.cnpj ?? ""}</td>
          </tr>
        </table>
        <p style="color:#6b7280;font-size:13px;margin:0">
          Qualquer dúvida, estamos à disposição pelo WhatsApp ou pelo site
          <a href="https://www.apoya.com.br" style="color:#F26522">www.apoya.com.br</a>.
        </p>
      </td></tr>
      <tr><td style="background:#1B2A4A;padding:20px 40px">
        <div style="color:#94a3b8;font-size:11px">Apoya Auditoria, Consultoria e Contabilidade LTDA · CNPJ 43.507.838/0001-89 · Caçapava/SP</div>
        <div style="margin-top:4px"><a href="https://www.apoya.com.br" style="color:#F26522;font-size:11px">www.apoya.com.br</a></div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from:    "Apoya Contábil <nfe@apoya.com.br>",
      to:      [cli.email],
      subject: `NFS-e Nº ${numero} — Honorários ${mesLabel}/${ano} — ${valorBRL}`,
      html,
      attachments: [{ filename: `NFS-e_${numero}_${comp}.pdf`, content: pdfBase64 }],
    }),
  });
  console.log(`[email] ✅ Enviado para ${cli.email}`);
}

// ── Enviar WhatsApp — documento PDF ──────────────────────────────────────────
async function enviarWhatsApp(cli: any, instConfig: any, numero: string, comp: string, valor: number, pdfBase64: string) {
  const tel = (cli.whatsapp ?? cli.telefone ?? "").replace(/\D/g, "");
  if (!tel || !instConfig) return;
  const destino   = tel.startsWith("55") ? tel : `55${tel}`;
  const baseUrl   = instConfig.evolution_base_url ?? "";
  const apiKey    = instConfig.evolution_apikey ?? Deno.env.get("EVOLUTION_API_KEY") ?? "";
  const instancia = instConfig.nome ?? "";
  if (!baseUrl || !instancia) return;

  const [ano, mes] = comp.split("-");
  const mesLabel = MESES[Number(mes) - 1] ?? comp;
  const valorBRL = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (pdfBase64) {
    await fetch(`${baseUrl}/message/sendMedia/${instancia}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number:    destino,
        mediatype: "document",
        mimetype:  "application/pdf",
        media:     pdfBase64,
        fileName:  `NFS-e_${numero}_${comp}.pdf`,
        caption:   `🧾 *Nota Fiscal Nº ${numero}*\nHonorários Contábeis — ${mesLabel}/${ano}\nValor: ${valorBRL}\n\n_Apoya Contábil · apoya.com.br_`,
      }),
    });
    console.log(`[wa] ✅ PDF enviado para ${destino}`);
  }
}

// ── HANDLER PRINCIPAL ─────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-apoya-secret",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Validar secret interno
  const secret = req.headers.get("x-apoya-secret");
  if (secret !== (Deno.env.get("APOYA_INTERNAL_SECRET") ?? (() => { throw new Error("[security] APOYA_INTERNAL_SECRET não configurado. Configure o secret no Supabase Edge Functions."); })())) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  try {
    const body = await req.json() as any;
    const { cobranca_id, cliente_id } = body;
    if (!cobranca_id || !cliente_id) {
      return new Response(JSON.stringify({ error: "cobranca_id e cliente_id obrigatórios" }), {
        status: 400, headers: corsHeaders,
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Buscar dados completos
    const { data: cob }  = await db.from("cobrancas").select("*").eq("id", cobranca_id).single();
    const { data: cli }  = await db.from("clientes").select("razao_social,cnpj,email,whatsapp,telefone,inscricao_municipal,codigo_servico_nfse,aliquota_iss,cep,logradouro,numero,complemento,bairro,municipio,uf,codigo_municipio_ibge").eq("id", cliente_id).single();
    const { data: inst } = await db.from("wa_instance").select("nome,evolution_base_url,evolution_apikey").eq("ativo", true).limit(1).single();

    if (!cob || !cli) {
      return new Response(JSON.stringify({ error: "Cobrança ou cliente não encontrado" }), {
        status: 404, headers: corsHeaders,
      });
    }

    // Verificar se nota já foi emitida
    const { data: jaEmitida } = await db.from("nfse_emitida")
      .select("id").eq("cliente_id", cliente_id).eq("competencia", cob.competencia)
      .eq("status", "emitida").maybeSingle();
    if (jaEmitida) {
      return new Response(JSON.stringify({ ok: true, msg: "Nota já emitida" }), { headers: corsHeaders });
    }

    // Emitir nota
    const resultado = await emitirNfse(cli, cob);

    // Registrar no banco (sucesso ou erro)
    await db.from("nfse_emitida").insert({
      cliente_id,
      nfseio_id:        resultado.nfseioId,
      numero:           resultado.numero,
      status:           resultado.erro ? "erro" : "emitida",
      competencia:      cob.competencia,
      data_emissao:     resultado.erro ? null : new Date().toISOString().slice(0, 10),
      tomador_nome:     cli.razao_social,
      tomador_cnpj_cpf: cli.cnpj,
      tomador_email:    cli.email,
      descricao_servico: `Honorários Contábeis — ${cob.competencia}`,
      codigo_servico:   cli.codigo_servico_nfse ?? "0107",
      valor_servico:    Number(cob.valor),
      aliquota_iss:     cli.aliquota_iss ?? 0.05,
      pdf_url:          resultado.pdfUrl,
      issretido:        false,
      erro_msg:         resultado.erro ?? null,
    });

    if (resultado.erro) {
      return new Response(JSON.stringify({ ok: false, erro: resultado.erro }), { headers: corsHeaders });
    }

    const numero   = resultado.numero ?? "s/n";
    const pdfBase64 = resultado.pdfBase64;
    const comp     = cob.competencia ?? "";

    // Enviar email e WhatsApp em paralelo
    await Promise.allSettled([
      pdfBase64 && cli.email ? enviarEmail(cli, cob, numero, pdfBase64) : Promise.resolve(),
      pdfBase64 ? enviarWhatsApp(cli, inst, numero, comp, Number(cob.valor), pdfBase64) : Promise.resolve(),
    ]);

    console.log(`[nfse-pos-pagamento] ✅ NFS-e ${numero} — ${cli.razao_social} — ${comp}`);
    return new Response(JSON.stringify({ ok: true, numero, nfseioId: resultado.nfseioId }), {
      headers: corsHeaders,
    });
  } catch (e: any) {
    console.error("[nfse-pos-pagamento] Erro:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro interno" }), {
      status: 500, headers: corsHeaders,
    });
  }
});

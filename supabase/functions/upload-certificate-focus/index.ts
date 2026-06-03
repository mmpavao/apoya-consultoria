/**
 * upload-certificate-focus — Edge Function
 * Recebe PFX em base64 + senha + CNPJ
 * Faz upload para Focus NF-e via POST /v2/empresas/{cnpj}/certificado
 * Retorna: { ok, certRef, validUntil, status }
 *
 * Auth Focus NF-e: HTTP Basic (token : "")
 * Secret: FOCUSNFE_API_TOKEN
 * Docs: https://doc.focusnfe.com.br/reference/empresa_certificado
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FOCUS_TOKEN = Deno.env.get("FOCUSNFE_API_TOKEN")!;
const FOCUS_BASE  = Deno.env.get("FOCUSNFE_AMBIENTE") === "producao"
  ? "https://api.focusnfe.com.br/v2"
  : "https://homologacao.focusnfe.com.br/v2";

function focusAuth(): string {
  return `Basic ${btoa(`${FOCUS_TOKEN}:`)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { pfxBase64, password, cnpj } = await req.json();

    if (!pfxBase64 || !password || !cnpj) {
      return Response.json(
        { ok: false, error: "pfxBase64, password e cnpj são obrigatórios" },
        { headers: CORS, status: 400 }
      );
    }

    if (!FOCUS_TOKEN) {
      return Response.json(
        { ok: false, error: "FOCUSNFE_API_TOKEN não configurado" },
        { headers: CORS, status: 500 }
      );
    }

    const cnpjLimpo = cnpj.replace(/\D/g, "");

    // Converter base64 → Blob para multipart
    const pfxBytes = Uint8Array.from(atob(pfxBase64), (c) => c.charCodeAt(0));
    const pfxBlob  = new Blob([pfxBytes], { type: "application/x-pkcs12" });

    const form = new FormData();
    form.append("arquivo", pfxBlob, "certificado.pfx");
    form.append("senha", password);

    // POST /v2/empresas/{cnpj}/certificado
    const uploadResp = await fetch(
      `${FOCUS_BASE}/empresas/${cnpjLimpo}/certificado`,
      {
        method: "POST",
        headers: { "Authorization": focusAuth() },
        body: form,
      }
    );

    const uploadData = await uploadResp.json().catch(() => ({}));

    if (!uploadResp.ok) {
      return Response.json(
        { ok: false, error: `Focus NF-e retornou ${uploadResp.status}`, detail: uploadData },
        { headers: CORS, status: 502 }
      );
    }

    return Response.json({
      ok:         true,
      certRef:    cnpjLimpo,
      validUntil: uploadData?.data_expiracao ?? null,
      status:     uploadData?.status ?? "ativo",
      detail:     uploadData,
    }, { headers: CORS });

  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { headers: CORS, status: 500 }
    );
  }
});

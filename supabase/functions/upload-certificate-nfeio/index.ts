/**
 * upload-certificate-nfeio — Edge Function
 * Recebe PFX em base64 + senha + CNPJ
 * Faz upload para NFE.io via POST /v1/companies/{emitente_id}/certificate
 * Retorna: { ok, certId, validUntil, status }
 * 
 * O emitente_id é resolvido pelo CNPJ consultando GET /v1/companies
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { pfxBase64, password, cnpj } = await req.json();

    if (!pfxBase64 || !password) {
      return Response.json(
        { ok: false, error: "pfxBase64 e password são obrigatórios" },
        { headers: CORS, status: 400 }
      );
    }

    const NFEIO_KEY = Deno.env.get("NFEIO_API_KEY_NOTA_FISCAL");
    if (!NFEIO_KEY) {
      return Response.json(
        { ok: false, error: "NFEIO_API_KEY_NOTA_FISCAL não configurada" },
        { headers: CORS, status: 500 }
      );
    }

    const cnpjLimpo = (cnpj ?? "").replace(/\D/g, "");

    // 1. Resolver emitente_id pelo CNPJ
    let emitenteId: string | null = null;

    const listResp = await fetch("https://api.nfe.io/v1/companies", {
      headers: { "Authorization": NFEIO_KEY },
    });

    if (listResp.ok) {
      const listData = await listResp.json();
      const companies: Array<{ id: string; federalTaxNumber: string }> =
        listData?.companies ?? listData?.data ?? listData ?? [];

      const match = companies.find(
        (c) => c.federalTaxNumber?.replace(/\D/g, "") === cnpjLimpo
      );
      if (match) emitenteId = match.id;
    }

    // Fallback: usar o emitente padrão da APOYA
    if (!emitenteId) {
      emitenteId = "d8e1f4b5f4674fdaaaf034e5a837b85d";
    }

    // 2. Converter base64 → Blob para multipart
    const pfxBytes = Uint8Array.from(atob(pfxBase64), (c) => c.charCodeAt(0));
    const pfxBlob  = new Blob([pfxBytes], { type: "application/x-pkcs12" });

    const form = new FormData();
    form.append("file", pfxBlob, "certificado.pfx");
    form.append("password", password);

    // 3. Upload para NFE.io
    const uploadResp = await fetch(
      `https://api.nfe.io/v1/companies/${emitenteId}/certificate`,
      {
        method: "POST",
        headers: { "Authorization": NFEIO_KEY },
        body: form,
      }
    );

    const uploadData = await uploadResp.json().catch(() => ({}));

    if (!uploadResp.ok) {
      return Response.json(
        { ok: false, error: `NFE.io retornou ${uploadResp.status}`, detail: uploadData },
        { headers: CORS, status: 502 }
      );
    }

    const cert = uploadData?.certificate ?? uploadData;

    return Response.json({
      ok:         true,
      certId:     cert?.taxPayerId ?? emitenteId,
      validUntil: cert?.validUntil ?? null,
      status:     cert?.status ?? "Active",
      thumbprint: cert?.thumbprint ?? null,
    }, { headers: CORS });

  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { headers: CORS, status: 500 }
    );
  }
});

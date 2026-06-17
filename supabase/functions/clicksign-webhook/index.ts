/**
 * Edge Function: clicksign-webhook
 * Recebe eventos Clicksign, valida HMAC SHA256 e atualiza banco.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const HMAC_SECRET = Deno.env.get("CLICKSIGN_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// HMAC-SHA256 usando Web Crypto API nativa do Deno
async function computeHmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function validateHmac(body: string, header: string | null): Promise<boolean> {
  // FAIL-CLOSED: sem assinatura ou sem secret configurado → REJEITA.
  // (antes retornava true "em dev" → permitia forjar evento de assinatura.)
  if (!header || !HMAC_SECRET) {
    console.error("HMAC header ausente ou secret não configurado — REJEITANDO");
    return false;
  }
  const expected = header.replace("sha256=", "");
  const computed = await computeHmac(HMAC_SECRET, body);
  return computed === expected;
}

const EVENT_STATUS_MAP: Record<string, string> = {
  sign:     "aguardando_assinatura",
  close:    "assinado",
  cancel:   "cancelado",
  deadline: "expirado",
  refusal:  "recusado",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();
  const hmacHeader = req.headers.get("Content-Hmac");
  const isValid = await validateHmac(rawBody, hmacHeader);

  if (!isValid) {
    console.error("HMAC inválido:", hmacHeader);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawBody); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const eventData = payload?.event as Record<string, unknown> ?? {};
    const eventName = eventData?.name as string ?? "unknown";
    const document = payload?.document as Record<string, unknown> ?? {};
    const signers = payload?.signers as Record<string, unknown>[] ?? [];

    const envelopeKey = document?.key as string
      ?? document?.envelope_key as string
      ?? String(eventData?.data ?? "");

    const signerEmail = signers?.[0]?.email as string | undefined;

    let contratoId: string | undefined;
    if (envelopeKey) {
      const { data } = await supabase
        .from("contrato_cliente")
        .select("id")
        .or(`clicksign_envelope_id.eq.${envelopeKey},clicksign_key.eq.${envelopeKey}`)
        .maybeSingle();
      contratoId = data?.id;
    }

    // Audit log
    await supabase.from("clicksign_evento").insert({
      contrato_id: contratoId ?? null,
      envelope_id: envelopeKey || "unknown",
      event_name: eventName,
      signer_email: signerEmail ?? null,
      event_data: { document, signers, event: eventData },
      raw_payload: payload,
    });

    // Atualizar contrato
    if (contratoId && EVENT_STATUS_MAP[eventName]) {
      const updates: Record<string, unknown> = {
        clicksign_status: EVENT_STATUS_MAP[eventName],
      };

      if (eventName === "close") {
        updates.clicksign_assinado_em = new Date().toISOString();
        updates.status = "ativo";
        const pdfUrl = document?.signed_file_url
          ?? (document?.files as Record<string, unknown>)?.signed;
        if (pdfUrl) updates.clicksign_pdf_url = pdfUrl;
      } else if (eventName === "cancel" || eventName === "refusal") {
        updates.status = "cancelado";
      }

      await supabase.from("contrato_cliente").update(updates).eq("id", contratoId);
    }

    return new Response(JSON.stringify({ ok: true, event: eventName }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("webhook error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200, // retornar 200 para não gerar retry infinito do Clicksign
      headers: { "Content-Type": "application/json" },
    });
  }
});

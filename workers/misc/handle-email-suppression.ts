import { createClient } from 'npm:@supabase/supabase-js@2'

// NOTE: LOVABLE SDK REMOVED — npm:@lovable.dev/webhooks-js removido
// Webhook signature verification agora usa HMAC-SHA256 nativo (Web Crypto API)
// Required secret: WEBHOOK_SECRET (ou RESEND_WEBHOOK_SECRET) para verificar assinatura do Resend

interface SuppressionPayload {
  email: string
  reason: 'bounce' | 'complaint' | 'unsubscribe'
  message_id?: string
  metadata?: Record<string, unknown>
  is_retry: boolean
  retry_count: number
}

function parseSuppressionPayload(body: string): SuppressionPayload {
  const parsed = JSON.parse(body)
  if (!parsed.data) {
    throw new Error('Missing data field in payload')
  }
  const data = parsed.data as SuppressionPayload
  if (!data.email || !data.reason) {
    throw new Error('Missing required fields: email, reason')
  }
  return data
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Verificação HMAC-SHA256 nativa — compatível com Resend webhooks
async function verifyHmacSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    // Resend envia no header svix-signature ou x-resend-signature
    const sigBytes = base64ToBytes(signature.replace(/^sha256=/, ''))
    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body))
  } catch {
    return false
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

function mapReasonToStatus(reason: string): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce': return 'bounced'
    case 'complaint': return 'complained'
    default: return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce': return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint': return 'Spam complaint — recipient marked email as spam'
    case 'unsubscribe': return 'Recipient unsubscribed'
    default: return 'Email suppressed'
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  // Usar RESEND_WEBHOOK_SECRET ou WEBHOOK_SECRET — não mais LOVABLE_API_KEY
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? Deno.env.get('WEBHOOK_SECRET')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[handle-email-suppression] Missing SUPABASE env vars')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const bodyText = await req.text()

  // Verificação de assinatura opcional — se secret não configurado, aceitar sem verificação
  if (webhookSecret) {
    const sig = req.headers.get('svix-signature')
      ?? req.headers.get('x-resend-signature')
      ?? req.headers.get('x-webhook-signature')
    const isValid = await verifyHmacSignature(bodyText, sig, webhookSecret)
    if (!isValid) {
      console.error('[handle-email-suppression] Invalid webhook signature')
      return jsonResponse({ error: 'Invalid signature' }, 401)
    }
  } else {
    console.warn('[handle-email-suppression] RESEND_WEBHOOK_SECRET not set — skipping signature verification')
  }

  let payload: SuppressionPayload
  try {
    payload = parseSuppressionPayload(bodyText)
  } catch (err) {
    console.error('[handle-email-suppression] Invalid payload:', err)
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = payload.email.toLowerCase()

  // 1. Upsert em suppressed_emails (idempotente — seguro para retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason: payload.reason,
        metadata: payload.metadata ?? null,
      },
      { onConflict: 'email' }
    )

  if (suppressError) {
    console.error('[handle-email-suppression] Failed to upsert:', suppressError)
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Registrar no log de envio
  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: payload.message_id ?? null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: mapReasonToStatus(payload.reason),
      error_message: mapReasonToMessage(payload.reason),
      metadata: payload.metadata ?? null,
    })

  if (insertError) {
    console.warn('[handle-email-suppression] Failed to insert log (non-fatal):', insertError)
  }

  console.log('[handle-email-suppression] Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason: payload.reason,
    is_retry: payload.is_retry,
    retry_count: payload.retry_count,
  })

  return jsonResponse({ success: true })
})

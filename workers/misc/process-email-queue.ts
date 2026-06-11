import { createClient } from 'npm:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// GenPro360 Process Email Queue — migrado de Lovable SDK para Resend direto
// Data: 2026-05-20 | Purge: remove-lovable-references
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_SEND_DELAY_MS = 200
const DEFAULT_AUTH_TTL_MINUTES = 15
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60

// Payload de uma mensagem na fila
interface EmailQueueMessage {
  run_id?: string
  to: string
  from?: string
  sender_domain?: string
  subject: string
  html: string
  text?: string
  purpose?: string
  label?: string
  idempotency_key?: string
  unsubscribe_token?: string
  message_id: string
  retry_count?: number
}

function isRateLimited(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429
  }
  return error instanceof Error && error.message.includes('429')
}

function isForbidden(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 403
  }
  return error instanceof Error && error.message.includes('403')
}

function getRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === 'object' && 'retryAfterSeconds' in error) {
    return (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
  }
  return 60
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

async function moveToDlq(
  supabase: ReturnType<typeof createClient>,
  queue: string,
  msg: { msg_id: number; message: Record<string, unknown> },
  reason: string
): Promise<void> {
  const payload = msg.message
  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: (payload.label || queue) as string,
    recipient_email: payload.to,
    status: 'dlq',
    error_message: reason,
  })
  const { error } = await supabase.rpc('move_to_dlq', {
    source_queue: queue,
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
  })
  if (error) {
    console.error('Failed to move message to DLQ', { queue, msg_id: msg.msg_id, reason, error })
  }
}

// ---------------------------------------------------------------------------
// Envio via Resend — substitui sendLovableEmail
// ---------------------------------------------------------------------------

async function sendViaResend(
  resendApiKey: string,
  fromEmail: string,
  payload: EmailQueueMessage
): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: payload.from ?? fromEmail,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: payload.message_id
        ? { 'Message-ID': `<${payload.message_id}>` }
        : undefined,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    const err = new Error(`Resend API error ${response.status}: ${errorText}`) as Error & { status: number }
    err.status = response.status
    throw err
  }
}

// ---------------------------------------------------------------------------
// Handler principal
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('EMAIL_FROM') ?? 'noreply@genprohub.com'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!resendApiKey) {
    console.warn('[process-email-queue] RESEND_API_KEY nao configurada — fila ignorada')
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY not configured', skipped: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[process-email-queue] Variaveis Supabase ausentes')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Verificar JWT do caller (deve ser service role ou cron interno)
  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '')
  const claims = parseJwtClaims(callerToken)
  if (!claims || (claims.role !== 'service_role' && claims.iss !== 'supabase')) {
    console.error('[process-email-queue] Token invalido ou sem permissao')
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Ler parametros da request
  let batchSize = DEFAULT_BATCH_SIZE
  let sendDelayMs = DEFAULT_SEND_DELAY_MS
  let queues = ['auth_emails', 'transactional_emails']

  try {
    const body = await req.json().catch(() => ({}))
    if (body.batch_size) batchSize = Number(body.batch_size)
    if (body.send_delay_ms) sendDelayMs = Number(body.send_delay_ms)
    if (Array.isArray(body.queues)) queues = body.queues
  } catch {
    // Usar defaults
  }

  let totalProcessed = 0
  let totalFailed = 0

  for (const queue of queues) {
    // Buscar mensagens pendentes
    const { data: messages, error: fetchError } = await supabase.rpc('read_email_queue', {
      queue_name: queue,
      batch_size: batchSize,
    })

    if (fetchError) {
      console.error(`[process-email-queue] Erro ao ler fila ${queue}:`, fetchError)
      continue
    }

    if (!messages || messages.length === 0) {
      console.log(`[process-email-queue] Fila ${queue} vazia`)
      continue
    }

    for (const msg of messages) {
      const payload = msg.message as EmailQueueMessage
      const retryCount = payload.retry_count ?? 0

      // Checar idempotência
      if (payload.idempotency_key) {
        const { data: existing } = await supabase
          .from('email_send_log')
          .select('id')
          .eq('message_id', payload.idempotency_key)
          .eq('status', 'sent')
          .maybeSingle()

        if (existing) {
          console.log(`[process-email-queue] Mensagem duplicada ignorada: ${payload.idempotency_key}`)
          await supabase.rpc('delete_email', { queue_name: queue, message_id: msg.msg_id })
          continue
        }
      }

      try {
        await sendViaResend(resendApiKey, fromEmail, payload)

        // Log sucesso
        await supabase.from('email_send_log').insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: 'sent',
        })

        // Deletar da fila
        const { error: delError } = await supabase.rpc('delete_email', {
          queue_name: queue,
          message_id: msg.msg_id,
        })
        if (delError) {
          console.error('[process-email-queue] Erro ao deletar mensagem da fila', { queue, msg_id: msg.msg_id, error: delError })
        }

        totalProcessed++

        // Delay entre envios para respeitar rate limit
        if (sendDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, sendDelayMs))
        }

      } catch (error) {
        console.error(`[process-email-queue] Erro ao enviar msg ${payload.message_id}:`, error)

        if (isForbidden(error)) {
          await moveToDlq(supabase, queue, msg, `Forbidden: ${String(error)}`)
          totalFailed++
          continue
        }

        if (isRateLimited(error)) {
          const retryAfter = getRetryAfterSeconds(error)
          console.warn(`[process-email-queue] Rate limited — aguardar ${retryAfter}s`)
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
          continue
        }

        if (retryCount >= MAX_RETRIES) {
          await moveToDlq(supabase, queue, msg, `Max retries (${MAX_RETRIES}) exceeded: ${String(error)}`)
          totalFailed++
        } else {
          // Incrementar retry_count e recolocar na fila
          await supabase.rpc('nack_email', {
            queue_name: queue,
            message_id: msg.msg_id,
            retry_count: retryCount + 1,
          })
        }
      }
    }
  }

  console.log(`[process-email-queue] Concluido — enviados: ${totalProcessed} / falhas: ${totalFailed}`)

  return new Response(
    JSON.stringify({ processed: totalProcessed, failed: totalFailed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})

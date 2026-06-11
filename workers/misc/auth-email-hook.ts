import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'
import { AUTH_SUBJECTS, resolveLocale } from '../_shared/email-templates/_i18n.tsx'

// ---------------------------------------------------------------------------
// GenPro360 Auth Email Hook — migrado de Lovable SDK para Resend direto
// Data: 2026-05-20 | Purge: remove-lovable-references
// ---------------------------------------------------------------------------

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-supabase-signature',
}

interface AuthEmailPayload {
  user: {
    id: string
    email: string
    user_metadata?: Record<string, unknown>
    app_metadata?: Record<string, unknown>
  }
  email_data: {
    token?: string
    token_hash?: string
    redirect_to?: string
    email_action_type: 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'reauthentication' | 'email_change_new'
    site_url?: string
    confirmation_url?: string
    new_email?: string
    token_new?: string
    token_hash_new?: string
  }
}

type EmailActionType = AuthEmailPayload['email_data']['email_action_type']

interface ResendEmailPayload {
  from: string
  to: string
  subject: string
  html: string
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function renderEmailHtml(
  actionType: EmailActionType,
  payload: AuthEmailPayload
): Promise<{ html: string; subject: string }> {
  const locale = resolveLocale(payload.user?.user_metadata?.locale as string | undefined)
  const subjects = AUTH_SUBJECTS[locale] ?? AUTH_SUBJECTS['pt-BR']
  const emailData = payload.email_data

  const confirmationUrl = emailData.confirmation_url
    ?? emailData.redirect_to
    ?? emailData.site_url
    ?? 'https://genprohub.com'

  let component: React.ReactElement
  let subject: string

  switch (actionType) {
    case 'signup':
      component = React.createElement(SignupEmail, { confirmationUrl, locale })
      subject = subjects.signup
      break
    case 'invite':
      component = React.createElement(InviteEmail, { confirmationUrl, locale })
      subject = subjects.invite
      break
    case 'magiclink':
      component = React.createElement(MagicLinkEmail, { magicLinkUrl: confirmationUrl, locale })
      subject = subjects.magiclink
      break
    case 'recovery':
      component = React.createElement(RecoveryEmail, { recoveryUrl: confirmationUrl, locale })
      subject = subjects.recovery
      break
    case 'email_change':
    case 'email_change_new':
      component = React.createElement(EmailChangeEmail, {
        confirmationUrl,
        newEmail: emailData.new_email ?? payload.user.email,
        locale,
      })
      subject = subjects.email_change
      break
    case 'reauthentication':
      component = React.createElement(ReauthenticationEmail, {
        token: emailData.token ?? '',
        locale,
      })
      subject = subjects.reauthentication
      break
    default:
      throw new Error(`Unknown email action type: ${actionType}`)
  }

  const html = await renderAsync(component)
  return { html, subject }
}

async function sendViaResend(resendApiKey: string, payload: ResendEmailPayload): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: payload.from,
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error ${response.status}: ${error}`)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('EMAIL_FROM') ?? 'noreply@genprohub.com'
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!resendApiKey) {
    // Não bloquear o fluxo de auth — apenas logar e retornar 200
    console.warn('[auth-email-hook] RESEND_API_KEY nao configurada — email ignorado')
    return jsonResponse({ message: 'Email skipped: RESEND_API_KEY not configured' }, 200)
  }

  let body: AuthEmailPayload
  try {
    body = await req.json() as AuthEmailPayload
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const actionType = body?.email_data?.email_action_type
  const recipientEmail = body?.user?.email

  if (!actionType || !recipientEmail) {
    return jsonResponse({ error: 'Missing required fields: email_action_type, user.email' }, 400)
  }

  console.log(`[auth-email-hook] tipo=${actionType} destinatario=${recipientEmail}`)

  try {
    const { html, subject } = await renderEmailHtml(actionType, body)

    await sendViaResend(resendApiKey, {
      from: fromEmail,
      to: recipientEmail,
      subject,
      html,
    })

    // Log opcional no banco
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        await supabase.from('email_send_log').insert({
          recipient_email: recipientEmail,
          template_name: `auth_${actionType}`,
          status: 'sent',
          message_id: crypto.randomUUID(),
        })
      } catch (logErr) {
        console.error('[auth-email-hook] Erro ao registrar log:', logErr)
      }
    }

    return jsonResponse({ message: 'Email sent successfully' }, 200)

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[auth-email-hook] Erro tipo=${actionType}:`, msg)
    // Retornar 200 para nao bloquear auth — email falho nao impede signup
    return jsonResponse({ error: msg, skipped: true }, 200)
  }
})

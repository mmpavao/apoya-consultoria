import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

// NOTE: LOVABLE SDK REMOVED — LOVABLE_API_KEY removido
// Auth agora usa PREVIEW_AUTH_TOKEN (Supabase secret interno)
// Se PREVIEW_AUTH_TOKEN não configurado, endpoint retorna 503 (não 500)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Autenticação via PREVIEW_AUTH_TOKEN — substitui LOVABLE_API_KEY
  const previewToken = Deno.env.get('PREVIEW_AUTH_TOKEN')
  if (!previewToken) {
    console.warn('[preview-transactional-email] PREVIEW_AUTH_TOKEN not configured')
    return new Response(
      JSON.stringify({ error: 'Preview endpoint not configured' }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (token !== previewToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const templateNames = Object.keys(TEMPLATES)
  const results: Array<{
    templateName: string
    displayName: string
    subject: string
    html: string
    status: 'ready' | 'preview_data_required' | 'render_failed'
    errorMessage?: string
  }> = []

  for (const name of templateNames) {
    const tpl = TEMPLATES[name as keyof typeof TEMPLATES]
    if (!tpl) continue

    if (!tpl.previewData) {
      results.push({
        templateName: name,
        displayName: tpl.displayName ?? name,
        subject: '',
        html: '',
        status: 'preview_data_required',
      })
      continue
    }

    try {
      const { subject, html } = await renderAsync(React.createElement(tpl.component, tpl.previewData as never))
        .then(html => ({ subject: tpl.subject ?? name, html }))

      results.push({
        templateName: name,
        displayName: tpl.displayName ?? name,
        subject: tpl.subject ?? name,
        html,
        status: 'ready',
      })
    } catch (err) {
      results.push({
        templateName: name,
        displayName: tpl.displayName ?? name,
        subject: '',
        html: '',
        status: 'render_failed',
        errorMessage: String(err),
      })
    }
  }

  return new Response(JSON.stringify({ templates: results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

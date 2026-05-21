// Edge Function: send-invite
// Gera token SHA-256 seguro, salva no banco e envia e-mail de convite
// POST /functions/v1/send-invite
// Body: { email, role, setores_ids?, mensagem? }
// Auth: Bearer token do usuário logado (deve ser admin)

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL      = Deno.env.get("APP_URL") ?? "https://apoyaproject.zapro.tech";
const SMTP_FROM    = Deno.env.get("SMTP_FROM") ?? "nao-responder@apoya.com.br";

const VALID_ROLES = ["admin","contador","assistente","agente","supervisor"];

const ROLE_LABELS: Record<string, string> = {
  admin:      "Administrador",
  contador:   "Contador",
  assistente: "Assistente",
  agente:     "Agente",
  supervisor: "Supervisor",
};

Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // ── Auth: verificar JWT ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: "Invalid token" }, 401);

  // ── Verificar role admin ─────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleRow?.role !== "admin") {
    return json({ error: "Only admins can send invites" }, 403);
  }

  // ── Validar body ─────────────────────────────────────────────
  let body: { email: string; role: string; setores_ids?: string[]; mensagem?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { email, role, setores_ids = [], mensagem } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: "E-mail inválido" }, 400);
  }
  if (!VALID_ROLES.includes(role)) {
    return json({ error: `Role inválido. Use: ${VALID_ROLES.join(", ")}` }, 400);
  }

  // ── Verificar se já existe convite pendente para esse e-mail ─
  const { data: existing } = await admin
    .from("convites")
    .select("id, expira_em")
    .eq("email", email.toLowerCase())
    .is("usado_em", null)
    .is("cancelado_em", null)
    .gt("expira_em", new Date().toISOString())
    .maybeSingle();

  if (existing) {
    return json({ error: `Já existe um convite pendente para ${email}. Cancele-o antes de reenviar.` }, 409);
  }

  // ── Gerar token seguro (32 bytes → 64 chars hex) ─────────────
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

  // ── Salvar convite no banco ──────────────────────────────────
  const { data: convite, error: insertErr } = await admin
    .from("convites")
    .insert({
      email:      email.toLowerCase(),
      role,
      token,
      setores_ids,
      criado_por: user.id,
      mensagem,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("Insert convite error:", insertErr);
    return json({ error: "Erro ao criar convite" }, 500);
  }

  // ── Montar link de aceite ────────────────────────────────────
  const acceptUrl = `${APP_URL}/aceitar-convite?token=${token}`;

  // ── Enviar e-mail via Supabase Auth (invite) ─────────────────
  // Usamos o auth admin para enviar o magic link com redirect
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: acceptUrl,
    data: {
      convite_id: convite.id,
      role,
      invited_by: user.email,
    },
  });

  if (mailError) {
    // Rollback: deletar convite se o e-mail falhou
    await admin.from("convites").delete().eq("id", convite.id);
    console.error("Email send error:", mailError);
    return json({ error: `Erro ao enviar e-mail: ${mailError.message}` }, 500);
  }

  return json({
    ok: true,
    convite_id: convite.id,
    message: `Convite enviado para ${email} com role ${ROLE_LABELS[role]}`,
  });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

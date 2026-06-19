/**
 * POST /api/usuarios/convidar
 * Convida novo usuário via Supabase Admin Auth (inviteUserByEmail).
 * Apenas admins podem chamar esta rota.
 * Body: { email: string, nome?: string, role?: UsuarioRole }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/usuarios/convidar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Autenticar chamador
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
        const token = auth.replace("Bearer ", "");

        const db = supabaseAdmin as any;
        const { data: caller, error: authErr } = await db.auth.getUser(token);
        if (authErr || !caller?.user) return json({ error: "Token inválido" }, 401);

        // Verificar se o chamador é admin
        const { data: roleRow } = await db
          .from("user_roles")
          .select("role")
          .eq("user_id", caller.user.id)
          .single();

        if (roleRow?.role !== "admin") {
          return json({ error: "Apenas administradores podem convidar usuários" }, 403);
        }

        const body = await request.json() as { email?: string; nome?: string; role?: string };
        const { email, nome, role = "assistente" } = body;

        if (!email || !email.includes("@")) {
          return json({ error: "E-mail inválido" }, 400);
        }

        // Convidar via Admin API
        const { data: invited, error: inviteErr } = await db.auth.admin.inviteUserByEmail(email, {
          data: { full_name: nome ?? "" },
          redirectTo: `${process.env.PUBLIC_URL ?? "https://apoya-gestao.talkzzbot.workers.dev"}/login`,
        });

        if (inviteErr) {
          // Se já existe, apenas retornar OK (idempotente)
          if (inviteErr.message?.includes("already been registered")) {
            return json({ ok: true, message: "Usuário já cadastrado — e-mail não reenviado" });
          }
          return json({ error: inviteErr.message }, 400);
        }

        const userId = invited?.user?.id;

        if (userId) {
          // Inserir profile se não existir (coluna real é `nome`, não full_name)
          const { error: profErr } = await db.from("profiles").upsert({
            id: userId,
            email,
            nome: nome ?? "",
          }, { onConflict: "id", ignoreDuplicates: false });
          if (profErr) return json({ ok: false, error: "Convite enviado, mas falhou ao gravar o profile: " + profErr.message }, 500);

          // Inserir role
          await db.from("user_roles").upsert({
            user_id: userId,
            role,
          }, { onConflict: "user_id", ignoreDuplicates: false });
        }

        return json({ ok: true, userId, email, role });
      },
    },
  },
});

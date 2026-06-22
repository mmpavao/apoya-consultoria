/**
 * POST /api/usuarios/convidar
 * Convida novo usuário via Supabase Admin Auth (inviteUserByEmail).
 * Auth: apenas admin.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse, requireAdmin } from "@/lib/api-auth";

export const Route = createFileRoute("/api/usuarios/convidar")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const auth = await requireAdmin(request);
        if (auth instanceof Response) return auth;

        const body = await request.json() as { email?: string; nome?: string; role?: string };
        const { email, nome, role = "assistente" } = body;

        if (!email || !email.includes("@")) {
          return jsonResponse({ error: "E-mail inválido" }, 400);
        }

        const db = supabaseAdmin as any;
        const { data: invited, error: inviteErr } = await db.auth.admin.inviteUserByEmail(email, {
          data: { full_name: nome ?? "" },
          redirectTo: `${process.env.PUBLIC_URL ?? "https://apoyaproject.zapro.tech"}/login`,
        });

        if (inviteErr) {
          if (inviteErr.message?.includes("already been registered")) {
            return jsonResponse({ ok: true, message: "Usuário já cadastrado — e-mail não reenviado" });
          }
          return jsonResponse({ error: inviteErr.message }, 400);
        }

        const userId = invited?.user?.id;

        if (userId) {
          const { error: profErr } = await db.from("profiles").upsert({
            id: userId,
            email,
            nome: nome ?? "",
          }, { onConflict: "id", ignoreDuplicates: false });
          if (profErr) return jsonResponse({ ok: false, error: "Convite enviado, mas falhou ao gravar o profile: " + profErr.message }, 500);

          await db.from("user_roles").upsert({
            user_id: userId,
            role,
          }, { onConflict: "user_id", ignoreDuplicates: false });
        }

        return jsonResponse({ ok: true, userId, email, role });
      },
    },
  },
});

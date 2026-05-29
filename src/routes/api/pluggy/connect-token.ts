/**
 * POST /api/pluggy/connect-token — Gera um Connect Token server-side para abrir o Pluggy Connect
 *
 * Body (opcional):
 *   { clientUserId?: string }  — ID do cliente para rastreamento (ex: empresa_id do Supabase)
 *
 * Retorna:
 *   { accessToken: string }
 *
 * SEGURANÇA: PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET ficam SOMENTE no servidor.
 * Nunca expor essas credenciais no frontend.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLUGGY_API_URL = "https://api.pluggy.ai";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUserFromReq(req: Request) {
  const auth  = req.headers.get("Authorization") ?? "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Autentica na Pluggy e retorna um apiKey temporário.
 * Esse apiKey expira em 2h — é usado internamente para criar o Connect Token.
 */
async function getPluggyApiKey(): Promise<string> {
  const clientId     = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID ou PLUGGY_CLIENT_SECRET não configurados no ambiente");
  }

  const res = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy auth falhou (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json() as { apiKey: string };
  return data.apiKey;
}

/**
 * Cria um Connect Token para o cliente abrir o widget Pluggy Connect.
 * O clientUserId permite rastrear qual empresa/usuário está conectando.
 */
async function createConnectToken(apiKey: string, clientUserId?: string): Promise<string> {
  const body: Record<string, unknown> = {};
  if (clientUserId) body.clientUserId = clientUserId;

  const res = await fetch(`${PLUGGY_API_URL}/connect_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy connect_token falhou (${res.status}): ${err.slice(0, 200)}`);
  }

  const data = await res.json() as { accessToken: string };
  return data.accessToken;
}

export const Route = createFileRoute("/api/pluggy/connect-token")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Autenticação obrigatória — apenas usuários logados podem conectar contas
        const user = await getUserFromReq(request);
        if (!user) return json({ error: "Unauthorized" }, 401);

        let body: { clientUserId?: string } = {};
        try {
          body = await request.json();
        } catch {
          // body opcional — sem problema se vier vazio
        }

        const { clientUserId } = body;

        try {
          // 1. Autentica na Pluggy com as credenciais do servidor
          const apiKey = await getPluggyApiKey();

          // 2. Gera o Connect Token (pode ser vinculado a um empresa_id do Supabase)
          const accessToken = await createConnectToken(apiKey, clientUserId);

          // 3. Retorna o token para o frontend abrir o widget
          return json({ accessToken });

        } catch (e: any) {
          console.error("[Pluggy] connect-token error:", e.message);
          return json({ error: e.message ?? "Erro interno ao gerar Connect Token" }, 500);
        }
      },
    },
  },
});

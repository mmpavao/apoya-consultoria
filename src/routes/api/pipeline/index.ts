/**
 * GET  /api/pipeline?setor=fiscal  — config + tarefas agrupadas por etapa
 *
 * SEGURANÇA:
 *  - APOYA_SERVICE_TOKEN lida de process.env (CF Worker secret).
 *    NUNCA aparece no bundle do browser — este arquivo roda server-side.
 *  - ator_tipo derivado da sessão Supabase do usuário logado, NÃO do payload.
 *    Disciplina F1.1: agentes chamam o MCP diretamente com sua API key de agente.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  SUPABASE_URL,
  getApoyaServiceToken,
  getMcpUrl,
  getSupabaseAnonKey,
} from "@/lib/worker-env";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function autenticarSessao(
  request: Request
): Promise<{ userId: string; email: string; atorTipo: "humano" } | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Nao autenticado" }, 401);
  const token = authHeader.slice(7).trim();

  const anonKey = getSupabaseAnonKey();

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!resp.ok) return json({ error: "Sessao invalida" }, 401);
  const user = (await resp.json()) as { id?: string; email?: string };
  if (!user?.id) return json({ error: "Usuario nao encontrado" }, 401);
  // Qualquer usuario autenticado via browser = humano
  return { userId: user.id, email: user.email ?? "", atorTipo: "humano" };
}

async function callMcp(tool: string, args: unknown): Promise<unknown> {
  const apiKey = getApoyaServiceToken();
  const res = await fetch(getMcpUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (data.error) throw new Error(JSON.stringify(data.error));
  const content = Array.isArray(data.result?.content) ? data.result.content : [];
  const text = content.find((c: any) => c.type === "text");
  if (!text) return data.result;
  try { return JSON.parse(text.text); } catch { return text.text; }
}


/**
 * Verifica se o usuário tem acesso ao setor pedido.
 * Admin (role=admin) → sempre true.
 * Outros → verifica user_setores.
 */
async function checkUserSetor(
  userId: string,
  anonKey: string,
  userToken: string,
  setor: string
): Promise<boolean> {
  // Verificar role admin
  const roleResp = await fetch(
    `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.admin&select=role&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` } }
  );
  if (roleResp.ok) {
    const roles = await roleResp.json() as Array<{ role: string }>;
    if (roles.length > 0) return true; // é admin
  }

  // Verificar user_setores
  const setorResp = await fetch(
    `${SUPABASE_URL}/rest/v1/user_setores?user_id=eq.${userId}&setor_slug=eq.${setor}&select=setor_slug&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` } }
  );
  if (!setorResp.ok) return false;
  const rows = await setorResp.json() as Array<{ setor_slug: string }>;
  return rows.length > 0;
}

export const Route = createFileRoute("/api/pipeline/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await autenticarSessao(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const setor = url.searchParams.get("setor") ?? "fiscal";
        const clienteId = url.searchParams.get("cliente_id");

        // B2: Guard — 403 se o usuário não tem o setor pedido
        const anonKey = getSupabaseAnonKey();
        const userToken = request.headers.get("authorization")!.slice(7).trim();
        const hasSetor = await checkUserSetor(auth.userId, anonKey, userToken, setor);
        if (!hasSetor) {
          return json({ error: "Acesso negado ao setor: " + setor, code: "SETOR_NEGADO" }, 403);
        }

        try {
          const args: Record<string, string> = { setor };
          if (clienteId) args.cliente_id = clienteId;
          const kanban = await callMcp("tarefas_por_pipeline", args);
          return json(kanban);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[/api/pipeline GET]", msg);
          return json({ error: msg }, 502);
        }
      },
    },
  },
});

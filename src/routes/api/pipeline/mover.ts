/**
 * POST /api/pipeline/mover
 * Move uma tarefa de etapa — invoca tarefa_mover_etapa no MCP.
 *
 * SEGURANÇA F1.1:
 *  - ator_tipo = "humano" é derivado da sessão Supabase autenticada.
 *    O payload NUNCA pode sobrescrever esse valor.
 *  - A APOYA_SERVICE_TOKEN (API key do MCP) fica no CF Worker secret,
 *    NUNCA no bundle do browser.
 *  - Só usuários autenticados podem chamar esta rota.
 *
 * Body esperado: { tarefa_id, etapa_destino, motivo? }
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  SUPABASE_URL,
  getApoyaServiceToken,
  getMcpUrl,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
} from "@/lib/worker-env";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function anonKey(): string {
  return getSupabaseAnonKey();
}

async function autenticarSessao(
  request: Request
): Promise<{ userId: string; email: string; atorTipo: "humano"; token: string } | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Nao autenticado" }, 401);
  const token = authHeader.slice(7).trim();

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey() },
  });
  if (!resp.ok) return json({ error: "Sessao invalida" }, 401);
  const user = (await resp.json()) as { id?: string; email?: string };
  if (!user?.id) return json({ error: "Usuario nao encontrado" }, 401);
  return { userId: user.id, email: user.email ?? "", atorTipo: "humano", token };
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
 * Admin → true. Outros → verifica user_setores.
 */
async function checkUserSetor(
  userId: string,
  anonKey: string,
  userToken: string,
  setor: string
): Promise<boolean> {
  const roleResp = await fetch(
    `${SUPABASE_URL}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.admin&select=role&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` } }
  );
  if (roleResp.ok) {
    const roles = await roleResp.json() as Array<{ role: string }>;
    if (roles.length > 0) return true;
  }
  const setorResp = await fetch(
    `${SUPABASE_URL}/rest/v1/user_setores?user_id=eq.${userId}&setor_slug=eq.${setor}&select=setor_slug&limit=1`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${userToken}` } }
  );
  if (!setorResp.ok) return false;
  const rows = await setorResp.json() as Array<{ setor_slug: string }>;
  return rows.length > 0;
}

export const Route = createFileRoute("/api/pipeline/mover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Autenticar sessao — ator_tipo = "humano" garantido pelo servidor
        const auth = await autenticarSessao(request);
        if (auth instanceof Response) return auth;
        const { userId, email, atorTipo, token } = auth;

        // 2. Parsear body
        let body: any;
        try { body = await request.json(); } catch {
          return json({ error: "JSON invalido" }, 400);
        }

        const { tarefa_id, etapa_destino, motivo } = body ?? {};
        if (!tarefa_id) return json({ error: "tarefa_id obrigatorio" }, 400);
        if (!etapa_destino) return json({ error: "etapa_destino obrigatorio" }, 400);

        // 2b. B2 isolamento (escrita) — setor lido direto do Supabase (service role),
        //     NUNCA do payload (anti-spoof). Fail-closed: qualquer falha → 403/50x.
        {
          const svcKey = getSupabaseServiceRoleKey();
          let tSetor: string | undefined;
          try {
            const r = await fetch(
              `${SUPABASE_URL}/rest/v1/tarefas?id=eq.${encodeURIComponent(tarefa_id)}&select=setor&limit=1`,
              { headers: { apikey: svcKey, Authorization: `Bearer ${svcKey}` } }
            );
            if (!r.ok) return json({ error: "Falha ao validar tarefa" }, 502);
            const rows = (await r.json()) as Array<{ setor?: string }>;
            tSetor = rows[0]?.setor;
          } catch (e) {
            console.error("[/api/pipeline/mover supabase-setor]", e);
            return json({ error: "Falha ao validar setor da tarefa" }, 502);
          }
          // Fail-closed: setor desconhecido (tarefa não existe) → negar
          if (!tSetor) {
            return json({ error: "Tarefa nao encontrada", code: "TAREFA_NAO_ENCONTRADA" }, 404);
          }
          if (!(await checkUserSetor(userId, anonKey(), token, tSetor))) {
            return json({ error: `Acesso negado ao setor: ${tSetor}`, code: "SETOR_NEGADO" }, 403);
          }
        }

        // 3. Chamar tarefa_mover_etapa no MCP com ator derivado da sessao
        //    NUNCA aceitar ator_tipo do payload — F1.1 compliance
        try {
          const result = await callMcp("tarefa_mover_etapa", {
            tarefa_id,
            etapa_destino,
            ator: email,          // label informativo (email do usuario)
            ator_tipo: atorTipo,  // sempre "humano" — derivado da sessao, nao do payload
            ...(motivo ? { motivo } : {}),
          });
          return json({ ok: true, result });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Checar se foi bloqueio de aprovacao (nao eh erro 502)
          if (msg.includes("requer_aprovacao") || msg.includes("aprovacao")) {
            return json({ error: msg, code: "REQUER_APROVACAO" }, 403);
          }
          console.error("[/api/pipeline/mover POST]", msg);
          return json({ error: msg }, 502);
        }
      },
    },
  },
});

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

function getMcpKey(): string {
  if (typeof process !== "undefined" && process.env?.APOYA_SERVICE_TOKEN)
    return process.env.APOYA_SERVICE_TOKEN;
  const g = (globalThis as any).__env__?.APOYA_SERVICE_TOKEN;
  return g ?? "";
}

const MCP_URL = "https://apoya-mcp.talkzzbot.workers.dev/mcp";
const SUPA_URL = "https://ajaqbdsalxfgrwpjbtbn.supabase.co";

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

  const anonKey =
    (typeof process !== "undefined" && process.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    (globalThis as any).__env__?.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYXFiZHNhbHhmZ3J3cGpidGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDgzMjMsImV4cCI6MjA5NDg4NDMyM30.QI9pwP1W3x6jFzOPsI_8lTGCY8Moup0AIhcsoG6jDQM";

  const resp = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!resp.ok) return json({ error: "Sessao invalida" }, 401);
  const user = (await resp.json()) as { id?: string; email?: string };
  if (!user?.id) return json({ error: "Usuario nao encontrado" }, 401);
  return { userId: user.id, email: user.email ?? "", atorTipo: "humano" };
}

async function callMcp(tool: string, args: unknown): Promise<unknown> {
  const apiKey = getMcpKey();
  const res = await fetch(MCP_URL, {
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

export const Route = createFileRoute("/api/pipeline/mover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Autenticar sessao — ator_tipo = "humano" garantido pelo servidor
        const auth = await autenticarSessao(request);
        if (auth instanceof Response) return auth;
        const { email, atorTipo } = auth;

        // 2. Parsear body
        let body: any;
        try { body = await request.json(); } catch {
          return json({ error: "JSON invalido" }, 400);
        }

        const { tarefa_id, etapa_destino, motivo } = body ?? {};
        if (!tarefa_id) return json({ error: "tarefa_id obrigatorio" }, 400);
        if (!etapa_destino) return json({ error: "etapa_destino obrigatorio" }, 400);

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

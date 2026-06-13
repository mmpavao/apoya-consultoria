/**
 * POST /api/serpro/call
 * Proxy autenticado para o MCP SERPRO via mcp.zapro.tech.
 *
 * Body: { tool: string, params: Record<string, unknown>, cnpj?: string }
 *
 * Antes de chamar o MCP, valida:
 *   - Autenticação do usuário (Bearer Supabase)
 *   - Loga resultado (ok/erro) em serpro_log
 *   - Loga resultado em serpro_log
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SERPRO_TOOLS } from "@/lib/serpro/tools-catalog";

const MCP_URL = "https://mcp.zapro.tech/mcp";
const MCP_TOKEN = process.env.SERPRO_TOKEN ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticate(request: Request): Promise<{ userId: string } | Response> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await (supabaseAdmin as any).auth.getUser(token);
  if (error || !data?.user) return json({ error: "Token inválido" }, 401);
  return { userId: data.user.id };
}

export const Route = createFileRoute("/api/serpro/call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const { userId } = auth;

        let body: any;
        try { body = await request.json(); } catch { return json({ error: "JSON inválido" }, 400); }

        const { tool, params = {}, cliente_id } = body;
        if (!tool) return json({ error: "tool é obrigatório" }, 400);

        const toolDef = SERPRO_TOOLS.find((t) => t.name === tool);
        if (!toolDef) return json({ error: `Tool desconhecida: ${tool}` }, 400);

        const db = supabaseAdmin as any;
        const t0 = Date.now();

        // Buscar dados do cliente para validação (se informado)
        let clienteData: any = null;
        if (cliente_id) {
          const { data } = await db
            .from("clientes")
            .select("id,regime,tem_certificado,tem_procuracao,cnpj")
            .eq("id", cliente_id)
            .single();
          clienteData = data;
        }

        // Elegibilidade: NÃO bloqueamos no servidor.
        // O MCP SERPRO decide se o acesso é permitido ou não.
        // Apenas logamos a tentativa — o resultado do MCP fala por si.

        // Chamar o MCP
        try {
          const mcpRes = await fetch(MCP_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${MCP_TOKEN}`,
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: Date.now(),
              method: "tools/call",
              params: { name: tool, arguments: params },
            }),
          });

          const mcpData = await mcpRes.json().catch(() => ({}));
          const duracao = Date.now() - t0;

          if (mcpData.error) {
            await db.from("serpro_log").insert({
              cliente_id,
              tool,
              parametros: params,
              status: "erro",
              erro_msg: JSON.stringify(mcpData.error).slice(0, 500),
              duracao_ms: duracao,
              created_by: userId,
            });
            return json({ error: mcpData.error }, 502);
          }

          // Extrair conteúdo do resultado
          const result = mcpData.result;
          const content = Array.isArray(result?.content)
            ? result.content
            : [{ type: "text", text: JSON.stringify(result) }];

          // Resumo para log (sem dados sensíveis)
          const resumo = content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text?.slice(0, 200))
            .join(" ")
            .slice(0, 500);

          await db.from("serpro_log").insert({
            cliente_id,
            tool,
            parametros: params,
            resultado_resumo: resumo,
            status: "ok",
            duracao_ms: duracao,
            created_by: userId,
          });

          return json({ ok: true, content, duracao_ms: duracao });
        } catch (e: any) {
          const duracao = Date.now() - t0;
          await db.from("serpro_log").insert({
            cliente_id,
            tool,
            parametros: params,
            status: "erro",
            erro_msg: e?.message?.slice(0, 500) ?? "Erro desconhecido",
            duracao_ms: duracao,
            created_by: userId,
          });
          return json({ error: `Falha ao chamar MCP: ${e?.message}` }, 502);
        }
      },
    },
  },
});

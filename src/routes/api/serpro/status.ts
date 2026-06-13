/**
 * GET /api/serpro/status
 * Verifica conectividade com o gateway SERPRO.
 *
 * SEGURANÇA: Token MCP lido exclusivamente de env var SERPRO_TOKEN.
 * Configurar via: wrangler secret put SERPRO_TOKEN (workers: apoya-gestao, apoya-mcp)
 */
import { createFileRoute } from "@tanstack/react-router";

const MCP_URL = "https://mcp.zapro.tech/mcp";
const MCP_TOKEN: string =
  (typeof process !== "undefined" ? process.env.SERPRO_TOKEN : undefined) ??
  (typeof globalThis !== "undefined"
    ? (globalThis as Record<string, unknown>).SERPRO_TOKEN as string | undefined
    : undefined) ??
  "";

export const Route = createFileRoute("/api/serpro/status")({
  server: {
    handlers: {
      GET: async () => {
        if (!MCP_TOKEN) {
          return new Response(
            JSON.stringify({ ok: false, error: "SERPRO_TOKEN não configurado. Execute: wrangler secret put SERPRO_TOKEN" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }
        try {
          const res = await fetch(MCP_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${MCP_TOKEN}`,
            },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "tools/call",
              params: { name: "serpro_status", arguments: {} },
            }),
          });
          const data = await res.json().catch(() => ({}));
          const content = data?.result?.content ?? [];
          const textContent = content.find((c: any) => c.type === "text");
          const status = textContent ? JSON.parse(textContent.text) : data;
          return new Response(JSON.stringify({ ok: true, serpro: status }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: e?.message }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

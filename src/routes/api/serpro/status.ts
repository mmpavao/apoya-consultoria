/**
 * GET /api/serpro/status
 * Verifica conectividade com o gateway SERPRO.
 */
import { createFileRoute } from "@tanstack/react-router";

const MCP_URL = "https://mcp.zapro.tech/mcp";
const MCP_TOKEN = process.env.SERPRO_TOKEN ?? "";

export const Route = createFileRoute("/api/serpro/status")({
  server: {
    handlers: {
      GET: async () => {
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

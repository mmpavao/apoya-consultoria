// src/index.js — Entrypoint APOYA MCP Worker v3.0 (modular)
// Este arquivo APENAS importa e monta — lógica fica nos módulos.

import { sb, validateApiKey } from "./db.js";

import { TOOLS_ADMIN,      HANDLERS_ADMIN      } from "./tools/admin.js";
import { TOOLS_CLIENTES,   HANDLERS_CLIENTES   } from "./tools/clientes.js";
import { TOOLS_COBRANCAS,  HANDLERS_COBRANCAS  } from "./tools/cobrancas.js";
import { TOOLS_COMERCIAL,  HANDLERS_COMERCIAL  } from "./tools/comercial.js";
import { TOOLS_CONTABIL,   HANDLERS_CONTABIL   } from "./tools/contabil.js";
import { TOOLS_DOCUMENTOS, HANDLERS_DOCUMENTOS } from "./tools/documentos.js";
import { TOOLS_DP,         HANDLERS_DP         } from "./tools/dp.js";
import { TOOLS_FISCAL,     HANDLERS_FISCAL     } from "./tools/fiscal.js";
import { TOOLS_TAREFAS,    HANDLERS_TAREFAS    } from "./tools/tarefas.js";
import { TOOLS_WHATSAPP,   HANDLERS_WHATSAPP   } from "./tools/whatsapp.js";

// ─── Montagem ────────────────────────────────────────────────────────────────

const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "apoya-gestao-mcp",
  version: "3.1.1",
  description: "APOYA MCP Worker v3.1.1 (modular) — 85 tools, F1.1 security fixes"
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
  "Access-Control-Max-Age": "86400"
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const mcpError = (id, code, message) =>
  json({ jsonrpc: "2.0", id, error: { code, message } });

const mcpResult = (id, data) =>
  json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] } });

const TOOLS = [
  ...TOOLS_ADMIN,
  ...TOOLS_CLIENTES,
  ...TOOLS_COBRANCAS,
  ...TOOLS_COMERCIAL,
  ...TOOLS_CONTABIL,
  ...TOOLS_DOCUMENTOS,
  ...TOOLS_DP,
  ...TOOLS_FISCAL,
  ...TOOLS_TAREFAS,
  ...TOOLS_WHATSAPP,
];

const HANDLERS = {
  ...HANDLERS_ADMIN,
  ...HANDLERS_CLIENTES,
  ...HANDLERS_COBRANCAS,
  ...HANDLERS_COMERCIAL,
  ...HANDLERS_CONTABIL,
  ...HANDLERS_DOCUMENTOS,
  ...HANDLERS_DP,
  ...HANDLERS_FISCAL,
  ...HANDLERS_TAREFAS,
  ...HANDLERS_WHATSAPP,
};

// ─── Sanity check em boot ────────────────────────────────────────────────────
const TOOL_COUNT = TOOLS.length;
const HANDLER_COUNT = Object.keys(HANDLERS).length;
if (TOOL_COUNT !== HANDLER_COUNT) {
  console.error(`[BOOT] MISMATCH: ${TOOL_COUNT} tools vs ${HANDLER_COUNT} handlers`);
}

// ─── Export default (Cloudflare Worker) ─────────────────────────────────────
export default {
  async fetch(request, env) {
    const method = request.method;
    const url    = new URL(request.url);
    const path   = url.pathname;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Health check público
    if (path === "/health") {
      return json({
        status: "ok",
        worker: "apoya-mcp",
        version: SERVER_INFO.version,
        tools: TOOL_COUNT,
        handlers: HANDLER_COUNT,
        parity: TOOL_COUNT === HANDLER_COUNT ? "ok" : "MISMATCH",
        ts: new Date().toISOString()
      });
    }

    // SSE endpoint (Claude Desktop)
    if (path === "/sse" && method === "GET") {
      const mcpUrl = `https://${url.host}/mcp`;
      const body   = `event: endpoint\ndata: ${mcpUrl}\n\n`;
      return new Response(body, {
        headers: {
          ...CORS,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive"
        }
      });
    }

    // MCP endpoint
    if (path === "/mcp" && method === "POST") {
      const identity = await validateApiKey(request.headers.get("Authorization"), env);
      if (!identity) return mcpError(null, -32001, "API key inválida ou ausente");

      let body;
      try { body = await request.json(); }
      catch { return mcpError(null, -32700, "JSON inválido"); }

      const { id, method: rpcMethod, params } = body;

      switch (rpcMethod) {
        case "initialize":
          return json({
            jsonrpc: "2.0", id,
            result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              serverInfo: SERVER_INFO,
              capabilities: { tools: {} }
            }
          });

        case "notifications/initialized":
        case "ping":
          return json({ jsonrpc: "2.0", id, result: {} });

        case "tools/list": {
          const scoped = identity.scopes.includes("*")
            ? TOOLS
            : TOOLS.filter(t => identity.scopes.includes(t.name));
          return json({ jsonrpc: "2.0", id, result: { tools: scoped } });
        }

        case "tools/call": {
          const toolName = params?.name || "";
          const toolArgs = params?.arguments || {};
          if (!identity.scopes.includes("*") && !identity.scopes.includes(toolName))
            return mcpError(id, -32003, `Scope insuficiente para '${toolName}'`);
          const handler = HANDLERS[toolName];
          if (!handler)
            return mcpError(id, -32601, `Tool '${toolName}' não encontrada. Tools disponíveis: ${TOOLS.map(t => t.name).join(", ")}`);
          try {
            const result = await handler(toolArgs, env, identity);
            return mcpResult(id, result);
          } catch (err) {
            return json({
              jsonrpc: "2.0", id,
              result: {
                content: [{ type: "text", text: JSON.stringify({ error: err.message, tool: toolName, stack: err.stack?.slice(0, 200) }) }],
                isError: true
              }
            });
          }
        }

        default:
          return mcpError(id, -32601, `Método '${rpcMethod}' não suportado`);
      }
    }

    return json({ error: "Not found", endpoints: ["/health", "/mcp (POST)", "/sse (GET)"] }, 404);
  }
};

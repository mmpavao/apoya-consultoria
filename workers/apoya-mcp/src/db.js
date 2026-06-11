// src/db.js — Supabase REST helper + utils MCP
// Fonte: worker.js v3.0 — extraído em refactor(mcp) 2026-06-11

// APOYA MCP Worker v3.0 — Schema completo 2026-06-10
// 83 tools | 32 tabelas | 8 Edge Functions | SERPRO + Focus + Asaas + Evolution
const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "apoya-gestao-mcp",
  version: "3.0.0",
  description: "MCP APOYA Gestão — 83 tools, schema completo Jun/2026"
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

// ── Supabase REST helper ─────────────────────────────────────────────────────
function sb(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const h = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
  return {
    async get(table, params = {}) {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`${url}/rest/v1/${table}${qs ? "?" + qs : ""}`, { headers: h });
      if (!r.ok) return { code: r.status, ...(await r.json().catch(() => ({}))) };
      return r.json();
    },
    async post(table, body, prefer = "return=representation") {
      const r = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...h, Prefer: prefer },
        body: JSON.stringify(body)
      });
      if (!r.ok && r.status !== 201) return { code: r.status, ...(await r.json().catch(() => ({}))) };
      if (prefer === "return=minimal") return { ok: true };
      return r.json();
    },
    async patch(table, filter, body) {
      const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: "PATCH", headers: h, body: JSON.stringify(body)
      });
      if (!r.ok) return { code: r.status, ...(await r.json().catch(() => ({}))) };
      return r.json();
    },
    async del(table, filter) {
      const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: "DELETE", headers: { ...h, Prefer: "return=representation" }
      });
      if (r.status === 204) return { deleted: true };
      return r.json();
    },
    async rpc(fn, body = {}) {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST", headers: h, body: JSON.stringify(body)
      });
      return r.json();
    },
    async edgeFn(fn, body = {}, env2) {
      const r = await fetch(`${url}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env2.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify(body)
      });
      return r.json();
    }
  };
}

// ── Auth ─────────────────────────────────────────────────────────────────────
async function validateApiKey(authHeader, env) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const db = sb(env);
  const rows = await db.get("mcp_api_keys", {
    select: "id,agent_name,scopes,is_active,expires_at",
    key_hash: `eq.${hash}`
  });
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const key = rows[0];
  if (!key.is_active) return null;
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null;
  await db.patch("mcp_api_keys", `id=eq.${key.id}`, { last_used_at: new Date().toISOString() });
  return { agentName: key.agent_name, scopes: key.scopes?.length ? key.scopes : ["*"], keyId: key.id };
}


export { sb, validateApiKey };

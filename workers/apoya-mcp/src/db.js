// src/db.js — Supabase REST helper + auth
// security(F1.1) 2026-06-11 — validateApiKey retorna escopo_setores + ator_tipo derivado da chave

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

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
// Retorna identity com campos derivados da API key — NUNCA do payload da chamada:
// {
//   agentName:      string  — nome do agente registrado (ex: "agente_fiscal")
//   scopes:         string[] — escopos de tool (["*"] = master)
//   escopo_setores: string[] — setores autorizados para escrita (["*"] = master)
//   ator_tipo:      "agente" | "humano" — SEMPRE "agente" para chamadas MCP
//   is_admin:       boolean — true só se scopes contém "admin"
//   keyId:          string
// }
//
// DECISÃO DE ARQUITETURA (F1.1):
// Toda chamada via MCP é feita por um agente/serviço — portanto ator_tipo é
// SEMPRE "agente", derivado da chave, nunca do payload. Aprovações humanas
// em etapas requer_aprovacao=true são realizadas EXCLUSIVAMENTE pelo painel
// web (sessão autenticada) ou por uma chave marcada com is_human_delegate=true
// no cadastro da mcp_api_keys. Agentes não podem auto-declarar ator_tipo="humano".
async function validateApiKey(authHeader, env) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw) return null;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const db = sb(env);
  const rows = await db.get("mcp_api_keys", {
    select: "id,agent_name,scopes,is_active,expires_at,escopo_setores,is_human_delegate",
    key_hash: `eq.${hash}`
  });
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const key = rows[0];
  if (!key.is_active) return null;
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null;
  await db.patch("mcp_api_keys", `id=eq.${key.id}`, { last_used_at: new Date().toISOString() });

  // FAIL-CLOSED: chave sem scopes explícito NÃO vira master — recebe [] (nega
  // tudo), forçando cadastro explícito. (escopo_setores mantém default ["*"]
  // por ora: as chaves atuais têm setores=null e dependem disso; restringir por
  // setor exige atribuição explícita por chave — follow-up separado.)
  const scopes     = Array.isArray(key.scopes) ? key.scopes : [];
  const escopoSet  = Array.isArray(key.escopo_setores) ? key.escopo_setores : ["*"];
  // is_human_delegate: chave marcada explicitamente como representante de ação humana aprovada
  // (ex: webhook de aprovação do painel web). Padrão = false.
  const isHumanDelegate = key.is_human_delegate === true;

  return {
    agentName:       key.agent_name,
    scopes,
    escopo_setores:  escopoSet,
    // ator_tipo derivado da chave — imutável pelo payload
    ator_tipo:       isHumanDelegate ? "humano" : "agente",
    // is_admin = scopes contém "admin" OU is_human_delegate (aprovação explícita)
    is_admin:        scopes.includes("admin") || scopes.includes("*") && isHumanDelegate,
    is_human_delegate: isHumanDelegate,
    keyId:           key.id
  };
}

export { sb, validateApiKey };

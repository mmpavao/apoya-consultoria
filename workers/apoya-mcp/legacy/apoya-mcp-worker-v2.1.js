// APOYA MCP Worker v2.1 — campos corrigidos conforme schema real do banco
const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "apoya-gestao-mcp", version: "2.1.0", description: "MCP completo APOYA — 53 tools" };

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

// ── Supabase REST helper ────────────────────────────────────────────────────
function sb(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Prefer": "return=representation" };

  return {
    async get(table, params = {}) {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`${url}/rest/v1/${table}${qs ? '?' + qs : ''}`, { headers });
      if (!r.ok) { const e = await r.json(); return { code: r.status, ...e }; }
      return r.json();
    },
    async post(table, body, prefer = "return=representation") {
      const r = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST", headers: { ...headers, Prefer: prefer }, body: JSON.stringify(body)
      });
      if (!r.ok && r.status !== 201) { const e = await r.json(); return { code: r.status, ...e }; }
      if (prefer === "return=minimal") return { ok: true };
      return r.json();
    },
    async patch(table, filter, body) {
      const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: "PATCH", headers, body: JSON.stringify(body)
      });
      if (!r.ok) { const e = await r.json(); return { code: r.status, ...e }; }
      return r.json();
    },
    async del(table, filter) {
      const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: "DELETE", headers: { ...headers, Prefer: "return=representation" }
      });
      if (r.status === 204) return { deleted: true };
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
  const rows = await db.get("mcp_api_keys", { select: "id,agent_name,scopes,is_active,expires_at", key_hash: `eq.${hash}` });
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const key = rows[0];
  if (!key.is_active) return null;
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null;
  await db.patch("mcp_api_keys", `id=eq.${key.id}`, { last_used_at: new Date().toISOString() });
  return { agentName: key.agent_name, scopes: key.scopes?.length ? key.scopes : ["*"], keyId: key.id };
}

// ── TOOLS ────────────────────────────────────────────────────────────────────
const TOOLS = [
  // CLIENTES
  { name: "clientes_listar", description: "Lista clientes com filtros. Retorna razão social, CNPJ, regime, status, honorário.", inputSchema: { type: "object", properties: { regime: { type: "string" }, status: { type: "string" }, limit: { type: "integer", default: 20 }, offset: { type: "integer", default: 0 }, search: { type: "string" } } } },
  { name: "cliente_buscar", description: "Dados completos de um cliente pelo CNPJ (com ou sem máscara) ou UUID.", inputSchema: { type: "object", required: ["identificador"], properties: { identificador: { type: "string" } } } },
  { name: "cliente_criar", description: "Cria novo cliente. Mínimo: razão social, CNPJ, regime.", inputSchema: { type: "object", required: ["razao_social", "cnpj", "regime"], properties: { razao_social: { type: "string" }, cnpj: { type: "string" }, regime: { type: "string" }, email: { type: "string" }, telefone: { type: "string" }, responsavel: { type: "string" }, valor_honorario: { type: "number" } } } },
  { name: "cliente_atualizar", description: "Atualiza dados de um cliente pelo UUID.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, razao_social: { type: "string" }, email: { type: "string" }, telefone: { type: "string" }, status: { type: "string" }, valor_honorario: { type: "number" }, regime: { type: "string" }, responsavel: { type: "string" } } } },
  { name: "cliente_excluir", description: "Remove cliente pelo UUID.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  { name: "cliente_socios_listar", description: "Lista sócios de um cliente.", inputSchema: { type: "object", required: ["cliente_id"], properties: { cliente_id: { type: "string" } } } },
  { name: "cliente_socio_criar", description: "Adiciona sócio ao cliente.", inputSchema: { type: "object", required: ["cliente_id", "nome", "cpf"], properties: { cliente_id: { type: "string" }, nome: { type: "string" }, cpf: { type: "string" }, qualificacao: { type: "string" }, participacao: { type: "number" } } } },
  // USUÁRIOS
  { name: "usuarios_listar", description: "Lista usuários do sistema.", inputSchema: { type: "object", properties: { limit: { type: "integer", default: 50 } } } },
  { name: "usuario_buscar", description: "Busca usuário por UUID ou email.", inputSchema: { type: "object", required: ["identificador"], properties: { identificador: { type: "string" } } } },
  { name: "usuario_role_atualizar", description: "Atualiza role de um usuário.", inputSchema: { type: "object", required: ["user_id", "role"], properties: { user_id: { type: "string" }, role: { type: "string" } } } },
  { name: "usuario_convidar", description: "Envia convite para novo usuário.", inputSchema: { type: "object", required: ["email", "role"], properties: { email: { type: "string" }, role: { type: "string" }, nome: { type: "string" } } } },
  { name: "permissoes_listar", description: "Lista permissões do sistema.", inputSchema: { type: "object", properties: {} } },
  { name: "convites_listar", description: "Lista convites de acesso.", inputSchema: { type: "object", properties: { limit: { type: "integer", default: 50 } } } },
  // OBRIGAÇÕES
  { name: "obrigacoes_listar", description: "Lista obrigações fiscais/contábeis.", inputSchema: { type: "object", properties: { cliente_id: { type: "string" }, status: { type: "string" }, tipo: { type: "string" }, vencimento_ate: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "obrigacao_criar", description: "Cria nova obrigação.", inputSchema: { type: "object", required: ["cliente_id", "tipo", "descricao", "vencimento"], properties: { cliente_id: { type: "string" }, tipo: { type: "string" }, descricao: { type: "string" }, vencimento: { type: "string" }, competencia: { type: "string" }, valor: { type: "number" } } } },
  { name: "obrigacao_atualizar", description: "Atualiza obrigação existente.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, status: { type: "string" }, observacao: { type: "string" } } } },
  // COBRANÇAS
  { name: "cobrancas_listar", description: "Lista cobranças/honorários.", inputSchema: { type: "object", properties: { cliente_id: { type: "string" }, status: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "cobranca_criar", description: "Cria cobrança.", inputSchema: { type: "object", required: ["cliente_id", "valor", "vencimento", "descricao"], properties: { cliente_id: { type: "string" }, valor: { type: "number" }, vencimento: { type: "string" }, descricao: { type: "string" } } } },
  { name: "cobranca_atualizar", description: "Atualiza cobrança.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, status: { type: "string" }, pago_em: { type: "string" } } } },
  { name: "lancamentos_listar", description: "Lista lançamentos contábeis.", inputSchema: { type: "object", properties: { cliente_id: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "lancamento_criar", description: "Cria lançamento contábil.", inputSchema: { type: "object", required: ["cliente_id", "conta_debito", "conta_credito", "valor", "historico", "data_lancamento"], properties: { cliente_id: { type: "string" }, conta_debito: { type: "string" }, conta_credito: { type: "string" }, valor: { type: "number" }, historico: { type: "string" }, data_lancamento: { type: "string" } } } },
  { name: "apuracao_buscar", description: "Apuração mensal de um cliente.", inputSchema: { type: "object", required: ["cliente_id", "competencia"], properties: { cliente_id: { type: "string" }, competencia: { type: "string" } } } },
  { name: "apuracao_registrar", description: "Registra/atualiza apuração mensal.", inputSchema: { type: "object", required: ["cliente_id", "competencia", "receita_bruta"], properties: { cliente_id: { type: "string" }, competencia: { type: "string" }, receita_bruta: { type: "number" }, valor_das: { type: "number" }, aliquota: { type: "number" } } } },
  // TAREFAS
  { name: "tarefas_listar", description: "Lista tarefas do workflow.", inputSchema: { type: "object", properties: { status: { type: "string" }, tipo: { type: "string" }, responsavel: { type: "string" }, cliente_id: { type: "string" }, prioridade: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "tarefa_buscar", description: "Detalhes de uma tarefa.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  { name: "tarefa_criar", description: "Cria tarefa com SLA automático.", inputSchema: { type: "object", required: ["titulo", "tipo", "responsavel"], properties: { titulo: { type: "string" }, tipo: { type: "string" }, responsavel: { type: "string" }, descricao: { type: "string" }, cliente_id: { type: "string" }, prioridade: { type: "string" }, data_vencimento: { type: "string" }, criado_por: { type: "string" } } } },
  { name: "tarefa_atualizar", description: "Atualiza tarefa.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" }, status: { type: "string" }, responsavel: { type: "string" }, descricao: { type: "string" } } } },
  { name: "tarefa_comentar", description: "Adiciona comentário à tarefa.", inputSchema: { type: "object", required: ["id", "comentario", "autor"], properties: { id: { type: "string" }, comentario: { type: "string" }, autor: { type: "string" } } } },
  // WHATSAPP
  { name: "whatsapp_enviar", description: "Envia mensagem WhatsApp.", inputSchema: { type: "object", required: ["destinatario", "mensagem"], properties: { destinatario: { type: "string" }, mensagem: { type: "string" }, instancia: { type: "string" } } } },
  { name: "whatsapp_conversas_listar", description: "Lista conversas WA ativas.", inputSchema: { type: "object", properties: { cliente_id: { type: "string" }, limit: { type: "integer", default: 20 } } } },
  { name: "whatsapp_mensagens_listar", description: "Lista mensagens de uma conversa.", inputSchema: { type: "object", required: ["conversa_id"], properties: { conversa_id: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "whatsapp_mensagens_pendentes", description: "Mensagens recebidas aguardando resposta.", inputSchema: { type: "object", properties: { limit: { type: "integer", default: 20 } } } },
  { name: "whatsapp_instancias", description: "Lista instâncias Evolution API.", inputSchema: { type: "object", properties: {} } },
  // FISCAL
  { name: "nfse_emitir", description: "Emite NFS-e via NFE.io.", inputSchema: { type: "object", required: ["cliente_id", "servico_descricao", "valor"], properties: { cliente_id: { type: "string" }, servico_descricao: { type: "string" }, valor: { type: "number" }, tomador_cnpj: { type: "string" }, tomador_razao: { type: "string" } } } },
  { name: "nfse_listar", description: "Lista NFS-e emitidas.", inputSchema: { type: "object", properties: { cliente_id: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "das_listar", description: "Lista guias DAS.", inputSchema: { type: "object", properties: { cliente_id: { type: "string" }, status: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "das_gerar", description: "Gera guia DAS via SERPRO.", inputSchema: { type: "object", required: ["cliente_id", "competencia"], properties: { cliente_id: { type: "string" }, competencia: { type: "string" } } } },
  // DOCUMENTOS
  { name: "documentos_listar", description: "Lista documentos de um cliente.", inputSchema: { type: "object", properties: { cliente_id: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "documento_registrar", description: "Registra metadados de documento.", inputSchema: { type: "object", required: ["cliente_id", "nome", "tipo_mime"], properties: { cliente_id: { type: "string" }, nome: { type: "string" }, tipo_mime: { type: "string" }, storage_path: { type: "string" }, tamanho_bytes: { type: "integer" } } } },
  // ESCRITÓRIO
  { name: "escritorio_config_ler", description: "Lê configurações do escritório.", inputSchema: { type: "object", properties: {} } },
  { name: "escritorio_config_atualizar", description: "Atualiza configurações do escritório.", inputSchema: { type: "object", properties: { razao_social: { type: "string" }, email: { type: "string" }, telefone: { type: "string" } } } },
  { name: "integracoes_listar", description: "Lista integrações configuradas.", inputSchema: { type: "object", properties: {} } },
  { name: "integracao_toggle", description: "Ativa/desativa integração.", inputSchema: { type: "object", required: ["id", "ativa"], properties: { id: { type: "string" }, ativa: { type: "boolean" } } } },
  // SERPRO
  { name: "serpro_consultar", description: "Consulta SERPRO: ccmei_dados, pgmei_das, pgmei_divida, pgdas_ultima, sitfis.", inputSchema: { type: "object", required: ["tool", "cnpj"], properties: { tool: { type: "string" }, cnpj: { type: "string" }, params: { type: "object" } } } },
  // AUTOMAÇÕES
  { name: "automacoes_listar", description: "Lista automações configuradas.", inputSchema: { type: "object", properties: { status: { type: "string" } } } },
  { name: "automacao_toggle", description: "Ativa/desativa automação.", inputSchema: { type: "object", required: ["id", "status"], properties: { id: { type: "string" }, status: { type: "string" } } } },
  // MCP KEYS
  { name: "mcp_keys_listar", description: "Lista API Keys do MCP.", inputSchema: { type: "object", properties: {} } },
  { name: "mcp_key_revogar", description: "Revoga API Key.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  { name: "mcp_key_excluir", description: "Exclui API Key permanentemente.", inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  // LOGS
  { name: "agente_log", description: "Registra log de agente.", inputSchema: { type: "object", required: ["agente", "acao", "resultado"], properties: { agente: { type: "string" }, acao: { type: "string" }, resultado: { type: "string" }, cliente_id: { type: "string" }, detalhes: { type: "object" } } } },
  { name: "logs_listar", description: "Lista logs de auditoria.", inputSchema: { type: "object", properties: { agente: { type: "string" }, limit: { type: "integer", default: 50 } } } },
  { name: "calendario_fiscal", description: "Calendário fiscal do mês.", inputSchema: { type: "object", properties: { mes: { type: "string" } } } },
];

// ── HANDLERS ──────────────────────────────────────────────────────────────────
const HANDLERS = {
  // CLIENTES — cnpj armazenado COM máscara no banco
  async clientes_listar(a, env) {
    const db = sb(env);
    const p = {
      select: "id,razao_social,nome_fantasia,cnpj,regime,status,responsavel,email,telefone,valor_honorario,created_at",
      order: "razao_social.asc",
      limit: String(a.limit || 20),
      offset: String(a.offset || 0)
    };
    if (a.regime) p["regime"] = `eq.${a.regime}`;
    if (a.status) p["status"] = `eq.${a.status}`;
    if (a.search) p["or"] = `(razao_social.ilike.*${a.search}*,nome_fantasia.ilike.*${a.search}*,cnpj.ilike.*${a.search}*)`;
    return db.get("clientes", p);
  },

  async cliente_buscar(a, env) {
    const db = sb(env);
    const id = String(a.identificador);
    // Verificar se é CNPJ (só dígitos ou com máscara)
    const digits = id.replace(/\D/g, "");
    if (digits.length === 14) {
      // Tentar com e sem máscara
      const fmt = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
      const r1 = await db.get("clientes", { select: "*", cnpj: `eq.${fmt}`, limit: "1" });
      if (Array.isArray(r1) && r1.length > 0) return r1[0];
      const r2 = await db.get("clientes", { select: "*", cnpj: `eq.${digits}`, limit: "1" });
      if (Array.isArray(r2) && r2.length > 0) return r2[0];
      return { error: "Cliente não encontrado", cnpj_buscado: fmt };
    }
    const rows = await db.get("clientes", { select: "*", id: `eq.${id}`, limit: "1" });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Cliente não encontrado" };
  },

  async cliente_criar(a, env) {
    const digits = String(a.cnpj).replace(/\D/g, "");
    const cnpjFmt = digits.length === 14
      ? `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`
      : a.cnpj;
    return sb(env).post("clientes", { ...a, cnpj: cnpjFmt, status: a.status || "ativo" });
  },

  async cliente_atualizar(a, env) {
    const { id, ...patch } = a;
    return sb(env).patch("clientes", `id=eq.${id}`, patch);
  },

  async cliente_excluir(a, env) {
    return sb(env).del("clientes", `id=eq.${a.id}`);
  },

  async cliente_socios_listar(a, env) {
    return sb(env).get("cliente_socio", { select: "*", cliente_id: `eq.${a.cliente_id}` });
  },

  async cliente_socio_criar(a, env) {
    return sb(env).post("cliente_socio", a);
  },

  // USUÁRIOS — usa tabela profiles (sem role) + user_roles
  async usuarios_listar(a, env) {
    return sb(env).get("profiles", {
      select: "id,nome,email,avatar_url,created_at",
      order: "nome.asc",
      limit: String(a.limit || 50)
    });
  },

  async usuario_buscar(a, env) {
    const id = String(a.identificador);
    const isEmail = id.includes("@");
    const rows = await sb(env).get("profiles", { select: "*", [isEmail ? "email" : "id"]: `eq.${id}`, limit: "1" });
    if (!Array.isArray(rows) || rows.length === 0) return { error: "Usuário não encontrado" };
    // Buscar role
    const roles = await sb(env).get("user_roles", { select: "role", user_id: `eq.${rows[0].id}`, limit: "1" });
    return { ...rows[0], role: Array.isArray(roles) && roles.length > 0 ? roles[0].role : "sem_role" };
  },

  async usuario_role_atualizar(a, env) {
    const db = sb(env);
    const existing = await db.get("user_roles", { select: "id", user_id: `eq.${a.user_id}`, limit: "1" });
    if (Array.isArray(existing) && existing.length > 0) {
      return db.patch("user_roles", `user_id=eq.${a.user_id}`, { role: a.role });
    }
    return db.post("user_roles", { user_id: a.user_id, role: a.role });
  },

  async usuario_convidar(a, env) {
    return sb(env).post("convites", { email: a.email, role: a.role || "assistente", mensagem: a.nome || null, criado_em: new Date().toISOString() });
  },

  async permissoes_listar(_a, env) {
    return sb(env).get("permissoes", { select: "*", order: "slug.asc" });
  },

  async convites_listar(a, env) {
    return sb(env).get("convites", { select: "*", order: "criado_em.desc", limit: String(a.limit || 50) });
  },

  // OBRIGAÇÕES
  async obrigacoes_listar(a, env) {
    const p = { select: "*", order: "vencimento.asc", limit: String(a.limit || 50) };
    if (a.cliente_id) p["cliente_id"] = `eq.${a.cliente_id}`;
    if (a.status) p["status"] = `eq.${a.status}`;
    if (a.tipo) p["tipo"] = `ilike.*${a.tipo}*`;
    if (a.vencimento_ate) p["vencimento"] = `lte.${a.vencimento_ate}`;
    return sb(env).get("obrigacoes", p);
  },

  async obrigacao_criar(a, env) {
    const db = sb(env);
    // Buscar dados do cliente para preencher campos NOT NULL
    let clienteNome = a.cliente_nome || "";
    let regime = a.regime || "Simples";
    let responsavel = a.responsavel || "APOYA";
    if (a.cliente_id && !clienteNome) {
      const cli = await db.get("clientes", { select: "razao_social,regime,responsavel", id: `eq.${a.cliente_id}`, limit: "1" });
      if (Array.isArray(cli) && cli.length > 0) {
        clienteNome = cli[0].razao_social || "";
        regime = cli[0].regime || regime;
        responsavel = cli[0].responsavel || responsavel;
      }
    }
    return db.post("obrigacoes", {
      ...a,
      cliente_nome: clienteNome,
      regime,
      responsavel,
      status: a.status || "pendente"
    });
  },

  async obrigacao_atualizar(a, env) {
    const { id, ...patch } = a;
    return sb(env).patch("obrigacoes", `id=eq.${id}`, patch);
  },

  // COBRANÇAS
  async cobrancas_listar(a, env) {
    const p = { select: "*", order: "vencimento.desc", limit: String(a.limit || 50) };
    if (a.cliente_id) p["cliente_id"] = `eq.${a.cliente_id}`;
    if (a.status) {
      const statusMap = {atrasada:'vencida', paga:'paga', pendente:'pendente', cancelada:'cancelada'};
      p["status"] = `eq.${statusMap[a.status] || a.status}`;
    }
    return sb(env).get("cobrancas", p);
  },

  async cobranca_criar(a, env) {
    return sb(env).post("cobrancas", { ...a, status: "pendente" });
  },

  async cobranca_atualizar(a, env) {
    const { id, ...patch } = a;
    return sb(env).patch("cobrancas", `id=eq.${id}`, patch);
  },

  async lancamentos_listar(a, env) {
    const p = { select: "*", order: "data_lancamento.desc", limit: String(a.limit || 50) };
    if (a.cliente_id) p["cliente_id"] = `eq.${a.cliente_id}`;
    return sb(env).get("lancamentos_contabeis", p);
  },

  async lancamento_criar(a, env) {
    return sb(env).post("lancamentos_contabeis", a);
  },

  async apuracao_buscar(a, env) {
    const comp = String(a.competencia).replace("-", "").slice(0, 6);
    const rows = await sb(env).get("apuracoes_mensais", { select: "*", cliente_id: `eq.${a.cliente_id}`, competencia: `eq.${comp}`, limit: "1" });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Apuração não encontrada", competencia: comp };
  },

  async apuracao_registrar(a, env) {
    const db = sb(env);
    const comp = String(a.competencia).replace("-", "").slice(0, 6);
    const body = { ...a, competencia: comp };
    const existing = await db.get("apuracoes_mensais", { select: "id", cliente_id: `eq.${a.cliente_id}`, competencia: `eq.${comp}`, limit: "1" });
    if (Array.isArray(existing) && existing.length > 0) return db.patch("apuracoes_mensais", `id=eq.${existing[0].id}`, body);
    return db.post("apuracoes_mensais", body);
  },

  // TAREFAS
  async tarefas_listar(a, env) {
    const p = { select: "*", order: "created_at.desc", limit: String(a.limit || 50) };
    if (a.status) p["status"] = `eq.${a.status}`;
    if (a.tipo) p["tipo"] = `eq.${a.tipo}`;
    if (a.responsavel) p["responsavel"] = `ilike.*${a.responsavel}*`;
    if (a.cliente_id) p["cliente_id"] = `eq.${a.cliente_id}`;
    if (a.prioridade) p["prioridade"] = `eq.${a.prioridade}`;
    return sb(env).get("tarefas", p);
  },

  async tarefa_buscar(a, env) {
    const rows = await sb(env).get("tarefas", { select: "*", id: `eq.${a.id}`, limit: "1" });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Tarefa não encontrada" };
  },

  async tarefa_criar(a, env) {
    const sla = { fiscal: 4, dp: 24, financeiro: 24, atendimento: 2, contabilidade: 48, societario: 72, compliance: 48, comercial: 48, interno: 72 };
    const horas = sla[a.tipo] || 72;
    return sb(env).post("tarefas", {
      titulo: a.titulo,
      descricao: a.descricao || null,
      tipo: a.tipo || "interno",
      status: "aberta",
      prioridade: ({critica:'critica',alta:'alta',normal:'media',media:'media',baixa:'baixa'}[a.prioridade] || 'media'),
      cliente_id: a.cliente_id || null,
      cliente_nome: a.cliente_nome || null,
      responsavel: a.responsavel,
      responsavel_tipo: a.responsavel_tipo || "agente",
      criado_por: a.criado_por || "mcp",
      criado_por_tipo: "agente",
      sla_horas: horas,
      sla_status: "no_prazo",
      data_prazo: a.data_vencimento || new Date(Date.now() + horas * 3600000).toISOString(),
      requer_aprovacao: false
    });
  },

  async tarefa_atualizar(a, env) {
    const { id, ...patch } = a;
    return sb(env).patch("tarefas", `id=eq.${id}`, patch);
  },

  async tarefa_comentar(a, env) {
    const rows = await sb(env).get("tarefas", { select: "comentarios", id: `eq.${a.id}`, limit: "1" });
    if (!Array.isArray(rows) || rows.length === 0) return { error: "Tarefa não encontrada" };
    const comentarios = rows[0].comentarios || [];
    comentarios.push({ autor: a.autor, texto: a.comentario, criado_em: new Date().toISOString() });
    return sb(env).patch("tarefas", `id=eq.${a.id}`, { comentarios });
  },

  // WHATSAPP
  async whatsapp_enviar(a, env) {
    const db = sb(env);
    await db.post("mensagem_whatsapp", {
      telefone: String(a.destinatario).replace(/\D/g, ""),
      conteudo: String(a.mensagem),
      direcao: "enviada", tipo: "texto", status: "pendente"
    }, "return=minimal");

    const inst = await db.get("wa_instance", { select: "id,nome,status,evolution_apikey", order: "created_at.asc", limit: "1" });
    if (!Array.isArray(inst) || inst.length === 0) return { queued: true, msg: "Sem instância configurada" };
    const i = inst[0];
    if (i.status !== "connected") return { queued: true, msg: `Instância ${i.nome} não conectada (${i.status})` };

    // Pegar URL da evolução do escritório_config
    const cfg = await db.get("escritorio_config", { select: "evolution_api_url,evolution_api_key", limit: "1" });
    const evolutionUrl = Array.isArray(cfg) && cfg[0]?.evolution_api_url ? cfg[0].evolution_api_url : null;
    const evolutionKey = Array.isArray(cfg) && cfg[0]?.evolution_api_key ? cfg[0].evolution_api_key : i.evolution_apikey;

    if (!evolutionUrl) return { queued: true, msg: "evolution_api_url não configurado" };

    const tel = String(a.destinatario).replace(/\D/g, "");
    const r = await fetch(`${evolutionUrl}/message/sendText/${i.nome}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: `${tel}@s.whatsapp.net`, textMessage: { text: String(a.mensagem) } })
    });
    return r.json();
  },

  async whatsapp_conversas_listar(a, env) {
    const p = { select: "*", order: "ultima_em.desc", limit: String(a.limit || 20) };
    if (a.cliente_id) p["cliente_id"] = `eq.${a.cliente_id}`;
    return sb(env).get("wa_conversa", p);
  },

  async whatsapp_mensagens_listar(a, env) {
    return sb(env).get("mensagem_whatsapp", {
      select: "*", conversa_id: `eq.${a.conversa_id}`, order: "created_at.asc", limit: String(a.limit || 50)
    });
  },

  async whatsapp_mensagens_pendentes(a, env) {
    return sb(env).get("mensagem_whatsapp", {
      select: "*", direcao: "eq.recebida", order: "created_at.desc", limit: String(a.limit || 20)
    });
  },

  async whatsapp_instancias(_a, env) {
    return sb(env).get("wa_instance", { select: "id,nome,display_name,status,numero,created_at", order: "nome.asc" });
  },

  // FISCAL
  async nfse_emitir(a, env) {
    const db = sb(env);
    const cfg = await db.get("escritorio_config", { select: "nfeio_api_key,nfseio_emitente_id,cnpj", limit: "1" });
    if (!Array.isArray(cfg) || !cfg[0]?.nfeio_api_key) return { error: "NFE.io não configurado" };
    const { nfeio_api_key, nfseio_emitente_id, cnpj } = cfg[0];
    const emitenteCnpj = (nfseio_emitente_id || cnpj).replace(/\D/g, "");
    const payload = {
      cityServiceCode: "17.20", federalServiceCode: "17.20",
      description: a.servico_descricao, servicesAmount: a.valor,
      taxationType: "WithinCity",
      ...(a.tomador_cnpj ? { borrower: { federalTaxNumber: String(a.tomador_cnpj).replace(/\D/g,""), name: a.tomador_razao || "" } } : {})
    };
    const r = await fetch(`https://api.nfe.io/v1/companies/${emitenteCnpj}/serviceinvoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(nfeio_api_key + ":")}` },
      body: JSON.stringify(payload)
    });
    const result = await r.json();
    await db.post("nfse_notas", {
      cliente_id: a.cliente_id, valor_servico: a.valor, descricao_servico: a.servico_descricao, status: "rascunho"
    }, "return=minimal");
    return result;
  },

  async nfse_listar(a, env) {
    const p = { select: "*", order: "created_at.desc", limit: String(a.limit || 50) };
    if (a.cliente_id) p["cliente_id"] = `eq.${a.cliente_id}`;
    return sb(env).get("nfse_emitida", p);
  },

  async das_listar(a, env) {
    const p = { select: "*", order: "competencia.desc", limit: String(a.limit || 50) };
    if (a.cliente_id) p["cliente_id"] = `eq.${a.cliente_id}`;
    if (a.status) p["status"] = `eq.${a.status}`;
    return sb(env).get("das_guias", p);
  },

  async das_gerar(a, env) {
    const cli = await HANDLERS.cliente_buscar({ identificador: a.cliente_id }, env);
    if (cli.error) return cli;
    return HANDLERS.serpro_consultar({ tool: "serpro_pgmei_das", cnpj: cli.cnpj, params: { periodo: a.competencia } }, env);
  },

  // DOCUMENTOS
  async documentos_listar(a, env) {
    const p = { select: "*", order: "created_at.desc", limit: String(a.limit || 50) };
    if (a.cliente_id) p["cliente_id"] = `eq.${a.cliente_id}`;
    return sb(env).get("documento_arquivo", p);
  },

  async documento_registrar(a, env) {
    return sb(env).post("documento_arquivo", { ...a, created_at: new Date().toISOString() });
  },

  // ESCRITÓRIO
  async escritorio_config_ler(_a, env) {
    const rows = await sb(env).get("escritorio_config", {
      select: "id,razao_social,nome_fantasia,cnpj,crc,email,telefone,whatsapp,logotipo_url,nfseio_emitente_id,nfseio_ambiente,evolution_api_url,dia_cobranca,dias_suspensao",
      limit: "1"
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Config não encontrada" };
  },

  async escritorio_config_atualizar(a, env) {
    const db = sb(env);
    const ex = await db.get("escritorio_config", { select: "id", limit: "1" });
    if (Array.isArray(ex) && ex.length > 0) return db.patch("escritorio_config", `id=eq.${ex[0].id}`, a);
    return db.post("escritorio_config", a);
  },

  async integracoes_listar(_a, env) {
    return sb(env).get("integracao_config", { select: "id,tipo,ativa,updated_at", order: "tipo.asc" });
  },

  async integracao_toggle(a, env) {
    return sb(env).patch("integracao_config", `id=eq.${a.id}`, { ativa: a.ativa });
  },

  // SERPRO
  async serpro_consultar(a, env) {
    const body = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: String(a.tool), arguments: { cnpj: String(a.cnpj).replace(/\D/g,""), ...(a.params || {}) } } };
    const resp = await fetch(env.ZAPRO_MCP_URL || "https://mcp.zapro.tech/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.ZAPRO_MCP_TOKEN}` },
      body: JSON.stringify(body)
    });
    return resp.json();
  },

  // AUTOMAÇÕES
  async automacoes_listar(a, env) {
    const p = { select: "*", order: "nome.asc" };
    if (a.status) p["status"] = `eq.${a.status}`;
    return sb(env).get("automacoes_config", p);
  },

  async automacao_toggle(a, env) {
    return sb(env).patch("automacoes_config", `id=eq.${a.id}`, { status: a.status });
  },

  // MCP KEYS
  async mcp_keys_listar(_a, env) {
    return sb(env).get("mcp_api_keys", { select: "id,agent_name,description,scopes,is_active,last_used_at,created_at", order: "created_at.asc" });
  },

  async mcp_key_revogar(a, env) {
    return sb(env).patch("mcp_api_keys", `id=eq.${a.id}`, { is_active: false });
  },

  async mcp_key_excluir(a, env) {
    return sb(env).del("mcp_api_keys", `id=eq.${a.id}`);
  },

  // LOGS
  async agente_log(a, env) {
    return sb(env).post("agente_logs", {
      agente: a.agente, acao: a.acao, resultado: a.resultado,
      cliente_id: a.cliente_id || null, detalhes: a.detalhes || null,
      executado_em: new Date().toISOString()
    }, "return=minimal");
  },

  async logs_listar(a, env) {
    const p = { select: "*", order: "executado_em.desc", limit: String(a.limit || 50) };
    if (a.agente) p["agente"] = `ilike.*${a.agente}*`;
    return sb(env).get("agente_logs", p);
  },

  async calendario_fiscal(a, env) {
    const mes = a.mes ? String(a.mes) : new Date().toISOString().slice(5, 7);
    return sb(env).get("calendario_fiscal", {
      select: "id,codigo,nome,descricao,regime,competencia_mes,dia_vencimento,periodicidade,ativo",
      competencia_mes: `eq.${parseInt(mes.slice(-2) || mes)}`,
      ativo: "eq.true",
      order: "dia_vencimento.asc"
    });
  },
};

// ── Worker ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ status: "ok", service: SERVER_INFO.name, version: SERVER_INFO.version, tools: TOOLS.length, categories: 15, timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/sse" && request.method === "GET") {
      const identity = await validateApiKey(request.headers.get("Authorization"), env);
      if (!identity) return new Response("Unauthorized", { status: 401, headers: CORS });
      const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`event: endpoint\ndata: ${url.origin}/message\n\n`)); } });
      return new Response(stream, { headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }

    if ((url.pathname === "/message" || url.pathname === "/mcp") && request.method === "POST") {
      const identity = await validateApiKey(request.headers.get("Authorization"), env);
      if (!identity) return mcpError(null, -32001, "Unauthorized");

      let body;
      try { body = await request.json(); } catch { return mcpError(null, -32700, "Parse error"); }
      const { jsonrpc, id, method, params } = body;
      if (jsonrpc !== "2.0") return mcpError(id, -32600, "Invalid Request");

      switch (method) {
        case "initialize":
          return json({ jsonrpc: "2.0", id, result: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: {}, logging: {} }, serverInfo: SERVER_INFO, meta: { agent: identity.agentName, scopes: identity.scopes, tools_count: TOOLS.length } } });
        case "notifications/initialized":
        case "ping":
          return json({ jsonrpc: "2.0", id, result: {} });
        case "tools/list": {
          const scoped = identity.scopes.includes("*") ? TOOLS : TOOLS.filter(t => identity.scopes.includes(t.name));
          return json({ jsonrpc: "2.0", id, result: { tools: scoped } });
        }
        case "tools/call": {
          const toolName = params?.name || "";
          const toolArgs = params?.arguments || {};
          if (!identity.scopes.includes("*") && !identity.scopes.includes(toolName)) return mcpError(id, -32003, `Scope insuficiente para '${toolName}'`);
          const handler = HANDLERS[toolName];
          if (!handler) return mcpError(id, -32601, `Tool '${toolName}' não encontrada`);
          try {
            const result = await handler(toolArgs, env);
            return mcpResult(id, result);
          } catch (err) {
            return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({ error: err.message, tool: toolName }) }], isError: true } });
          }
        }
        default: return mcpError(id, -32601, `Método '${method}' não suportado`);
      }
    }
    return json({ error: "Not found" }, 404);
  }
};

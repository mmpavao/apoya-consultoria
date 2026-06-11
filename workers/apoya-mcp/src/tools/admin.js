// tools/admin.js — Admin, usuários, configurações, auditoria, MCP keys
// Auto-gerado em refactor(mcp) 2026-06-11 — NÃO EDITAR MANUALMENTE

export const TOOLS_ADMIN = [
  {
      name: "usuario_buscar",
      description: "Busca usuário por UUID ou email.",
      inputSchema: {
        type: "object",
        required: ["identificador"],
        properties: { identificador: { type: "string" } }
      }
    },
  {
      name: "usuarios_listar",
      description: "Lista usuários do sistema (profiles + roles). Campos: id, nome, email, role, cliente_id.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "integer", default: 50 } }
      }
    },
  {
      name: "usuario_role_atualizar",
      description: "Atualiza role de um usuário (admin | contador | assistente | cliente).",
      inputSchema: {
        type: "object",
        required: ["user_id", "role"],
        properties: { user_id: { type: "string" }, role: { type: "string" } }
      }
    },
  {
      name: "permissoes_listar",
      description: "Lista todas as permissões cadastradas no sistema.",
      inputSchema: { type: "object", properties: {} }
    },
  {
      name: "convites_listar",
      description: "Lista convites de acesso pendentes.",
      inputSchema: { type: "object", properties: { limit: { type: "integer", default: 50 } } }
    },
  {
      name: "mcp_api_key_criar",
      description: "Cria nova API key do MCP para um agente.",
      inputSchema: {
        type: "object",
        required: ["agent_name", "raw_key"],
        properties: {
          agent_name: { type: "string" },
          raw_key: { type: "string" },
          description: { type: "string" },
          scopes: { type: "array", items: { type: "string" } },
          expires_at: { type: "string" }
        }
      }
    },
  {
      name: "mcp_api_keys_listar",
      description: "Lista API keys do MCP cadastradas (sem revelar o hash). Campos: agent_name, scopes, is_active, last_used_at.",
      inputSchema: { type: "object", properties: {} }
    },
  {
      name: "audit_log_listar",
      description: "Lista log de auditoria do sistema. Campos: user_id, acao, entidade, entidade_id, ip.",
      inputSchema: {
        type: "object",
        properties: {
          entidade: { type: "string" },
          user_id: { type: "string" },
          limit: { type: "integer", default: 100 }
        }
      }
    },
  {
      name: "automacoes_listar",
      description: "Lista automações configuradas (automacoes_config). Campos: nome, tipo_gatilho, status, ultima_execucao, total_execucoes.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "integer", default: 50 }
        }
      }
    },
  {
      name: "escritorio_config_buscar",
      description: "Busca configuração do escritório APOYA. Campos: razao_social, cnpj, crc, focusnfe_api_token, asaas_api_key, evolution_api_url, dias_suspensao, dia_cobranca, templates WA.",
      inputSchema: { type: "object", properties: {} }
    },
  {
      name: "escritorio_config_atualizar",
      description: "Atualiza configuração do escritório.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          template_wa_das: { type: "string" },
          template_wa_nfse: { type: "string" },
          template_wa_cobranca: { type: "string" },
          dias_suspensao: { type: "integer" },
          dia_cobranca: { type: "integer" }
        }
      }
    },
  {
      name: "integracao_config_listar",
      description: "Lista configurações de integrações ativas (Focus, SERPRO, Asaas, Evolution).",
      inputSchema: { type: "object", properties: {} }
    },
  {
      name: "sistema_saude",
      description: "Verifica saúde do sistema: conexão Supabase, total de clientes, obrigações vencidas, cobranças em atraso.",
      inputSchema: { type: "object", properties: {} }
    },
];

export const HANDLERS_ADMIN = {
  async usuario_buscar(args, env) {
    const db = sb(env);
    const isEmail = args.identificador.includes("@");
    const filter = isEmail ? { email: `eq.${args.identificador}` } : { id: `eq.${args.identificador}` };
    const rows = await db.get("profiles", { select: "*", ...filter });
    return Array.isArray(rows) ? rows[0] || { error: "Usuário não encontrado" } : rows;
  },

  async usuarios_listar(args, env) {
    return sb(env).get("profiles", { select: "id,nome,email,avatar_url,cliente_id,created_at", limit: args.limit || 50 });
  },

  async usuario_role_atualizar(args, env) {
    const existing = await sb(env).get("user_roles", { user_id: `eq.${args.user_id}` });
    if (Array.isArray(existing) && existing.length > 0) {
      return sb(env).patch("user_roles", `user_id=eq.${args.user_id}`, { role: args.role });
    }
    return sb(env).post("user_roles", { user_id: args.user_id, role: args.role });
  },

  async permissoes_listar(args, env) {
    return sb(env).get("permissoes", { select: "*", order: "slug.asc" });
  },

  // TAREFAS,

  async convites_listar(args, env) {
    return sb(env).get("convites", { select: "*", order: "criado_em.desc", limit: args.limit || 50 });
  },

  async mcp_api_key_criar(args, env) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(args.raw_key));
    const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    return sb(env).post("mcp_api_keys", {
      agent_name: args.agent_name,
      key_hash: hash,
      description: args.description || "",
      scopes: args.scopes || ["*"],
      is_active: true,
      expires_at: args.expires_at || null,
      created_at: new Date().toISOString()
    });
  },

  // UTILITÁRIOS,

  async mcp_api_keys_listar(args, env) {
    return sb(env).get("mcp_api_keys", { select: "id,agent_name,description,scopes,is_active,last_used_at,created_at,expires_at", order: "created_at.desc" });
  },

  async audit_log_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 100 };
    if (args.entidade) p["entidade"] = `eq.${args.entidade}`;
    if (args.user_id) p["user_id"] = `eq.${args.user_id}`;
    return sb(env).get("audit_log", p);
  },

  async automacoes_listar(args, env) {
    const p = { select: "id,nome,descricao,tipo_gatilho,status,ultima_execucao,proxima_execucao,total_execucoes,created_at", order: "nome.asc", limit: args.limit || 50 };
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("automacoes_config", p);
  },

  async escritorio_config_buscar(args, env) {
    const rows = await sb(env).get("escritorio_config", { select: "id,razao_social,nome_fantasia,cnpj,crc,email,telefone,whatsapp,dias_suspensao,dia_cobranca,template_wa_das,template_wa_nfse,template_wa_cobranca,municipio,uf,inscricao_municipal,focus_ambiente", limit: 1 });
    return Array.isArray(rows) ? rows[0] || {} : rows;
  },

  async escritorio_config_atualizar(args, env) {
    const { id, ...data } = args;
    return sb(env).patch("escritorio_config", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  async integracao_config_listar(args, env) {
    return sb(env).get("integracao_config", { select: "id,tipo,ativa,updated_at" });
  },

  async sistema_saude(args, env) {
    const db = sb(env);
    const [clientes, obrigVencidas, cobrancasAtraso, tarefasCriticas] = await Promise.all([
      db.get("clientes", { select: "id", status: "eq.ativo" }),
      db.get("obrigacoes", { select: "id", status: "eq.pendente", vencimento: `lt.${new Date().toISOString().slice(0, 10)}` }),
      db.get("cobrancas", { select: "id,valor", status: "eq.atrasado" }),
      db.get("tarefas", { select: "id", sla_status: "eq.atrasado" })
    ]);
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      clientes_ativos: Array.isArray(clientes) ? clientes.length : "?",
      obrigacoes_vencidas: Array.isArray(obrigVencidas) ? obrigVencidas.length : "?",
      cobrancas_atrasadas: Array.isArray(cobrancasAtraso) ? cobrancasAtraso.length : "?",
      tarefas_sla_atrasado: Array.isArray(tarefasCriticas) ? tarefasCriticas.length : "?"
    };
  }
};

// ── FETCH HANDLER ─────────────────────────────────────────────────────────────,

};

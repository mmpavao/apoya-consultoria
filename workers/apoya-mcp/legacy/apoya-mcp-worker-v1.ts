/**
 * APOYA MCP Worker — v2.0
 * 100% dos tools do sistema:
 * Clientes, Usuários, Permissões, Obrigações, Cobranças, Tarefas,
 * WhatsApp (send/recv), NFS-e, DAS, Documentos, Lançamentos,
 * Escritório Config, Integrações, Automações, Logs
 */

const MCP_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "apoya-gestao-mcp",
  version: "2.0.0",
  description: "MCP completo do sistema APOYA Gestão — acesso 100%"
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-session-id",
  "Access-Control-Max-Age": "86400"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

function mcpError(id: unknown, code: number, message: string) {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}

function mcpResult(id: unknown, data: unknown) {
  return json({
    jsonrpc: "2.0", id,
    result: {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    }
  });
}

// ── Supabase Client ───────────────────────────────────────────────────────────
function sb(env: Env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    async query(table: string, params: Record<string, string> = {}) {
      const qs = new URLSearchParams(params).toString();
      const r = await fetch(`${url}/rest/v1/${table}${qs ? '?' + qs : ''}`, {
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        }
      });
      return r.json();
    },
    async post(table: string, body: unknown, prefer = "return=representation") {
      const r = await fetch(`${url}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          "Content-Type": "application/json", Prefer: prefer
        },
        body: JSON.stringify(body)
      });
      return r.json();
    },
    async patch(table: string, filter: string, body: unknown) {
      const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: "PATCH",
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          "Content-Type": "application/json", Prefer: "return=representation"
        },
        body: JSON.stringify(body)
      });
      return r.json();
    },
    async delete(table: string, filter: string) {
      const r = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: "DELETE",
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          "Content-Type": "application/json", Prefer: "return=representation"
        }
      });
      return r.status === 204 ? { deleted: true } : r.json();
    },
    async rpc(fn: string, body: unknown) {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          apikey: key, Authorization: `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      return r.json();
    }
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ZAPRO_MCP_URL?: string;
  ZAPRO_MCP_TOKEN?: string;
}

interface Identity { agentName: string; scopes: string[]; keyId: string; }

async function validateApiKey(authHeader: string | null, env: Env): Promise<Identity | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const raw = authHeader.slice(7).trim();
  if (!raw) return null;

  // Hash SHA-256
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");

  const db = sb(env);
  const rows = await db.query("mcp_api_keys",
    { select: "id,agent_name,scopes,is_active,expires_at", "key_hash": `eq.${hash}` }
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const key = rows[0];
  if (!key.is_active) return null;
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null;

  // Atualizar last_used_at
  await db.patch("mcp_api_keys", `id=eq.${key.id}`, { last_used_at: new Date().toISOString() });

  return {
    agentName: key.agent_name,
    scopes: key.scopes?.length ? key.scopes : ["*"],
    keyId: key.id
  };
}

// ── TOOLS DEFINITIONS ─────────────────────────────────────────────────────────
const TOOLS = [

  // ═══════════════════════════════════════════
  // CLIENTES
  // ═══════════════════════════════════════════
  {
    name: "clientes_listar",
    description: "Lista clientes da APOYA com filtros opcionais. Retorna razão social, CNPJ, regime, status, honorário e checklist de prontidão.",
    inputSchema: {
      type: "object",
      properties: {
        regime: { type: "string", enum: ["MEI", "Simples", "Lucro Presumido", "Lucro Real"] },
        status: { type: "string", enum: ["ativo", "inadimplente", "suspenso", "inativo", "em_analise"] },
        limit: { type: "integer", default: 20, maximum: 200 },
        offset: { type: "integer", default: 0 },
        search: { type: "string", description: "Busca por razão social, fantasia ou CNPJ" }
      }
    }
  },
  {
    name: "cliente_buscar",
    description: "Dados completos de um cliente pelo CNPJ ou UUID. Inclui sócios, certificados, configuração fiscal e obrigações.",
    inputSchema: {
      type: "object", required: ["identificador"],
      properties: { identificador: { type: "string" } }
    }
  },
  {
    name: "cliente_criar",
    description: "Cria novo cliente no sistema. Dados mínimos: razão social, CNPJ, regime tributário.",
    inputSchema: {
      type: "object", required: ["razao_social", "cnpj", "regime"],
      properties: {
        razao_social: { type: "string" },
        cnpj: { type: "string" },
        regime: { type: "string", enum: ["MEI", "Simples", "Lucro Presumido", "Lucro Real"] },
        email: { type: "string" },
        telefone: { type: "string" },
        responsavel: { type: "string" },
        honorario: { type: "number" }
      }
    }
  },
  {
    name: "cliente_atualizar",
    description: "Atualiza dados de um cliente existente pelo UUID.",
    inputSchema: {
      type: "object", required: ["id"],
      properties: {
        id: { type: "string" },
        razao_social: { type: "string" },
        email: { type: "string" },
        telefone: { type: "string" },
        status: { type: "string" },
        honorario: { type: "number" },
        regime: { type: "string" },
        responsavel: { type: "string" }
      }
    }
  },
  {
    name: "cliente_excluir",
    description: "Remove um cliente do sistema pelo UUID. Operação irreversível.",
    inputSchema: {
      type: "object", required: ["id"],
      properties: { id: { type: "string" } }
    }
  },
  {
    name: "cliente_socios_listar",
    description: "Lista os sócios/quadro societário de um cliente.",
    inputSchema: {
      type: "object", required: ["cliente_id"],
      properties: { cliente_id: { type: "string" } }
    }
  },
  {
    name: "cliente_socio_criar",
    description: "Adiciona sócio ao quadro societário de um cliente.",
    inputSchema: {
      type: "object", required: ["cliente_id", "nome", "cpf"],
      properties: {
        cliente_id: { type: "string" },
        nome: { type: "string" },
        cpf: { type: "string" },
        qualificacao: { type: "string" },
        participacao: { type: "number" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // USUÁRIOS E PERMISSÕES
  // ═══════════════════════════════════════════
  {
    name: "usuarios_listar",
    description: "Lista todos os usuários do sistema com perfil, role e status.",
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string", enum: ["admin", "contador", "assistente", "cliente"] },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "usuario_buscar",
    description: "Busca usuário por ID ou email. Retorna perfil, role, setor e permissões.",
    inputSchema: {
      type: "object", required: ["identificador"],
      properties: { identificador: { type: "string", description: "UUID ou email" } }
    }
  },
  {
    name: "usuario_role_atualizar",
    description: "Atualiza o role/papel de um usuário no sistema.",
    inputSchema: {
      type: "object", required: ["user_id", "role"],
      properties: {
        user_id: { type: "string" },
        role: { type: "string", enum: ["admin", "contador", "assistente", "cliente"] }
      }
    }
  },
  {
    name: "usuario_convidar",
    description: "Envia convite por e-mail para um novo usuário acessar o sistema.",
    inputSchema: {
      type: "object", required: ["email", "role"],
      properties: {
        email: { type: "string" },
        role: { type: "string", enum: ["admin", "contador", "assistente", "cliente"] },
        nome: { type: "string" }
      }
    }
  },
  {
    name: "permissoes_listar",
    description: "Lista as permissões configuradas no sistema (módulos, ações e papéis autorizados).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "permissoes_atualizar",
    description: "Atualiza uma permissão — habilita/desabilita acesso de um role a um módulo/ação.",
    inputSchema: {
      type: "object", required: ["modulo", "acao", "role", "permitido"],
      properties: {
        modulo: { type: "string" },
        acao: { type: "string" },
        role: { type: "string" },
        permitido: { type: "boolean" }
      }
    }
  },
  {
    name: "convites_listar",
    description: "Lista convites pendentes e já aceitos de usuários.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pendente", "aceito", "expirado"] }
      }
    }
  },

  // ═══════════════════════════════════════════
  // OBRIGAÇÕES FISCAIS
  // ═══════════════════════════════════════════
  {
    name: "obrigacoes_listar",
    description: "Lista obrigações fiscais/contábeis. Pode filtrar por cliente, status, tipo e período.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string", enum: ["pendente", "atrasada", "concluida", "cancelada"] },
        tipo: { type: "string" },
        competencia: { type: "string" },
        vencimento_ate: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "obrigacao_criar",
    description: "Cria uma nova obrigação fiscal/contábil para um cliente.",
    inputSchema: {
      type: "object", required: ["cliente_id", "tipo", "descricao", "vencimento"],
      properties: {
        cliente_id: { type: "string" },
        tipo: { type: "string" },
        descricao: { type: "string" },
        vencimento: { type: "string" },
        competencia: { type: "string" },
        valor: { type: "number" },
        prioridade: { type: "string", enum: ["baixa", "normal", "alta", "critica"] }
      }
    }
  },
  {
    name: "obrigacao_atualizar",
    description: "Atualiza status ou campos de uma obrigação existente.",
    inputSchema: {
      type: "object", required: ["id"],
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["pendente", "atrasada", "concluida", "cancelada"] },
        observacao: { type: "string" },
        concluida_em: { type: "string" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // COBRANÇAS / FINANCEIRO
  // ═══════════════════════════════════════════
  {
    name: "cobrancas_listar",
    description: "Lista cobranças/honorários. Pode filtrar por cliente, status e período.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string", enum: ["pendente", "paga", "atrasada", "cancelada"] },
        mes: { type: "string", description: "YYYY-MM" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "cobranca_criar",
    description: "Cria uma nova cobrança/honorário para um cliente.",
    inputSchema: {
      type: "object", required: ["cliente_id", "valor", "vencimento", "descricao"],
      properties: {
        cliente_id: { type: "string" },
        valor: { type: "number" },
        vencimento: { type: "string" },
        descricao: { type: "string" },
        tipo: { type: "string" }
      }
    }
  },
  {
    name: "cobranca_atualizar",
    description: "Atualiza status de uma cobrança (ex: marcar como paga).",
    inputSchema: {
      type: "object", required: ["id"],
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        pago_em: { type: "string" },
        observacao: { type: "string" }
      }
    }
  },
  {
    name: "lancamentos_listar",
    description: "Lista lançamentos contábeis. Pode filtrar por cliente, conta e período.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        conta_debito: { type: "string" },
        conta_credito: { type: "string" },
        periodo_inicio: { type: "string" },
        periodo_fim: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "lancamento_criar",
    description: "Cria um lançamento contábil em partidas dobradas.",
    inputSchema: {
      type: "object", required: ["cliente_id", "conta_debito", "conta_credito", "valor", "historico", "data_lancamento"],
      properties: {
        cliente_id: { type: "string" },
        conta_debito: { type: "string" },
        conta_credito: { type: "string" },
        valor: { type: "number" },
        historico: { type: "string" },
        data_lancamento: { type: "string" },
        competencia: { type: "string" },
        documento_ref: { type: "string" }
      }
    }
  },
  {
    name: "apuracao_buscar",
    description: "Retorna apuração mensal (DAS, impostos, resultado) de um cliente num período.",
    inputSchema: {
      type: "object", required: ["cliente_id", "competencia"],
      properties: {
        cliente_id: { type: "string" },
        competencia: { type: "string", description: "YYYY-MM ou YYYYMM" }
      }
    }
  },
  {
    name: "apuracao_registrar",
    description: "Registra ou atualiza a apuração mensal de um cliente.",
    inputSchema: {
      type: "object", required: ["cliente_id", "competencia", "receita_bruta"],
      properties: {
        cliente_id: { type: "string" },
        competencia: { type: "string" },
        receita_bruta: { type: "number" },
        base_calculo: { type: "number" },
        aliquota: { type: "number" },
        valor_das: { type: "number" },
        status: { type: "string" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // TAREFAS / WORKFLOWS
  // ═══════════════════════════════════════════
  {
    name: "tarefas_listar",
    description: "Lista tarefas do sistema de workflows com filtros opcionais.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["aberta","em_andamento","aguardando_aprovacao","aprovada","rejeitada","concluida","cancelada","bloqueada"] },
        tipo: { type: "string", enum: ["fiscal","dp","financeiro","societario","compliance","contabilidade","atendimento","comercial","interno"] },
        responsavel: { type: "string" },
        cliente_id: { type: "string" },
        prioridade: { type: "string", enum: ["baixa","normal","alta","critica"] },
        sla_status: { type: "string", enum: ["no_prazo","atencao","atrasada","expirada"] },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "tarefa_buscar",
    description: "Retorna detalhes completos de uma tarefa pelo UUID, incluindo subtarefas, comentários e histórico.",
    inputSchema: {
      type: "object", required: ["id"],
      properties: { id: { type: "string" } }
    }
  },
  {
    name: "tarefa_criar",
    description: "Cria nova tarefa no sistema de workflows com SLA automático por tipo.",
    inputSchema: {
      type: "object", required: ["titulo", "tipo", "responsavel"],
      properties: {
        titulo: { type: "string" },
        tipo: { type: "string", enum: ["fiscal","dp","financeiro","societario","compliance","contabilidade","atendimento","comercial","interno"] },
        responsavel: { type: "string" },
        descricao: { type: "string" },
        cliente_id: { type: "string" },
        prioridade: { type: "string", enum: ["baixa","normal","alta","critica"] },
        data_vencimento: { type: "string" },
        criado_por: { type: "string" }
      }
    }
  },
  {
    name: "tarefa_atualizar",
    description: "Atualiza campos de uma tarefa (status, responsável, descrição, etc.).",
    inputSchema: {
      type: "object", required: ["id"],
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        responsavel: { type: "string" },
        prioridade: { type: "string" },
        descricao: { type: "string" },
        data_vencimento: { type: "string" }
      }
    }
  },
  {
    name: "tarefa_comentar",
    description: "Adiciona um comentário a uma tarefa.",
    inputSchema: {
      type: "object", required: ["id", "comentario", "autor"],
      properties: {
        id: { type: "string" },
        comentario: { type: "string" },
        autor: { type: "string" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // WHATSAPP — ENVIO E RECEBIMENTO
  // ═══════════════════════════════════════════
  {
    name: "whatsapp_enviar",
    description: "Envia mensagem WhatsApp para um número ou cliente. Usa a Evolution API integrada.",
    inputSchema: {
      type: "object", required: ["destinatario", "mensagem"],
      properties: {
        destinatario: { type: "string", description: "Número +55DD9XXXXXXXX ou cliente_id" },
        mensagem: { type: "string" },
        instancia: { type: "string", description: "Nome da instância Evolution API (padrão: ZapMEI)" },
        tipo: { type: "string", enum: ["texto", "documento", "imagem"], default: "texto" }
      }
    }
  },
  {
    name: "whatsapp_conversas_listar",
    description: "Lista conversas WhatsApp ativas com clientes. Retorna últimas mensagens e status.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string", enum: ["aberta", "em_atendimento", "encerrada"] },
        limit: { type: "integer", default: 20 }
      }
    }
  },
  {
    name: "whatsapp_mensagens_listar",
    description: "Lista mensagens de uma conversa WhatsApp específica.",
    inputSchema: {
      type: "object", required: ["conversa_id"],
      properties: {
        conversa_id: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "whatsapp_mensagens_pendentes",
    description: "Lista mensagens WhatsApp recebidas que aguardam resposta (status: pendente/novo).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", default: 20 }
      }
    }
  },
  {
    name: "whatsapp_instancias",
    description: "Lista as instâncias Evolution API configuradas e seus status de conexão.",
    inputSchema: { type: "object", properties: {} }
  },

  // ═══════════════════════════════════════════
  // NFS-e / FISCAL
  // ═══════════════════════════════════════════
  {
    name: "nfse_emitir",
    description: "Emite NFS-e para um cliente via NFE.io. Requer configuração fiscal ativa.",
    inputSchema: {
      type: "object", required: ["cliente_id", "servico_descricao", "valor"],
      properties: {
        cliente_id: { type: "string" },
        servico_descricao: { type: "string" },
        valor: { type: "number" },
        tomador_cnpj: { type: "string" },
        tomador_razao: { type: "string" },
        competencia: { type: "string" }
      }
    }
  },
  {
    name: "nfse_listar",
    description: "Lista NFS-e emitidas ou recebidas. Pode filtrar por cliente e período.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        tipo: { type: "string", enum: ["emitida", "recebida"] },
        periodo: { type: "string", description: "YYYY-MM" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "das_listar",
    description: "Lista guias DAS geradas. Pode filtrar por cliente, status e período.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string", enum: ["pendente", "paga", "atrasada"] },
        competencia: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "das_gerar",
    description: "Gera guia DAS para um cliente via SERPRO.",
    inputSchema: {
      type: "object", required: ["cliente_id", "competencia"],
      properties: {
        cliente_id: { type: "string" },
        competencia: { type: "string", description: "YYYYMM" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // DOCUMENTOS
  // ═══════════════════════════════════════════
  {
    name: "documentos_listar",
    description: "Lista documentos arquivados de um cliente (pastas e arquivos).",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        pasta_id: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "documento_registrar",
    description: "Registra metadados de um documento no sistema.",
    inputSchema: {
      type: "object", required: ["cliente_id", "nome", "tipo"],
      properties: {
        cliente_id: { type: "string" },
        nome: { type: "string" },
        tipo: { type: "string" },
        pasta_id: { type: "string" },
        storage_path: { type: "string" },
        tamanho: { type: "integer" },
        observacao: { type: "string" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // ESCRITÓRIO / CONFIGURAÇÕES
  // ═══════════════════════════════════════════
  {
    name: "escritorio_config_ler",
    description: "Lê as configurações do escritório contábil (dados, logo, templates, integrações ativas).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "escritorio_config_atualizar",
    description: "Atualiza configurações do escritório.",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        cnpj: { type: "string" },
        email: { type: "string" },
        telefone: { type: "string" },
        endereco: { type: "string" }
      }
    }
  },
  {
    name: "integracoes_listar",
    description: "Lista integrações configuradas no sistema (Evolution API, NFE.io, SERPRO, Asaas) e seus status.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "integracao_toggle",
    description: "Ativa ou desativa uma integração pelo ID.",
    inputSchema: {
      type: "object", required: ["id", "ativa"],
      properties: {
        id: { type: "string" },
        ativa: { type: "boolean" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // SERPRO — CONSULTAS FISCAIS
  // ═══════════════════════════════════════════
  {
    name: "serpro_consultar",
    description: "Consulta dados fiscais no SERPRO via gateway zapro.tech. Suporta: ccmei_dados, ccmei_situacao, pgmei_das, pgmei_divida, pgdas_ultima, sitfis.",
    inputSchema: {
      type: "object", required: ["tool", "cnpj"],
      properties: {
        tool: { type: "string" },
        cnpj: { type: "string" },
        params: { type: "object" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // AUTOMAÇÕES
  // ═══════════════════════════════════════════
  {
    name: "automacoes_listar",
    description: "Lista automações configuradas no sistema (DAS automático, régua de cobrança, alertas).",
    inputSchema: {
      type: "object",
      properties: {
        ativa: { type: "boolean" },
        tipo: { type: "string" }
      }
    }
  },
  {
    name: "automacao_toggle",
    description: "Ativa ou desativa uma automação pelo ID.",
    inputSchema: {
      type: "object", required: ["id", "ativa"],
      properties: {
        id: { type: "string" },
        ativa: { type: "boolean" }
      }
    }
  },

  // ═══════════════════════════════════════════
  // MCP API KEYS
  // ═══════════════════════════════════════════
  {
    name: "mcp_keys_listar",
    description: "Lista as API Keys do MCP configuradas no sistema.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "mcp_key_revogar",
    description: "Revoga (desativa) uma API Key do MCP pelo ID.",
    inputSchema: {
      type: "object", required: ["id"],
      properties: { id: { type: "string" } }
    }
  },
  {
    name: "mcp_key_excluir",
    description: "Exclui permanentemente uma API Key do MCP.",
    inputSchema: {
      type: "object", required: ["id"],
      properties: { id: { type: "string" } }
    }
  },

  // ═══════════════════════════════════════════
  // LOGS / AUDITORIA
  // ═══════════════════════════════════════════
  {
    name: "agente_log",
    description: "Registra uma ação/log de agente no sistema de auditoria.",
    inputSchema: {
      type: "object", required: ["agente", "acao", "resultado"],
      properties: {
        agente: { type: "string" },
        acao: { type: "string" },
        resultado: { type: "string", enum: ["sucesso", "erro", "parcial"] },
        cliente_id: { type: "string" },
        detalhes: { type: "object" },
        erro_mensagem: { type: "string" }
      }
    }
  },
  {
    name: "logs_listar",
    description: "Lista logs de auditoria do sistema.",
    inputSchema: {
      type: "object",
      properties: {
        agente: { type: "string" },
        resultado: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "calendario_fiscal",
    description: "Retorna o calendário fiscal do mês atual ou de um período, com obrigações vencendo.",
    inputSchema: {
      type: "object",
      properties: {
        mes: { type: "string", description: "YYYY-MM (padrão: mês atual)" }
      }
    }
  },
];

// ── HANDLERS ──────────────────────────────────────────────────────────────────
type Handler = (args: Record<string, unknown>, env: Env) => Promise<unknown>;

const HANDLERS: Record<string, Handler> = {

  // CLIENTES
  async clientes_listar(args, env) {
    const db = sb(env);
    const params: Record<string, string> = {
      select: "id,razao_social,nome_fantasia,cnpj,regime,status,honorario,responsavel,email,telefone,created_at",
      order: "razao_social.asc",
      limit: String(args.limit || 20),
      offset: String(args.offset || 0)
    };
    if (args.regime) params["regime"] = `eq.${args.regime}`;
    if (args.status) params["status"] = `eq.${args.status}`;
    if (args.search) params["razao_social"] = `ilike.*${args.search}*`;
    return db.query("clientes", params);
  },

  async cliente_buscar(args, env) {
    const db = sb(env);
    const id = String(args.identificador).replace(/\D/g, "").length >= 11
      ? String(args.identificador).replace(/\D/g, "")
      : String(args.identificador);
    const isCnpj = /^\d{14}$/.test(id);
    const rows = await db.query("clientes", {
      select: "*",
      [isCnpj ? "cnpj" : "id"]: `eq.${id}`
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Cliente não encontrado" };
  },

  async cliente_criar(args, env) {
    return sb(env).post("clientes", {
      razao_social: args.razao_social,
      cnpj: String(args.cnpj).replace(/\D/g, ""),
      regime: args.regime,
      email: args.email || null,
      telefone: args.telefone || null,
      responsavel: args.responsavel || "APOYA",
      honorario: args.honorario || null,
      status: "ativo"
    });
  },

  async cliente_atualizar(args, env) {
    const { id, ...patch } = args;
    return sb(env).patch("clientes", `id=eq.${id}`, patch);
  },

  async cliente_excluir(args, env) {
    return sb(env).delete("clientes", `id=eq.${args.id}`);
  },

  async cliente_socios_listar(args, env) {
    return sb(env).query("cliente_socio", { select: "*", cliente_id: `eq.${args.cliente_id}` });
  },

  async cliente_socio_criar(args, env) {
    return sb(env).post("cliente_socio", args);
  },

  // USUÁRIOS E PERMISSÕES
  async usuarios_listar(args, env) {
    const params: Record<string, string> = {
      select: "id,email,full_name,role,created_at",
      order: "full_name.asc",
      limit: String(args.limit || 50)
    };
    if (args.role) params["role"] = `eq.${args.role}`;
    return sb(env).query("profiles", params);
  },

  async usuario_buscar(args, env) {
    const id = String(args.identificador);
    const isEmail = id.includes("@");
    const rows = await sb(env).query("profiles", {
      select: "*",
      [isEmail ? "email" : "id"]: `eq.${id}`
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Usuário não encontrado" };
  },

  async usuario_role_atualizar(args, env) {
    return sb(env).patch("profiles", `id=eq.${args.user_id}`, { role: args.role });
  },

  async usuario_convidar(args, env) {
    return sb(env).post("convites", {
      email: args.email,
      role: args.role,
      nome: args.nome || null,
      status: "pendente",
      criado_em: new Date().toISOString()
    });
  },

  async permissoes_listar(_args, env) {
    return sb(env).query("permissoes", { select: "*", order: "modulo.asc" });
  },

  async permissoes_atualizar(args, env) {
    const existing = await sb(env).query("permissoes", {
      select: "id", modulo: `eq.${args.modulo}`, acao: `eq.${args.acao}`, role: `eq.${args.role}`
    });
    if (Array.isArray(existing) && existing.length > 0) {
      return sb(env).patch("permissoes", `id=eq.${existing[0].id}`, { permitido: args.permitido });
    }
    return sb(env).post("permissoes", args);
  },

  async convites_listar(args, env) {
    const params: Record<string, string> = { select: "*", order: "criado_em.desc" };
    if (args.status) params["status"] = `eq.${args.status}`;
    return sb(env).query("convites", params);
  },

  // OBRIGAÇÕES
  async obrigacoes_listar(args, env) {
    const params: Record<string, string> = {
      select: "*", order: "vencimento.asc", limit: String(args.limit || 50)
    };
    if (args.cliente_id) params["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) params["status"] = `eq.${args.status}`;
    if (args.tipo) params["tipo"] = `ilike.${args.tipo}`;
    if (args.vencimento_ate) params["vencimento"] = `lte.${args.vencimento_ate}`;
    return sb(env).query("obrigacoes", params);
  },

  async obrigacao_criar(args, env) {
    return sb(env).post("obrigacoes", { ...args, status: args.status || "pendente" });
  },

  async obrigacao_atualizar(args, env) {
    const { id, ...patch } = args;
    return sb(env).patch("obrigacoes", `id=eq.${id}`, patch);
  },

  // COBRANÇAS
  async cobrancas_listar(args, env) {
    const params: Record<string, string> = {
      select: "*", order: "vencimento.desc", limit: String(args.limit || 50)
    };
    if (args.cliente_id) params["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) params["status"] = `eq.${args.status}`;
    return sb(env).query("cobrancas", params);
  },

  async cobranca_criar(args, env) {
    return sb(env).post("cobrancas", { ...args, status: "pendente" });
  },

  async cobranca_atualizar(args, env) {
    const { id, ...patch } = args;
    return sb(env).patch("cobrancas", `id=eq.${id}`, patch);
  },

  // LANÇAMENTOS
  async lancamentos_listar(args, env) {
    const params: Record<string, string> = {
      select: "*", order: "data_lancamento.desc", limit: String(args.limit || 50)
    };
    if (args.cliente_id) params["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.periodo_inicio) params["data_lancamento"] = `gte.${args.periodo_inicio}`;
    return sb(env).query("lancamentos_contabeis", params);
  },

  async lancamento_criar(args, env) {
    return sb(env).post("lancamentos_contabeis", args);
  },

  async apuracao_buscar(args, env) {
    const comp = String(args.competencia).replace("-", "").slice(0, 6);
    const rows = await sb(env).query("apuracoes_mensais", {
      select: "*", cliente_id: `eq.${args.cliente_id}`, competencia: `eq.${comp}`
    });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Apuração não encontrada", cliente_id: args.cliente_id, competencia: comp };
  },

  async apuracao_registrar(args, env) {
    const comp = String(args.competencia).replace("-", "").slice(0, 6);
    const existing = await sb(env).query("apuracoes_mensais", {
      select: "id", cliente_id: `eq.${args.cliente_id}`, competencia: `eq.${comp}`
    });
    const body = { ...args, competencia: comp };
    if (Array.isArray(existing) && existing.length > 0) {
      return sb(env).patch("apuracoes_mensais", `id=eq.${existing[0].id}`, body);
    }
    return sb(env).post("apuracoes_mensais", body);
  },

  // TAREFAS
  async tarefas_listar(args, env) {
    const params: Record<string, string> = {
      select: "*", order: "created_at.desc", limit: String(args.limit || 50)
    };
    if (args.status) params["status"] = `eq.${args.status}`;
    if (args.tipo) params["tipo"] = `eq.${args.tipo}`;
    if (args.responsavel) params["responsavel"] = `ilike.*${args.responsavel}*`;
    if (args.cliente_id) params["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.prioridade) params["prioridade"] = `eq.${args.prioridade}`;
    return sb(env).query("tarefas", params);
  },

  async tarefa_buscar(args, env) {
    const rows = await sb(env).query("tarefas", { select: "*", id: `eq.${args.id}` });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Tarefa não encontrada" };
  },

  async tarefa_criar(args, env) {
    const slaHoras: Record<string, number> = {
      fiscal: 4, dp: 24, financeiro: 24, atendimento: 2,
      contabilidade: 48, societario: 72, compliance: 48,
      comercial: 48, interno: 72
    };
    const tipo = String(args.tipo);
    const horas = slaHoras[tipo] || 72;
    const sla_vencimento = new Date(Date.now() + horas * 3600000).toISOString();
    return sb(env).post("tarefas", {
      ...args,
      status: "aberta",
      prioridade: args.prioridade || "normal",
      sla_horas: horas,
      sla_vencimento,
      criado_em: new Date().toISOString()
    });
  },

  async tarefa_atualizar(args, env) {
    const { id, ...patch } = args;
    return sb(env).patch("tarefas", `id=eq.${id}`, patch);
  },

  async tarefa_comentar(args, env) {
    // Buscar tarefa atual
    const rows = await sb(env).query("tarefas", { select: "comentarios", id: `eq.${args.id}` });
    if (!Array.isArray(rows) || rows.length === 0) return { error: "Tarefa não encontrada" };
    const comentarios = rows[0].comentarios || [];
    comentarios.push({
      autor: args.autor,
      texto: args.comentario,
      criado_em: new Date().toISOString()
    });
    return sb(env).patch("tarefas", `id=eq.${args.id}`, { comentarios });
  },

  // WHATSAPP
  async whatsapp_enviar(args, env) {
    // Registrar mensagem na fila
    await sb(env).post("mensagem_whatsapp", {
      destinatario: args.destinatario,
      mensagem: String(args.mensagem),
      instancia: args.instancia || "ZapMEI",
      status: "pendente",
      tipo: args.tipo || "texto",
      criado_em: new Date().toISOString()
    });

    // Tentar enviar via Evolution API
    const instancia = await sb(env).query("wa_instance", {
      select: "id,nome,evolution_url,api_key,status",
      nome: `ilike.*${args.instancia || "ZapMEI"}*`
    });

    if (!Array.isArray(instancia) || instancia.length === 0 || instancia[0].status !== "connected") {
      return { queued: true, message: "Mensagem enfileirada — instância não conectada" };
    }

    const inst = instancia[0];
    const tel = String(args.destinatario).replace(/\D/g, "");
    const r = await fetch(`${inst.evolution_url}/message/sendText/${inst.nome}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: inst.api_key },
      body: JSON.stringify({ number: `${tel}@s.whatsapp.net`, textMessage: { text: String(args.mensagem) } })
    });
    const result = await r.json();
    return { sent: true, result };
  },

  async whatsapp_conversas_listar(args, env) {
    const params: Record<string, string> = {
      select: "*", order: "ultima_mensagem.desc", limit: String(args.limit || 20)
    };
    if (args.cliente_id) params["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) params["status"] = `eq.${args.status}`;
    return sb(env).query("wa_conversa", params);
  },

  async whatsapp_mensagens_listar(args, env) {
    return sb(env).query("mensagem_whatsapp", {
      select: "*",
      conversa_id: `eq.${args.conversa_id}`,
      order: "criado_em.asc",
      limit: String(args.limit || 50)
    });
  },

  async whatsapp_mensagens_pendentes(args, env) {
    return sb(env).query("mensagem_whatsapp", {
      select: "*",
      status: "in.(pendente,novo,recebido)",
      order: "criado_em.desc",
      limit: String(args.limit || 20)
    });
  },

  async whatsapp_instancias(_args, env) {
    return sb(env).query("wa_instance", { select: "id,nome,status,numero,created_at", order: "nome.asc" });
  },

  // NFS-e
  async nfse_emitir(args, env) {
    const config = await sb(env).query("escritorio_config", { select: "nfseio_api_key,cnpj", limit: "1" });
    if (!Array.isArray(config) || !config[0]?.nfseio_api_key) return { error: "NFE.io não configurado" };

    const payload = {
      cityServiceCode: "17.20",
      federalServiceCode: "17.20",
      description: args.servico_descricao,
      servicesAmount: args.valor,
      taxationType: "WithinCity",
      borrower: args.tomador_cnpj ? {
        federalTaxNumber: String(args.tomador_cnpj).replace(/\D/g, ""),
        name: args.tomador_razao || ""
      } : undefined
    };

    const cnpjEmit = String(config[0].cnpj).replace(/\D/g, "");
    const r = await fetch(`https://api.nfe.io/v1/companies/${cnpjEmit}/serviceinvoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(config[0].nfseio_api_key + ":")}` },
      body: JSON.stringify(payload)
    });
    const result = await r.json();

    // Registrar no banco
    await sb(env).post("nfse_notas", {
      cliente_id: args.cliente_id,
      valor: args.valor,
      descricao: args.servico_descricao,
      status: "processando",
      nfseio_ref: result.id || null,
      criado_em: new Date().toISOString()
    }, "return=minimal");

    return result;
  },

  async nfse_listar(args, env) {
    const params: Record<string, string> = { select: "*", order: "created_at.desc", limit: String(args.limit || 50) };
    if (args.cliente_id) params["cliente_id"] = `eq.${args.cliente_id}`;
    const table = args.tipo === "recebida" ? "nfse_recebida" : "nfse_emitida";
    return sb(env).query(table, params);
  },

  async das_listar(args, env) {
    const params: Record<string, string> = { select: "*", order: "competencia.desc", limit: String(args.limit || 50) };
    if (args.cliente_id) params["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) params["status"] = `eq.${args.status}`;
    if (args.competencia) params["competencia"] = `eq.${args.competencia}`;
    return sb(env).query("das_guias", params);
  },

  async das_gerar(args, env) {
    // Buscar CNPJ do cliente
    const cliente = await HANDLERS.cliente_buscar({ identificador: args.cliente_id }, env) as Record<string, unknown>;
    if (!cliente.cnpj) return { error: "Cliente não encontrado" };

    // Chamar SERPRO via gateway
    return HANDLERS.serpro_consultar({ tool: "serpro_pgmei_das", cnpj: cliente.cnpj, params: { periodo: args.competencia } }, env);
  },

  // DOCUMENTOS
  async documentos_listar(args, env) {
    const params: Record<string, string> = { select: "*", order: "created_at.desc", limit: String(args.limit || 50) };
    if (args.cliente_id) params["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.pasta_id) params["pasta_id"] = `eq.${args.pasta_id}`;
    return sb(env).query("documento_arquivo", params);
  },

  async documento_registrar(args, env) {
    return sb(env).post("documento_arquivo", { ...args, criado_em: new Date().toISOString() });
  },

  // ESCRITÓRIO
  async escritorio_config_ler(_args, env) {
    const rows = await sb(env).query("escritorio_config", { select: "id,nome,cnpj,email,telefone,endereco,logo_url,nfseio_api_key,asaas_token", limit: "1" });
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : { error: "Configuração não encontrada" };
  },

  async escritorio_config_atualizar(args, env) {
    const existing = await sb(env).query("escritorio_config", { select: "id", limit: "1" });
    if (Array.isArray(existing) && existing.length > 0) {
      return sb(env).patch("escritorio_config", `id=eq.${existing[0].id}`, args);
    }
    return sb(env).post("escritorio_config", args);
  },

  async integracoes_listar(_args, env) {
    return sb(env).query("integracao_config", { select: "id,nome,tipo,ativa,descricao,updated_at", order: "nome.asc" });
  },

  async integracao_toggle(args, env) {
    return sb(env).patch("integracao_config", `id=eq.${args.id}`, { ativa: args.ativa });
  },

  // SERPRO
  async serpro_consultar(args, env) {
    const serproTool = String(args.tool);
    const cnpj = String(args.cnpj).replace(/\D/g, "");
    const body = {
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: serproTool, arguments: { cnpj, ...(args.params || {}) } }
    };
    const resp = await fetch(env.ZAPRO_MCP_URL || "https://mcp.zapro.tech/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${env.ZAPRO_MCP_TOKEN}` },
      body: JSON.stringify(body)
    });
    return resp.json();
  },

  // AUTOMAÇÕES
  async automacoes_listar(args, env) {
    const params: Record<string, string> = { select: "*", order: "nome.asc" };
    if (typeof args.ativa === "boolean") params["ativa"] = `eq.${args.ativa}`;
    if (args.tipo) params["tipo"] = `eq.${args.tipo}`;
    return sb(env).query("automacoes_config", params);
  },

  async automacao_toggle(args, env) {
    return sb(env).patch("automacoes_config", `id=eq.${args.id}`, { ativa: args.ativa });
  },

  // MCP KEYS
  async mcp_keys_listar(_args, env) {
    return sb(env).query("mcp_api_keys", {
      select: "id,agent_name,description,is_active,last_used_at,created_at,expires_at",
      order: "created_at.asc"
    });
  },

  async mcp_key_revogar(args, env) {
    return sb(env).patch("mcp_api_keys", `id=eq.${args.id}`, { is_active: false });
  },

  async mcp_key_excluir(args, env) {
    return sb(env).delete("mcp_api_keys", `id=eq.${args.id}`);
  },

  // LOGS
  async agente_log(args, env) {
    return sb(env).post("agente_logs", {
      agente: args.agente,
      acao: args.acao,
      resultado: args.resultado,
      cliente_id: args.cliente_id || null,
      detalhes: args.detalhes || null,
      erro_mensagem: args.erro_mensagem || null,
      executado_em: new Date().toISOString()
    }, "return=minimal");
  },

  async logs_listar(args, env) {
    const params: Record<string, string> = {
      select: "*", order: "executado_em.desc", limit: String(args.limit || 50)
    };
    if (args.agente) params["agente"] = `ilike.*${args.agente}*`;
    if (args.resultado) params["resultado"] = `eq.${args.resultado}`;
    return sb(env).query("agente_logs", params);
  },

  async calendario_fiscal(args, env) {
    const mes = args.mes ? String(args.mes) : new Date().toISOString().slice(0, 7);
    return sb(env).query("calendario_fiscal", {
      select: "*",
      competencia: `like.${mes}%`,
      order: "vencimento.asc"
    });
  },
};

// ── Main Worker ───────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        status: "ok",
        service: SERVER_INFO.name,
        version: SERVER_INFO.version,
        protocol: MCP_PROTOCOL_VERSION,
        tools: TOOLS.length,
        categories: ["clientes", "usuarios", "permissoes", "obrigacoes", "cobrancas", "tarefas", "whatsapp", "nfse", "das", "documentos", "escritorio", "serpro", "automacoes", "mcp_keys", "logs"],
        timestamp: new Date().toISOString()
      });
    }

    // SSE endpoint
    if (url.pathname === "/sse" && request.method === "GET") {
      const auth = request.headers.get("Authorization");
      const identity = await validateApiKey(auth, env);
      if (!identity) return new Response("Unauthorized", { status: 401, headers: CORS });

      const stream = new ReadableStream({
        start(controller) {
          const enc = new TextEncoder();
          controller.enqueue(enc.encode(`event: endpoint\ndata: ${url.origin}/message\n\n`));
        }
      });
      return new Response(stream, {
        headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }
      });
    }

    // MCP JSON-RPC
    if ((url.pathname === "/message" || url.pathname === "/mcp") && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      const identity = await validateApiKey(auth, env);
      if (!identity) return mcpError(null, -32001, "Unauthorized: API Key inválida ou ausente");

      let body: { jsonrpc: string; id: unknown; method: string; params?: Record<string, unknown> };
      try { body = await request.json(); }
      catch { return mcpError(null, -32700, "Parse error"); }

      const { jsonrpc, id, method, params } = body;
      if (jsonrpc !== "2.0") return mcpError(id, -32600, "Invalid Request");

      switch (method) {
        case "initialize":
          return json({
            jsonrpc: "2.0", id,
            result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: { tools: {}, logging: {} },
              serverInfo: SERVER_INFO,
              meta: { agent: identity.agentName, scopes: identity.scopes, tools_count: TOOLS.length }
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
          const toolName = (params?.name as string) || "";
          const toolArgs = (params?.arguments as Record<string, unknown>) || {};

          if (!identity.scopes.includes("*") && !identity.scopes.includes(toolName)) {
            return mcpError(id, -32003, `Scope insuficiente: '${toolName}'`);
          }

          const handler = HANDLERS[toolName];
          if (!handler) return mcpError(id, -32601, `Tool '${toolName}' não encontrada`);

          try {
            const result = await handler(toolArgs, env);
            return mcpResult(id, result);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return json({
              jsonrpc: "2.0", id,
              result: { content: [{ type: "text", text: JSON.stringify({ error: msg, tool: toolName }) }], isError: true }
            });
          }
        }

        default:
          return mcpError(id, -32601, `Método '${method}' não suportado`);
      }
    }

    return json({ error: "Not found", endpoints: ["/", "/health", "/sse", "/mcp", "/message"] }, 404);
  }
};

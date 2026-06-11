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

// ── TOOLS DEFINITION ─────────────────────────────────────────────────────────
const TOOLS = [

  // ══════════════════════════════════════════════════════
  // CLIENTES
  // ══════════════════════════════════════════════════════
  {
    name: "clientes_listar",
    description: "Lista clientes. Campos: razao_social, nome_fantasia, cnpj, regime, status, responsavel, email, telefone, whatsapp, valor_honorario, dia_vencimento, tem_certificado, bloqueado, asaas_customer_id.",
    inputSchema: {
      type: "object",
      properties: {
        regime: { type: "string", description: "Simples Nacional | Lucro Presumido | Lucro Real | MEI" },
        status: { type: "string", description: "ativo | inativo | suspenso | bloqueado" },
        search: { type: "string", description: "Busca por razão social ou CNPJ" },
        responsavel_id: { type: "string" },
        bloqueado: { type: "boolean" },
        limit: { type: "integer", default: 20 },
        offset: { type: "integer", default: 0 }
      }
    }
  },
  {
    name: "cliente_buscar",
    description: "Dados completos de um cliente por UUID ou CNPJ. Inclui endereço, integrations, honorário, certificado digital.",
    inputSchema: {
      type: "object",
      required: ["identificador"],
      properties: { identificador: { type: "string", description: "UUID ou CNPJ (com ou sem máscara)" } }
    }
  },
  {
    name: "cliente_criar",
    description: "Cria novo cliente. Campos obrigatórios: razao_social, cnpj, regime. Opcionais: nome_fantasia, email, telefone, whatsapp, inscricao_municipal, inscricao_estadual, codigo_servico_nfse, valor_honorario, dia_vencimento, forma_pagamento, logradouro, numero, bairro, municipio, uf, cep, codigo_municipio_ibge.",
    inputSchema: {
      type: "object",
      required: ["razao_social", "cnpj", "regime"],
      properties: {
        razao_social: { type: "string" },
        cnpj: { type: "string" },
        regime: { type: "string" },
        nome_fantasia: { type: "string" },
        email: { type: "string" },
        telefone: { type: "string" },
        whatsapp: { type: "string" },
        responsavel: { type: "string" },
        valor_honorario: { type: "number" },
        dia_vencimento: { type: "integer" },
        forma_pagamento: { type: "string" },
        inscricao_municipal: { type: "string" },
        inscricao_estadual: { type: "string" },
        codigo_servico_nfse: { type: "string" },
        logradouro: { type: "string" },
        numero: { type: "string" },
        bairro: { type: "string" },
        municipio: { type: "string" },
        uf: { type: "string" },
        cep: { type: "string" },
        codigo_municipio_ibge: { type: "string" },
        tem_empregados: { type: "boolean" },
        aliquota_iss: { type: "number" }
      }
    }
  },
  {
    name: "cliente_atualizar",
    description: "Atualiza qualquer campo de um cliente pelo UUID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        razao_social: { type: "string" },
        nome_fantasia: { type: "string" },
        email: { type: "string" },
        telefone: { type: "string" },
        whatsapp: { type: "string" },
        status: { type: "string" },
        valor_honorario: { type: "number" },
        regime: { type: "string" },
        responsavel: { type: "string" },
        responsavel_id: { type: "string" },
        inscricao_municipal: { type: "string" },
        codigo_municipio_ibge: { type: "string" },
        dia_vencimento: { type: "integer" },
        forma_pagamento: { type: "string" },
        bloqueado: { type: "boolean" },
        motivo_bloqueio: { type: "string" },
        focus_ambiente: { type: "string" },
        asaas_customer_id: { type: "string" },
        observacoes: { type: "string" }
      }
    }
  },
  {
    name: "cliente_socios_listar",
    description: "Lista sócios de um cliente. Campos: nome, cpf, qualificacao, percentual, is_administrador, is_ativo.",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: { cliente_id: { type: "string" } }
    }
  },
  {
    name: "cliente_socio_criar",
    description: "Adiciona sócio ao cliente.",
    inputSchema: {
      type: "object",
      required: ["cliente_id", "nome", "cpf"],
      properties: {
        cliente_id: { type: "string" },
        nome: { type: "string" },
        cpf: { type: "string" },
        qualificacao: { type: "string" },
        percentual: { type: "number" },
        capital_subscrito: { type: "number" },
        is_administrador: { type: "boolean" },
        email: { type: "string" },
        telefone: { type: "string" },
        whatsapp: { type: "string" }
      }
    }
  },
  {
    name: "cliente_servicos_listar",
    description: "Lista serviços contratados por um cliente (cliente_servico). Campos: catalogo_id, nome_servico, valor_contratado, valor_final, periodicidade, status.",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: { cliente_id: { type: "string" } }
    }
  },
  {
    name: "cliente_certificado_buscar",
    description: "Busca certificado digital A1 de um cliente. Campos: tipo, pfx_validade, pfx_nome_razao, pfx_cnpj, has_procuracao, focus_cert_ref.",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: { cliente_id: { type: "string" } }
    }
  },
  {
    name: "cliente_bloqueios_listar",
    description: "Lista histórico de bloqueios de um cliente.",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: { cliente_id: { type: "string" } }
    }
  },

  // ══════════════════════════════════════════════════════
  // USUÁRIOS / PERMISSÕES
  // ══════════════════════════════════════════════════════
  {
    name: "usuarios_listar",
    description: "Lista usuários do sistema (profiles + roles). Campos: id, nome, email, role, cliente_id.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", default: 50 } }
    }
  },
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
    name: "usuario_role_atualizar",
    description: "Atualiza role de um usuário (admin | contador | assistente | cliente).",
    inputSchema: {
      type: "object",
      required: ["user_id", "role"],
      properties: { user_id: { type: "string" }, role: { type: "string" } }
    }
  },
  {
    name: "convites_listar",
    description: "Lista convites de acesso pendentes.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", default: 50 } } }
  },
  {
    name: "setores_listar",
    description: "Lista setores do escritório (fiscal, dp, contabil, comercial, etc).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "permissoes_listar",
    description: "Lista todas as permissões cadastradas no sistema.",
    inputSchema: { type: "object", properties: {} }
  },

  // ══════════════════════════════════════════════════════
  // TAREFAS
  // ══════════════════════════════════════════════════════
  {
    name: "tarefas_listar",
    description: "Lista tarefas. Campos: titulo, tipo, status, prioridade, sla_status, responsavel, cliente_id, data_prazo, subtarefas_total, subtarefas_concluidas, comentarios, historico.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "aberta | em_andamento | aprovada | rejeitada | concluida | cancelada" },
        tipo: { type: "string" },
        responsavel: { type: "string" },
        cliente_id: { type: "string" },
        prioridade: { type: "string", description: "baixa | normal | alta | critica" },
        sla_status: { type: "string", description: "no_prazo | critico | atrasado | concluido" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "tarefa_buscar",
    description: "Detalhes completos de uma tarefa incluindo histórico e comentários.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } }
    }
  },
  {
    name: "tarefa_criar",
    description: "Cria tarefa com SLA automático por tipo (fiscal_urgente:4h, dp:24h, comercial:48h, outros:72h).",
    inputSchema: {
      type: "object",
      required: ["titulo", "tipo", "responsavel", "criado_por"],
      properties: {
        titulo: { type: "string" },
        tipo: { type: "string", description: "fiscal_urgente | dp | comercial | outros" },
        responsavel: { type: "string" },
        responsavel_tipo: { type: "string", default: "humano" },
        criado_por: { type: "string" },
        criado_por_tipo: { type: "string", default: "agente" },
        descricao: { type: "string" },
        cliente_id: { type: "string" },
        prioridade: { type: "string", default: "normal" },
        data_prazo: { type: "string" },
        metadados: { type: "object" }
      }
    }
  },
  {
    name: "tarefa_atualizar",
    description: "Atualiza campos de uma tarefa e registra histórico automaticamente.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        responsavel: { type: "string" },
        descricao: { type: "string" },
        prioridade: { type: "string" },
        data_prazo: { type: "string" },
        _por: { type: "string", description: "Nome do agente que fez a mudança" }
      }
    }
  },
  {
    name: "tarefa_comentar",
    description: "Adiciona comentário a uma tarefa.",
    inputSchema: {
      type: "object",
      required: ["id", "texto", "autor"],
      properties: {
        id: { type: "string" },
        texto: { type: "string" },
        autor: { type: "string" },
        autor_tipo: { type: "string", default: "agente" }
      }
    }
  },
  {
    name: "tarefa_concluir",
    description: "Conclui uma tarefa. Falha se houver subtarefas abertas.",
    inputSchema: {
      type: "object",
      required: ["id", "concluido_por"],
      properties: { id: { type: "string" }, concluido_por: { type: "string" } }
    }
  },
  {
    name: "tarefas_agente_listar",
    description: "Lista tarefas programadas para agentes de IA (tarefas_agente). Campos: tipo, titulo, agente, status, executar_em, resultado, erro.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "pendente | processando | concluida | erro" },
        agente: { type: "string" },
        client_id: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // OBRIGAÇÕES
  // ══════════════════════════════════════════════════════
  {
    name: "obrigacoes_listar",
    description: "Lista obrigações fiscais/contábeis. Campos: tipo, descricao, competencia, vencimento, status, valor, responsavel, cliente_nome.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string", description: "pendente | concluida | atrasada" },
        tipo: { type: "string" },
        vencimento_ate: { type: "string", description: "YYYY-MM-DD" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "obrigacao_criar",
    description: "Cria nova obrigação.",
    inputSchema: {
      type: "object",
      required: ["cliente_id", "tipo", "descricao", "vencimento"],
      properties: {
        cliente_id: { type: "string" },
        tipo: { type: "string" },
        descricao: { type: "string" },
        vencimento: { type: "string" },
        competencia: { type: "string" },
        valor: { type: "number" },
        responsavel: { type: "string" }
      }
    }
  },
  {
    name: "obrigacao_atualizar",
    description: "Atualiza obrigação (status, valor, observacoes).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        valor: { type: "number" },
        observacoes: { type: "string" },
        concluido_por: { type: "string" }
      }
    }
  },
  {
    name: "calendario_fiscal_listar",
    description: "Lista obrigações do calendário fiscal padrão por regime.",
    inputSchema: {
      type: "object",
      properties: {
        regime: { type: "string" },
        ativo: { type: "boolean", default: true }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // COBRANÇAS / FINANCEIRO
  // ══════════════════════════════════════════════════════
  {
    name: "cobrancas_listar",
    description: "Lista cobranças/honorários. Campos: cliente_nome, valor, vencimento, status, dias_atraso, regua_stage, pix_copia_cola, boleto_url, nfse_status.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string", description: "pendente | pago | atrasado | cancelado" },
        regua_stage: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "cobranca_criar",
    description: "Cria cobrança de honorário.",
    inputSchema: {
      type: "object",
      required: ["cliente_id", "valor", "vencimento", "descricao"],
      properties: {
        cliente_id: { type: "string" },
        valor: { type: "number" },
        vencimento: { type: "string" },
        descricao: { type: "string" },
        competencia: { type: "string" },
        forma: { type: "string", description: "pix | boleto | cartao" },
        recorrente: { type: "boolean" }
      }
    }
  },
  {
    name: "cobranca_atualizar",
    description: "Atualiza cobrança (status, pago_em, regua_stage).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        pago_em: { type: "string" },
        regua_stage: { type: "string" }
      }
    }
  },
  {
    name: "regua_cobranca_config_buscar",
    description: "Busca configuração da régua de cobrança do escritório (dias, percentuais, mensagens).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "servico_pagamentos_listar",
    description: "Lista pagamentos de serviços (servico_pagamento). Campos: cliente_id, competencia, valor, status, forma_pagamento.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // APURAÇÕES / CONTABILIDADE
  // ══════════════════════════════════════════════════════
  {
    name: "apuracao_buscar",
    description: "Apuração mensal de um cliente (apuracoes_mensais). Campos: receita_bruta, das_valor, das_codigo_barras, icms, iss, pgdas_recibo, checklist.",
    inputSchema: {
      type: "object",
      required: ["cliente_id", "competencia"],
      properties: {
        cliente_id: { type: "string" },
        competencia: { type: "string", description: "YYYY-MM" }
      }
    }
  },
  {
    name: "apuracao_registrar",
    description: "Cria ou atualiza apuração mensal.",
    inputSchema: {
      type: "object",
      required: ["cliente_id", "competencia", "receita_bruta"],
      properties: {
        cliente_id: { type: "string" },
        competencia: { type: "string" },
        receita_bruta: { type: "number" },
        receita_bruta_servico: { type: "number" },
        receita_bruta_comercio: { type: "number" },
        das_valor: { type: "number" },
        das_codigo_barras: { type: "string" },
        das_vencimento: { type: "string" },
        aliquota_efetiva: { type: "number" },
        status: { type: "string" }
      }
    }
  },
  {
    name: "lancamentos_listar",
    description: "Lista lançamentos contábeis. Campos: conta_debito, conta_credito, valor, historico, data_lancamento, status, criado_por_agente.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        mes_referencia: { type: "string", description: "YYYY-MM" },
        status: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "lancamento_criar",
    description: "Cria lançamento contábil.",
    inputSchema: {
      type: "object",
      required: ["cliente_id", "conta_debito", "conta_credito", "valor", "historico", "data_lancamento"],
      properties: {
        cliente_id: { type: "string" },
        conta_debito: { type: "string" },
        conta_credito: { type: "string" },
        valor: { type: "number" },
        historico: { type: "string" },
        data_lancamento: { type: "string" },
        data_competencia: { type: "string" },
        tipo: { type: "string" },
        centro_custo: { type: "string" },
        criado_por_agente: { type: "boolean", default: true }
      }
    }
  },
  {
    name: "plano_contas_listar",
    description: "Lista plano de contas de um cliente.",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: {
        cliente_id: { type: "string" },
        tipo: { type: "string", description: "ativo | passivo | receita | despesa | resultado" },
        aceita_lancamento: { type: "boolean" }
      }
    }
  },
  {
    name: "periodos_contabeis_listar",
    description: "Lista períodos contábeis (aberto | fechado) de um cliente.",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 24 }
      }
    }
  },
  {
    name: "documentos_fiscais_listar",
    description: "Lista documentos fiscais (NF-e, NFS-e, NFC-e) de um cliente. Campos: tipo, numero, data_emissao, emitente_cnpj, destinatario_cnpj, valor_total, status, conta_contabil_confirmada.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        tipo: { type: "string", description: "NFe | NFSe | NFCe" },
        mes_referencia: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "extrato_bancario_listar",
    description: "Lista entradas do extrato bancário de um cliente para conciliação.",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: {
        cliente_id: { type: "string" },
        mes_referencia: { type: "string" },
        status: { type: "string", description: "pendente | conciliado" },
        limit: { type: "integer", default: 100 }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // NFS-e (Focus NFe)
  // ══════════════════════════════════════════════════════
  {
    name: "nfse_emitir_focus",
    description: "Emite NFS-e via API Focus NFe. Usa certificado A1 do cliente. Retorna ref para consulta.",
    inputSchema: {
      type: "object",
      required: ["cliente_id", "valor_servico", "descricao_servico", "codigo_servico"],
      properties: {
        cliente_id: { type: "string" },
        valor_servico: { type: "number" },
        descricao_servico: { type: "string" },
        codigo_servico: { type: "string" },
        tomador_razao: { type: "string" },
        tomador_cnpj: { type: "string" },
        tomador_cpf: { type: "string" },
        tomador_email: { type: "string" },
        tomador_municipio_ibge: { type: "string" },
        competencia: { type: "string", description: "YYYY-MM" },
        cobranca_id: { type: "string" }
      }
    }
  },
  {
    name: "nfse_listar",
    description: "Lista NFS-e emitidas (nfse_emitida). Campos: numero, status, competencia, tomador_nome, valor_servico, pdf_url, cobranca_id.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string" },
        competencia: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "nfse_consultar_focus",
    description: "Consulta status de uma NFS-e na API Focus pelo ref.",
    inputSchema: {
      type: "object",
      required: ["focus_ref"],
      properties: { focus_ref: { type: "string" } }
    }
  },
  {
    name: "nfse_log_listar",
    description: "Lista log de operações NFS-e (focus_nfse_log). Útil para debug.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string", description: "sucesso | erro" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "nfse_recebidas_listar",
    description: "Lista NFS-e recebidas por um cliente (como tomador).",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: {
        cliente_id: { type: "string" },
        competencia: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // DAS / PGMEI / PGDAS (via SERPRO)
  // ══════════════════════════════════════════════════════
  {
    name: "das_listar",
    description: "Lista guias DAS geradas (das_guias). Campos: cliente_nome, regime, competencia, vencimento, valor, status, codigo_barras.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string", description: "pendente | pago | vencido" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "das_gerar",
    description: "Gera guia DAS do Simples Nacional via SERPRO para um cliente e competência.",
    inputSchema: {
      type: "object",
      required: ["cliente_id", "competencia"],
      properties: {
        cliente_id: { type: "string" },
        competencia: { type: "string", description: "YYYYMM" }
      }
    }
  },
  {
    name: "serpro_log_listar",
    description: "Lista log de consultas SERPRO. Campos: tool, parametros, status, resultado_resumo, duracao_ms.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // WHATSAPP / MENSAGERIA
  // ══════════════════════════════════════════════════════
  {
    name: "whatsapp_enviar",
    description: "Envia mensagem WhatsApp via Evolution API.",
    inputSchema: {
      type: "object",
      required: ["destinatario", "mensagem"],
      properties: {
        destinatario: { type: "string", description: "Número no formato 5511999999999" },
        mensagem: { type: "string" },
        instancia: { type: "string", description: "Nome da instância Evolution (usa padrão se omitido)" }
      }
    }
  },
  {
    name: "whatsapp_conversas_listar",
    description: "Lista conversas WhatsApp ativas (wa_conversa). Campos: telefone, nome_contato, ultima_mensagem, nao_lidas, assigned_to, departamento.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        departamento: { type: "string" },
        assigned_to: { type: "string" },
        limit: { type: "integer", default: 20 }
      }
    }
  },
  {
    name: "whatsapp_mensagens_listar",
    description: "Lista mensagens de uma conversa WA.",
    inputSchema: {
      type: "object",
      required: ["conversa_id"],
      properties: {
        conversa_id: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "whatsapp_instancias",
    description: "Lista instâncias Evolution API configuradas. Campos: nome, numero, status, departamentos.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "whatsapp_sessoes_listar",
    description: "Lista sessões de atendimento WhatsApp (whatsapp_sessions). Campos: phone_number, client_id, last_agent, modo_humano.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", default: 50 } } }
  },

  // ══════════════════════════════════════════════════════
  // DOCUMENTOS
  // ══════════════════════════════════════════════════════
  {
    name: "documentos_listar",
    description: "Lista documentos de um cliente (documentos). Campos: tipo, subtipo, titulo, status, data_emissao, data_validade.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        tipo: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "documento_pastas_listar",
    description: "Lista pastas de documentos de um cliente (documento_pasta).",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: { cliente_id: { type: "string" } }
    }
  },
  {
    name: "documento_arquivos_listar",
    description: "Lista arquivos dentro de uma pasta (documento_arquivo). Campos: nome, tipo_mime, tamanho_bytes, storage_url.",
    inputSchema: {
      type: "object",
      required: ["pasta_id"],
      properties: {
        pasta_id: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // CONTRATOS / CLICKSIGN
  // ══════════════════════════════════════════════════════
  {
    name: "contratos_listar",
    description: "Lista contratos de clientes (contrato_cliente). Campos: numero, titulo, tipo, status, clicksign_status, clicksign_sign_url_cliente, assinado_em.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "contrato_buscar",
    description: "Detalhes completos de um contrato incluindo link de assinatura.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } }
    }
  },

  // ══════════════════════════════════════════════════════
  // DP (DEPARTAMENTO PESSOAL)
  // ══════════════════════════════════════════════════════
  {
    name: "funcionarios_listar",
    description: "Lista funcionários de uma empresa cliente (funcionarios). Campos: nome, cpf, cargo, salario_base, data_admissao, status.",
    inputSchema: {
      type: "object",
      required: ["empresa_id"],
      properties: {
        empresa_id: { type: "string" },
        status: { type: "string", description: "ativo | demitido" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "folhas_listar",
    description: "Lista folhas de pagamento mensais (folha_mensal). Campos: competencia, total_funcionarios, total_liquido, status.",
    inputSchema: {
      type: "object",
      required: ["empresa_id"],
      properties: {
        empresa_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 12 }
      }
    }
  },
  {
    name: "ferias_listar",
    description: "Lista férias de funcionários.",
    inputSchema: {
      type: "object",
      properties: {
        empresa_id: { type: "string" },
        funcionario_id: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "rescisoes_listar",
    description: "Lista rescisões registradas.",
    inputSchema: {
      type: "object",
      properties: {
        empresa_id: { type: "string" },
        limit: { type: "integer", default: 20 }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // PROCESSOS SOCIETÁRIOS
  // ══════════════════════════════════════════════════════
  {
    name: "processos_societarios_listar",
    description: "Lista processos societários (abertura, alteração, encerramento). Campos: nome_empresa, tipo, fase, prioridade, responsavel, prazo.",
    inputSchema: {
      type: "object",
      properties: {
        cliente_id: { type: "string" },
        fase: { type: "string" },
        tipo: { type: "string" },
        status: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "processo_societario_criar",
    description: "Cria novo processo societário.",
    inputSchema: {
      type: "object",
      required: ["nome_empresa", "tipo"],
      properties: {
        nome_empresa: { type: "string" },
        cnpj: { type: "string" },
        tipo: { type: "string" },
        cliente_id: { type: "string" },
        fase: { type: "string" },
        prioridade: { type: "string" },
        responsavel: { type: "string" },
        prazo: { type: "string" },
        descricao: { type: "string" }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // CRM / LEADS
  // ══════════════════════════════════════════════════════
  {
    name: "leads_listar",
    description: "Lista leads do CRM (leads_crm). Campos: nome, email, telefone, cnpj, etapa, temperatura, origem, responsavel, honorario_proposto.",
    inputSchema: {
      type: "object",
      properties: {
        etapa: { type: "string" },
        temperatura: { type: "string", description: "quente | morno | frio" },
        responsavel: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "lead_criar",
    description: "Cria novo lead no CRM.",
    inputSchema: {
      type: "object",
      required: ["nome"],
      properties: {
        nome: { type: "string" },
        email: { type: "string" },
        telefone: { type: "string" },
        cnpj: { type: "string" },
        regime_tributario: { type: "string" },
        municipio: { type: "string" },
        uf: { type: "string" },
        etapa: { type: "string" },
        temperatura: { type: "string" },
        origem: { type: "string" },
        responsavel: { type: "string" },
        honorario_proposto: { type: "number" }
      }
    }
  },
  {
    name: "lead_atualizar",
    description: "Atualiza lead no CRM.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        etapa: { type: "string" },
        temperatura: { type: "string" },
        responsavel: { type: "string" },
        honorario_proposto: { type: "number" },
        proximo_passo: { type: "string" },
        motivo_perda: { type: "string" },
        observacoes: { type: "string" }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // AUTOMAÇÕES
  // ══════════════════════════════════════════════════════
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
    name: "agente_logs_listar",
    description: "Lista logs de ações dos agentes IA (agente_logs). Campos: agente, acao, resultado, cliente_id, erro_mensagem, executado_em.",
    inputSchema: {
      type: "object",
      properties: {
        agente: { type: "string" },
        cliente_id: { type: "string" },
        limit: { type: "integer", default: 100 }
      }
    }
  },
  {
    name: "agente_log_criar",
    description: "Registra log de ação de um agente.",
    inputSchema: {
      type: "object",
      required: ["agente", "acao"],
      properties: {
        agente: { type: "string" },
        acao: { type: "string" },
        resultado: { type: "string" },
        cliente_id: { type: "string" },
        detalhes: { type: "object" },
        erro_mensagem: { type: "string" }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // EDGE FUNCTIONS
  // ══════════════════════════════════════════════════════
  {
    name: "edge_cnpj_enrich",
    description: "Enriquece dados de um CNPJ via Receita Federal (edge function cnpj-enrich). Retorna razão social, sócios, atividade, endereço.",
    inputSchema: {
      type: "object",
      required: ["cnpj"],
      properties: { cnpj: { type: "string" } }
    }
  },
  {
    name: "edge_parse_certificate",
    description: "Faz parse de um certificado A1 PFX (base64 ou URL) e retorna dados: validade, razão social, CNPJ.",
    inputSchema: {
      type: "object",
      required: ["pfx_base64", "senha"],
      properties: {
        pfx_base64: { type: "string" },
        senha: { type: "string" }
      }
    }
  },
  {
    name: "edge_sync_nfse_nfeio",
    description: "Sincroniza NFS-e de um cliente via NFE.io (edge function sync-nfse-nfeio).",
    inputSchema: {
      type: "object",
      required: ["cliente_id"],
      properties: {
        cliente_id: { type: "string" },
        competencia: { type: "string" }
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // ESCRITÓRIO / CONFIG
  // ══════════════════════════════════════════════════════
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
    name: "mcp_api_keys_listar",
    description: "Lista API keys do MCP cadastradas (sem revelar o hash). Campos: agent_name, scopes, is_active, last_used_at.",
    inputSchema: { type: "object", properties: {} }
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

  // ══════════════════════════════════════════════════════
  // UTILITÁRIOS
  // ══════════════════════════════════════════════════════
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
    name: "eventos_listar",
    description: "Lista eventos do sistema (eventos). Campos: tipo, descricao, agente, payload.",
    inputSchema: {
      type: "object",
      properties: {
        client_id: { type: "string" },
        tipo: { type: "string" },
        limit: { type: "integer", default: 50 }
      }
    }
  },
  {
    name: "sistema_saude",
    description: "Verifica saúde do sistema: conexão Supabase, total de clientes, obrigações vencidas, cobranças em atraso.",
    inputSchema: { type: "object", properties: {} }
  }
];

// ── HANDLERS ─────────────────────────────────────────────────────────────────
const HANDLERS = {

  // CLIENTES
  async clientes_listar(args, env) {
    const db = sb(env);
    const p = { select: "id,razao_social,nome_fantasia,cnpj,regime,status,responsavel,email,telefone,whatsapp,valor_honorario,dia_vencimento,tem_certificado,bloqueado,asaas_customer_id,created_at", order: "razao_social.asc", limit: args.limit || 20, offset: args.offset || 0 };
    if (args.regime) p["regime"] = `eq.${args.regime}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.responsavel_id) p["responsavel_id"] = `eq.${args.responsavel_id}`;
    if (args.bloqueado !== undefined) p["bloqueado"] = `eq.${args.bloqueado}`;
    if (args.search) p["razao_social"] = `ilike.*${args.search}*`;
    return db.get("clientes", p);
  },

  async cliente_buscar(args, env) {
    const db = sb(env);
    const id = args.identificador.replace(/\D/g, "");
    const isCNPJ = id.length === 14;
    const filter = isCNPJ ? { cnpj: `eq.${id}` } : { id: `eq.${args.identificador}` };
    const rows = await db.get("clientes", { select: "*", ...filter });
    return Array.isArray(rows) ? rows[0] || { error: "Cliente não encontrado" } : rows;
  },

  async cliente_criar(args, env) {
    const db = sb(env);
    const cnpj = args.cnpj.replace(/\D/g, "");
    return db.post("clientes", { ...args, cnpj, created_at: new Date().toISOString() });
  },

  async cliente_atualizar(args, env) {
    const db = sb(env);
    const { id, ...data } = args;
    return db.patch("clientes", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  async cliente_socios_listar(args, env) {
    return sb(env).get("cliente_socio", { cliente_id: `eq.${args.cliente_id}`, order: "created_at.asc" });
  },

  async cliente_socio_criar(args, env) {
    return sb(env).post("cliente_socio", { ...args, created_at: new Date().toISOString() });
  },

  async cliente_servicos_listar(args, env) {
    return sb(env).get("cliente_servico", { cliente_id: `eq.${args.cliente_id}`, select: "*", order: "created_at.desc" });
  },

  async cliente_certificado_buscar(args, env) {
    const rows = await sb(env).get("cliente_certificado", { cliente_id: `eq.${args.cliente_id}`, select: "id,tipo,pfx_validade,pfx_nome_razao,pfx_cnpj,pfx_serial,has_procuracao,procuracao_validade,focus_cert_ref,focus_cert_enviado_em" });
    return Array.isArray(rows) ? rows[0] || { error: "Certificado não encontrado" } : rows;
  },

  async cliente_bloqueios_listar(args, env) {
    return sb(env).get("cliente_bloqueio", { cliente_id: `eq.${args.cliente_id}`, order: "created_at.desc" });
  },

  // USUÁRIOS
  async usuarios_listar(args, env) {
    return sb(env).get("profiles", { select: "id,nome,email,avatar_url,cliente_id,created_at", limit: args.limit || 50 });
  },

  async usuario_buscar(args, env) {
    const db = sb(env);
    const isEmail = args.identificador.includes("@");
    const filter = isEmail ? { email: `eq.${args.identificador}` } : { id: `eq.${args.identificador}` };
    const rows = await db.get("profiles", { select: "*", ...filter });
    return Array.isArray(rows) ? rows[0] || { error: "Usuário não encontrado" } : rows;
  },

  async usuario_role_atualizar(args, env) {
    const existing = await sb(env).get("user_roles", { user_id: `eq.${args.user_id}` });
    if (Array.isArray(existing) && existing.length > 0) {
      return sb(env).patch("user_roles", `user_id=eq.${args.user_id}`, { role: args.role });
    }
    return sb(env).post("user_roles", { user_id: args.user_id, role: args.role });
  },

  async convites_listar(args, env) {
    return sb(env).get("convites", { select: "*", order: "criado_em.desc", limit: args.limit || 50 });
  },

  async setores_listar(args, env) {
    return sb(env).get("setores", { select: "*", order: "ordem.asc" });
  },

  async permissoes_listar(args, env) {
    return sb(env).get("permissoes", { select: "*", order: "slug.asc" });
  },

  // TAREFAS
  async tarefas_listar(args, env) {
    const p = { select: "id,titulo,tipo,status,prioridade,sla_status,responsavel,cliente_id,cliente_nome,data_prazo,sla_horas,subtarefas_total,subtarefas_concluidas,criado_por,created_at,updated_at", order: "created_at.desc", limit: args.limit || 50 };
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    if (args.responsavel) p["responsavel"] = `ilike.*${args.responsavel}*`;
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.prioridade) p["prioridade"] = `eq.${args.prioridade}`;
    if (args.sla_status) p["sla_status"] = `eq.${args.sla_status}`;
    return sb(env).get("tarefas", p);
  },

  async tarefa_buscar(args, env) {
    const rows = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "*" });
    return Array.isArray(rows) ? rows[0] || { error: "Tarefa não encontrada" } : rows;
  },

  async tarefa_criar(args, env) {
    const slaMap = { fiscal_urgente: 4, dp: 24, comercial: 48 };
    const sla = slaMap[args.tipo] || 72;
    const agora = new Date();
    const prazo = new Date(agora.getTime() + sla * 3600000).toISOString();
    return sb(env).post("tarefas", {
      titulo: args.titulo,
      tipo: args.tipo,
      descricao: args.descricao || "",
      status: "aberta",
      prioridade: args.prioridade || "normal",
      responsavel: args.responsavel,
      responsavel_tipo: args.responsavel_tipo || "humano",
      criado_por: args.criado_por,
      criado_por_tipo: args.criado_por_tipo || "agente",
      cliente_id: args.cliente_id || null,
      sla_horas: sla,
      sla_status: "no_prazo",
      data_prazo: args.data_prazo || prazo,
      metadados: args.metadados || {},
      historico: [{ ts: agora.toISOString(), autor: args.criado_por, acao: "criada", descricao: `Tarefa criada por ${args.criado_por}` }],
      created_at: agora.toISOString()
    });
  },

  async tarefa_atualizar(args, env) {
    const { id, _por, ...data } = args;
    const tarefa = await sb(env).get("tarefas", { id: `eq.${id}`, select: "historico" });
    const hist = Array.isArray(tarefa) && tarefa[0]?.historico ? tarefa[0].historico : [];
    hist.push({ ts: new Date().toISOString(), autor: _por || "agente", acao: "atualizada", descricao: JSON.stringify(data) });
    return sb(env).patch("tarefas", `id=eq.${id}`, { ...data, historico: hist, updated_at: new Date().toISOString() });
  },

  async tarefa_comentar(args, env) {
    const tarefa = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "comentarios" });
    const comentarios = Array.isArray(tarefa) && tarefa[0]?.comentarios ? tarefa[0].comentarios : [];
    comentarios.push({ ts: new Date().toISOString(), autor: args.autor, autor_tipo: args.autor_tipo || "agente", texto: args.texto });
    return sb(env).patch("tarefas", `id=eq.${args.id}`, { comentarios, updated_at: new Date().toISOString() });
  },

  async tarefa_concluir(args, env) {
    const rows = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "metadados,status" });
    if (!Array.isArray(rows) || rows.length === 0) return { error: "Tarefa não encontrada" };
    const t = rows[0];
    const subs = t.metadados?.subtarefas || [];
    const abertas = subs.filter(s => s.status !== "concluida");
    if (abertas.length > 0) return { error: `Existem ${abertas.length} subtarefas ainda abertas`, subtarefas_abertas: abertas };
    return sb(env).patch("tarefas", `id=eq.${args.id}`, { status: "concluida", sla_status: "concluido", concluida_em: new Date().toISOString(), updated_at: new Date().toISOString() });
  },

  async tarefas_agente_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.agente) p["agente"] = `eq.${args.agente}`;
    if (args.client_id) p["client_id"] = `eq.${args.client_id}`;
    return sb(env).get("tarefas_agente", p);
  },

  // OBRIGAÇÕES
  async obrigacoes_listar(args, env) {
    const p = { select: "id,cliente_id,cliente_nome,tipo,descricao,competencia,vencimento,status,valor,responsavel,concluida_em,updated_at", order: "vencimento.asc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    if (args.vencimento_ate) p["vencimento"] = `lte.${args.vencimento_ate}`;
    return sb(env).get("obrigacoes", p);
  },

  async obrigacao_criar(args, env) {
    return sb(env).post("obrigacoes", { ...args, status: "pendente", created_at: new Date().toISOString() });
  },

  async obrigacao_atualizar(args, env) {
    const { id, ...data } = args;
    if (data.status === "concluida" && !data.concluida_em) data.concluida_em = new Date().toISOString();
    return sb(env).patch("obrigacoes", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  async calendario_fiscal_listar(args, env) {
    const p = { select: "*", order: "dia_vencimento.asc" };
    if (args.regime) p["regime"] = `eq.${args.regime}`;
    if (args.ativo !== undefined) p["ativo"] = `eq.${args.ativo}`;
    return sb(env).get("calendario_fiscal", p);
  },

  // COBRANÇAS
  async cobrancas_listar(args, env) {
    const p = { select: "id,cliente_id,cliente_nome,cnpj,valor,vencimento,competencia,status,dias_atraso,regua_stage,regua_stage_nome,pix_copia_cola,boleto_url,nfse_status,asaas_payment_id,created_at", order: "vencimento.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.regua_stage) p["regua_stage"] = `eq.${args.regua_stage}`;
    return sb(env).get("cobrancas", p);
  },

  async cobranca_criar(args, env) {
    return sb(env).post("cobrancas", { ...args, status: "pendente", created_at: new Date().toISOString() });
  },

  async cobranca_atualizar(args, env) {
    const { id, ...data } = args;
    return sb(env).patch("cobrancas", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  async regua_cobranca_config_buscar(args, env) {
    const rows = await sb(env).get("regua_cobranca_config", { select: "*", limit: 1 });
    return Array.isArray(rows) ? rows[0] || {} : rows;
  },

  async servico_pagamentos_listar(args, env) {
    const p = { select: "*", order: "data_vencimento.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("servico_pagamento", p);
  },

  // APURAÇÕES / CONTABILIDADE
  async apuracao_buscar(args, env) {
    const p = { empresa_id: `eq.${args.cliente_id}`, mes_referencia: `eq.${args.competencia}`, select: "*" };
    const rows = await sb(env).get("apuracoes_mensais", p);
    if (Array.isArray(rows) && rows.length > 0) return rows[0];
    // fallback tabela apuracoes
    const p2 = { client_id: `eq.${args.cliente_id}`, competencia: `eq.${args.competencia}`, select: "*" };
    const rows2 = await sb(env).get("apuracoes", p2);
    return Array.isArray(rows2) ? rows2[0] || { error: "Apuração não encontrada" } : rows2;
  },

  async apuracao_registrar(args, env) {
    const db = sb(env);
    const existing = await db.get("apuracoes_mensais", { empresa_id: `eq.${args.cliente_id}`, mes_referencia: `eq.${args.competencia}` });
    const body = {
      empresa_id: args.cliente_id,
      mes_referencia: args.competencia,
      receita_bruta: args.receita_bruta,
      receita_bruta_servico: args.receita_bruta_servico,
      receita_bruta_comercio: args.receita_bruta_comercio,
      das_valor: args.das_valor,
      das_codigo_barras: args.das_codigo_barras,
      das_vencimento: args.das_vencimento,
      aliquota_efetiva: args.aliquota_efetiva,
      status: args.status || "em_aberto",
      atualizado_por_agente: true,
      updated_at: new Date().toISOString()
    };
    if (Array.isArray(existing) && existing.length > 0) {
      return db.patch("apuracoes_mensais", `id=eq.${existing[0].id}`, body);
    }
    return db.post("apuracoes_mensais", { ...body, created_at: new Date().toISOString() });
  },

  async lancamentos_listar(args, env) {
    const p = { select: "*", order: "data_lancamento.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["empresa_id"] = `eq.${args.cliente_id}`;
    if (args.mes_referencia) p["mes_referencia"] = `eq.${args.mes_referencia}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("lancamentos_contabeis", p);
  },

  async lancamento_criar(args, env) {
    return sb(env).post("lancamentos_contabeis", {
      empresa_id: args.cliente_id,
      conta_debito: args.conta_debito,
      conta_credito: args.conta_credito,
      valor: args.valor,
      historico: args.historico,
      data_lancamento: args.data_lancamento,
      data_competencia: args.data_competencia || args.data_lancamento,
      mes_referencia: args.data_lancamento?.slice(0, 7),
      tipo: args.tipo || "normal",
      centro_custo: args.centro_custo,
      status: "ativo",
      criado_por_agente: args.criado_por_agente !== false,
      created_at: new Date().toISOString()
    });
  },

  async plano_contas_listar(args, env) {
    const p = { empresa_id: `eq.${args.cliente_id}`, select: "id,codigo,descricao,tipo,natureza,nivel,codigo_pai,aceita_lancamento,ativo", order: "codigo.asc" };
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    if (args.aceita_lancamento !== undefined) p["aceita_lancamento"] = `eq.${args.aceita_lancamento}`;
    return sb(env).get("plano_contas", p);
  },

  async periodos_contabeis_listar(args, env) {
    const p = { empresa_id: `eq.${args.cliente_id}`, select: "*", order: "mes_referencia.desc", limit: args.limit || 24 };
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("periodos_contabeis", p);
  },

  async documentos_fiscais_listar(args, env) {
    const p = { select: "id,tipo,numero,serie,data_emissao,emitente_cnpj,emitente_razao,destinatario_cnpj,destinatario_razao,valor_total,status,conta_contabil_confirmada,mes_referencia,created_at", order: "data_emissao.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["empresa_id"] = `eq.${args.cliente_id}`;
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    if (args.mes_referencia) p["mes_referencia"] = `eq.${args.mes_referencia}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("documentos_fiscais", p);
  },

  async extrato_bancario_listar(args, env) {
    const p = { empresa_id: `eq.${args.cliente_id}`, select: "*", order: "data_linha.desc", limit: args.limit || 100 };
    if (args.mes_referencia) p["mes_referencia"] = `eq.${args.mes_referencia}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("extrato_bancario", p);
  },

  // NFS-e
  async nfse_emitir_focus(args, env) {
    const db = sb(env);
    // Buscar dados do cliente
    const clRows = await db.get("clientes", { id: `eq.${args.cliente_id}`, select: "cnpj,inscricao_municipal,codigo_municipio_ibge,razao_social,focus_ambiente" });
    if (!Array.isArray(clRows) || clRows.length === 0) return { error: "Cliente não encontrado" };
    const cl = clRows[0];
    const focusToken = env.FOCUS_NFE_API_TOKEN_2;
    const focusUrl = "https://api.focusnfe.com.br/v2";
    const ref = `apoya-${args.cliente_id.slice(0, 8)}-${Date.now()}`;
    const payload = {
      data_emissao: new Date().toISOString(),
      natureza_operacao: "1",
      optante_simples_nacional: true,
      regime_especial_tributacao: "6",
      prestador: { cnpj: cl.cnpj.replace(/\D/g, ""), inscricao_municipal: cl.inscricao_municipal, codigo_municipio: cl.codigo_municipio_ibge || "3508504" },
      tomador: {
        cnpj: args.tomador_cnpj?.replace(/\D/g, "") || "",
        cpf: args.tomador_cpf?.replace(/\D/g, "") || "",
        razao_social: args.tomador_razao || "NÃO INFORMADO",
        email: args.tomador_email || "",
        endereco: { logradouro: "NÃO INFORMADO", numero: "S/N", bairro: "Centro", codigo_municipio: args.tomador_municipio_ibge || "3508504", uf: "SP", cep: "12280000" }
      },
      servico: { valor_servicos: args.valor_servico, item_lista_servico: args.codigo_servico, codigo_tributacao_municipio: args.codigo_servico, discriminacao: args.descricao_servico, codigo_municipio: cl.codigo_municipio_ibge || "3508504" }
    };
    const resp = await fetch(`${focusUrl}/nfse?ref=${ref}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(focusToken + ":")}` },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    // Gravar log
    await db.post("focus_nfse_log", { cliente_id: args.cliente_id, operacao: "emissao", focus_ref: ref, status: resp.ok ? "sucesso" : "erro", payload, resposta: data, created_at: new Date().toISOString() });
    return { ref, http_status: resp.status, ...data };
  },

  async nfse_listar(args, env) {
    const p = { select: "id,focus_ref,numero,status,competencia,data_emissao,tomador_nome,tomador_cnpj_cpf,valor_servico,pdf_url,cobranca_id,created_at", order: "created_at.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.competencia) p["competencia"] = `eq.${args.competencia}`;
    return sb(env).get("nfse_emitida", p);
  },

  async nfse_consultar_focus(args, env) {
    const focusToken = env.FOCUS_NFE_API_TOKEN_2;
    const resp = await fetch(`https://api.focusnfe.com.br/v2/nfse/${args.focus_ref}`, {
      headers: { Authorization: `Basic ${btoa(focusToken + ":")}` }
    });
    return resp.json();
  },

  async nfse_log_listar(args, env) {
    const p = { select: "id,cliente_id,operacao,focus_ref,status,erro_msg,duracao_ms,created_at", order: "created_at.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("focus_nfse_log", p);
  },

  async nfse_recebidas_listar(args, env) {
    const p = { cliente_id: `eq.${args.cliente_id}`, select: "*", order: "data_emissao.desc", limit: args.limit || 50 };
    if (args.competencia) p["competencia"] = `eq.${args.competencia}`;
    return sb(env).get("nfse_recebida", p);
  },

  // DAS / SERPRO
  async das_listar(args, env) {
    const p = { select: "id,cliente_id,cliente_nome,cnpj,regime,competencia,vencimento,valor,status,codigo_barras,enviado_wa_em,created_at", order: "vencimento.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("das_guias", p);
  },

  async das_gerar(args, env) {
    const db = sb(env);
    const clRows = await db.get("clientes", { id: `eq.${args.cliente_id}`, select: "cnpj,razao_social,regime" });
    if (!Array.isArray(clRows) || clRows.length === 0) return { error: "Cliente não encontrado" };
    const cl = clRows[0];
    const cnpj = cl.cnpj.replace(/\D/g, "");
    const periodo = args.competencia.replace("-", "");
    const serproToken = env.ETRANSPARENCIA_TOKEN;
    const resp = await fetch(`https://gateway.apiserpro.serpro.gov.br/simples-nacional/v1/pgmei/das/${cnpj}/${periodo}`, {
      headers: { Authorization: `Bearer ${serproToken}`, "Content-Type": "application/json" }
    });
    const data = await resp.json();
    await db.post("serpro_log", { cliente_id: args.cliente_id, tool: "das_gerar", parametros: { cnpj, periodo }, resultado_resumo: JSON.stringify(data).slice(0, 500), status: resp.ok ? "sucesso" : "erro", created_at: new Date().toISOString() });
    return data;
  },

  async serpro_log_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("serpro_log", p);
  },

  // WHATSAPP
  async whatsapp_enviar(args, env) {
    const instRows = await sb(env).get("wa_instance", { select: "nome,numero,status,evolution_apikey", limit: 1 });
    const inst = Array.isArray(instRows) ? instRows[0] : null;
    if (!inst) return { error: "Nenhuma instância WA configurada" };
    const instName = args.instancia || inst.nome;
    const apiKey = inst.evolution_apikey || env.EVOLUTION_API_KEY;
    const apiUrl = env.EVOLUTION_API_URL;
    const resp = await fetch(`${apiUrl}/message/sendText/${instName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: args.destinatario, text: args.mensagem })
    });
    return resp.json();
  },

  async whatsapp_conversas_listar(args, env) {
    const p = { select: "id,instance_id,cliente_id,telefone,nome_contato,ultima_mensagem,ultima_em,nao_lidas,assigned_to,departamento,archived", order: "ultima_em.desc", limit: args.limit || 20 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.departamento) p["departamento"] = `eq.${args.departamento}`;
    if (args.assigned_to) p["assigned_to"] = `eq.${args.assigned_to}`;
    return sb(env).get("wa_conversa", p);
  },

  async whatsapp_mensagens_listar(args, env) {
    return sb(env).get("mensagem_whatsapp", { conversa_id: `eq.${args.conversa_id}`, select: "*", order: "created_at.asc", limit: args.limit || 50 });
  },

  async whatsapp_instancias(args, env) {
    return sb(env).get("wa_instance", { select: "id,nome,display_name,numero,status,departamentos,last_connected_at", order: "created_at.asc" });
  },

  async whatsapp_sessoes_listar(args, env) {
    return sb(env).get("whatsapp_sessions", { select: "id,phone_number,client_id,last_agent,modo_humano,humano_desde,updated_at", order: "updated_at.desc", limit: args.limit || 50 });
  },

  // DOCUMENTOS
  async documentos_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["client_id"] = `eq.${args.cliente_id}`;
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("documentos", p);
  },

  async documento_pastas_listar(args, env) {
    return sb(env).get("documento_pasta", { cliente_id: `eq.${args.cliente_id}`, select: "*", order: "ordem.asc" });
  },

  async documento_arquivos_listar(args, env) {
    return sb(env).get("documento_arquivo", { pasta_id: `eq.${args.pasta_id}`, select: "*", order: "created_at.desc", limit: args.limit || 50 });
  },

  // CONTRATOS
  async contratos_listar(args, env) {
    const p = { select: "id,cliente_id,numero,titulo,tipo,status,valor_total,data_inicio,clicksign_status,clicksign_sign_url_cliente,assinado_em,created_at", order: "created_at.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("contrato_cliente", p);
  },

  async contrato_buscar(args, env) {
    const rows = await sb(env).get("contrato_cliente", { id: `eq.${args.id}`, select: "*" });
    return Array.isArray(rows) ? rows[0] || { error: "Contrato não encontrado" } : rows;
  },

  // DP
  async funcionarios_listar(args, env) {
    const p = { empresa_id: `eq.${args.empresa_id}`, select: "id,nome,cpf,cargo,departamento,salario_base,data_admissao,data_demissao,tipo_contrato,status", order: "nome.asc", limit: args.limit || 50 };
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("funcionarios", p);
  },

  async folhas_listar(args, env) {
    const p = { empresa_id: `eq.${args.empresa_id}`, select: "*", order: "competencia.desc", limit: args.limit || 12 };
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("folha_mensal", p);
  },

  async ferias_listar(args, env) {
    const p = { select: "*", order: "gozo_inicio.desc", limit: args.limit || 50 };
    if (args.empresa_id) p["empresa_id"] = `eq.${args.empresa_id}`;
    if (args.funcionario_id) p["funcionario_id"] = `eq.${args.funcionario_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("ferias", p);
  },

  async rescisoes_listar(args, env) {
    const p = { select: "*", order: "data_demissao.desc", limit: args.limit || 20 };
    if (args.empresa_id) p["empresa_id"] = `eq.${args.empresa_id}`;
    return sb(env).get("rescisoes", p);
  },

  // PROCESSOS SOCIETÁRIOS
  async processos_societarios_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.fase) p["fase"] = `eq.${args.fase}`;
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("processos_societarios", p);
  },

  async processo_societario_criar(args, env) {
    return sb(env).post("processos_societarios", { ...args, status: "ativo", created_at: new Date().toISOString() });
  },

  // CRM
  async leads_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.etapa) p["etapa"] = `eq.${args.etapa}`;
    if (args.temperatura) p["temperatura"] = `eq.${args.temperatura}`;
    if (args.responsavel) p["responsavel"] = `eq.${args.responsavel}`;
    return sb(env).get("leads_crm", p);
  },

  async lead_criar(args, env) {
    return sb(env).post("leads_crm", { ...args, created_at: new Date().toISOString() });
  },

  async lead_atualizar(args, env) {
    const { id, ...data } = args;
    return sb(env).patch("leads_crm", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  // AUTOMAÇÕES / LOGS
  async automacoes_listar(args, env) {
    const p = { select: "id,nome,descricao,tipo_gatilho,status,ultima_execucao,proxima_execucao,total_execucoes,created_at", order: "nome.asc", limit: args.limit || 50 };
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("automacoes_config", p);
  },

  async agente_logs_listar(args, env) {
    const p = { select: "*", order: "executado_em.desc", limit: args.limit || 100 };
    if (args.agente) p["agente"] = `eq.${args.agente}`;
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    return sb(env).get("agente_logs", p);
  },

  async agente_log_criar(args, env) {
    return sb(env).post("agente_logs", {
      agente: args.agente,
      acao: args.acao,
      resultado: args.resultado,
      cliente_id: args.cliente_id || null,
      detalhes: args.detalhes || {},
      erro_mensagem: args.erro_mensagem || null,
      executado_em: new Date().toISOString()
    }, "return=minimal");
  },

  // EDGE FUNCTIONS
  async edge_cnpj_enrich(args, env) {
    return sb(env).edgeFn("cnpj-enrich", { cnpj: args.cnpj.replace(/\D/g, "") }, env);
  },

  async edge_parse_certificate(args, env) {
    return sb(env).edgeFn("parse-certificate", { pfx_base64: args.pfx_base64, senha: args.senha }, env);
  },

  async edge_sync_nfse_nfeio(args, env) {
    return sb(env).edgeFn("sync-nfse-nfeio", { cliente_id: args.cliente_id, competencia: args.competencia }, env);
  },

  // ESCRITÓRIO
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

  async mcp_api_keys_listar(args, env) {
    return sb(env).get("mcp_api_keys", { select: "id,agent_name,description,scopes,is_active,last_used_at,created_at,expires_at", order: "created_at.desc" });
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

  // UTILITÁRIOS
  async audit_log_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 100 };
    if (args.entidade) p["entidade"] = `eq.${args.entidade}`;
    if (args.user_id) p["user_id"] = `eq.${args.user_id}`;
    return sb(env).get("audit_log", p);
  },

  async eventos_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.client_id) p["client_id"] = `eq.${args.client_id}`;
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    return sb(env).get("eventos", p);
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

// ── FETCH HANDLER ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        status: "ok",
        service: SERVER_INFO.name,
        version: SERVER_INFO.version,
        tools: TOOLS.length,
        tables: 32,
        edge_functions: 8,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === "/sse" && request.method === "GET") {
      const identity = await validateApiKey(request.headers.get("Authorization"), env);
      if (!identity) return new Response("Unauthorized", { status: 401, headers: CORS });
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(`event: endpoint\ndata: ${url.origin}/message\n\n`));
        }
      });
      return new Response(stream, {
        headers: { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }
      });
    }

    if ((url.pathname === "/message" || url.pathname === "/mcp") && request.method === "POST") {
      const identity = await validateApiKey(request.headers.get("Authorization"), env);
      if (!identity) return mcpError(null, -32001, "Unauthorized — Informe Bearer token válido em Authorization");

      let body;
      try { body = await request.json(); } catch { return mcpError(null, -32700, "Parse error"); }

      const { jsonrpc, id, method, params } = body;
      if (jsonrpc !== "2.0") return mcpError(id, -32600, "Invalid Request");

      switch (method) {
        case "initialize":
          return json({
            jsonrpc: "2.0", id, result: {
              protocolVersion: MCP_PROTOCOL_VERSION,
              capabilities: { tools: {}, logging: {} },
              serverInfo: SERVER_INFO,
              meta: { agent: identity.agentName, scopes: identity.scopes, tools_count: TOOLS.length, schema_version: "2026-06-10" }
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
          if (!handler) return mcpError(id, -32601, `Tool '${toolName}' não encontrada. Tools disponíveis: ${TOOLS.map(t => t.name).join(", ")}`);
          try {
            const result = await handler(toolArgs, env);
            return mcpResult(id, result);
          } catch (err) {
            return json({
              jsonrpc: "2.0", id,
              result: { content: [{ type: "text", text: JSON.stringify({ error: err.message, tool: toolName, stack: err.stack?.slice(0, 200) }) }], isError: true }
            });
          }
        }

        default:
          return mcpError(id, -32601, `Método '${method}' não suportado`);
      }
    }

    return json({ error: "Not found", endpoints: ["/health", "/mcp (POST)", "/sse (GET)"] }, 404);
  }
};

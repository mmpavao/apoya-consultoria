// tools/contabil.js — Lançamentos, plano de contas, apurações, extrato
// Auto-gerado em refactor(mcp) 2026-06-11 — NÃO EDITAR MANUALMENTE

export const TOOLS_CONTABIL = [
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
];

export const HANDLERS_CONTABIL = {
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

  async lancamentos_listar(args, env) {
    const p = { select: "*", order: "data_lancamento.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["empresa_id"] = `eq.${args.cliente_id}`;
    if (args.mes_referencia) p["mes_referencia"] = `eq.${args.mes_referencia}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("lancamentos_contabeis", p);
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

  async apuracao_buscar(args, env) {
    const p = { empresa_id: `eq.${args.cliente_id}`, mes_referencia: `eq.${args.competencia}`, select: "*" };
    const rows = await sb(env).get("apuracoes_mensais", p);
    if (Array.isArray(rows) && rows.length > 0) return rows[0];
    // fallback tabela apuracoes
    const p2 = { client_id: `eq.${args.cliente_id}`, competencia: `eq.${args.competencia}`, select: "*" };
    const rows2 = await sb(env).get("apuracoes", p2);
    return Array.isArray(rows2) ? rows2[0] || { error: "Apuração não encontrada" } : rows2;
  },

  async extrato_bancario_listar(args, env) {
    const p = { empresa_id: `eq.${args.cliente_id}`, select: "*", order: "data_linha.desc", limit: args.limit || 100 };
    if (args.mes_referencia) p["mes_referencia"] = `eq.${args.mes_referencia}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("extrato_bancario", p);
  },

  // NFS-e,

};

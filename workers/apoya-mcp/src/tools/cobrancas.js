// tools/cobrancas.js — Cobranças, pagamentos, régua de cobrança
// Auto-gerado em refactor(mcp) 2026-06-11 — NÃO EDITAR MANUALMENTE

export const TOOLS_COBRANCAS = [
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
];

export const HANDLERS_COBRANCAS = {
  async cobranca_criar(args, env) {
    return sb(env).post("cobrancas", { ...args, status: "pendente", created_at: new Date().toISOString() });
  },

  async cobranca_atualizar(args, env) {
    const { id, ...data } = args;
    return sb(env).patch("cobrancas", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  async cobrancas_listar(args, env) {
    const p = { select: "id,cliente_id,cliente_nome,cnpj,valor,vencimento,competencia,status,dias_atraso,regua_stage,regua_stage_nome,pix_copia_cola,boleto_url,nfse_status,asaas_payment_id,created_at", order: "vencimento.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.regua_stage) p["regua_stage"] = `eq.${args.regua_stage}`;
    return sb(env).get("cobrancas", p);
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

  // APURAÇÕES / CONTABILIDADE,

};

// tools/fiscal.js — NFS-e, DAS, PGDAS, SERPRO, obrigações fiscais
// Auto-gerado em refactor(mcp) 2026-06-11 — NÃO EDITAR MANUALMENTE

export const TOOLS_FISCAL = [
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
      name: "nfse_consultar_focus",
      description: "Consulta status de uma NFS-e na API Focus pelo ref.",
      inputSchema: {
        type: "object",
        required: ["focus_ref"],
        properties: { focus_ref: { type: "string" } }
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
];

export const HANDLERS_FISCAL = {
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

  async nfse_consultar_focus(args, env) {
    const focusToken = env.FOCUS_NFE_API_TOKEN_2;
    const resp = await fetch(`https://api.focusnfe.com.br/v2/nfse/${args.focus_ref}`, {
      headers: { Authorization: `Basic ${btoa(focusToken + ":")}` }
    });
    return resp.json();
  },

  async nfse_listar(args, env) {
    const p = { select: "id,focus_ref,numero,status,competencia,data_emissao,tomador_nome,tomador_cnpj_cpf,valor_servico,pdf_url,cobranca_id,created_at", order: "created_at.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.competencia) p["competencia"] = `eq.${args.competencia}`;
    return sb(env).get("nfse_emitida", p);
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

  // DAS / SERPRO,

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

  async das_listar(args, env) {
    const p = { select: "id,cliente_id,cliente_nome,cnpj,regime,competencia,vencimento,valor,status,codigo_barras,enviado_wa_em,created_at", order: "vencimento.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("das_guias", p);
  },

  async documentos_fiscais_listar(args, env) {
    const p = { select: "id,tipo,numero,serie,data_emissao,emitente_cnpj,emitente_razao,destinatario_cnpj,destinatario_razao,valor_total,status,conta_contabil_confirmada,mes_referencia,created_at", order: "data_emissao.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["empresa_id"] = `eq.${args.cliente_id}`;
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    if (args.mes_referencia) p["mes_referencia"] = `eq.${args.mes_referencia}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("documentos_fiscais", p);
  },

  async calendario_fiscal_listar(args, env) {
    const p = { select: "*", order: "dia_vencimento.asc" };
    if (args.regime) p["regime"] = `eq.${args.regime}`;
    if (args.ativo !== undefined) p["ativo"] = `eq.${args.ativo}`;
    return sb(env).get("calendario_fiscal", p);
  },

  // COBRANÇAS,

  async obrigacao_criar(args, env) {
    return sb(env).post("obrigacoes", { ...args, status: "pendente", created_at: new Date().toISOString() });
  },

  async obrigacao_atualizar(args, env) {
    const { id, ...data } = args;
    if (data.status === "concluida" && !data.concluida_em) data.concluida_em = new Date().toISOString();
    return sb(env).patch("obrigacoes", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  async obrigacoes_listar(args, env) {
    const p = { select: "id,cliente_id,cliente_nome,tipo,descricao,competencia,vencimento,status,valor,responsavel,concluida_em,updated_at", order: "vencimento.asc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
    if (args.vencimento_ate) p["vencimento"] = `lte.${args.vencimento_ate}`;
    return sb(env).get("obrigacoes", p);
  },

  async serpro_log_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    if (args.status) p["status"] = `eq.${args.status}`;
    return sb(env).get("serpro_log", p);
  },

  // WHATSAPP,

  async edge_cnpj_enrich(args, env) {
    return sb(env).edgeFn("cnpj-enrich", { cnpj: args.cnpj.replace(/\D/g, "") }, env);
  },

  async edge_parse_certificate(args, env) {
    return sb(env).edgeFn("parse-certificate", { pfx_base64: args.pfx_base64, senha: args.senha }, env);
  },

  async edge_sync_nfse_nfeio(args, env) {
    return sb(env).edgeFn("sync-nfse-nfeio", { cliente_id: args.cliente_id, competencia: args.competencia }, env);
  },

  // ESCRITÓRIO,

};

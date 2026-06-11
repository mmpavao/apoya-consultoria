// tools/clientes.js — Clientes, contratos, sócios, setores
// refactor(mcp) 2026-06-11

import { sb } from "../db.js";

export const TOOLS_CLIENTES = [
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
      name: "cliente_bloqueios_listar",
      description: "Lista histórico de bloqueios de um cliente.",
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
      name: "contrato_buscar",
      description: "Detalhes completos de um contrato incluindo link de assinatura.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } }
      }
    },
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
      name: "setores_listar",
      description: "Lista setores do escritório (fiscal, dp, contabil, comercial, etc).",
      inputSchema: { type: "object", properties: {} }
    },
];

export const HANDLERS_CLIENTES = {

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

  async cliente_socios_listar(args, env) {
      return sb(env).get("cliente_socio", { cliente_id: `eq.${args.cliente_id}`, order: "created_at.asc" });
    },

  async cliente_socio_criar(args, env) {
      return sb(env).post("cliente_socio", { ...args, created_at: new Date().toISOString() });
    },

  async cliente_servicos_listar(args, env) {
      return sb(env).get("cliente_servico", { cliente_id: `eq.${args.cliente_id}`, select: "*", order: "created_at.desc" });
    },

  async cliente_bloqueios_listar(args, env) {
      return sb(env).get("cliente_bloqueio", { cliente_id: `eq.${args.cliente_id}`, order: "created_at.desc" });
    },

  async cliente_certificado_buscar(args, env) {
      const rows = await sb(env).get("cliente_certificado", { cliente_id: `eq.${args.cliente_id}`, select: "id,tipo,pfx_validade,pfx_nome_razao,pfx_cnpj,pfx_serial,has_procuracao,procuracao_validade,focus_cert_ref,focus_cert_enviado_em" });
      return Array.isArray(rows) ? rows[0] || { error: "Certificado não encontrado" } : rows;
    },

  async contrato_buscar(args, env) {
      const rows = await sb(env).get("contrato_cliente", { id: `eq.${args.id}`, select: "*" });
      return Array.isArray(rows) ? rows[0] || { error: "Contrato não encontrado" } : rows;
    },

  async contratos_listar(args, env) {
      const p = { select: "id,cliente_id,numero,titulo,tipo,status,valor_total,data_inicio,clicksign_status,clicksign_sign_url_cliente,assinado_em,created_at", order: "created_at.desc", limit: args.limit || 50 };
      if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
      if (args.status) p["status"] = `eq.${args.status}`;
      return sb(env).get("contrato_cliente", p);
    },

  async setores_listar(args, env) {
      return sb(env).get("setores", { select: "*", order: "ordem.asc" });
    },

};

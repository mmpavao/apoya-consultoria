// tools/dp.js — Funcionários, folhas, férias, rescisões, eventos
// refactor(mcp) 2026-06-11

import { sb } from "../db.js";

export const TOOLS_DP = [
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
];

export const HANDLERS_DP = {

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

  async eventos_listar(args, env) {
      const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
      if (args.client_id) p["client_id"] = `eq.${args.client_id}`;
      if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
      return sb(env).get("eventos", p);
    },

};

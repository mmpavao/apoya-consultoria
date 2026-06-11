// tools/comercial.js — Leads, processos societários
// refactor(mcp) 2026-06-11

import { sb } from "../db.js";

export const TOOLS_COMERCIAL = [
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
];

export const HANDLERS_COMERCIAL = {

  async lead_criar(args, env) {
      return sb(env).post("leads_crm", { ...args, created_at: new Date().toISOString() });
    },

  async lead_atualizar(args, env) {
      const { id, ...data } = args;
      return sb(env).patch("leads_crm", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
    },

  async leads_listar(args, env) {
      const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
      if (args.etapa) p["etapa"] = `eq.${args.etapa}`;
      if (args.temperatura) p["temperatura"] = `eq.${args.temperatura}`;
      if (args.responsavel) p["responsavel"] = `eq.${args.responsavel}`;
      return sb(env).get("leads_crm", p);
    },

  async processo_societario_criar(args, env) {
      return sb(env).post("processos_societarios", { ...args, status: "ativo", created_at: new Date().toISOString() });
    },

  async processos_societarios_listar(args, env) {
      const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
      if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
      if (args.fase) p["fase"] = `eq.${args.fase}`;
      if (args.tipo) p["tipo"] = `eq.${args.tipo}`;
      if (args.status) p["status"] = `eq.${args.status}`;
      return sb(env).get("processos_societarios", p);
    },

};

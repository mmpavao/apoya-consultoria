// tools/whatsapp.js — WhatsApp: envio, instâncias, conversas, mensagens
// refactor(mcp) 2026-06-11

import { sb } from "../db.js";

export const TOOLS_WHATSAPP = [
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
      name: "whatsapp_instancias",
      description: "Lista instâncias Evolution API configuradas. Campos: nome, numero, status, departamentos.",
      inputSchema: { type: "object", properties: {} }
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
      name: "whatsapp_sessoes_listar",
      description: "Lista sessões de atendimento WhatsApp (whatsapp_sessions). Campos: phone_number, client_id, last_agent, modo_humano.",
      inputSchema: { type: "object", properties: { limit: { type: "integer", default: 50 } } }
    },
];

export const HANDLERS_WHATSAPP = {

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

  async whatsapp_instancias(args, env) {
      return sb(env).get("wa_instance", { select: "id,nome,display_name,numero,status,departamentos,last_connected_at", order: "created_at.asc" });
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

  async whatsapp_sessoes_listar(args, env) {
      return sb(env).get("whatsapp_sessions", { select: "id,phone_number,client_id,last_agent,modo_humano,humano_desde,updated_at", order: "updated_at.desc", limit: args.limit || 50 });
    },

};

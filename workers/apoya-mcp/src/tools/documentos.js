// tools/documentos.js — Documentos, pastas, arquivos
// refactor(mcp) 2026-06-11

import { sb } from "../db.js";

export const TOOLS_DOCUMENTOS = [
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
];

export const HANDLERS_DOCUMENTOS = {

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

};

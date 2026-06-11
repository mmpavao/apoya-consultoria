// tools/tarefas.js — Tarefas, agente logs
// Auto-gerado em refactor(mcp) 2026-06-11 — NÃO EDITAR MANUALMENTE

export const TOOLS_TAREFAS = [
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
      name: "tarefa_buscar",
      description: "Detalhes completos de uma tarefa incluindo histórico e comentários.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } }
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
];

export const HANDLERS_TAREFAS = {
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

  async tarefa_buscar(args, env) {
    const rows = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "*" });
    return Array.isArray(rows) ? rows[0] || { error: "Tarefa não encontrada" } : rows;
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

  async tarefas_agente_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.status) p["status"] = `eq.${args.status}`;
    if (args.agente) p["agente"] = `eq.${args.agente}`;
    if (args.client_id) p["client_id"] = `eq.${args.client_id}`;
    return sb(env).get("tarefas_agente", p);
  },

  // OBRIGAÇÕES,

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

  // EDGE FUNCTIONS,

  async agente_logs_listar(args, env) {
    const p = { select: "*", order: "executado_em.desc", limit: args.limit || 100 };
    if (args.agente) p["agente"] = `eq.${args.agente}`;
    if (args.cliente_id) p["cliente_id"] = `eq.${args.cliente_id}`;
    return sb(env).get("agente_logs", p);
  },

};

// tools/tarefas.js — Tarefas, pipeline de setores, agente logs
// feat(pipeline) 2026-06-11 — F1: pipeline_config_listar, tarefas_por_pipeline, tarefa_mover_etapa
// fix(tarefas) 2026-06-11 — tarefa_criar/atualizar aceitam setor + etapa_pipeline

import { sb } from "../db.js";

export const TOOLS_TAREFAS = [
  // ── Tarefas CRUD ────────────────────────────────────────────────────────────
  {
    name: "tarefa_criar",
    description: "Cria tarefa com SLA automático por tipo. Aceita setor para colocar no pipeline correto — etapa_pipeline padrão = primeira etapa do setor.",
    inputSchema: {
      type: "object",
      required: ["titulo", "tipo", "responsavel", "criado_por"],
      properties: {
        titulo:          { type: "string" },
        tipo:            { type: "string", description: "fiscal_urgente | dp | comercial | outros" },
        responsavel:     { type: "string" },
        responsavel_tipo:{ type: "string", default: "humano" },
        criado_por:      { type: "string" },
        criado_por_tipo: { type: "string", default: "agente" },
        descricao:       { type: "string" },
        cliente_id:      { type: "string" },
        cliente_nome:    { type: "string" },
        prioridade:      { type: "string", default: "normal" },
        data_prazo:      { type: "string" },
        setor:           { type: "string", description: "fiscal | dp | contabil | financeiro (opcional — coloca no pipeline)" },
        etapa_pipeline:  { type: "string", description: "Etapa inicial no pipeline (omitir = primeira etapa do setor)" },
        metadados:       { type: "object" }
      }
    }
  },
  {
    name: "tarefa_buscar",
    description: "Detalhes completos de uma tarefa incluindo histórico e comentários.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } }
  },
  {
    name: "tarefa_atualizar",
    description: "Atualiza campos da tarefa. Aceita setor e etapa_pipeline.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id:              { type: "string" },
        titulo:          { type: "string" },
        descricao:       { type: "string" },
        status:          { type: "string" },
        prioridade:      { type: "string" },
        responsavel:     { type: "string" },
        responsavel_tipo:{ type: "string" },
        data_prazo:      { type: "string" },
        setor:           { type: "string" },
        etapa_pipeline:  { type: "string" },
        metadados:       { type: "object" },
        _por:            { type: "string", description: "Identificação de quem faz a mudança (para histórico)" }
      }
    }
  },
  {
    name: "tarefa_comentar",
    description: "Adiciona comentário à tarefa.",
    inputSchema: {
      type: "object",
      required: ["id", "texto", "autor"],
      properties: {
        id:         { type: "string" },
        texto:      { type: "string" },
        autor:      { type: "string" },
        autor_tipo: { type: "string", default: "agente" }
      }
    }
  },
  {
    name: "tarefa_aprovar",
    description: "Aprova a tarefa — muda status para aprovada.",
    inputSchema: { type: "object", required: ["id", "aprovado_por"], properties: { id: { type: "string" }, aprovado_por: { type: "string" } } }
  },
  {
    name: "tarefa_rejeitar",
    description: "Rejeita a tarefa com motivo — muda status para rejeitada.",
    inputSchema: { type: "object", required: ["id", "aprovado_por", "motivo"], properties: { id: { type: "string" }, aprovado_por: { type: "string" }, motivo: { type: "string" } } }
  },
  {
    name: "tarefa_concluir",
    description: "Conclui a tarefa. Retorna erro se houver subtarefas abertas.",
    inputSchema: { type: "object", required: ["id", "concluido_por"], properties: { id: { type: "string" }, concluido_por: { type: "string" } } }
  },
  {
    name: "tarefas_listar",
    description: "Lista tarefas com filtros opcionais.",
    inputSchema: {
      type: "object",
      properties: {
        status:      { type: "string" },
        responsavel: { type: "string" },
        cliente_id:  { type: "string" },
        prioridade:  { type: "string" },
        sla_status:  { type: "string" },
        tipo:        { type: "string" },
        setor:       { type: "string" },
        limit:       { type: "number", default: 50 }
      }
    }
  },
  {
    name: "tarefas_agente_listar",
    description: "Lista tarefas do tipo agente com filtros.",
    inputSchema: { type: "object", properties: { status: { type: "string" }, agente: { type: "string" }, limit: { type: "number", default: 20 } } }
  },
  // ── Pipeline tools (F1) ─────────────────────────────────────────────────────
  {
    name: "pipeline_config_listar",
    description: "Lista as configurações de pipeline de todos os setores ativos (etapas, SLAs, permissões).",
    inputSchema: {
      type: "object",
      properties: {
        setor: { type: "string", description: "Filtrar por setor específico (opcional)" }
      }
    }
  },
  {
    name: "tarefas_por_pipeline",
    description: "Retorna tarefas de um setor agrupadas por etapa — payload pronto para Kanban.",
    inputSchema: {
      type: "object",
      required: ["setor"],
      properties: {
        setor:       { type: "string", description: "fiscal | dp | contabil | financeiro" },
        cliente_id:  { type: "string", description: "Filtrar por cliente (opcional)" },
        responsavel: { type: "string", description: "Filtrar por responsável (opcional)" }
      }
    }
  },
  {
    name: "tarefa_mover_etapa",
    description: "Move uma tarefa para outra etapa do pipeline. Valida: etapa existe, transição permitida para o ator, requer_aprovacao respeitado. Grava evento auditável em tarefa_eventos.",
    inputSchema: {
      type: "object",
      required: ["tarefa_id", "etapa_destino", "ator", "ator_tipo"],
      properties: {
        tarefa_id:      { type: "string" },
        etapa_destino:  { type: "string", description: "Key da etapa destino (ex: pronto_transmitir)" },
        ator:           { type: "string", description: "Nome/ID de quem está movendo" },
        ator_tipo:      { type: "string", description: "humano | agente" },
        comentario:     { type: "string", description: "Comentário opcional sobre a movimentação" }
      }
    }
  },
  // ── Agente logs ─────────────────────────────────────────────────────────────
  {
    name: "agente_log_criar",
    description: "Registra ação do agente no log.",
    inputSchema: {
      type: "object",
      required: ["agente", "acao"],
      properties: {
        agente:       { type: "string" },
        acao:         { type: "string" },
        cliente_id:   { type: "string" },
        resultado:    { type: "string" },
        detalhes:     { type: "object" },
        erro_mensagem:{ type: "string" }
      }
    }
  },
  {
    name: "agente_logs_listar",
    description: "Lista logs de ações dos agentes.",
    inputSchema: {
      type: "object",
      properties: {
        agente:    { type: "string" },
        cliente_id:{ type: "string" },
        limit:     { type: "number", default: 50 }
      }
    }
  }
];

export const HANDLERS_TAREFAS = {

  // ── tarefa_criar ─────────────────────────────────────────────────────────────
  async tarefa_criar(args, env) {
    const slaMap = { fiscal_urgente: 4, dp: 24, comercial: 48 };
    const sla    = slaMap[args.tipo] || 72;
    const agora  = new Date();
    const prazo  = new Date(agora.getTime() + sla * 3600000).toISOString();

    // Resolver etapa_pipeline: se setor informado e etapa não informada, pegar a primeira etapa
    let etapaPipeline = args.etapa_pipeline || null;
    if (args.setor && !etapaPipeline) {
      const pipRow = await sb(env).get("pipeline_config", {
        select: "etapas",
        setor: `eq.${args.setor}`,
        limit: 1
      });
      if (Array.isArray(pipRow) && pipRow[0]?.etapas?.length) {
        const sorted = [...pipRow[0].etapas].sort((a, b) => a.ordem - b.ordem);
        etapaPipeline = sorted[0].key;
      }
    }

    const payload = {
      titulo:          args.titulo,
      tipo:            args.tipo,
      descricao:       args.descricao || "",
      status:          "aberta",
      prioridade:      args.prioridade || "normal",
      responsavel:     args.responsavel,
      responsavel_tipo:args.responsavel_tipo || "humano",
      criado_por:      args.criado_por,
      criado_por_tipo: args.criado_por_tipo || "agente",
      cliente_id:      args.cliente_id || null,
      cliente_nome:    args.cliente_nome || null,
      sla_horas:       sla,
      sla_status:      "no_prazo",
      data_prazo:      args.data_prazo || prazo,
      metadados:       args.metadados || {},
      historico:       [{ ts: agora.toISOString(), autor: args.criado_por, acao: "criada", descricao: `Tarefa criada por ${args.criado_por}` }],
      created_at:      agora.toISOString()
    };

    if (args.setor)          payload.setor          = args.setor;
    if (etapaPipeline)       payload.etapa_pipeline = etapaPipeline;

    const result = await sb(env).post("tarefas", payload);

    // Gravar evento de criação no pipeline se tiver setor
    if (args.setor && Array.isArray(result) && result[0]?.id) {
      await sb(env).post("tarefa_eventos", {
        tarefa_id:  result[0].id,
        tipo:       "tarefa_criada",
        ator:       args.criado_por,
        ator_tipo:  args.criado_por_tipo || "agente",
        para_etapa: etapaPipeline,
        payload:    { setor: args.setor },
        criado_em:  agora.toISOString()
      });
    }

    return result;
  },

  // ── tarefa_buscar ────────────────────────────────────────────────────────────
  async tarefa_buscar(args, env) {
    const rows = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "*" });
    return rows;
  },

  // ── tarefa_atualizar ─────────────────────────────────────────────────────────
  async tarefa_atualizar(args, env) {
    const { id, _por, ...data } = args;
    const hist_entry = _por ? [{ ts: new Date().toISOString(), autor: _por, acao: "atualizada", descricao: `Tarefa atualizada por ${_por}` }] : null;

    if (hist_entry) {
      const tarefa = await sb(env).get("tarefas", { id: `eq.${id}`, select: "historico" });
      const hist   = Array.isArray(tarefa) && tarefa[0]?.historico ? [...tarefa[0].historico, ...hist_entry] : hist_entry;
      data.historico = hist;
    }

    return sb(env).patch("tarefas", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  // ── tarefa_comentar ──────────────────────────────────────────────────────────
  async tarefa_comentar(args, env) {
    const tarefa   = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "comentarios" });
    const existing = Array.isArray(tarefa) && tarefa[0]?.comentarios ? tarefa[0].comentarios : [];
    const comentarios = [...existing, { ts: new Date().toISOString(), autor: args.autor, autor_tipo: args.autor_tipo || "agente", texto: args.texto }];
    return sb(env).patch("tarefas", `id=eq.${args.id}`, { comentarios, updated_at: new Date().toISOString() });
  },

  // ── tarefa_aprovar ───────────────────────────────────────────────────────────
  async tarefa_aprovar(args, env) {
    const agora  = new Date().toISOString();
    const tarefa = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "historico" });
    const hist   = Array.isArray(tarefa) && tarefa[0]?.historico ? tarefa[0].historico : [];
    return sb(env).patch("tarefas", `id=eq.${args.id}`, {
      status:      "aprovada",
      aprovado_por: args.aprovado_por,
      aprovado_em:  agora,
      historico:   [...hist, { ts: agora, autor: args.aprovado_por, acao: "aprovada", descricao: `Aprovada por ${args.aprovado_por}` }],
      updated_at:   agora
    });
  },

  // ── tarefa_rejeitar ──────────────────────────────────────────────────────────
  async tarefa_rejeitar(args, env) {
    const agora  = new Date().toISOString();
    const tarefa = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "historico" });
    const hist   = Array.isArray(tarefa) && tarefa[0]?.historico ? tarefa[0].historico : [];
    return sb(env).patch("tarefas", `id=eq.${args.id}`, {
      status:          "rejeitada",
      motivo_rejeicao: args.motivo,
      historico:       [...hist, { ts: agora, autor: args.aprovado_por, acao: "rejeitada", descricao: args.motivo }],
      updated_at:       agora
    });
  },

  // ── tarefa_concluir ──────────────────────────────────────────────────────────
  async tarefa_concluir(args, env) {
    const rows = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "metadados,status" });
    if (!Array.isArray(rows) || !rows[0]) return { error: "Tarefa não encontrada" };
    const meta = rows[0].metadados || {};
    if (meta.subtarefas) {
      const abertas = meta.subtarefas.filter(s => s.status !== "concluida");
      if (abertas.length) return { error: `Existem ${abertas.length} subtarefas abertas`, subtarefas_abertas: abertas };
    }
    const agora  = new Date().toISOString();
    const tarefa = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "historico" });
    const hist   = Array.isArray(tarefa) && tarefa[0]?.historico ? tarefa[0].historico : [];
    return sb(env).patch("tarefas", `id=eq.${args.id}`, {
      status:      "concluida",
      sla_status:  "concluido",
      concluida_em: agora,
      historico:   [...hist, { ts: agora, autor: args.concluido_por, acao: "concluida", descricao: `Concluída por ${args.concluido_por}` }],
      updated_at:   agora
    });
  },

  // ── tarefas_listar ───────────────────────────────────────────────────────────
  async tarefas_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 50 };
    if (args.status)      p.status      = `eq.${args.status}`;
    if (args.responsavel) p.responsavel = `eq.${args.responsavel}`;
    if (args.cliente_id)  p.cliente_id  = `eq.${args.cliente_id}`;
    if (args.prioridade)  p.prioridade  = `eq.${args.prioridade}`;
    if (args.sla_status)  p.sla_status  = `eq.${args.sla_status}`;
    if (args.tipo)        p.tipo        = `eq.${args.tipo}`;
    if (args.setor)       p.setor       = `eq.${args.setor}`;
    return sb(env).get("tarefas", p);
  },

  // ── tarefas_agente_listar ────────────────────────────────────────────────────
  async tarefas_agente_listar(args, env) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 20 };
    if (args.status) p.status = `eq.${args.status}`;
    if (args.agente) p.responsavel = `eq.${args.agente}`;
    return sb(env).get("tarefas_agente", p);
  },

  // ── pipeline_config_listar ────────────────────────────────────────────────────
  async pipeline_config_listar(args, env) {
    const p = { select: "*", ativo: "eq.true", order: "setor.asc" };
    if (args.setor) p.setor = `eq.${args.setor}`;
    return sb(env).get("pipeline_config", p);
  },

  // ── tarefas_por_pipeline ──────────────────────────────────────────────────────
  async tarefas_por_pipeline(args, env) {
    // Buscar config do pipeline
    const configs = await sb(env).get("pipeline_config", {
      select: "etapas,nome",
      setor: `eq.${args.setor}`,
      ativo: "eq.true",
      limit: 1
    });
    if (!Array.isArray(configs) || !configs[0]) {
      return { error: `Pipeline não encontrado para setor: ${args.setor}` };
    }
    const config = configs[0];
    const etapas = [...config.etapas].sort((a, b) => a.ordem - b.ordem);

    // Buscar tarefas do setor
    const p = {
      select: "id,titulo,tipo,status,prioridade,sla_status,sla_horas,data_prazo,responsavel,responsavel_tipo,etapa_pipeline,cliente_id,cliente_nome,created_at,updated_at",
      setor:  `eq.${args.setor}`,
      order:  "created_at.desc"
    };
    if (args.cliente_id)  p.cliente_id  = `eq.${args.cliente_id}`;
    if (args.responsavel) p.responsavel = `eq.${args.responsavel}`;

    const tarefas = await sb(env).get("tarefas", p);
    if (!Array.isArray(tarefas)) return tarefas;

    // Agrupar por etapa
    const agora = new Date();
    const kanban = etapas.map(etapa => {
      const items = tarefas.filter(t => t.etapa_pipeline === etapa.key);
      // Calcular SLA status de cada item
      const itemsComSla = items.map(t => {
        let slaStatus = t.sla_status;
        if (t.data_prazo && t.status !== 'concluida') {
          const prazo = new Date(t.data_prazo);
          const diff  = prazo - agora;
          if (diff < 0) slaStatus = 'atrasado';
          else if (diff < 3600000 * 4) slaStatus = 'critico';
        }
        return { ...t, sla_calculado: slaStatus };
      });
      return {
        etapa_key:         etapa.key,
        etapa_label:       etapa.label,
        ordem:             etapa.ordem,
        requer_aprovacao:  etapa.requer_aprovacao,
        sla_horas:         etapa.sla_horas,
        pode_mover:        etapa.pode_mover,
        pode_aprovar:      etapa.pode_aprovar,
        total:             items.length,
        atrasadas:         itemsComSla.filter(t => t.sla_calculado === 'atrasado').length,
        tarefas:           itemsComSla
      };
    });

    // Tarefas sem etapa definida (orphans)
    const orphans = tarefas.filter(t => !t.etapa_pipeline || !etapas.find(e => e.key === t.etapa_pipeline));

    return {
      setor:         args.setor,
      pipeline_nome: config.nome,
      total_tarefas: tarefas.length,
      etapas:        kanban,
      sem_etapa:     orphans
    };
  },

  // ── tarefa_mover_etapa ────────────────────────────────────────────────────────
  async tarefa_mover_etapa(args, env) {
    const { tarefa_id, etapa_destino, ator, ator_tipo, comentario } = args;

    // 1. Buscar a tarefa
    const rows = await sb(env).get("tarefas", { id: `eq.${tarefa_id}`, select: "*" });
    if (!Array.isArray(rows) || !rows[0]) return { error: "Tarefa não encontrada" };
    const tarefa = rows[0];

    if (!tarefa.setor) return { error: "Tarefa não pertence a nenhum pipeline (setor é null)" };

    // 2. Buscar config do pipeline
    const configs = await sb(env).get("pipeline_config", {
      select: "etapas",
      setor: `eq.${tarefa.setor}`,
      ativo: "eq.true",
      limit: 1
    });
    if (!Array.isArray(configs) || !configs[0]) {
      return { error: `Pipeline não configurado para setor: ${tarefa.setor}` };
    }
    const etapas = configs[0].etapas;

    // 3. Validar etapa destino existe
    const etapaDest = etapas.find(e => e.key === etapa_destino);
    if (!etapaDest) {
      const validas = etapas.map(e => e.key).join(", ");
      return { error: `Etapa '${etapa_destino}' não existe. Válidas: ${validas}` };
    }

    // 4. Validar permissão: ator pode mover para esta etapa?
    const atorToken = `${ator_tipo}:${ator}`;
    const podeGenerico = `${ator_tipo}:*`;
    const permissoes = etapaDest.pode_mover || [];
    const temPermissao = permissoes.some(p => p === atorToken || p === podeGenerico || p === `${ator_tipo}:admin`);

    // Admin e humano:admin sempre podem
    const isAdmin = ator === 'admin' || ator_tipo === 'humano';

    if (!temPermissao && !isAdmin) {
      return {
        error: `Ator '${atorToken}' não tem permissão para mover para '${etapa_destino}'.`,
        pode_mover: permissoes
      };
    }

    // 5. Validar requer_aprovacao na etapa ATUAL
    const etapaAtual = etapas.find(e => e.key === tarefa.etapa_pipeline);
    if (etapaAtual?.requer_aprovacao && ator_tipo === 'agente') {
      // Agente tenta sair de etapa que requer aprovação humana
      const podeAprovar = etapaAtual.pode_aprovar || [];
      return {
        error: `Etapa '${etapaAtual.key}' requer aprovação humana para avançar.`,
        requer_aprovacao: true,
        pode_aprovar: podeAprovar,
        instrucao: "Estacione aqui e comente o que preparou. Aguarde aprovação humana."
      };
    }

    // 6. Executar movimentação
    const agora = new Date().toISOString();
    const hist  = Array.isArray(tarefa.historico) ? tarefa.historico : [];
    const novoHist = [...hist, {
      ts:        agora,
      autor:     ator,
      acao:      "etapa_movida",
      descricao: `${tarefa.etapa_pipeline || 'início'} → ${etapa_destino}`
    }];

    await sb(env).patch("tarefas", `id=eq.${tarefa_id}`, {
      etapa_pipeline: etapa_destino,
      historico:      novoHist,
      updated_at:     agora
    });

    // 7. Gravar evento auditável
    const eventoPayload = {
      tarefa_id,
      tipo:       "etapa_movida",
      ator,
      ator_tipo,
      de_etapa:   tarefa.etapa_pipeline,
      para_etapa: etapa_destino,
      payload:    { comentario: comentario || null, setor: tarefa.setor },
      criado_em:  agora
    };
    await sb(env).post("tarefa_eventos", eventoPayload);

    // 8. Se tiver comentário, adicionar
    if (comentario) {
      const comentarios = Array.isArray(tarefa.comentarios) ? tarefa.comentarios : [];
      await sb(env).patch("tarefas", `id=eq.${tarefa_id}`, {
        comentarios: [...comentarios, { ts: agora, autor: ator, autor_tipo: ator_tipo, texto: comentario }]
      });
    }

    return {
      ok:          true,
      tarefa_id,
      de_etapa:    tarefa.etapa_pipeline,
      para_etapa:  etapa_destino,
      ator,
      ator_tipo,
      evento_gravado: true
    };
  },

  // ── agente_log_criar ─────────────────────────────────────────────────────────
  async agente_log_criar(args, env) {
    return sb(env).post("agente_logs", {
      agente:        args.agente,
      acao:          args.acao,
      cliente_id:    args.cliente_id || null,
      resultado:     args.resultado  || "ok",
      detalhes:      args.detalhes   || {},
      erro_mensagem: args.erro_mensagem || null,
      executado_em:  new Date().toISOString()
    });
  },

  // ── agente_logs_listar ───────────────────────────────────────────────────────
  async agente_logs_listar(args, env) {
    const p = { select: "*", order: "executado_em.desc", limit: args.limit || 50 };
    if (args.agente)    p.agente     = `eq.${args.agente}`;
    if (args.cliente_id) p.cliente_id = `eq.${args.cliente_id}`;
    return sb(env).get("agente_logs", p);
  }

};

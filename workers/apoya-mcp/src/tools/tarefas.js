// tools/tarefas.js — Tarefas, pipeline de setores, agente logs
// feat(pipeline) 2026-06-11 — F1: pipeline_config_listar, tarefas_por_pipeline, tarefa_mover_etapa
// security(F1.1) 2026-06-11 — ator/ator_tipo derivado da API key (identity), não do payload
//                             escopo_setores aplicado em tarefa_criar/atualizar/mover_etapa

import { sb } from "../db.js";

// ── Helper: verificar escopo de setor ────────────────────────────────────────
// Retorna null se autorizado, ou { error: string } se negado.
function checkSetorScope(identity, setor, operacao) {
  if (!setor) return null; // tarefa sem setor = global = não restringida por setor
  const escopos = identity?.escopo_setores ?? ["*"];
  if (escopos.includes("*") || escopos.includes(setor)) return null;
  return {
    error: `Chave '${identity?.agentName}' não autorizada para setor '${setor}' em ${operacao}.`,
    escopo_setores: escopos,
    setor_requisitado: setor
  };
}

export const TOOLS_TAREFAS = [
  // ── Tarefas CRUD ────────────────────────────────────────────────────────────
  {
    name: "tarefa_criar",
    description: "Cria tarefa com SLA automático por tipo. Aceita setor para colocar no pipeline correto — etapa_pipeline padrão = primeira etapa do setor. Requer escopo de setor na API key.",
    inputSchema: {
      type: "object",
      required: ["titulo", "tipo", "responsavel", "criado_por"],
      properties: {
        titulo:          { type: "string" },
        tipo:            { type: "string", description: "fiscal_urgente | dp | comercial | outros" },
        responsavel:     { type: "string" },
        responsavel_tipo:{ type: "string", description: "IGNORADO — derivado da API key autenticada" },
        criado_por:      { type: "string" },
        criado_por_tipo: { type: "string", description: "IGNORADO — derivado da API key autenticada" },
        descricao:       { type: "string" },
        cliente_id:      { type: "string" },
        cliente_nome:    { type: "string" },
        prioridade:      { type: "string", default: "normal" },
        data_prazo:      { type: "string" },
        setor:           { type: "string", description: "fiscal | dp | contabil | financeiro (exige escopo na API key)" },
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
    description: "Atualiza campos da tarefa. Requer escopo de setor na API key para tarefas com setor definido.",
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
        autor:      { type: "string" }
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
  // ── Pipeline tools ──────────────────────────────────────────────────────────
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
        cliente_id:  { type: "string" },
        responsavel: { type: "string" }
      }
    }
  },
  {
    name: "tarefa_mover_etapa",
    description: "Move tarefa para outra etapa do pipeline. ator/ator_tipo são derivados da API key autenticada — valores no payload são IGNORADOS para decisão de permissão. Chaves de agente são bloqueadas em etapas requer_aprovacao. Requer escopo de setor na API key.",
    inputSchema: {
      type: "object",
      required: ["tarefa_id", "etapa_destino"],
      properties: {
        tarefa_id:     { type: "string" },
        etapa_destino: { type: "string", description: "Key da etapa destino (ex: pronto_transmitir)" },
        comentario:    { type: "string", description: "Comentário opcional sobre a movimentação" },
        ator:          { type: "string", description: "Label informativo apenas — NÃO usado para autorização" }
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
  async tarefa_criar(args, env, identity) {
    // ACHADO 2: verificar escopo de setor antes de qualquer operação
    const scopeErr = checkSetorScope(identity, args.setor, "tarefa_criar");
    if (scopeErr) return scopeErr;

    const slaMap = { fiscal_urgente: 4, dp: 24, comercial: 48 };
    const sla    = slaMap[args.tipo] || 72;
    const agora  = new Date();
    const prazo  = new Date(agora.getTime() + sla * 3600000).toISOString();

    // ACHADO 1: ator_tipo e criado_por_tipo derivados da identity, não do payload
    const ator_tipo_real = identity?.ator_tipo ?? "agente";
    const agentName      = identity?.agentName ?? args.criado_por ?? "desconhecido";

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
      responsavel_tipo:args.responsavel_tipo || "humano", // responsável da tarefa (diferente do criador)
      criado_por:      agentName,
      criado_por_tipo: ator_tipo_real,
      cliente_id:      args.cliente_id || null,
      cliente_nome:    args.cliente_nome || null,
      sla_horas:       sla,
      sla_status:      "no_prazo",
      data_prazo:      args.data_prazo || prazo,
      metadados:       args.metadados || {},
      historico:       [{ ts: agora.toISOString(), autor: agentName, autor_tipo: ator_tipo_real, acao: "criada", descricao: `Tarefa criada por ${agentName}` }],
      created_at:      agora.toISOString()
    };

    if (args.setor)    payload.setor          = args.setor;
    if (etapaPipeline) payload.etapa_pipeline = etapaPipeline;

    const result = await sb(env).post("tarefas", payload);

    // Gravar evento de criação no pipeline se tiver setor
    if (args.setor && Array.isArray(result) && result[0]?.id) {
      await sb(env).post("tarefa_eventos", {
        tarefa_id:  result[0].id,
        tipo:       "tarefa_criada",
        ator:       agentName,
        ator_tipo:  ator_tipo_real,
        para_etapa: etapaPipeline,
        payload:    { setor: args.setor },
        criado_em:  agora.toISOString()
      });
    }

    return result;
  },

  // ── tarefa_buscar ────────────────────────────────────────────────────────────
  async tarefa_buscar(args, env, identity) {
    return sb(env).get("tarefas", { id: `eq.${args.id}`, select: "*" });
  },

  // ── tarefa_atualizar ─────────────────────────────────────────────────────────
  async tarefa_atualizar(args, env, identity) {
    // ACHADO 2: se tarefa tem setor (no args ou no banco), verificar escopo
    let setor = args.setor;
    if (!setor) {
      // Buscar o setor atual da tarefa para validar
      const tarRows = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "setor" });
      setor = Array.isArray(tarRows) && tarRows[0]?.setor;
    }
    const scopeErr = checkSetorScope(identity, setor, "tarefa_atualizar");
    if (scopeErr) return scopeErr;

    const { id, _por, ...data } = args;
    // Remover campos que não devem ir para o banco diretamente
    delete data.responsavel_tipo; // não deixar sobrescrever inadvertidamente

    const ator_nome = _por || identity?.agentName || "desconhecido";

    if (_por) {
      const tarefa = await sb(env).get("tarefas", { id: `eq.${id}`, select: "historico" });
      const hist   = Array.isArray(tarefa) && tarefa[0]?.historico ? tarefa[0].historico : [];
      data.historico = [...hist, { ts: new Date().toISOString(), autor: ator_nome, autor_tipo: identity?.ator_tipo ?? "agente", acao: "atualizada", descricao: `Atualizada por ${ator_nome}` }];
    }

    return sb(env).patch("tarefas", `id=eq.${id}`, { ...data, updated_at: new Date().toISOString() });
  },

  // ── tarefa_comentar ──────────────────────────────────────────────────────────
  async tarefa_comentar(args, env, identity) {
    const tarefa   = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "comentarios" });
    const existing = Array.isArray(tarefa) && tarefa[0]?.comentarios ? tarefa[0].comentarios : [];
    const ator_tipo_real = identity?.ator_tipo ?? "agente";
    const comentarios = [...existing, {
      ts:         new Date().toISOString(),
      autor:      args.autor || identity?.agentName,
      autor_tipo: ator_tipo_real,
      texto:      args.texto
    }];
    return sb(env).patch("tarefas", `id=eq.${args.id}`, { comentarios, updated_at: new Date().toISOString() });
  },

  // ── tarefa_aprovar ───────────────────────────────────────────────────────────
  async tarefa_aprovar(args, env, identity) {
    const agora  = new Date().toISOString();
    const tarefa = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "historico" });
    const hist   = Array.isArray(tarefa) && tarefa[0]?.historico ? tarefa[0].historico : [];
    return sb(env).patch("tarefas", `id=eq.${args.id}`, {
      status:       "aprovada",
      aprovado_por:  args.aprovado_por,
      aprovado_em:   agora,
      historico:    [...hist, { ts: agora, autor: args.aprovado_por, autor_tipo: identity?.ator_tipo ?? "agente", acao: "aprovada", descricao: `Aprovada por ${args.aprovado_por}` }],
      updated_at:    agora
    });
  },

  // ── tarefa_rejeitar ──────────────────────────────────────────────────────────
  async tarefa_rejeitar(args, env, identity) {
    const agora  = new Date().toISOString();
    const tarefa = await sb(env).get("tarefas", { id: `eq.${args.id}`, select: "historico" });
    const hist   = Array.isArray(tarefa) && tarefa[0]?.historico ? tarefa[0].historico : [];
    return sb(env).patch("tarefas", `id=eq.${args.id}`, {
      status:          "rejeitada",
      motivo_rejeicao: args.motivo,
      historico:       [...hist, { ts: agora, autor: args.aprovado_por, autor_tipo: identity?.ator_tipo ?? "agente", acao: "rejeitada", descricao: args.motivo }],
      updated_at:       agora
    });
  },

  // ── tarefa_concluir ──────────────────────────────────────────────────────────
  async tarefa_concluir(args, env, identity) {
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
      status:       "concluida",
      sla_status:   "concluido",
      concluida_em:  agora,
      historico:    [...hist, { ts: agora, autor: args.concluido_por, autor_tipo: identity?.ator_tipo ?? "agente", acao: "concluida", descricao: `Concluída por ${args.concluido_por}` }],
      updated_at:    agora
    });
  },

  // ── tarefas_listar ───────────────────────────────────────────────────────────
  async tarefas_listar(args, env, identity) {
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
  async tarefas_agente_listar(args, env, identity) {
    const p = { select: "*", order: "created_at.desc", limit: args.limit || 20 };
    if (args.status) p.status = `eq.${args.status}`;
    if (args.agente) p.responsavel = `eq.${args.agente}`;
    return sb(env).get("tarefas_agente", p);
  },

  // ── pipeline_config_listar ────────────────────────────────────────────────────
  async pipeline_config_listar(args, env, identity) {
    const p = { select: "*", ativo: "eq.true", order: "setor.asc" };
    if (args.setor) p.setor = `eq.${args.setor}`;
    return sb(env).get("pipeline_config", p);
  },

  // ── tarefas_por_pipeline ──────────────────────────────────────────────────────
  async tarefas_por_pipeline(args, env, identity) {
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

    const p = {
      select: "id,titulo,tipo,status,prioridade,sla_status,sla_horas,data_prazo,responsavel,responsavel_tipo,etapa_pipeline,cliente_id,cliente_nome,created_at,updated_at",
      setor:  `eq.${args.setor}`,
      order:  "created_at.desc"
    };
    if (args.cliente_id)  p.cliente_id  = `eq.${args.cliente_id}`;
    if (args.responsavel) p.responsavel = `eq.${args.responsavel}`;

    const tarefas = await sb(env).get("tarefas", p);
    if (!Array.isArray(tarefas)) return tarefas;

    const agora = new Date();
    const kanban = etapas.map(etapa => {
      const items = tarefas.filter(t => t.etapa_pipeline === etapa.key);
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
        etapa_key:        etapa.key,
        etapa_label:      etapa.label,
        ordem:            etapa.ordem,
        requer_aprovacao: etapa.requer_aprovacao,
        sla_horas:        etapa.sla_horas,
        pode_mover:       etapa.pode_mover,
        pode_aprovar:     etapa.pode_aprovar,
        total:            items.length,
        atrasadas:        itemsComSla.filter(t => t.sla_calculado === 'atrasado').length,
        tarefas:          itemsComSla
      };
    });

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
  // ACHADO 1 — CORRIGIDO:
  // ator_tipo é derivado de identity.ator_tipo (da API key autenticada), NUNCA do payload.
  // O payload pode incluir "ator" apenas como label informativo.
  // is_human_delegate=true na mcp_api_keys é o único caminho para mover etapas com requer_aprovacao.
  async tarefa_mover_etapa(args, env, identity) {
    const { tarefa_id, etapa_destino, comentario } = args;
    // ator_label: informativo apenas, para aparecer no histórico
    const ator_label     = args.ator || identity?.agentName || "desconhecido";
    // ator_tipo_real: DERIVADO DA API KEY — imutável pelo payload
    const ator_tipo_real = identity?.ator_tipo ?? "agente";
    const agentName      = identity?.agentName ?? "desconhecido";

    // 1. Buscar a tarefa
    const rows = await sb(env).get("tarefas", { id: `eq.${tarefa_id}`, select: "*" });
    if (!Array.isArray(rows) || !rows[0]) return { error: "Tarefa não encontrada" };
    const tarefa = rows[0];

    if (!tarefa.setor) return { error: "Tarefa não pertence a nenhum pipeline (setor é null)" };

    // ACHADO 2: verificar escopo de setor
    const scopeErr = checkSetorScope(identity, tarefa.setor, "tarefa_mover_etapa");
    if (scopeErr) return scopeErr;

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
      return { error: `Etapa '${etapa_destino}' não existe no pipeline '${tarefa.setor}'. Válidas: ${validas}` };
    }

    // 4. ACHADO 1 — CRÍTICO CORRIGIDO:
    // Verificar requer_aprovacao da etapa ATUAL usando ator_tipo REAL (da API key)
    const etapaAtual = etapas.find(e => e.key === tarefa.etapa_pipeline);
    if (etapaAtual?.requer_aprovacao && ator_tipo_real === "agente") {
      // Agente (ator_tipo derivado da chave) não pode sair de etapa com aprovação obrigatória
      // Única exceção: is_human_delegate=true na chave (webhook de aprovação do painel)
      return {
        error: `Etapa '${etapaAtual.key}' requer aprovação humana para avançar.`,
        requer_aprovacao: true,
        ator_tipo_autenticado: ator_tipo_real,
        pode_aprovar: etapaAtual.pode_aprovar,
        instrucao: "Aprovação deve ser feita pelo painel web (sessão humana autenticada) ou por chave is_human_delegate=true. Agentes NÃO podem auto-aprovar mesmo enviando ator_tipo='humano' no payload."
      };
    }

    // 5. Validar permissão da chave para MOVER para etapa destino
    // Chave com escopo_setores["*"] (master) sempre pode
    // Chave com escopo do setor pode mover nas etapas permitidas
    const permissoes = etapaDest.pode_mover || [];
    const atorToken  = `${ator_tipo_real}:${agentName}`;
    const masterOk   = (identity?.escopo_setores ?? []).includes("*");
    // Verificar: agente:nome_agente OU agente:* OU humano:admin
    const temPermissao = masterOk || permissoes.some(p =>
      p === atorToken ||
      p === `${ator_tipo_real}:*` ||
      p === `${ator_tipo_real}:admin`
    );

    if (!temPermissao) {
      return {
        error: `Chave '${agentName}' (${ator_tipo_real}) não tem permissão para mover para '${etapa_destino}'.`,
        ator_tipo_autenticado: ator_tipo_real,
        pode_mover: permissoes
      };
    }

    // 6. Executar movimentação
    const agora    = new Date().toISOString();
    const hist     = Array.isArray(tarefa.historico) ? tarefa.historico : [];
    const novoHist = [...hist, {
      ts:        agora,
      autor:     ator_label,
      autor_tipo: ator_tipo_real,
      acao:      "etapa_movida",
      descricao: `${tarefa.etapa_pipeline || 'início'} → ${etapa_destino}`
    }];

    await sb(env).patch("tarefas", `id=eq.${tarefa_id}`, {
      etapa_pipeline: etapa_destino,
      historico:      novoHist,
      updated_at:     agora
    });

    // 7. Gravar evento auditável em tarefa_eventos
    await sb(env).post("tarefa_eventos", {
      tarefa_id,
      tipo:       "etapa_movida",
      ator:       ator_label,
      ator_tipo:  ator_tipo_real,
      de_etapa:   tarefa.etapa_pipeline,
      para_etapa: etapa_destino,
      payload:    { comentario: comentario || null, setor: tarefa.setor, chave_id: identity?.keyId },
      criado_em:  agora
    });

    // 8. Adicionar comentário se fornecido
    if (comentario) {
      const comentarios = Array.isArray(tarefa.comentarios) ? tarefa.comentarios : [];
      await sb(env).patch("tarefas", `id=eq.${tarefa_id}`, {
        comentarios: [...comentarios, { ts: agora, autor: ator_label, autor_tipo: ator_tipo_real, texto: comentario }]
      });
    }

    return {
      ok:                    true,
      tarefa_id,
      de_etapa:              tarefa.etapa_pipeline,
      para_etapa:            etapa_destino,
      ator:                  ator_label,
      ator_tipo_autenticado: ator_tipo_real,
      evento_gravado:        true
    };
  },

  // ── agente_log_criar ─────────────────────────────────────────────────────────
  async agente_log_criar(args, env, identity) {
    return sb(env).post("agente_logs", {
      agente:        args.agente || identity?.agentName,
      acao:          args.acao,
      cliente_id:    args.cliente_id || null,
      resultado:     args.resultado  || "ok",
      detalhes:      args.detalhes   || {},
      erro_mensagem: args.erro_mensagem || null,
      executado_em:  new Date().toISOString()
    });
  },

  // ── agente_logs_listar ───────────────────────────────────────────────────────
  async agente_logs_listar(args, env, identity) {
    const p = { select: "*", order: "executado_em.desc", limit: args.limit || 50 };
    if (args.agente)    p.agente      = `eq.${args.agente}`;
    if (args.cliente_id) p.cliente_id = `eq.${args.cliente_id}`;
    return sb(env).get("agente_logs", p);
  }

};

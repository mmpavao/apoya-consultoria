import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch }   from "@/components/ui/switch";
import {
  X, Send, Plus, Trash2, Clock, ExternalLink, Edit2, Save,
  CheckCircle2, XCircle, PlayCircle, ThumbsUp, ThumbsDown,
  Loader2,
} from "lucide-react";
import { Tarefa, TarefaStatus, TarefaTipo, TarefaPrioridade, useTarefas, Subtarefa, calcularSlaHoras } from "@/hooks/use-tarefas";
import {
  BadgeStatus, BadgePrioridade, BadgeSLA, BadgeTipo, AvatarResponsavel,
  STATUS_LABEL, TODOS_RESPONSAVEIS, TIPO_LABEL, PRIORIDADE_LABEL, PRIORIDADE_EMOJI,
  formatData, formatDataRelativa,
} from "./tarefa-utils";

interface Props {
  tarefa: Tarefa;
  open: boolean;
  onClose: () => void;
  currentUser?: string;
  currentUserRole?: "admin" | "contador" | "cliente";
}

// ── Inline label-value para aba de detalhes ───────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

export function TarefaModal({ tarefa, open, onClose, currentUser = "Daniel Araújo", currentUserRole = "admin" }: Props) {
  const { atualizarTarefa, adicionarComentario, deletarTarefa } = useTarefas();

  // ── Estado local ─────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState("detalhes");
  const [modoEdicao,      setModoEdicao]      = useState(false);
  const [salvando,        setSalvando]        = useState(false);
  const [comentario,      setComentario]      = useState("");
  const [motivoRejeicao,  setMotivoRejeicao]  = useState("");
  const [showRejeitar,    setShowRejeitar]    = useState(false);
  const [confirmarDelete, setConfirmarDelete] = useState(false);

  // Campos editáveis
  const [editTitulo,        setEditTitulo]       = useState("");
  const [editDescricao,     setEditDescricao]    = useState("");
  const [editTipo,          setEditTipo]         = useState<TarefaTipo>("interno");
  const [editPrioridade,    setEditPrioridade]   = useState<TarefaPrioridade>("media");
  const [editResponsavel,   setEditResponsavel]  = useState("");
  const [editDataPrazo,     setEditDataPrazo]    = useState("");
  const [editTags,          setEditTags]         = useState("");
  const [editReqAprov,      setEditReqAprov]     = useState(false);
  const [editAprovador,     setEditAprovador]    = useState("");
  const [novaSubtarefa,     setNovaSubtarefa]    = useState("");

  // Sincronizar campos com tarefa quando abre
  useEffect(() => {
    if (tarefa && open) {
      setEditTitulo(tarefa.titulo);
      setEditDescricao(tarefa.descricao ?? "");
      setEditTipo(tarefa.tipo);
      setEditPrioridade(tarefa.prioridade);
      setEditResponsavel(tarefa.responsavel);
      setEditDataPrazo(tarefa.data_prazo ? new Date(tarefa.data_prazo).toISOString().slice(0, 16) : "");
      setEditTags((tarefa.tags ?? []).join(", "));
      setEditReqAprov(tarefa.requer_aprovacao);
      setEditAprovador(tarefa.aprovador ?? "");
      setModoEdicao(false);
      setActiveTab("detalhes");
      setShowRejeitar(false);
      setConfirmarDelete(false);
    }
  }, [tarefa?.id, open]);


  const isAdmin      = currentUserRole === "admin";
  const isAprovador  = tarefa.aprovador === currentUser || isAdmin;
  const progressoSub = tarefa.subtarefas_total > 0
    ? Math.round((tarefa.subtarefas_concluidas / tarefa.subtarefas_total) * 100) : 0;
  const podeEditar   = isAdmin || tarefa.responsavel === currentUser;
  const podeApagar   = isAdmin;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  async function mudarStatus(novo: TarefaStatus, extra?: Record<string, unknown>) {
    setSalvando(true);
    try { await atualizarTarefa(tarefa.id, { status: novo, ...extra } as any, currentUser); }
    finally { setSalvando(false); }
  }

  async function salvarEdicao() {
    setSalvando(true);
    try {
      const tagsArr = editTags.split(",").map(t => t.trim()).filter(Boolean);
      const resp    = TODOS_RESPONSAVEIS.find(r => r.nome === editResponsavel);
      await atualizarTarefa(tarefa.id, {
        titulo:           editTitulo.trim(),
        descricao:        editDescricao.trim() || undefined,
        tipo:             editTipo,
        prioridade:       editPrioridade,
        responsavel:      editResponsavel,
        responsavel_tipo: resp?.tipo ?? tarefa.responsavel_tipo,
        data_prazo:       editDataPrazo ? new Date(editDataPrazo).toISOString() : undefined,
        tags:             tagsArr,
        sla_horas:        calcularSlaHoras(editTipo, tagsArr),
        requer_aprovacao: editReqAprov,
        aprovador:        editReqAprov ? editAprovador || undefined : undefined,
      } as any, currentUser);
      setModoEdicao(false);
    } finally { setSalvando(false); }
  }

  async function enviarComentario() {
    if (!comentario.trim()) return;
    await adicionarComentario(tarefa.id, { autor: currentUser, autor_tipo: "humano", texto: comentario.trim() });
    setComentario("");
  }

  async function toggleSubtarefa(subId: string, novoStatus: "aberta" | "concluida") {
    const subs      = tarefa.subtarefas.map(s => s.id === subId ? { ...s, status: novoStatus } : s);
    const concluidas = subs.filter(s => s.status === "concluida").length;
    await atualizarTarefa(tarefa.id, { subtarefas: subs, subtarefas_concluidas: concluidas } as any, currentUser);
  }

  async function adicionarSubtarefa() {
    if (!novaSubtarefa.trim()) return;
    const nova: Subtarefa = { id: crypto.randomUUID(), titulo: novaSubtarefa.trim(), status: "aberta" };
    const subs = [...tarefa.subtarefas, nova];
    await atualizarTarefa(tarefa.id, { subtarefas: subs, subtarefas_total: subs.length } as any, currentUser);
    setNovaSubtarefa("");
  }

  async function removerSubtarefa(subId: string) {
    const subs = tarefa.subtarefas.filter(s => s.id !== subId);
    await atualizarTarefa(tarefa.id, {
      subtarefas: subs,
      subtarefas_total: subs.length,
      subtarefas_concluidas: subs.filter(s => s.status === "concluida").length,
    } as any, currentUser);
  }

  async function handleAprovar() { await mudarStatus("aprovada", { aprovado_em: new Date().toISOString(), aprovado_por: currentUser }); }
  async function handleRejeitar() {
    await mudarStatus("rejeitada", { motivo_rejeicao: motivoRejeicao });
    setShowRejeitar(false); setMotivoRejeicao("");
  }
  async function handleExcluir() {
    setSalvando(true);
    try { await deletarTarefa(tarefa.id); onClose(); }
    finally { setSalvando(false); }
  }

  // ── Botões de ação por status ─────────────────────────────────────────────
  function AcoesStatus() {
    if (salvando) return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</div>;
    const btns: React.ReactNode[] = [];
    if (tarefa.status === "aberta")
      btns.push(<Button key="ini" size="sm" onClick={() => mudarStatus("em_andamento")} className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"><PlayCircle className="w-3.5 h-3.5"/>Iniciar</Button>);
    if (tarefa.status === "em_andamento") {
      if (tarefa.requer_aprovacao)
        btns.push(<Button key="apr" size="sm" onClick={() => mudarStatus("aguardando_aprovacao")} className="bg-violet-500 hover:bg-violet-600 text-white gap-1.5"><ThumbsUp className="w-3.5 h-3.5"/>Enviar Aprovação</Button>);
      else
        btns.push(<Button key="con" size="sm" onClick={() => mudarStatus("concluida")} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/>Concluir</Button>);
    }
    if (tarefa.status === "aguardando_aprovacao" && isAprovador) {
      btns.push(<Button key="apr2" size="sm" onClick={handleAprovar} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"><ThumbsUp className="w-3.5 h-3.5"/>Aprovar</Button>);
      btns.push(<Button key="rej" size="sm" variant="destructive" onClick={() => setShowRejeitar(true)} className="gap-1.5"><ThumbsDown className="w-3.5 h-3.5"/>Rejeitar</Button>);
    }
    if (tarefa.status === "aprovada")
      btns.push(<Button key="con2" size="sm" onClick={() => mudarStatus("concluida")} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/>Concluir</Button>);
    if (!["concluida","cancelada"].includes(tarefa.status))
      btns.push(<Button key="can" size="sm" variant="outline" onClick={() => mudarStatus("cancelada")} className="text-slate-500 gap-1.5"><XCircle className="w-3.5 h-3.5"/>Cancelar</Button>);
    return <>{btns}</>;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* ─ Header ────────────────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                <BadgeTipo      tipo={tarefa.tipo} />
                <BadgeStatus    status={tarefa.status} />
                <BadgePrioridade prioridade={tarefa.prioridade} />
                <BadgeSLA       sla_status={tarefa.sla_status} data_prazo={tarefa.data_prazo} />
              </div>
              {/* Título — editável inline */}
              {modoEdicao ? (
                <Input
                  value={editTitulo}
                  onChange={e => setEditTitulo(e.target.value)}
                  className="text-base font-semibold h-auto py-1.5 border-primary/50 focus-visible:ring-primary/30"
                  autoFocus
                />
              ) : (
                <h2 className="text-lg font-semibold text-slate-900 leading-snug">{tarefa.titulo}</h2>
              )}
              {tarefa.cliente_nome && (
                <p className="flex items-center gap-1 text-sm text-slate-500 mt-1">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {tarefa.cliente_nome}
                </p>
              )}
            </div>

            {/* Ações header */}
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {podeEditar && !modoEdicao && (
                <button
                  onClick={() => setModoEdicao(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title="Editar tarefa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {modoEdicao && (
                <>
                  <button onClick={() => setModoEdicao(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" title="Cancelar edição">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={salvarEdicao} disabled={salvando} className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors" title="Salvar edição">
                    {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  </button>
                </>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─ Tabs ──────────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 pt-1 border-b border-slate-100 bg-white rounded-none justify-start h-auto gap-0 shrink-0">
            {[
              { key: "detalhes",    label: "Detalhes" },
              { key: "subtarefas",  label: `Subtarefas (${tarefa.subtarefas_concluidas}/${tarefa.subtarefas_total})` },
              { key: "comentarios", label: `Comentários (${tarefa.comentarios.length})` },
              { key: "historico",   label: "Histórico" },
            ].map(t => (
              <TabsTrigger
                key={t.key} value={t.key}
                className="relative rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors bg-transparent hover:bg-transparent shadow-none"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── ABA DETALHES ──────────────────────────────────────────────── */}
          <TabsContent value="detalhes" className="flex-1 overflow-y-auto px-6 py-5 m-0 space-y-5">

            {/* Descrição */}
            {modoEdicao ? (
              <div>
                <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Descrição</Label>
                <Textarea value={editDescricao} onChange={e => setEditDescricao(e.target.value)} rows={4}
                  placeholder="Descreva o que precisa ser feito..." className="resize-none text-sm" />
              </div>
            ) : tarefa.descricao ? (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Descrição</p>
                <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-100">
                  {tarefa.descricao}
                </div>
              </div>
            ) : null}

            {/* Campos editáveis em modo edição */}
            {modoEdicao && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Tipo</Label>
                  <Select value={editTipo} onValueChange={v => setEditTipo(v as TarefaTipo)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(TIPO_LABEL) as TarefaTipo[]).map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Prioridade</Label>
                  <Select value={editPrioridade} onValueChange={v => setEditPrioridade(v as TarefaPrioridade)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{(["critica","alta","media","baixa"] as TarefaPrioridade[]).map(p => <SelectItem key={p} value={p}>{PRIORIDADE_EMOJI[p]} {PRIORIDADE_LABEL[p]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Responsável</Label>
                  <Select value={editResponsavel} onValueChange={setEditResponsavel}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">Agentes IA</div>
                      {TODOS_RESPONSAVEIS.filter(r => r.tipo === "agente").map(r => <SelectItem key={r.nome} value={r.nome}>🤖 {r.nome}</SelectItem>)}
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase mt-1">Humanos</div>
                      {TODOS_RESPONSAVEIS.filter(r => r.tipo === "humano").map(r => <SelectItem key={r.nome} value={r.nome}>👤 {r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Prazo</Label>
                  <Input type="datetime-local" value={editDataPrazo} onChange={e => setEditDataPrazo(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Tags (separadas por vírgula)</Label>
                  <Input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="urgente, fiscal_urgente, mei..." className="h-9 text-sm" />
                </div>
                <div className="col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">Requer Aprovação</p>
                    <p className="text-xs text-slate-400">A tarefa ficará em "Aguardando Aprovação" antes de ser concluída</p>
                  </div>
                  <Switch checked={editReqAprov} onCheckedChange={setEditReqAprov} />
                </div>
                {editReqAprov && (
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Quem Aprova</Label>
                    <Select value={editAprovador} onValueChange={setEditAprovador}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar aprovador..." /></SelectTrigger>
                      <SelectContent>
                        {TODOS_RESPONSAVEIS.map(r => <SelectItem key={r.nome} value={r.nome}>{r.tipo === "agente" ? "🤖" : "👤"} {r.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Grid de informações (modo visualização) */}
            {!modoEdicao && (
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <Field label="Responsável"><AvatarResponsavel nome={tarefa.responsavel} tipo={tarefa.responsavel_tipo} /></Field>
                <Field label="Criado por"><AvatarResponsavel nome={tarefa.criado_por} tipo={tarefa.criado_por_tipo} /></Field>
                {tarefa.requer_aprovacao && tarefa.aprovador && (
                  <Field label="Aprovador"><AvatarResponsavel nome={tarefa.aprovador} tipo={tarefa.aprovador_tipo ?? "humano"} /></Field>
                )}
                <Field label="Origem">{tarefa.origem ?? "sistema"}</Field>
                <Field label="Aberta em">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" />{formatData(tarefa.created_at)}</span>
                </Field>
                {tarefa.data_prazo && <Field label="Prazo">{formatData(tarefa.data_prazo)}</Field>}
                {tarefa.sla_horas   && <Field label="SLA">{tarefa.sla_horas}h</Field>}
                {tarefa.concluida_em && <Field label="Concluída em">{formatData(tarefa.concluida_em)}</Field>}
                {tarefa.aprovado_por && <Field label="Aprovado por">{tarefa.aprovado_por} em {formatData(tarefa.aprovado_em)}</Field>}
              </div>
            )}

            {/* Motivo de rejeição */}
            {tarefa.motivo_rejeicao && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-1">Motivo da Rejeição</p>
                <p className="text-sm text-red-700">{tarefa.motivo_rejeicao}</p>
              </div>
            )}

            {/* Tags */}
            {!modoEdicao && tarefa.tags.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {tarefa.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Form de rejeição */}
            {showRejeitar && (
              <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
                <p className="text-sm font-semibold text-red-700">Motivo da rejeição</p>
                <Textarea
                  value={motivoRejeicao}
                  onChange={e => setMotivoRejeicao(e.target.value)}
                  placeholder="Descreva o motivo da rejeição..."
                  rows={3} className="text-sm resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={handleRejeitar} disabled={!motivoRejeicao.trim() || salvando}>
                    {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ThumbsDown className="w-3.5 h-3.5" />}
                    Confirmar Rejeição
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowRejeitar(false)}>Cancelar</Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── ABA SUBTAREFAS ────────────────────────────────────────────── */}
          <TabsContent value="subtarefas" className="flex-1 overflow-y-auto px-6 py-5 m-0 space-y-4">
            {tarefa.subtarefas_total > 0 && (
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Progresso</span>
                  <span className="font-semibold">{tarefa.subtarefas_concluidas} / {tarefa.subtarefas_total}</span>
                </div>
                <Progress value={progressoSub} className="h-2" />
              </div>
            )}
            <div className="space-y-2">
              {tarefa.subtarefas.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 group">
                  <Checkbox
                    checked={sub.status === "concluida"}
                    onCheckedChange={v => toggleSubtarefa(sub.id, v ? "concluida" : "aberta")}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${sub.status === "concluida" ? "line-through text-slate-400" : "text-slate-700"}`}>
                      {sub.titulo}
                    </p>
                    {sub.responsavel && <p className="text-xs text-slate-400 mt-0.5">{sub.responsavel}</p>}
                  </div>
                  {podeEditar && (
                    <button onClick={() => removerSubtarefa(sub.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {tarefa.subtarefas.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nenhuma subtarefa adicionada</p>
              )}
            </div>
            {podeEditar && (
              <div className="flex gap-2">
                <Input
                  value={novaSubtarefa}
                  onChange={e => setNovaSubtarefa(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionarSubtarefa(); }}}
                  placeholder="Adicionar subtarefa..."
                  className="text-sm h-9"
                />
                <Button size="sm" onClick={adicionarSubtarefa} disabled={!novaSubtarefa.trim()} variant="outline" className="shrink-0 gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── ABA COMENTÁRIOS ───────────────────────────────────────────── */}
          <TabsContent value="comentarios" className="flex-1 flex flex-col overflow-hidden m-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {tarefa.comentarios.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum comentário ainda</p>
              )}
              {tarefa.comentarios.map(c => (
                <div key={c.id} className="flex gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    c.autor_tipo === "agente" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {c.autor_tipo === "agente" ? "AI" : c.autor.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-700">{c.autor}</span>
                      <span className="text-[11px] text-slate-400">{formatDataRelativa(c.timestamp)}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 border border-slate-100">
                      {c.texto}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-4 pt-2 border-t border-slate-100 bg-white">
              <div className="flex gap-2">
                <Textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviarComentario(); }}
                  placeholder="Adicionar comentário… (Ctrl+Enter para enviar)"
                  rows={2}
                  className="text-sm resize-none flex-1"
                />
                <Button onClick={enviarComentario} disabled={!comentario.trim()} size="sm" className="self-end gap-1 bg-primary hover:bg-primary/90">
                  <Send className="w-3.5 h-3.5" /> Enviar
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ── ABA HISTÓRICO ─────────────────────────────────────────────── */}
          <TabsContent value="historico" className="flex-1 overflow-y-auto px-6 py-4 m-0">
            {tarefa.historico.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">Sem histórico</p>
            )}
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-3 pl-8">
                {[...tarefa.historico].reverse().map((h, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[1.45rem] top-1.5 w-2 h-2 rounded-full bg-primary" />
                    <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-600">{h.campo}</span>
                        <span className="text-[11px] text-slate-400">{formatDataRelativa(h.em)}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        <span className="text-slate-700 font-medium">{h.por}</span> alterou
                        {h.de ? <> de <span className="font-medium text-slate-700">"{h.de}"</span></> : ""}
                        {" "}para <span className="font-medium text-slate-700">"{h.para}"</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ─ Footer ────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AcoesStatus />
          </div>
          <div className="flex items-center gap-2">
            {podeApagar && !confirmarDelete && (
              <button onClick={() => setConfirmarDelete(true)} className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                Excluir tarefa
              </button>
            )}
            {confirmarDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Excluir permanentemente?</span>
                <Button size="sm" variant="destructive" onClick={handleExcluir} disabled={salvando} className="h-7 text-xs px-2.5">
                  {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirmar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmarDelete(false)} className="h-7 text-xs px-2">Não</Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={onClose} className="h-8">Fechar</Button>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}

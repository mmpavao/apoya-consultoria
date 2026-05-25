import { useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { X, Send, Plus, ExternalLink, Clock, User, Bot } from "lucide-react";
import { Tarefa, TarefaStatus, useTarefas } from "@/hooks/use-tarefas";
import {
  BadgeStatus, BadgePrioridade, BadgeSLA, BadgeTipo, AvatarResponsavel,
  STATUS_LABEL, TODOS_RESPONSAVEIS, formatData, formatDataRelativa
} from "./tarefa-utils";

interface TarefaModalProps {
  tarefa: Tarefa | null;
  open: boolean;
  onClose: () => void;
  currentUser?: string;
  currentUserRole?: "admin" | "contador" | "cliente";
}

export function TarefaModal({ tarefa, open, onClose, currentUser = "Daniel Araújo", currentUserRole = "admin" }: TarefaModalProps) {
  const { atualizarTarefa, adicionarComentario } = useTarefas();
  const [activeTab, setActiveTab] = useState("detalhes");
  const [novoComentario, setNovoComentario] = useState("");
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [showRejeitar, setShowRejeitar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (!tarefa) return null;

  const isAprovador = tarefa.aprovador === currentUser || currentUserRole === "admin";
  const isCoo = currentUserRole === "admin";
  const temSubtarefasAbertas = tarefa.subtarefas.some(s => s.status === "aberta");
  const progressoSub = tarefa.subtarefas_total > 0 
    ? Math.round((tarefa.subtarefas_concluidas / tarefa.subtarefas_total) * 100) 
    : 0;

  async function mudarStatus(novo_status: TarefaStatus, extra?: Record<string, unknown>) {
    setSalvando(true);
    try {
      await atualizarTarefa(tarefa!.id, { status: novo_status, ...extra }, currentUser);
    } finally {
      setSalvando(false);
    }
  }

  async function handleEnviarComentario() {
    if (!novoComentario.trim()) return;
    await adicionarComentario(tarefa!.id, {
      autor: currentUser,
      autor_tipo: "humano",
      texto: novoComentario.trim(),
    });
    setNovoComentario("");
  }

  async function handleToggleSubtarefa(subId: string, novoStatus: "aberta" | "concluida") {
    const subs = tarefa.subtarefas.map(s => s.id === subId ? { ...s, status: novoStatus } : s);
    const concluidas = subs.filter(s => s.status === "concluida").length;
    await atualizarTarefa(tarefa.id, {
      subtarefas: subs,
      subtarefas_concluidas: concluidas,
    }, currentUser);
  }

  async function handleAprovar() {
    await mudarStatus("aprovada", {
      aprovado_em: new Date().toISOString(),
      aprovado_por: currentUser,
    });
  }

  async function handleRejeitar() {
    await mudarStatus("rejeitada", { motivo_rejeicao: motivoRejeicao });
    setShowRejeitar(false);
    setMotivoRejeicao("");
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <BadgeTipo tipo={tarefa.tipo} />
                <BadgeStatus status={tarefa.status} />
                <BadgePrioridade prioridade={tarefa.prioridade} />
                <BadgeSLA sla_status={tarefa.sla_status} data_prazo={tarefa.data_prazo} />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 truncate">{tarefa.titulo}</h2>
              {tarefa.cliente_nome && (
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> {tarefa.cliente_nome}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 pt-2 pb-0 border-b border-gray-100 bg-white rounded-none justify-start h-auto gap-0">
            {["detalhes","subtarefas","comentarios","historico"].map(tab => (
              <TabsTrigger key={tab} value={tab} className="rounded-t-md rounded-b-none border-b-2 border-transparent data-[state=active]:border-[#E8721C] data-[state=active]:text-[#E8721C] px-4 py-2 text-sm capitalize">
                {tab === "comentarios" ? `Comentários (${tarefa.comentarios.length})` :
                 tab === "subtarefas" ? `Subtarefas (${tarefa.subtarefas_concluidas}/${tarefa.subtarefas_total})` :
                 tab === "historico" ? "Histórico" : "Detalhes"}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Detalhes */}
          <TabsContent value="detalhes" className="flex-1 overflow-y-auto px-6 py-4 m-0">
            <div className="space-y-4">
              {tarefa.descricao && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Descrição</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">{tarefa.descricao}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Responsável" value={<AvatarResponsavel nome={tarefa.responsavel} tipo={tarefa.responsavel_tipo} />} />
                {tarefa.requer_aprovacao && tarefa.aprovador && (
                  <InfoRow label="Aprovador" value={<AvatarResponsavel nome={tarefa.aprovador} tipo={tarefa.aprovador_tipo ?? "humano"} />} />
                )}
                <InfoRow label="Criado por" value={<AvatarResponsavel nome={tarefa.criado_por} tipo={tarefa.criado_por_tipo} />} />
                <InfoRow label="Origem" value={tarefa.origem ?? "sistema"} />
                <InfoRow label="Aberta em" value={<><Clock className="w-3 h-3 inline mr-1" />{formatData(tarefa.created_at)}</>} />
                {tarefa.data_prazo && (
                  <InfoRow label="Prazo" value={formatData(tarefa.data_prazo)} />
                )}
                {tarefa.sla_horas && (
                  <InfoRow label="SLA" value={`${tarefa.sla_horas}h`} />
                )}
                {tarefa.concluida_em && (
                  <InfoRow label="Concluída em" value={formatData(tarefa.concluida_em)} />
                )}
              </div>
              {tarefa.motivo_rejeicao && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-medium text-red-600 mb-1">Motivo da Rejeição</p>
                  <p className="text-sm text-red-700">{tarefa.motivo_rejeicao}</p>
                </div>
              )}
              {tarefa.tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {tarefa.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Subtarefas */}
          <TabsContent value="subtarefas" className="flex-1 overflow-y-auto px-6 py-4 m-0">
            {tarefa.subtarefas_total > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progresso</span>
                  <span>{tarefa.subtarefas_concluidas} de {tarefa.subtarefas_total}</span>
                </div>
                <Progress value={progressoSub} className="h-2" />
              </div>
            )}
            <div className="space-y-2">
              {tarefa.subtarefas.map(sub => (
                <div key={sub.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Checkbox
                    checked={sub.status === "concluida"}
                    onCheckedChange={(checked) => handleToggleSubtarefa(sub.id, checked ? "concluida" : "aberta")}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${sub.status === "concluida" ? "line-through text-gray-400" : "text-gray-700"}`}>{sub.titulo}</p>
                    {sub.responsavel && <p className="text-xs text-gray-400">{sub.responsavel}</p>}
                  </div>
                  {sub.data_prazo && (
                    <span className="text-xs text-gray-400">{formatData(sub.data_prazo)}</span>
                  )}
                </div>
              ))}
              {tarefa.subtarefas.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma subtarefa adicionada</p>
              )}
            </div>
          </TabsContent>

          {/* Comentários */}
          <TabsContent value="comentarios" className="flex-1 flex flex-col overflow-hidden m-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {tarefa.comentarios.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum comentário ainda</p>
              )}
              {tarefa.comentarios.map(c => (
                <div key={c.id} className={`flex gap-3 ${c.autor_tipo === "agente" ? "opacity-90" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${c.autor_tipo === "agente" ? "bg-blue-100" : "bg-orange-100"}`}>
                    {c.autor_tipo === "agente" ? <Bot className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-orange-600" />}
                  </div>
                  <div className={`flex-1 rounded-lg px-3 py-2 text-sm ${c.autor_tipo === "agente" ? "bg-blue-50 border border-blue-100" : "bg-gray-50 border border-gray-100"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-700 text-xs">{c.autor}</span>
                      <span className="text-gray-400 text-xs">{formatDataRelativa(c.timestamp)}</span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{c.texto}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-white">
              <div className="flex gap-2">
                <Textarea
                  value={novoComentario}
                  onChange={e => setNovoComentario(e.target.value)}
                  placeholder="Adicionar comentário..."
                  className="min-h-[60px] text-sm resize-none"
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleEnviarComentario(); }}
                />
                <Button size="sm" onClick={handleEnviarComentario} className="self-end bg-[#E8721C] hover:bg-[#d4621a]">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico" className="flex-1 overflow-y-auto px-6 py-4 m-0">
            <div className="space-y-2">
              {tarefa.historico.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum histórico registrado</p>
              )}
              {[...tarefa.historico].reverse().map((h, i) => (
                <div key={i} className="flex gap-3 items-start text-sm">
                  <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-gray-700">
                      <strong>{h.por}</strong> alterou <em>{h.campo}</em>
                      {h.de && <> de <strong>"{h.de}"</strong></>}
                      {h.para && <> para <strong>"{h.para}"</strong></>}
                    </span>
                    <span className="text-gray-400 text-xs ml-2">{formatData(h.em)}</span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer — botões contextuais */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white">
          {showRejeitar ? (
            <div className="space-y-2">
              <Textarea
                value={motivoRejeicao}
                onChange={e => setMotivoRejeicao(e.target.value)}
                placeholder="Motivo da rejeição..."
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleRejeitar} disabled={!motivoRejeicao.trim()}>Confirmar Rejeição</Button>
                <Button size="sm" variant="outline" onClick={() => setShowRejeitar(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tarefa.status === "aberta" && (
                <>
                  <Button size="sm" onClick={() => mudarStatus("em_andamento")} disabled={salvando} className="bg-[#E8721C] hover:bg-[#d4621a]">▶ Iniciar</Button>
                  <Button size="sm" variant="outline" onClick={() => mudarStatus("cancelada")} disabled={salvando}>✕ Cancelar</Button>
                </>
              )}
              {tarefa.status === "em_andamento" && (
                <>
                  {tarefa.requer_aprovacao ? (
                    <Button size="sm" onClick={() => mudarStatus("aguardando_aprovacao")} disabled={salvando} className="bg-purple-600 hover:bg-purple-700 text-white">📋 Enviar para Aprovação</Button>
                  ) : (
                    <Button size="sm" onClick={() => mudarStatus("concluida")} disabled={salvando || temSubtarefasAbertas} title={temSubtarefasAbertas ? "Há subtarefas abertas" : undefined} className="bg-green-600 hover:bg-green-700 text-white">✓ Concluir</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => mudarStatus("bloqueada")} disabled={salvando}>⛔ Bloquear</Button>
                  <Button size="sm" variant="outline" onClick={() => mudarStatus("cancelada")} disabled={salvando}>✕ Cancelar</Button>
                </>
              )}
              {tarefa.status === "aguardando_aprovacao" && isAprovador && (
                <>
                  <Button size="sm" onClick={handleAprovar} disabled={salvando} className="bg-green-600 hover:bg-green-700 text-white">✓ Aprovar</Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowRejeitar(true)} disabled={salvando}>✕ Rejeitar</Button>
                </>
              )}
              {tarefa.status === "aprovada" && (
                <Button size="sm" onClick={() => mudarStatus("concluida")} disabled={salvando || temSubtarefasAbertas} className="bg-green-600 hover:bg-green-700 text-white">✓ Concluir</Button>
              )}
              {tarefa.status === "bloqueada" && (
                <Button size="sm" onClick={() => mudarStatus("em_andamento")} disabled={salvando}>↺ Retomar</Button>
              )}
              {(tarefa.status === "concluida" || tarefa.status === "cancelada") && (
                <p className="text-sm text-gray-400 italic">Tarefa encerrada — somente leitura</p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm text-gray-700">{value}</div>
    </div>
  );
}

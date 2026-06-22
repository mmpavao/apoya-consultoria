import { useState } from "react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch }   from "@/components/ui/switch";
import { X, Plus, Trash2, Loader2, Clock } from "lucide-react";
import { useTarefas, TarefaTipo, TarefaPrioridade, calcularSlaHoras } from "@/hooks/use-tarefas";
import { useResponsaveis } from "@/hooks/use-responsaveis";
import { TIPO_LABEL, PRIORIDADE_LABEL, PRIORIDADE_EMOJI, TIPO_DOT } from "./tarefa-utils";
import { useClientes } from "@/hooks/use-clientes";
import { toast } from "sonner";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  clienteIdPre?: string;
  currentUser?: string;
}

interface SubForm { titulo: string; responsavel: string; }

const EMPTY_FORM = {
  titulo: "", descricao: "", tipo: "interno" as TarefaTipo,
  prioridade: "media" as TarefaPrioridade,
  responsavel: "", clienteId: "", dataPrazo: "",
  requerAprovacao: false, aprovador: "",
  tags: "", subtarefas: [] as SubForm[],
};

export function NovaTarefaForm({ open, onClose, clienteIdPre, currentUser = "Daniel Araújo" }: Props) {
  const { criarTarefa } = useTarefas();
  const { clientes }    = useClientes();
  const { responsaveis } = useResponsaveis();
  const [salvando, setSalvando] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM, clienteId: clienteIdPre ?? "" });

  const set = (k: keyof typeof EMPTY_FORM, v: unknown) => setForm(p => ({ ...p, [k]: v }));
  const tagsArr     = form.tags.split(",").map(t => t.trim()).filter(Boolean);
  const slaCalc     = calcularSlaHoras(form.tipo, tagsArr);
  const clienteSel  = clientes?.find(c => c.id === form.clienteId);

  function addSub()              { set("subtarefas", [...form.subtarefas, { titulo: "", responsavel: "" }]); }
  function removeSub(i: number)  { set("subtarefas", form.subtarefas.filter((_, idx) => idx !== i)); }
  function updateSub(i: number, k: keyof SubForm, v: string) {
    const next = [...form.subtarefas];
    next[i] = { ...next[i], [k]: v };
    set("subtarefas", next);
  }

  function reset() { setForm({ ...EMPTY_FORM, clienteId: clienteIdPre ?? "" }); }

  async function handleSubmit() {
    if (!form.titulo.trim())             { toast.error("Título é obrigatório");         return; }
    if (!form.responsavel)               { toast.error("Responsável é obrigatório");    return; }
    if (form.requerAprovacao && !form.aprovador) { toast.error("Selecione um aprovador"); return; }

    setSalvando(true);
    try {
      const subs = form.subtarefas
        .filter(s => s.titulo.trim())
        .map(s => ({ id: crypto.randomUUID(), titulo: s.titulo.trim(), responsavel: s.responsavel || form.responsavel, status: "aberta" as const }));

      await criarTarefa({
        titulo:           form.titulo.trim(),
        descricao:        form.descricao.trim() || undefined,
        tipo:             form.tipo,
        status:           "aberta",
        prioridade:       form.prioridade,
        responsavel:      form.responsavel,
        responsavel_tipo: "humano",
        criado_por:       currentUser,
        criado_por_tipo:  "humano",
        cliente_id:       form.clienteId || undefined,
        cliente_nome:     clienteSel?.razaoSocial,
        data_prazo:       form.dataPrazo ? new Date(form.dataPrazo).toISOString() : undefined,
        requer_aprovacao: form.requerAprovacao,
        aprovador:        form.requerAprovacao ? form.aprovador || undefined : undefined,
        aprovador_tipo:   form.requerAprovacao ? "humano" : undefined,
        tags:             tagsArr,
        subtarefas:       subs,
        subtarefas_total: subs.length,
        subtarefas_concluidas: 0,
        origem:           "manual",
      });
      toast.success("Tarefa criada com sucesso!");
      reset();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar tarefa");
    } finally {
      setSalvando(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) { reset(); onClose(); } }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { reset(); onClose(); }} />
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Nova Tarefa</h2>
            <p className="text-sm text-slate-400 mt-0.5">Preencha os dados da tarefa</p>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Título */}
          <div>
            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">
              Título <span className="text-red-400">*</span>
            </Label>
            <Input
              value={form.titulo}
              onChange={e => set("titulo", e.target.value)}
              placeholder="Ex: Apurar DAS — João Silva — Jan/2026"
              className="text-sm"
              autoFocus
            />
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Descrição</Label>
            <Textarea
              value={form.descricao}
              onChange={e => set("descricao", e.target.value)}
              placeholder="Descreva o que precisa ser feito, contexto, documentos necessários..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Tipo + Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Tipo <span className="text-red-400">*</span>
              </Label>
              <Select value={form.tipo} onValueChange={v => set("tipo", v as TarefaTipo)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_LABEL) as TarefaTipo[]).map(t => (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${TIPO_DOT[t]}`} />
                        {TIPO_LABEL[t]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => set("prioridade", v as TarefaPrioridade)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["critica","alta","media","baixa"] as TarefaPrioridade[]).map(p => (
                    <SelectItem key={p} value={p}>{PRIORIDADE_EMOJI[p]} {PRIORIDADE_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Responsável + Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Responsável <span className="text-red-400">*</span>
              </Label>
              <Select value={form.responsavel} onValueChange={v => set("responsavel", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {responsaveis.map(r => <SelectItem key={r.nome} value={r.nome}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Cliente</Label>
              <Select value={form.clienteId || "none"} onValueChange={v => set("clienteId", v === "none" ? "" : v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Tarefa interna —</SelectItem>
                  {(clientes ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Prazo + SLA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Prazo</Label>
              <Input type="datetime-local" value={form.dataPrazo} onChange={e => set("dataPrazo", e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">SLA Calculado</Label>
              <div className="h-9 flex items-center gap-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-primary">{slaCalc}h</span>
                <span className="text-slate-400 text-xs">({TIPO_LABEL[form.tipo]})</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">Tags</Label>
            <Input
              value={form.tags}
              onChange={e => set("tags", e.target.value)}
              placeholder="urgente, mei, pgdas, novo_cliente..."
              className="text-sm h-9"
            />
            {tagsArr.includes("urgente") && form.tipo === "fiscal" && (
              <p className="text-xs text-amber-600 mt-1">⚡ Fiscal urgente: SLA reduzido para 4h</p>
            )}
          </div>

          {/* Requer Aprovação */}
          <div className="flex items-center gap-4 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-700">Requer Aprovação</p>
              <p className="text-xs text-slate-400">Ficará em "Aguardando Aprovação" antes de concluir</p>
            </div>
            <Switch checked={form.requerAprovacao} onCheckedChange={v => set("requerAprovacao", v)} />
          </div>

          {form.requerAprovacao && (
            <div>
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Quem Aprova <span className="text-red-400">*</span>
              </Label>
              <Select value={form.aprovador} onValueChange={v => set("aprovador", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar aprovador..." /></SelectTrigger>
                <SelectContent>
                  {responsaveis.map(r => <SelectItem key={r.nome} value={r.nome}>{r.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subtarefas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Subtarefas</Label>
              <button onClick={addSub} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
            {form.subtarefas.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Nenhuma subtarefa. Clique em "Adicionar" para criar.
              </p>
            )}
            <div className="space-y-2">
              {form.subtarefas.map((sub, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={sub.titulo}
                    onChange={e => updateSub(i, "titulo", e.target.value)}
                    placeholder={`Subtarefa ${i + 1}...`}
                    className="text-sm h-8 flex-1"
                  />
                  <Select value={sub.responsavel || "default"} onValueChange={v => updateSub(i, "responsavel", v === "default" ? "" : v)}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Resp." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">— Mesmo —</SelectItem>
                      {responsaveis.map(r => <SelectItem key={r.nome} value={r.nome} className="text-xs">{r.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button onClick={() => removeSub(i)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-400">
            Criado por <span className="font-medium text-slate-600">{currentUser}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }} disabled={salvando} className="h-9">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={salvando || !form.titulo.trim() || !form.responsavel}
              className="h-9 bg-primary hover:bg-primary/90 text-white gap-1.5 px-5"
            >
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {salvando ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  , document.body);
}

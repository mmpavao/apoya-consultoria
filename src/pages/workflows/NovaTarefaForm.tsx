import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";
import { useTarefas, calcularSlaHoras, TarefaTipo, TarefaPrioridade } from "@/hooks/use-tarefas";
import { TODOS_RESPONSAVEIS, TIPO_LABEL, PRIORIDADE_LABEL } from "./tarefa-utils";
import { useClientes } from "@/hooks/use-clientes";

interface NovaTarefaFormProps {
  open: boolean;
  onClose: () => void;
  currentUser?: string;
}

interface SubtarefaForm { titulo: string; responsavel: string; }

export function NovaTarefaForm({ open, onClose, currentUser = "Daniel Araújo" }: NovaTarefaFormProps) {
  const { criarTarefa } = useTarefas();
  const { clientes } = useClientes();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<TarefaTipo>("interno");
  const [responsavel, setResponsavel] = useState("");
  const [responsavelTipo, setResponsavelTipo] = useState<"agente" | "humano">("agente");
  const [clienteId, setClienteId] = useState("");
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>("media");
  const [dataPrazo, setDataPrazo] = useState("");
  const [requerAprovacao, setRequerAprovacao] = useState(false);
  const [aprovador, setAprovador] = useState("");
  const [aprovadorTipo, setAprovadorTipo] = useState<"agente" | "humano">("humano");
  const [descricao, setDescricao] = useState("");
  const [tags, setTags] = useState("");
  const [subtarefas, setSubtarefas] = useState<SubtarefaForm[]>([]);

  const slaCalculado = calcularSlaHoras(tipo, tags.split(",").map(t => t.trim()).filter(Boolean));
  const clienteSelecionado = clientes?.find(c => c.id === clienteId);

  function handleResponsavelChange(nome: string) {
    setResponsavel(nome);
    const r = TODOS_RESPONSAVEIS.find(r => r.nome === nome);
    if (r) setResponsavelTipo(r.tipo);
  }

  function handleAprovadorChange(nome: string) {
    setAprovador(nome);
    const r = TODOS_RESPONSAVEIS.find(r => r.nome === nome);
    if (r) setAprovadorTipo(r.tipo);
  }

  function addSubtarefa() {
    setSubtarefas(prev => [...prev, { titulo: "", responsavel: "" }]);
  }

  function removeSubtarefa(i: number) {
    setSubtarefas(prev => prev.filter((_, idx) => idx !== i));
  }

  function reset() {
    setTitulo(""); setTipo("interno"); setResponsavel(""); setClienteId("");
    setPrioridade("media"); setDataPrazo(""); setRequerAprovacao(false);
    setAprovador(""); setDescricao(""); setTags(""); setSubtarefas([]);
    setErro(null);
  }

  async function handleSubmit() {
    if (!titulo.trim()) { setErro("Título é obrigatório"); return; }
    if (!tipo) { setErro("Tipo é obrigatório"); return; }
    if (!responsavel) { setErro("Responsável é obrigatório"); return; }
    if (requerAprovacao && !aprovador) { setErro("Selecione um aprovador"); return; }

    setSalvando(true);
    setErro(null);
    try {
      const tagsArr = tags.split(",").map(t => t.trim()).filter(Boolean);
      const subsFormatadas = subtarefas
        .filter(s => s.titulo.trim())
        .map(s => ({
          id: crypto.randomUUID(),
          titulo: s.titulo.trim(),
          responsavel: s.responsavel || responsavel,
          status: "aberta" as const,
        }));

      await criarTarefa({
        titulo: titulo.trim(),
        tipo,
        status: "aberta",
        prioridade,
        responsavel,
        responsavel_tipo: responsavelTipo,
        criado_por: currentUser,
        criado_por_tipo: "humano",
        cliente_id: clienteId || undefined,
        cliente_nome: clienteSelecionado?.razaoSocial,
        data_prazo: dataPrazo ? new Date(dataPrazo).toISOString() : undefined,
        requer_aprovacao: requerAprovacao,
        aprovador: requerAprovacao ? aprovador : undefined,
        aprovador_tipo: requerAprovacao ? aprovadorTipo : undefined,
        descricao: descricao || undefined,
        tags: tagsArr,
        subtarefas: subsFormatadas,
        subtarefas_total: subsFormatadas.length,
        subtarefas_concluidas: 0,
        origem: "sistema",
      });
      reset();
      onClose();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao criar tarefa");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Título */}
          <div>
            <Label htmlFor="titulo" className="text-sm font-medium">Título <span className="text-red-500">*</span></Label>
            <Input id="titulo" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Apurar DAS cliente João Silva — Jan/2026" className="mt-1" />
          </div>

          {/* Tipo + Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Tipo <span className="text-red-500">*</span></Label>
              <Select value={tipo} onValueChange={v => setTipo(v as TarefaTipo)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_LABEL) as TarefaTipo[]).map(t => (
                    <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Prioridade</Label>
              <Select value={prioridade} onValueChange={v => setPrioridade(v as TarefaPrioridade)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["critica","alta","media","baixa"] as TarefaPrioridade[]).map(p => (
                    <SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Responsável */}
          <div>
            <Label className="text-sm font-medium">Responsável <span className="text-red-500">*</span></Label>
            <Select value={responsavel} onValueChange={handleResponsavelChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar responsável..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase">Agentes IA</div>
                {TODOS_RESPONSAVEIS.filter(r => r.tipo === "agente").map(r => (
                  <SelectItem key={r.nome} value={r.nome}>🤖 {r.nome}</SelectItem>
                ))}
                <div className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase mt-1">Humanos</div>
                {TODOS_RESPONSAVEIS.filter(r => r.tipo === "humano").map(r => (
                  <SelectItem key={r.nome} value={r.nome}>👤 {r.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cliente */}
          <div>
            <Label className="text-sm font-medium">Cliente</Label>
            <Select value={clienteId || "none"} onValueChange={v => setClienteId(v === "none" ? "" : v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Nenhum (tarefa interna)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhum —</SelectItem>
                {(clientes ?? []).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prazo + SLA */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Data Prazo</Label>
              <Input type="datetime-local" value={dataPrazo} onChange={e => setDataPrazo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm font-medium">SLA Automático</Label>
              <div className="mt-1 h-9 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                ⏱ {slaCalculado}h ({tipo === "dp" ? "urgência DP" : tipo === "comercial" || tipo === "atendimento" ? "48h padrão" : tipo === "fiscal" && tags.includes("urgente") ? "urgente!" : "padrão"})
              </div>
            </div>
          </div>

          {/* Requer Aprovação */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">Requer Aprovação?</p>
              <p className="text-xs text-gray-400">A tarefa ficará em "Aguardando Aprovação" antes de ser concluída</p>
            </div>
            <Switch checked={requerAprovacao} onCheckedChange={setRequerAprovacao} />
          </div>

          {requerAprovacao && (
            <div>
              <Label className="text-sm font-medium">Quem Aprova? <span className="text-red-500">*</span></Label>
              <Select value={aprovador} onValueChange={handleAprovadorChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecionar aprovador..." />
                </SelectTrigger>
                <SelectContent>
                  {TODOS_RESPONSAVEIS.map(r => (
                    <SelectItem key={r.nome} value={r.nome}>{r.tipo === "agente" ? "🤖" : "👤"} {r.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Descrição */}
          <div>
            <Label className="text-sm font-medium">Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhe o que precisa ser feito..." className="mt-1 min-h-[80px]" />
          </div>

          {/* Tags */}
          <div>
            <Label className="text-sm font-medium">Tags</Label>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="urgente, mensal, das (separado por vírgula)" className="mt-1" />
          </div>

          {/* Subtarefas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Subtarefas</Label>
              <Button type="button" size="sm" variant="outline" onClick={addSubtarefa} className="h-7 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {subtarefas.map((sub, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={sub.titulo} onChange={e => setSubtarefas(p => p.map((s, j) => j === i ? { ...s, titulo: e.target.value } : s))} placeholder={`Subtarefa ${i + 1}`} className="flex-1 text-sm h-8" />
                  <Input value={sub.responsavel} onChange={e => setSubtarefas(p => p.map((s, j) => j === i ? { ...s, responsavel: e.target.value } : s))} placeholder="Responsável" className="w-32 text-sm h-8" />
                  <button onClick={() => removeSubtarefa(i)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {erro && <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} disabled={salvando} className="flex-1 bg-[#E8721C] hover:bg-[#d4621a]">
              {salvando ? "Criando..." : "Criar Tarefa"}
            </Button>
            <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * PipelineKanban — componente genérico config-driven
 * Sprint B — adicionado: botão "+ Nova Tarefa" por coluna, dialog de criação
 */
import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useClientes } from "@/hooks/use-clientes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Clock, AlertTriangle, CheckCircle2, Loader2,
  Calendar, User, Plus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TarefaKanban {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  prioridade: "critica" | "alta" | "media" | "baixa";
  sla_calculado?: string;
  data_prazo?: string;
  responsavel?: string;
  cliente_nome?: string;
  created_at: string;
  etapa_pipeline?: string;
}

interface EtapaKanban {
  etapa_key: string;
  etapa_label: string;
  ordem: number;
  requer_aprovacao: boolean;
  sla_horas?: number;
  total: number;
  atrasadas: number;
  tarefas: TarefaKanban[];
}

interface KanbanData {
  setor: string;
  pipeline_nome: string;
  total_tarefas: number;
  etapas: EtapaKanban[];
  sem_etapa?: TarefaKanban[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SLA_COLORS: Record<string, string> = {
  atrasado: "bg-red-100 text-red-700 border-red-200",
  critico:  "bg-orange-100 text-orange-700 border-orange-200",
  atencao:  "bg-yellow-100 text-yellow-700 border-yellow-200",
  no_prazo: "bg-green-100 text-green-700 border-green-200",
};
const SLA_ICONS: Record<string, React.ElementType> = {
  atrasado: AlertTriangle, critico: AlertTriangle, atencao: Clock, no_prazo: CheckCircle2,
};
const PRIORIDADE_COLORS: Record<string, string> = {
  critica: "bg-red-500", alta: "bg-orange-400", media: "bg-yellow-400", baixa: "bg-blue-400",
};

function SlaTag({ status }: { status?: string }) {
  if (!status || status === "no_prazo") return null;
  const cls = SLA_COLORS[status] ?? SLA_COLORS.no_prazo;
  const Icon = SLA_ICONS[status] ?? Clock;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", cls)}>
      <Icon className="h-2.5 w-2.5" />
      {status === "atrasado" ? "Atrasada" : status === "critico" ? "Crítico" : "Atenção"}
    </span>
  );
}

function PrioridadeDot({ prioridade }: { prioridade: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", PRIORIDADE_COLORS[prioridade] ?? "bg-gray-400")} title={"Prioridade: " + prioridade} />;
}

// ── TarefaCard ────────────────────────────────────────────────────────────────

function TarefaCard({ tarefa, dragging, onDragStart, onDragEnd }: {
  tarefa: TarefaKanban; dragging: boolean;
  onDragStart: (id: string) => void; onDragEnd: () => void;
}) {
  const prazoStr = tarefa.data_prazo
    ? new Date(tarefa.data_prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;
  return (
    <div
      draggable onDragStart={() => onDragStart(tarefa.id)} onDragEnd={onDragEnd}
      className={cn(
        "group cursor-grab active:cursor-grabbing rounded-lg border bg-white p-3 shadow-sm",
        "transition-all duration-150 hover:shadow-md hover:border-primary/30",
        dragging && "opacity-40 scale-95 ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <PrioridadeDot prioridade={tarefa.prioridade} />
        <p className="text-sm font-medium text-foreground leading-tight flex-1">{tarefa.titulo}</p>
      </div>
      {tarefa.cliente_nome && <p className="text-xs text-muted-foreground mb-2 truncate">{tarefa.cliente_nome}</p>}
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <SlaTag status={tarefa.sla_calculado} />
        {prazoStr && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Calendar className="h-2.5 w-2.5" />{prazoStr}
          </span>
        )}
        {tarefa.responsavel && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground ml-auto">
            <User className="h-2.5 w-2.5" />{tarefa.responsavel.split("@")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// ── NovaTarefaDialog ──────────────────────────────────────────────────────────

function NovaTarefaDialog({ etapa, setor, onClose, onCreated }: {
  etapa: EtapaKanban; setor: string; onClose: () => void; onCreated: () => void;
}) {
  const { clientes } = useClientes();
  const [titulo, setTitulo]           = useState("");
  const [clienteId, setClienteId]     = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [prioridade, setPrioridade]   = useState("media");
  const [prazo, setPrazo]             = useState("");
  const [descricao, setDescricao]     = useState("");
  const [salvando, setSalvando]       = useState(false);

  async function salvar() {
    if (!titulo.trim()) { toast.error("Título obrigatório"); return; }
    setSalvando(true);
    try {
      const { error } = await (supabase as any).from("tarefas").insert({
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        setor,
        etapa_pipeline: etapa.etapa_key,
        prioridade,
        data_prazo: prazo || null,
        cliente_id: clienteId || null,
        cliente_nome: clienteNome || null,
        responsavel_tipo: "humano",
        origem: "manual",
        status: "aberta",
        tipo: "manual",
      });
      if (error) throw error;
      toast.success("Tarefa criada!");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error("Erro ao criar tarefa: " + (e?.message ?? "Desconhecido"));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Nova Tarefa</p>
            <p className="text-xs text-muted-foreground mt-0.5">Coluna: <span className="font-medium text-foreground">{etapa.etapa_label}</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Título <span className="text-red-500">*</span></label>
            <Input placeholder="Descreva a tarefa…" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9 text-sm" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Cliente</label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={clienteId}
              onChange={(e) => {
                setClienteId(e.target.value);
                const c = clientes.find((x: any) => x.id === e.target.value);
                setClienteNome(c ? (c.nomeFantasia || c.razaoSocial || "") : "");
              }}
            >
              <option value="">Nenhum</option>
              {clientes.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Prioridade</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value)}
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Prazo</label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Descrição</label>
            <textarea
              placeholder="Detalhes adicionais…"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button size="sm" onClick={salvar} disabled={salvando} className="gap-1.5">
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Criar Tarefa
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── KanbanColuna ──────────────────────────────────────────────────────────────

function KanbanColuna({ etapa, setor, isDragOver, draggingId, podeAprovar, movendo,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onAprovar, onNovaTarefa }: {
  etapa: EtapaKanban; setor: string; isDragOver: boolean; draggingId: string | null;
  podeAprovar: boolean; movendo: boolean;
  onDragStart: (id: string) => void; onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, key: string) => void; onDragLeave: () => void;
  onDrop: (etapaKey: string) => void; onAprovar?: (etapaKey: string) => void;
  onNovaTarefa: (etapa: EtapaKanban) => void;
}) {
  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px] flex-shrink-0">
      <div className={cn(
        "rounded-t-xl px-3 py-2 flex items-center justify-between",
        etapa.requer_aprovacao ? "bg-amber-50 border border-amber-200" : "bg-muted/60 border border-border",
      )}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold truncate text-foreground">{etapa.etapa_label}</span>
          {etapa.requer_aprovacao && (
            <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 px-1.5 py-0 shrink-0">Aprovação</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {etapa.atrasadas > 0 && (
            <span className="inline-flex items-center justify-center h-4 min-w-[16px] rounded-full bg-red-100 text-red-600 text-[10px] font-bold px-1">{etapa.atrasadas}⚠</span>
          )}
          <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary/10 text-primary text-xs font-bold px-1.5">{etapa.total}</span>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 min-h-[200px] border border-t-0 p-2 flex flex-col gap-2 transition-colors",
          isDragOver ? "bg-primary/5 border-primary/40" : "bg-muted/20 border-border",
          movendo && "opacity-60 pointer-events-none",
        )}
        onDragOver={(e) => onDragOver(e, etapa.etapa_key)}
        onDragLeave={onDragLeave}
        onDrop={() => onDrop(etapa.etapa_key)}
      >
        {etapa.tarefas.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground/60 text-center">Nenhuma tarefa</p>
          </div>
        )}
        {etapa.tarefas.map((t) => (
          <TarefaCard key={t.id} tarefa={t} dragging={draggingId === t.id} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        ))}
      </div>

      <div className="rounded-b-xl border border-t-0 border-border px-2 py-1.5 flex flex-col gap-1 bg-muted/10">
        <button
          onClick={() => onNovaTarefa(etapa)}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Nova Tarefa
        </button>
        {etapa.requer_aprovacao && podeAprovar && etapa.total > 0 && (
          <Button variant="outline" size="sm" className="w-full text-xs border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => onAprovar?.(etapa.etapa_key)}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar todas ({etapa.total})
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────────

export function PipelineKanban({ setor, podeAprovar = false }: { setor: string; podeAprovar?: boolean; }) {
  const [kanban, setKanban]               = useState<KanbanData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [draggingId, setDraggingId]       = useState<string | null>(null);
  const [dragOver, setDragOver]           = useState<string | null>(null);
  const [movendo, setMovendo]             = useState(false);
  const [novaTaskEtapa, setNovaTaskEtapa] = useState<EtapaKanban | null>(null);

  const carregarKanban = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão não iniciada");
      const res  = await fetch("/api/pipeline?setor=" + setor, { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar pipeline");
      setKanban(data as KanbanData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado");
    } finally { setLoading(false); }
  }, [setor]);

  useEffect(() => { carregarKanban(); }, [carregarKanban]);

  const handleDragStart = (id: string) => setDraggingId(id);
  const handleDragEnd   = () => { setDraggingId(null); setDragOver(null); };
  const handleDragOver  = (e: React.DragEvent, key: string) => { e.preventDefault(); setDragOver(key); };
  const handleDragLeave = () => setDragOver(null);

  const handleDrop = async (etapaDestino: string) => {
    setDragOver(null);
    if (!draggingId) return;
    const tarefaId = draggingId;
    setDraggingId(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      setMovendo(true);
      const res = await fetch("/api/pipeline/mover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ tarefa_id: tarefaId, etapa_destino: etapaDestino }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "REQUER_APROVACAO") toast.warning("Esta etapa requer aprovação humana.");
        else toast.error("Erro ao mover: " + (data.error ?? "Erro desconhecido"));
        return;
      }
      await carregarKanban();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao mover tarefa");
    } finally { setMovendo(false); }
  };

  // Aprovar todas as tarefas de uma etapa = avançá-las para a próxima etapa.
  // Usa o endpoint real /api/pipeline/mover e reporta o resultado honesto.
  const handleAprovarTodas = async (etapaKey: string) => {
    if (!kanban) return;
    const etapa = kanban.etapas.find(e => e.etapa_key === etapaKey);
    if (!etapa || etapa.tarefas.length === 0) return;
    const proxima = kanban.etapas
      .filter(e => e.ordem > etapa.ordem)
      .sort((a, b) => a.ordem - b.ordem)[0];
    if (!proxima) { toast.info("Não há etapa seguinte para avançar."); return; }
    if (!confirm(`Aprovar e avançar ${etapa.tarefas.length} tarefa(s) de "${etapa.etapa_label}" para "${proxima.etapa_label}"?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      setMovendo(true);
      let okN = 0, bloqueadas = 0;
      for (const t of etapa.tarefas) {
        const res = await fetch("/api/pipeline/mover", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ tarefa_id: t.id, etapa_destino: proxima.etapa_key, motivo: "Aprovação em lote" }),
        });
        if (res.ok) okN++; else bloqueadas++;
      }
      if (okN)         toast.success(`${okN} tarefa(s) aprovada(s) e avançada(s)`);
      if (bloqueadas)  toast.warning(`${bloqueadas} tarefa(s) não puderam ser avançadas`);
      await carregarKanban();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao aprovar em lote");
    } finally { setMovendo(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="ml-2 text-sm text-muted-foreground">Carregando pipeline...</span>
    </div>
  );

  if (error) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <AlertTriangle className="inline h-4 w-4 mr-1.5" />{error}
      <Button variant="ghost" size="sm" className="ml-3" onClick={carregarKanban}>Tentar novamente</Button>
    </div>
  );

  if (!kanban) return null;

  return (
    <>
      {novaTaskEtapa && (
        <NovaTarefaDialog
          etapa={novaTaskEtapa}
          setor={setor}
          onClose={() => setNovaTaskEtapa(null)}
          onCreated={carregarKanban}
        />
      )}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{kanban.pipeline_nome}</h3>
            <Badge variant="secondary" className="text-xs">{kanban.total_tarefas} tarefa{kanban.total_tarefas !== 1 ? "s" : ""}</Badge>
            {movendo && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Movendo...</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
              onClick={() => { if (kanban.etapas.length > 0) setNovaTaskEtapa(kanban.etapas[0]); }}>
              <Plus className="h-3.5 w-3.5" /> Nova Tarefa
            </Button>
            <Button variant="ghost" size="sm" onClick={carregarKanban} className="text-xs h-7">Atualizar</Button>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[300px]">
          {kanban.etapas.map((etapa) => (
            <KanbanColuna
              key={etapa.etapa_key}
              etapa={etapa}
              setor={setor}
              isDragOver={dragOver === etapa.etapa_key}
              draggingId={draggingId}
              podeAprovar={podeAprovar}
              movendo={movendo}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onAprovar={handleAprovarTodas}
              onNovaTarefa={setNovaTaskEtapa}
            />
          ))}
          {kanban.sem_etapa && kanban.sem_etapa.length > 0 && (
            <div className="flex flex-col min-w-[240px] max-w-[280px] flex-shrink-0">
              <div className="rounded-t-xl px-3 py-2 bg-muted/60 border border-border flex items-center justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Sem Etapa</span>
                <span className="text-xs font-bold text-muted-foreground">{kanban.sem_etapa.length}</span>
              </div>
              <div className="flex-1 rounded-b-xl border border-t-0 border-border bg-muted/20 p-2 flex flex-col gap-2">
                {kanban.sem_etapa.map((t) => (
                  <TarefaCard key={t.id} tarefa={t} dragging={draggingId === t.id} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

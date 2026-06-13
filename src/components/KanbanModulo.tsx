/**
 * KanbanModulo — Kanban estilo Societário para qualquer módulo
 * Usa a tabela "tarefas" com setor + etapa_pipeline
 * Inclui: botão "+ Novo", kanban colorido por fase, toggle kanban/lista
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, LayoutGrid, List, Search, AlertTriangle, Loader2, Calendar, User, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useClientes } from "@/hooks/use-clientes";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FaseConfig {
  key: string;
  label: string;
  cor: { border: string; bg: string; header: string; dot: string };
}

export interface CampoForm {
  key: string;
  label: string;
  tipo: "text" | "select" | "date" | "textarea";
  placeholder?: string;
  opcoes?: { value: string; label: string }[];
  obrigatorio?: boolean;
}

export interface KanbanModuloProps {
  setor: string;
  titulo: string;
  subtitulo?: string;
  fases: FaseConfig[];
  camposForm: CampoForm[];
  tipoLabel?: Record<string, string>;
  prioridadeLabel?: Record<string, string>;
  prioridadeCor?: Record<string, string>;
}

interface TarefaKanban {
  id: string;
  titulo: string;
  cliente_nome?: string;
  prioridade: string;
  tipo?: string;
  data_prazo?: string;
  responsavel?: string;
  status: string;
  etapa_pipeline?: string;
  created_at?: string;
}

const PRIORIDADE_DOT: Record<string, string> = {
  critica: "bg-red-500", alta: "bg-orange-400", media: "bg-yellow-400", baixa: "bg-blue-400",
};

const fmtData = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

// ── Card ──────────────────────────────────────────────────────────────────────

function TarefaCard({
  tarefa, hoje, onClick, onMover, fases,
}: {
  tarefa: TarefaKanban; hoje: string;
  onClick: () => void;
  onMover: (id: string, fase: string) => void;
  fases: FaseConfig[];
}) {
  const [showMenu, setShowMenu] = useState(false);
  const vencido = tarefa.data_prazo && tarefa.data_prazo < hoje && tarefa.etapa_pipeline !== fases[fases.length - 1]?.key;

  return (
    <div
      className="rounded-xl border bg-white shadow-sm hover:shadow-md transition-all cursor-pointer p-3.5 space-y-2.5 group relative"
      onClick={onClick}
    >
      {/* Linha 1: nome + prioridade */}
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", PRIORIDADE_DOT[tarefa.prioridade] ?? "bg-gray-300")} />
        <p className="text-sm font-semibold text-foreground leading-snug flex-1">{tarefa.titulo}</p>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Tipo */}
      {tarefa.tipo && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{tarefa.tipo}</Badge>
      )}

      {/* Responsável */}
      {tarefa.responsavel && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <User className="h-3 w-3" />{tarefa.responsavel}
        </p>
      )}

      {/* Prazo */}
      {tarefa.data_prazo && (
        <p className={cn("text-xs flex items-center gap-1", vencido ? "text-rose-600 font-semibold" : "text-muted-foreground")}>
          <Calendar className="h-3 w-3" />
          {vencido && "Vencido há "}{fmtData(tarefa.data_prazo)}
        </p>
      )}

      {/* Menu mover */}
      {showMenu && (
        <div
          className="absolute right-2 top-8 z-20 bg-white rounded-lg border shadow-lg p-1 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-muted-foreground px-2 py-1 font-semibold uppercase tracking-wide">Mover para</p>
          {fases.filter(f => f.key !== tarefa.etapa_pipeline).map(f => (
            <button
              key={f.key}
              className="w-full text-left text-xs px-2 py-1.5 hover:bg-muted rounded transition-colors"
              onClick={() => { onMover(tarefa.id, f.key); setShowMenu(false); }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nova Tarefa Dialog ────────────────────────────────────────────────────────

function NovaTarefaDialog({
  setor, fases, camposForm, onClose, onCreated,
}: {
  setor: string; fases: FaseConfig[]; camposForm: CampoForm[];
  onClose: () => void; onCreated: () => void;
}) {
  const { clientes } = useClientes();
  const [fase, setFase] = useState(fases[0]?.key ?? "");
  const [prioridade, setPrioridade] = useState("media");
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [prazo, setPrazo] = useState("");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  const titulo = campos["titulo"] ?? campos[camposForm[0]?.key] ?? "";

  async function salvar() {
    if (!titulo.trim()) { toast.error("Campo obrigatório"); return; }
    setSalvando(true);
    try {
      const { error } = await (supabase as any).from("tarefas").insert({
        titulo: titulo.trim(),
        setor,
        etapa_pipeline: fase,
        prioridade,
        data_prazo: prazo || null,
        cliente_id: clienteId || null,
        cliente_nome: clienteNome || null,
        tipo: campos["tipo"] || null,
        responsavel: campos["responsavel"] || null,
        descricao: campos["descricao"] || null,
        responsavel_tipo: "humano",
        origem: "manual",
        status: "aberta",
      });
      if (error) throw error;
      toast.success("Criado com sucesso!");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally { setSalvando(false); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-border overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <p className="font-semibold text-foreground">Novo Processo</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Fase */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">Fase inicial</label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={fase} onChange={e => setFase(e.target.value)}>
              {fases.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>

          {/* Campos customizados */}
          {camposForm.map(campo => (
            <div key={campo.key}>
              <label className="text-xs font-medium mb-1.5 block">
                {campo.label} {campo.obrigatorio && <span className="text-red-500">*</span>}
              </label>
              {campo.tipo === "text" && (
                <Input className="h-9 text-sm" placeholder={campo.placeholder} value={campos[campo.key] ?? ""} onChange={e => setCampos(c => ({ ...c, [campo.key]: e.target.value }))} />
              )}
              {campo.tipo === "select" && (
                <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={campos[campo.key] ?? ""} onChange={e => setCampos(c => ({ ...c, [campo.key]: e.target.value }))}>
                  <option value="">Selecionar...</option>
                  {campo.opcoes?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {campo.tipo === "date" && (
                <Input type="date" className="h-9 text-sm" value={campos[campo.key] ?? ""} onChange={e => setCampos(c => ({ ...c, [campo.key]: e.target.value }))} />
              )}
              {campo.tipo === "textarea" && (
                <textarea rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder={campo.placeholder} value={campos[campo.key] ?? ""} onChange={e => setCampos(c => ({ ...c, [campo.key]: e.target.value }))} />
              )}
            </div>
          ))}

          {/* Cliente */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">Cliente</label>
            <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={clienteId} onChange={e => { setClienteId(e.target.value); const c = clientes.find((x: any) => x.id === e.target.value); setClienteNome(c ? (c.nomeFantasia || c.razaoSocial || "") : ""); }}>
              <option value="">Nenhum</option>
              {clientes.map((c: any) => <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial}</option>)}
            </select>
          </div>

          {/* Prioridade + Prazo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">Prioridade</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={prioridade} onChange={e => setPrioridade(e.target.value)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">Prazo</label>
              <Input type="date" className="h-9 text-sm" value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button size="sm" onClick={salvar} disabled={salvando} className="gap-1.5">
            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Criar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────

export function KanbanModulo({ setor, titulo, subtitulo, fases, camposForm, tipoLabel = {}, prioridadeCor = {} }: KanbanModuloProps) {
  const [tarefas, setTarefas] = useState<TarefaKanban[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [query, setQuery] = useState("");
  const [showNovo, setShowNovo] = useState(false);
  const [movendo, setMovendo] = useState(false);
  const hoje = new Date().toISOString().split("T")[0];

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("tarefas")
        .select("id,titulo,cliente_nome,prioridade,tipo,data_prazo,responsavel,status,etapa_pipeline,created_at")
        .eq("setor", setor)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTarefas(data ?? []);
    } catch (e: any) {
      toast.error("Erro ao carregar: " + (e?.message ?? ""));
    } finally { setLoading(false); }
  }, [setor]);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    if (!query) return tarefas;
    const q = query.toLowerCase();
    return tarefas.filter(t =>
      t.titulo?.toLowerCase().includes(q) ||
      t.cliente_nome?.toLowerCase().includes(q) ||
      t.tipo?.toLowerCase().includes(q)
    );
  }, [tarefas, query]);

  const porFase = (faseKey: string) => filtradas.filter(t => t.etapa_pipeline === faseKey);

  async function moverFase(id: string, novaFase: string) {
    setMovendo(true);
    try {
      const { error } = await (supabase as any).from("tarefas").update({ etapa_pipeline: novaFase, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      setTarefas(ts => ts.map(t => t.id === id ? { ...t, etapa_pipeline: novaFase } : t));
      toast.success("Movido com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao mover: " + (e?.message ?? ""));
    } finally { setMovendo(false); }
  }

  const total = tarefas.length;
  const vencidas = tarefas.filter(t => t.data_prazo && t.data_prazo < hoje && t.etapa_pipeline !== fases[fases.length - 1]?.key).length;

  return (
    <>
      {showNovo && (
        <NovaTarefaDialog
          setor={setor}
          fases={fases}
          camposForm={camposForm}
          onClose={() => setShowNovo(false)}
          onCreated={carregar}
        />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-8 h-8 text-sm w-52"
              />
            </div>
            {vencidas > 0 && (
              <span className="flex items-center gap-1 text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                <AlertTriangle className="h-3 w-3" />{vencidas} vencido{vencidas > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button className={cn("px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors", view === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted")} onClick={() => setView("kanban")}>
                <LayoutGrid className="h-3.5 w-3.5" />Kanban
              </button>
              <button className={cn("px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors", view === "lista" ? "bg-primary text-primary-foreground" : "hover:bg-muted")} onClick={() => setView("lista")}>
                <List className="h-3.5 w-3.5" />Lista
              </button>
            </div>
            <span className="text-xs text-muted-foreground">{filtradas.length} de {total}</span>
            <Button size="sm" onClick={() => setShowNovo(true)} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> Novo Processo
            </Button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* KANBAN */}
        {!loading && view === "kanban" && (
          <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
            {fases.map(fase => {
              const cards = porFase(fase.key);
              const vencidosFase = cards.filter(t => t.data_prazo && t.data_prazo < hoje && fase.key !== fases[fases.length - 1]?.key);
              return (
                <div key={fase.key} className={cn("flex-shrink-0 w-64 rounded-xl border-t-4 flex flex-col border border-border/60", fase.cor.border, fase.cor.bg)}>
                  {/* Header coluna */}
                  <div className="px-3 py-2.5 border-b border-border/40">
                    <div className="flex items-center justify-between">
                      <span className={cn("font-semibold text-xs uppercase tracking-wide", fase.cor.header)}>{fase.label}</span>
                      <span className="text-xs text-muted-foreground font-medium bg-background/70 px-1.5 py-0.5 rounded-md">{cards.length}</span>
                    </div>
                    {vencidosFase.length > 0 && (
                      <div className="mt-1 text-[11px] text-rose-600 font-semibold">⚠ {vencidosFase.length} vencido{vencidosFase.length > 1 ? "s" : ""}</div>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
                    {cards.length === 0 && (
                      <p className="text-xs text-muted-foreground/60 text-center py-6 italic">Sem processos</p>
                    )}
                    {cards.map(t => (
                      <TarefaCard
                        key={t.id}
                        tarefa={t}
                        hoje={hoje}
                        onClick={() => {}}
                        onMover={moverFase}
                        fases={fases}
                      />
                    ))}
                  </div>

                  {/* Footer adicionar */}
                  <div className="p-2 border-t border-border/40">
                    <button
                      className="w-full text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-background/60 transition-colors"
                      onClick={() => setShowNovo(true)}
                    >
                      <Plus className="h-3 w-3" />Adicionar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LISTA */}
        {!loading && view === "lista" && (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Título</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Tipo</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Fase</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Prioridade</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Responsável</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Prazo</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 && (
                  <tr><td colSpan={6} className="text-center p-8 text-muted-foreground">Nenhum processo encontrado.</td></tr>
                )}
                {filtradas.map(t => {
                  const fase = fases.find(f => f.key === t.etapa_pipeline);
                  const vencida = t.data_prazo && t.data_prazo < hoje && t.etapa_pipeline !== fases[fases.length - 1]?.key;
                  return (
                    <tr key={t.id} className="border-t border-border/50 hover:bg-muted/30 cursor-pointer">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORIDADE_DOT[t.prioridade] ?? "bg-gray-300")} />
                          <span className="font-medium">{t.titulo}</span>
                        </div>
                        {t.cliente_nome && <div className="text-[11px] text-muted-foreground ml-4">{t.cliente_nome}</div>}
                      </td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">{t.tipo ? (tipoLabel[t.tipo] ?? t.tipo) : "—"}</td>
                      <td className="p-3">
                        {fase && <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", fase.cor.header, fase.cor.bg.replace("border-t-4", ""))}>{fase.label}</span>}
                      </td>
                      <td className="p-3 hidden sm:table-cell">
                        <span className={cn("text-[11px] font-bold px-1.5 py-0.5 rounded border", prioridadeCor[t.prioridade] ?? "border-gray-200 text-gray-600")}>{t.prioridade}</span>
                      </td>
                      <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">{t.responsavel ?? "—"}</td>
                      <td className="p-3"><span className={cn("text-xs", vencida ? "text-rose-600 font-semibold" : "text-muted-foreground")}>{fmtData(t.data_prazo) ?? "—"}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

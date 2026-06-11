import { createFileRoute } from "@tanstack/react-router";
import { SectorGuard } from "@/components/SectorGuard";
import { useState, useMemo } from "react";
import { Plus, LayoutGrid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PagePlaceholder";
import {
  useSocietario, ProcessoSocietario, FaseProcesso, TipoProcesso,
  FASE_LABEL, FASE_COR, TIPO_LABEL, PRIORIDADE_COR, PRIORIDADE_LABEL, STATUS_LABEL,
} from "@/hooks/use-societario";
import { ProcessoCard }     from "@/components/societario/ProcessoCard";
import { ProcessoModal }    from "@/components/societario/ProcessoModal";
import { NovoProcessoForm } from "@/components/societario/NovoProcessoForm";

export const Route = createFileRoute("/_app/societario")({
  component: SocietarioPage,
  head: () => ({ meta: [{ title: "Societário · APOYA Gestão" }] }),
});

const FASES: FaseProcesso[] = ["viabilidade","coletor","registro","pendencias","concluido"];
const TIPOS: TipoProcesso[] = ["abertura","alteracao","encerramento","transformacao","outros"];
type ViewMode = "kanban"|"lista";

const fmtData = (iso?:string|null) => {
  if (!iso) return "—";
  const [y,m,d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

function SocietarioPage__Inner() {
  const {processos,loading,criarProcesso,moverFase,adicionarComentario,atualizarProcesso,removerProcesso} = useSocietario();
  const [view,setView]         = useState<ViewMode>("kanban");
  const [query,setQuery]       = useState("");
  const [filtroTipo,setFiltroTipo] = useState<"todos"|TipoProcesso>("todos");
  const [filtroResp,setFiltroResp] = useState("todos");
  const [modalProcesso,setModalProcesso] = useState<ProcessoSocietario|null>(null);
  const [showNovo,setShowNovo] = useState(false);

  const responsaveis = useMemo(()=>{
    const s = new Set(processos.map(p=>p.responsavel).filter(Boolean) as string[]);
    return Array.from(s).sort();
  },[processos]);

  const filtrados = useMemo(()=>{
    const q = query.trim().toLowerCase();
    return processos.filter(p=>{
      if (q&&!`${p.nomeEmpresa} ${p.cnpj??""}`.toLowerCase().includes(q)) return false;
      if (filtroTipo!=="todos"&&p.tipo!==filtroTipo) return false;
      if (filtroResp!=="todos"&&p.responsavel!==filtroResp) return false;
      return true;
    });
  },[processos,query,filtroTipo,filtroResp]);

  const porFaseFiltrado = (fase:FaseProcesso) => filtrados.filter(p=>p.fase===fase);
  const hoje = new Date().toISOString().split("T")[0];

  async function handleMover(id:string, fase:FaseProcesso) {
    await moverFase(id,fase,"Gestor");
    if (modalProcesso?.id===id) setModalProcesso(prev=>prev?{...prev,fase}:prev);
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Gestão"
        title="Societário"
        subtitle="Pipeline de processos societários — abertura, alteração, encerramento e outros"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button className={`px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors ${view==="kanban"?"bg-primary text-primary-foreground":"hover:bg-muted"}`} onClick={()=>setView("kanban")}>
                <LayoutGrid className="h-3.5 w-3.5"/>Kanban
              </button>
              <button className={`px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors ${view==="lista"?"bg-primary text-primary-foreground":"hover:bg-muted"}`} onClick={()=>setView("lista")}>
                <List className="h-3.5 w-3.5"/>Lista
              </button>
            </div>
            <Button size="sm" onClick={()=>setShowNovo(true)} className="gap-1.5">
              <Plus className="h-4 w-4"/>Novo Processo
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"/>
          <Input placeholder="Buscar empresa ou CNPJ..." className="pl-8 h-8 text-sm" value={query} onChange={e=>setQuery(e.target.value)}/>
        </div>
        <Select value={filtroTipo} onValueChange={v=>setFiltroTipo(v as typeof filtroTipo)}>
          <SelectTrigger className="w-40 h-8 text-sm"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map(t=><SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        {responsaveis.length>0 && (
          <Select value={filtroResp} onValueChange={setFiltroResp}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos responsáveis</SelectItem>
              {responsaveis.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtrados.length} de {processos.length} processo{processos.length!==1?"s":""}</span>
      </div>

      {loading && <div className="text-center py-16 text-muted-foreground">Carregando processos...</div>}

      {/* KANBAN */}
      {!loading&&view==="kanban"&&(
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
          {FASES.map(fase=>{
            const cards = porFaseFiltrado(fase);
            const vencidos = cards.filter(p=>p.prazo&&p.prazo<hoje&&fase!=="concluido");
            const cor = FASE_COR[fase];
            return (
              <div key={fase} className={`flex-shrink-0 w-64 rounded-xl border-t-4 ${cor.border} ${cor.bg} border border-border/60 flex flex-col`}>
                <div className="px-3 py-2.5 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-xs uppercase tracking-wide ${cor.header}`}>{FASE_LABEL[fase]}</span>
                    <span className="text-xs text-muted-foreground font-medium bg-background/70 px-1.5 py-0.5 rounded-md">{cards.length}</span>
                  </div>
                  {vencidos.length>0&&<div className="mt-1 text-[11px] text-rose-600 font-semibold">⚠ {vencidos.length} vencido{vencidos.length>1?"s":""}</div>}
                </div>
                <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto">
                  {cards.length===0&&<p className="text-xs text-muted-foreground/60 text-center py-6 italic">Sem processos</p>}
                  {cards.map(p=>(
                    <ProcessoCard key={p.id} processo={p}
                      onClick={()=>setModalProcesso(p)}
                      onMoverFase={handleMover}
                      onEditar={setModalProcesso}
                      onRemover={removerProcesso}
                    />
                  ))}
                </div>
                <div className="p-2 border-t border-border/40">
                  <button className="w-full text-xs text-muted-foreground hover:text-primary flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-background/60 transition-colors" onClick={()=>setShowNovo(true)}>
                    <Plus className="h-3 w-3"/>Adicionar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LISTA */}
      {!loading&&view==="lista"&&(
        <div className="surface-card rounded-xl border overflow-hidden">
          <table className="ft-table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Empresa</th>
                <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase hidden md:table-cell">Tipo</th>
                <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Fase</th>
                <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase hidden sm:table-cell">Prioridade</th>
                <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase hidden lg:table-cell">Responsável</th>
                <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase">Prazo</th>
                <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length===0&&(
                <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">Nenhum processo encontrado.</td></tr>
              )}
              {filtrados.map(p=>(
                <tr key={p.id} className="border-t border-border/50 hover:bg-muted/30 cursor-pointer" onClick={()=>setModalProcesso(p)}>
                  <td className="p-3"><div className="font-medium">{p.nomeEmpresa}</div>{p.cnpj&&<div className="text-[11px] text-muted-foreground font-mono">{p.cnpj}</div>}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{TIPO_LABEL[p.tipo]}</td>
                  <td className="p-3">{FASE_LABEL[p.fase]}</td>
                  <td className="p-3 hidden sm:table-cell"><span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${PRIORIDADE_COR[p.prioridade]}`}>{PRIORIDADE_LABEL[p.prioridade]}</span></td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground">{p.responsavel??"—"}</td>
                  <td className="p-3"><span className={p.prazo&&p.prazo<hoje&&p.fase!=="concluido"?"text-rose-600 font-semibold":""}>{fmtData(p.prazo)}</span></td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground">{STATUS_LABEL[p.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProcessoModal processo={modalProcesso} open={!!modalProcesso} onClose={()=>setModalProcesso(null)}
        onMoverFase={handleMover} onComentario={adicionarComentario} onAtualizar={atualizarProcesso} autorPadrao="Gestor"/>
      <NovoProcessoForm open={showNovo} onClose={()=>setShowNovo(false)}
        onSalvar={async(data)=>{await criarProcesso(data);}}/>
    </div>
  );
}

function SocietarioPage() {
  return (
    <SectorGuard setor="societario">
      <SocietarioPage__Inner />
    </SectorGuard>
  );
}

import { useState } from "react";
import { MoreHorizontal, Calendar, User, Clock, ArrowRight, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ProcessoSocietario, FaseProcesso, FASE_LABEL, TIPO_LABEL,
  PRIORIDADE_COR, PRIORIDADE_LABEL, STATUS_COR, STATUS_LABEL,
} from "@/hooks/use-societario";

const FASES: FaseProcesso[] = ["viabilidade","coletor","registro","pendencias","concluido"];

interface Props {
  processo: ProcessoSocietario;
  onClick: () => void;
  onMoverFase: (id:string, fase:FaseProcesso) => void;
  onEditar: (p:ProcessoSocietario) => void;
  onRemover: (id:string) => void;
}

function prazoLabel(prazo?:string|null) {
  if (!prazo) return {label:"Sem prazo",urgente:false};
  const hoje = new Date().toISOString().split("T")[0];
  const dias = Math.ceil((new Date(prazo).getTime()-new Date(hoje).getTime())/(1000*60*60*24));
  if (dias<0)  return {label:`Vencido há ${Math.abs(dias)}d`,urgente:true};
  if (dias===0) return {label:"Vence hoje",urgente:true};
  if (dias<=3)  return {label:`${dias}d restantes`,urgente:true};
  return {label:`${dias}d restantes`,urgente:false};
}

export function ProcessoCard({processo,onClick,onMoverFase,onEditar,onRemover}:Props) {
  const [menuOpen,setMenuOpen] = useState(false);
  const pz = prazoLabel(processo.prazo);
  const outras = FASES.filter(f=>f!==processo.fase);

  return (
    <div className="surface-card rounded-xl p-3.5 shadow-sm border border-border/60 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group relative"
      onClick={onClick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-sm text-foreground leading-tight line-clamp-2 flex-1">{processo.nomeEmpresa}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 uppercase tracking-wide ${PRIORIDADE_COR[processo.prioridade]}`}>
          {PRIORIDADE_LABEL[processo.prioridade]}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className="text-[11px] text-muted-foreground font-medium">{TIPO_LABEL[processo.tipo]}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${STATUS_COR[processo.status]}`}>{STATUS_LABEL[processo.status]}</span>
      </div>
      {processo.cnpj && <p className="text-[11px] text-muted-foreground mb-2 font-mono">{processo.cnpj}</p>}
      <div className="space-y-1 text-[11px] text-muted-foreground">
        {processo.responsavel && <div className="flex items-center gap-1.5"><User className="h-3 w-3 shrink-0"/><span>{processo.responsavel}</span></div>}
        <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 shrink-0"/><span>{processo.diasNaFase}d nesta fase</span></div>
        <div className={`flex items-center gap-1.5 ${pz.urgente?"text-rose-600 font-semibold":""}`}>
          <Calendar className="h-3 w-3 shrink-0"/><span>{pz.label}</span>
        </div>
      </div>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button className="h-6 w-6 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground">
              <MoreHorizontal className="h-3.5 w-3.5"/>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={()=>onEditar(processo)}><Pencil className="h-3.5 w-3.5 mr-2"/>Editar processo</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger><ArrowRight className="h-3.5 w-3.5 mr-2"/>Mover para fase</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {outras.map(f=><DropdownMenuItem key={f} onClick={()=>onMoverFase(processo.id,f)}>{FASE_LABEL[f]}</DropdownMenuItem>)}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator/>
            <DropdownMenuItem className="text-destructive focus:text-destructive"
              onClick={()=>{if(confirm("Remover processo?"))onRemover(processo.id);}}>
              <Trash2 className="h-3.5 w-3.5 mr-2"/>Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

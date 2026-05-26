import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Landmark, Plus, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSocietario, FASE_LABEL, TIPO_LABEL, PRIORIDADE_COR, PRIORIDADE_LABEL } from "@/hooks/use-societario";
import { NovoProcessoForm } from "./NovoProcessoForm";

interface Props { clienteId: string; clienteNome?: string; }

export function ProcessosSocietariosCard({clienteId,clienteNome}:Props) {
  const navigate = useNavigate();
  const {processos,loading,criarProcesso} = useSocietario({clienteId});
  const [showNovo,setShowNovo] = useState(false);
  const ativos = processos.filter(p=>p.fase!=="concluido"&&p.status!=="cancelado");
  const preview = ativos.slice(0,3);

  return (
    <div className="surface-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary"/>
          <span className="font-semibold text-sm">Processos Societários</span>
          {ativos.length>0 && <span className="bg-primary/10 text-primary text-[11px] font-bold px-1.5 py-0.5 rounded-md">{ativos.length}</span>}
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={()=>navigate({to:"/societario"})}>
            <ExternalLink className="h-3 w-3"/>Ver todos
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={()=>setShowNovo(true)}>
            <Plus className="h-3 w-3"/>Novo
          </Button>
        </div>
      </div>
      {loading && <p className="text-xs text-muted-foreground py-2">Carregando...</p>}
      {!loading&&ativos.length===0 && <p className="text-xs text-muted-foreground py-2 italic">Nenhum processo ativo.</p>}
      {preview.map(p=>(
        <div key={p.id} className="flex items-center gap-3 py-2 border-t border-border/50 first:border-t-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-medium">{TIPO_LABEL[p.tipo]}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground"/>
              <span className="text-xs text-muted-foreground">{FASE_LABEL[p.fase]}</span>
            </div>
            <p className="text-xs text-muted-foreground">{p.diasNaFase}d na fase · {p.responsavel??"—"}</p>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${PRIORIDADE_COR[p.prioridade]}`}>{PRIORIDADE_LABEL[p.prioridade]}</span>
        </div>
      ))}
      {ativos.length>3 && (
        <p className="text-xs text-muted-foreground pt-2 border-t text-center">
          +{ativos.length-3} processos — <button className="text-primary hover:underline" onClick={()=>navigate({to:"/societario"})}>ver todos</button>
        </p>
      )}
      <NovoProcessoForm open={showNovo} onClose={()=>setShowNovo(false)} clienteIdFixo={clienteId}
        onSalvar={async(data)=>{await criarProcesso({...data,nomeEmpresa:data.nomeEmpresa||clienteNome||"Empresa"});}}/>
    </div>
  );
}

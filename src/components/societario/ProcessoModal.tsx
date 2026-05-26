import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Send, Clock, User, Calendar } from "lucide-react";
import {
  ProcessoSocietario, FaseProcesso, FASE_LABEL, TIPO_LABEL,
  PRIORIDADE_COR, PRIORIDADE_LABEL, STATUS_COR, STATUS_LABEL,
  useProcessoHistorico,
} from "@/hooks/use-societario";

const FASES: FaseProcesso[] = ["viabilidade","coletor","registro","pendencias","concluido"];

interface Props {
  processo: ProcessoSocietario|null; open: boolean; onClose: ()=>void;
  onMoverFase: (id:string,fase:FaseProcesso)=>void;
  onComentario: (id:string,texto:string,autor:string)=>Promise<boolean>;
  onAtualizar: (id:string,updates:Partial<ProcessoSocietario>)=>Promise<boolean>;
  autorPadrao?: string;
}

const fmtData = (iso?:string|null) => {
  if (!iso) return "—";
  const [y,m,d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

export function ProcessoModal({processo,open,onClose,onMoverFase,onComentario,onAtualizar,autorPadrao="Gestor"}:Props) {
  const {historico,reload} = useProcessoHistorico(processo?.id??"");
  const [comentario,setComentario] = useState("");
  const [enviando,setEnviando]     = useState(false);
  const [editando,setEditando]     = useState(false);
  const [prazoEdit,setPrazoEdit]   = useState("");
  const [respEdit,setRespEdit]     = useState("");

  useEffect(()=>{
    if (processo){ setPrazoEdit(processo.prazo??""); setRespEdit(processo.responsavel??""); }
  },[processo?.id]);

  async function handleComentario() {
    if (!processo||!comentario.trim()) return;
    setEnviando(true);
    const ok = await onComentario(processo.id,comentario.trim(),autorPadrao);
    if (ok){ setComentario(""); reload(); }
    setEnviando(false);
  }

  async function handleSalvar() {
    if (!processo) return;
    await onAtualizar(processo.id,{prazo:prazoEdit||null,responsavel:respEdit||null});
    setEditando(false);
  }

  if (!processo) return null;
  const proxFase = FASES[FASES.indexOf(processo.fase)+1] as FaseProcesso|undefined;
  const hoje = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={v=>{if(!v)onClose();}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b">
          <div className="flex items-start gap-3">
            <span className={`text-[11px] font-bold px-2 py-1 rounded-md border ${PRIORIDADE_COR[processo.prioridade]}`}>{PRIORIDADE_LABEL[processo.prioridade]}</span>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight">{processo.nomeEmpresa}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{TIPO_LABEL[processo.tipo]}</p>
            </div>
            {!editando && <Button variant="outline" size="sm" onClick={()=>setEditando(true)} className="shrink-0">Editar</Button>}
          </div>
        </DialogHeader>
        <div className="flex flex-1 overflow-hidden divide-x">
          {/* Esquerda */}
          <div className="w-72 shrink-0 overflow-y-auto p-5 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Fase atual</Label>
              <Badge variant="outline">{FASE_LABEL[processo.fase]}</Badge>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Status</Label>
              <span className={`text-xs px-2 py-1 rounded-md font-medium ${STATUS_COR[processo.status]}`}>{STATUS_LABEL[processo.status]}</span>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block"><User className="h-3 w-3 inline mr-1"/>Responsável</Label>
              {editando ? <Input value={respEdit} onChange={e=>setRespEdit(e.target.value)} className="h-8 text-sm"/> : <p className="text-sm font-medium">{processo.responsavel??"—"}</p>}
            </div>
            {processo.cnpj && <div><Label className="text-xs text-muted-foreground uppercase mb-1 block">CNPJ</Label><p className="text-sm font-mono">{processo.cnpj}</p></div>}
            <div className="space-y-1.5 text-sm">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider block"><Calendar className="h-3 w-3 inline mr-1"/>Prazos</Label>
              <div className="flex justify-between"><span className="text-muted-foreground">Abertura:</span><span>{fmtData(processo.dataAbertura)}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Prazo:</span>
                {editando ? <Input type="date" value={prazoEdit} onChange={e=>setPrazoEdit(e.target.value)} className="h-7 text-xs w-36"/> :
                  <span className={processo.prazo&&processo.prazo<hoje?"text-rose-600 font-semibold":""}>{fmtData(processo.prazo)}</span>}
              </div>
              {processo.dataConclusao && <div className="flex justify-between"><span className="text-muted-foreground">Conclusão:</span><span className="text-emerald-600">{fmtData(processo.dataConclusao)}</span></div>}
            </div>
            <div><Label className="text-xs text-muted-foreground uppercase mb-1 block"><Clock className="h-3 w-3 inline mr-1"/>Tempo na fase</Label><p className="text-sm font-medium">{processo.diasNaFase}d</p></div>
            <div className="space-y-2 pt-2 border-t">
              {editando ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSalvar} className="flex-1">Salvar</Button>
                  <Button size="sm" variant="outline" onClick={()=>setEditando(false)}>Cancelar</Button>
                </div>
              ) : proxFase ? (
                <Button size="sm" className="w-full gap-1.5" onClick={()=>onMoverFase(processo.id,proxFase)}>
                  <ArrowRight className="h-3.5 w-3.5"/>Avançar para {FASE_LABEL[proxFase]}
                </Button>
              ) : null}
              {processo.fase!=="concluido" && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Mover para fase:</Label>
                  <Select onValueChange={v=>onMoverFase(processo.id,v as FaseProcesso)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar..."/></SelectTrigger>
                    <SelectContent>{FASES.filter(f=>f!==processo.fase).map(f=><SelectItem key={f} value={f}>{FASE_LABEL[f]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          {/* Direita — histórico */}
          <div className="flex-1 flex flex-col overflow-hidden p-5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block">Histórico</Label>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {historico.length===0 && <p className="text-sm text-muted-foreground italic">Nenhum evento.</p>}
              {historico.map(ev=>(
                <div key={ev.id} className="flex gap-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{fmtData(ev.createdAt.split("T")[0])} · <span className="font-medium text-foreground">{ev.autor}</span></p>
                    <p className="text-sm mt-0.5">{ev.descricao??"—"}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t pt-4 space-y-2">
              <Label className="text-xs text-muted-foreground uppercase">Comentário</Label>
              <Textarea placeholder="Escreva um comentário..." rows={2} value={comentario}
                onChange={e=>setComentario(e.target.value)} className="text-sm"/>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleComentario} disabled={enviando||!comentario.trim()} className="gap-1.5">
                  <Send className="h-3.5 w-3.5"/>{enviando?"Enviando...":"Enviar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ProcessoSocietario, FaseProcesso, TipoProcesso, PrioridadeProcesso,
  FASE_LABEL, TIPO_LABEL, PRIORIDADE_LABEL,
} from "@/hooks/use-societario";

interface Props {
  open: boolean; onClose: ()=>void;
  onSalvar: (d:Omit<ProcessoSocietario,"id"|"diasNaFase"|"createdAt"|"updatedAt">)=>Promise<void>;
  clientes?: {id:string;razaoSocial:string}[];
  clienteIdFixo?: string;
}

const TIPOS: TipoProcesso[] = ["abertura","alteracao","encerramento","transformacao","outros"];
const PRIOS: PrioridadeProcesso[] = ["baixa","media","alta","urgente"];
const FASES: FaseProcesso[] = ["viabilidade","coletor","registro","pendencias","concluido"];

export function NovoProcessoForm({open,onClose,onSalvar,clientes=[],clienteIdFixo}:Props) {
  const [form,setForm] = useState({
    tipo:"abertura" as TipoProcesso, nomeEmpresa:"", cnpj:"",
    clienteId:clienteIdFixo??"", responsavel:"", prioridade:"media" as PrioridadeProcesso,
    fase:"viabilidade" as FaseProcesso, prazo:"",
    dataAbertura:new Date().toISOString().split("T")[0], descricao:"",
  });
  const [salvando,setSalvando] = useState(false);
  const set = (k:string,v:unknown) => setForm(f=>({...f,[k]:v}));

  async function handleSalvar() {
    if (!form.nomeEmpresa.trim()) return;
    setSalvando(true);
    await onSalvar({
      tipo:form.tipo, nomeEmpresa:form.nomeEmpresa.trim(), cnpj:form.cnpj||null,
      clienteId:form.clienteId||null, responsavel:form.responsavel||null,
      prioridade:form.prioridade, fase:form.fase, status:"em_andamento",
      prazo:form.prazo||null, dataAbertura:form.dataAbertura,
      descricao:form.descricao||null, documentosPendentes:[], observacoes:null, dataConclusao:null,
    });
    setSalvando(false);
    setForm({tipo:"abertura",nomeEmpresa:"",cnpj:"",clienteId:clienteIdFixo??"",responsavel:"",prioridade:"media",fase:"viabilidade",prazo:"",dataAbertura:new Date().toISOString().split("T")[0],descricao:""});
    onClose();
  }

  const fmtCnpj = (v:string) => v.replace(/\D/g,"").replace(/(\d{2})(\d)/,"$1.$2").replace(/(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2").slice(0,18);

  return (
    <Dialog open={open} onOpenChange={v=>{if(!v)onClose();}}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo Processo Societário</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select value={form.tipo} onValueChange={v=>set("tipo",v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{TIPOS.map(t=><SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v=>set("prioridade",v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{PRIOS.map(p=><SelectItem key={p} value={p}>{PRIORIDADE_LABEL[p]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome da empresa <span className="text-destructive">*</span></Label>
            <Input placeholder="Razão social ou nome" value={form.nomeEmpresa} onChange={e=>set("nomeEmpresa",e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ (se existente)</Label>
            <Input placeholder="00.000.000/0000-00" value={form.cnpj} onChange={e=>set("cnpj",fmtCnpj(e.target.value))} maxLength={18}/>
          </div>
          {!clienteIdFixo && clientes.length>0 && (
            <div className="space-y-1.5">
              <Label>Vincular cliente</Label>
              <Select value={form.clienteId} onValueChange={v=>set("clienteId",v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..."/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Empresa nova</SelectItem>
                  {clientes.map(c=><SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Input placeholder="Nome" value={form.responsavel} onChange={e=>set("responsavel",e.target.value)}/>
            </div>
            <div className="space-y-1.5">
              <Label>Fase inicial</Label>
              <Select value={form.fase} onValueChange={v=>set("fase",v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{FASES.map(f=><SelectItem key={f} value={f}>{FASE_LABEL[f]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <Input type="date" value={form.prazo} onChange={e=>set("prazo",e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea placeholder="Detalhes..." rows={3} value={form.descricao} onChange={e=>set("descricao",e.target.value)}/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando||!form.nomeEmpresa.trim()}>
            {salvando?"Salvando...":"Criar Processo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

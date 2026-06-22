import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FaseProcesso      = "viabilidade" | "coletor" | "registro" | "pendencias" | "concluido";
export type TipoProcesso      = "abertura" | "alteracao" | "encerramento" | "transformacao" | "outros";
export type PrioridadeProcesso = "baixa" | "media" | "alta" | "urgente";
export type StatusProcesso    = "em_andamento" | "aguardando_analise" | "em_edicao" | "pendente" | "concluido" | "cancelado";

export interface ProcessoSocietario {
  id: string; clienteId?: string | null; nomeEmpresa: string; cnpj?: string | null;
  tipo: TipoProcesso; fase: FaseProcesso; prioridade: PrioridadeProcesso; status: StatusProcesso;
  responsavel?: string | null; dataAbertura?: string | null; prazo?: string | null;
  dataConclusao?: string | null; descricao?: string | null;
  documentosPendentes?: string[] | null; observacoes?: string | null;
  diasNaFase: number; createdAt: string; updatedAt: string;
}
export interface HistoricoEvento {
  id: string; processoId: string; createdAt: string; autor: string;
  tipoEvento: string; faseAnterior?: string | null; faseNova?: string | null; descricao?: string | null;
}

export const FASE_LABEL: Record<FaseProcesso, string> = {
  viabilidade:"Iniciar Viabilidade", coletor:"Coletor Nacional",
  registro:"Registro", pendencias:"Pendências", concluido:"Concluído",
};
export const FASE_COR: Record<FaseProcesso,{border:string;bg:string;header:string}> = {
  viabilidade:{border:"border-t-slate-400",  bg:"bg-slate-50/60",   header:"text-slate-700"},
  coletor:    {border:"border-t-amber-400",  bg:"bg-amber-50/60",   header:"text-amber-800"},
  registro:   {border:"border-t-blue-400",   bg:"bg-blue-50/60",    header:"text-blue-800"},
  pendencias: {border:"border-t-orange-400", bg:"bg-orange-50/60",  header:"text-orange-800"},
  concluido:  {border:"border-t-emerald-400",bg:"bg-emerald-50/60", header:"text-emerald-800"},
};
export const TIPO_LABEL: Record<TipoProcesso,string> = {
  abertura:"Abertura",alteracao:"Alteração",encerramento:"Encerramento",
  transformacao:"Transformação",outros:"Outros",
};
export const PRIORIDADE_LABEL: Record<PrioridadeProcesso,string> = {baixa:"Baixa",media:"Média",alta:"Alta",urgente:"Urgente"};
export const PRIORIDADE_COR: Record<PrioridadeProcesso,string> = {
  baixa:"bg-slate-100 text-slate-600 border-slate-200",
  media:"bg-blue-100 text-blue-700 border-blue-200",
  alta:"bg-amber-100 text-amber-700 border-amber-200",
  urgente:"bg-rose-100 text-rose-700 border-rose-200",
};
export const STATUS_LABEL: Record<StatusProcesso,string> = {
  em_andamento:"Em andamento",aguardando_analise:"Aguardando análise",em_edicao:"Em edição",
  pendente:"Pendente",concluido:"Concluído",cancelado:"Cancelado",
};
export const STATUS_COR: Record<StatusProcesso,string> = {
  em_andamento:"bg-blue-50 text-blue-700",aguardando_analise:"bg-amber-50 text-amber-700",
  em_edicao:"bg-purple-50 text-purple-700",pendente:"bg-orange-50 text-orange-700",
  concluido:"bg-emerald-50 text-emerald-700",cancelado:"bg-slate-50 text-slate-500",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDb(r: Record<string,any>): ProcessoSocietario {
  const criado = r.created_at ? new Date(r.created_at) : new Date();
  const fim    = r.data_conclusao ? new Date(r.data_conclusao) : new Date();
  const diasNaFase = Math.max(0, Math.floor((fim.getTime()-criado.getTime())/(1000*60*60*24)));
  return {
    id: String(r.id), clienteId: r.cliente_id??null, nomeEmpresa: String(r.nome_empresa??""),
    cnpj: r.cnpj??null, tipo: r.tipo as TipoProcesso, fase: r.fase as FaseProcesso,
    prioridade: r.prioridade as PrioridadeProcesso, status: r.status as StatusProcesso,
    responsavel: r.responsavel??null, dataAbertura: r.data_abertura??null, prazo: r.prazo??null,
    dataConclusao: r.data_conclusao??null, descricao: r.descricao??null,
    documentosPendentes: Array.isArray(r.documentos_pendentes)?r.documentos_pendentes:[],
    observacoes: r.observacoes??null,
    diasNaFase: typeof r.dias_na_fase==="number"?r.dias_na_fase:diasNaFase,
    createdAt: String(r.created_at??""), updatedAt: String(r.updated_at??""),
  };
}
function toDb(p: Partial<ProcessoSocietario>): Record<string,unknown> {
  const r: Record<string,unknown> = {};
  if (p.clienteId!==undefined)           r.cliente_id=p.clienteId||null;
  if (p.nomeEmpresa!==undefined)         r.nome_empresa=p.nomeEmpresa;
  if (p.cnpj!==undefined)                r.cnpj=p.cnpj||null;
  if (p.tipo!==undefined)                r.tipo=p.tipo;
  if (p.fase!==undefined)                r.fase=p.fase;
  if (p.prioridade!==undefined)          r.prioridade=p.prioridade;
  if (p.status!==undefined)              r.status=p.status;
  if (p.responsavel!==undefined)         r.responsavel=p.responsavel||null;
  if (p.dataAbertura!==undefined)        r.data_abertura=p.dataAbertura||null;
  if (p.prazo!==undefined)               r.prazo=p.prazo||null;
  if (p.dataConclusao!==undefined)       r.data_conclusao=p.dataConclusao||null;
  if (p.descricao!==undefined)           r.descricao=p.descricao||null;
  if (p.documentosPendentes!==undefined) r.documentos_pendentes=p.documentosPendentes??[];
  if (p.observacoes!==undefined)         r.observacoes=p.observacoes||null;
  return r;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbH(r: Record<string,any>): HistoricoEvento {
  return { id:String(r.id), processoId:String(r.processo_id), createdAt:String(r.created_at??""),
    autor:String(r.autor??"Sistema"), tipoEvento:String(r.tipo_evento??""),
    faseAnterior:r.fase_anterior??null, faseNova:r.fase_nova??null, descricao:r.descricao??null };
}

export function useSocietario(opts?: {clienteId?:string;fase?:FaseProcesso;tipo?:TipoProcesso}) {
  const [processos,setProcessos] = useState<ProcessoSocietario[]>([]);
  const [loading,setLoading]     = useState(true);
  const [error,setError]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any).from("processos_societarios").select("*").order("created_at",{ascending:false});
      if (opts?.clienteId) q = q.eq("cliente_id",opts.clienteId);
      if (opts?.fase)      q = q.eq("fase",opts.fase);
      if (opts?.tipo)      q = q.eq("tipo",opts.tipo);
      const {data,error} = await q;
      if (error) throw error;
      setProcessos((data??[]).map(fromDb));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar processos societários";
      setError(msg);
      setProcessos([]);
      toast.error(msg);
    }
    finally  { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[opts?.clienteId,opts?.fase,opts?.tipo]);

  useEffect(()=>{load();},[load]);

  async function criarProcesso(input: Omit<ProcessoSocietario,"id"|"diasNaFase"|"createdAt"|"updatedAt">) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {data,error} = await (supabase as any).from("processos_societarios").insert(toDb(input as ProcessoSocietario)).select().single();
    if (error) { toast.error("Erro ao criar: "+error.message); return null; }
    toast.success("Processo criado!"); await load(); return fromDb(data);
  }
  async function atualizarProcesso(id:string, updates:Partial<ProcessoSocietario>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {error} = await (supabase as any).from("processos_societarios").update(toDb(updates)).eq("id",id);
    if (error) { toast.error("Erro ao atualizar"); return false; }
    toast.success("Salvo!"); await load(); return true;
  }
  async function moverFase(id:string, novaFase:FaseProcesso, autor="Sistema") {
    const proc = processos.find(p=>p.id===id); if (!proc) return false;
    const updates:Partial<ProcessoSocietario> = {
      fase:novaFase, status:novaFase==="concluido"?"concluido":proc.status,
      dataConclusao:novaFase==="concluido"?new Date().toISOString().split("T")[0]:proc.dataConclusao,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {error} = await (supabase as any).from("processos_societarios").update(toDb(updates)).eq("id",id);
    if (error) { toast.error("Erro ao mover fase"); return false; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("processos_historico").insert({
      processo_id:id,autor,tipo_evento:"mudanca_fase",
      fase_anterior:proc.fase,fase_nova:novaFase,
      descricao:`Movido de "${FASE_LABEL[proc.fase]}" para "${FASE_LABEL[novaFase]}"`,
    });
    await load(); return true;
  }
  async function adicionarComentario(id:string, texto:string, autor:string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {error} = await (supabase as any).from("processos_historico").insert({processo_id:id,autor,tipo_evento:"comentario",descricao:texto});
    if (error) { toast.error("Erro ao salvar comentário"); return false; }
    return true;
  }
  async function removerProcesso(id:string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {error} = await (supabase as any).from("processos_societarios").delete().eq("id",id);
    if (error) { toast.error("Erro ao remover"); return false; }
    toast.success("Removido"); await load(); return true;
  }
  const porFase = (fase:FaseProcesso) => processos.filter(p=>p.fase===fase);
  const hoje = new Date().toISOString().split("T")[0];
  const vencidosNaFase = (fase:FaseProcesso) => processos.filter(p=>p.fase===fase&&p.prazo&&p.prazo<hoje&&p.fase!=="concluido");
  return {processos,loading,error,load,criarProcesso,atualizarProcesso,moverFase,adicionarComentario,removerProcesso,porFase,vencidosNaFase};
}

export function useProcessoHistorico(processoId:string) {
  const [historico,setHistorico] = useState<HistoricoEvento[]>([]);
  const [loading,setLoading]     = useState(false);
  const load = useCallback(async()=>{
    if (!processoId) return; setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {data,error} = await (supabase as any).from("processos_historico").select("*").eq("processo_id",processoId).order("created_at",{ascending:false});
    if (!error) setHistorico((data??[]).map(fromDbH));
    setLoading(false);
  },[processoId]);
  useEffect(()=>{load();},[load]);
  return {historico,loading,reload:load};
}

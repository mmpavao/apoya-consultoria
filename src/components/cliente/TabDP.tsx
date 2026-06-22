/**
 * TabDP — Departamento Pessoal
 * Sub-abas: Funcionários | Folha Mensal | Férias
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Plus, UserX, Calendar, CheckSquare, ExternalLink } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useFuncionarios, useCreateFuncionario, useDemitirFuncionario,
  useFolhaMensal, useCreateFolha, useFecharFolha, useFerias,
  type TipoContrato, type TipoRescisao,
} from "@/hooks/use-dp";

// ─── Utils ────────────────────────────────────────────────────────────────────
const FMT_BRL = (v: number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const FMT_DATE = (d: string) => new Date(d+"T00:00:00").toLocaleDateString("pt-BR");
const MASK_CPF = (c: string) => { const d=c.replace(/\D/g,""); return d.length===11?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-**`:c; };
const MES_ATUAL = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const COMP_LABEL = (c: string) => { const [a,m]=c.split("-"); return `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][+m-1]}/${a}`; };
const TIPO_LABEL: Record<TipoContrato,string> = { clt:"CLT", pj:"PJ", estagiario:"Estagiário", autonomo:"Autônomo" };
const FOLHA_COR: Record<string,string> = { aberta:"bg-yellow-100 text-yellow-800", fechada:"bg-green-100 text-green-800", enviada:"bg-blue-100 text-blue-800" };

// ─── Dialog Novo Funcionário ──────────────────────────────────────────────────
function NovoFuncDialog({ open, onClose, clienteId, onOk }: { open:boolean; onClose:()=>void; clienteId:string; onOk:()=>void }) {
  const { create, loading } = useCreateFuncionario();
  const [f, setF] = useState({ nome:"", cpf:"", pis:"", cargo:"", departamento:"", salario_base:"",
    data_admissao:"", tipo_contrato:"clt" as TipoContrato, jornada:"44h_semana",
    banco:"", agencia:"", conta:"", tipo_conta:"", dependentes:"0", observacoes:"" });
  const s = (k: string, v: string) => setF(p=>({...p,[k]:v}));

  const submit = async () => {
    if (!f.nome||!f.cpf||!f.data_admissao||!f.salario_base) { toast.error("Nome, CPF, admissão e salário são obrigatórios"); return; }
    const ok = await create({ empresa_id:clienteId, nome:f.nome, cpf:f.cpf.replace(/\D/g,""),
      pis:f.pis||undefined, cargo:f.cargo||undefined, departamento:f.departamento||undefined,
      salario_base:parseFloat(f.salario_base)||0, data_admissao:f.data_admissao,
      tipo_contrato:f.tipo_contrato, jornada:f.jornada, banco:f.banco||undefined,
      agencia:f.agencia||undefined, conta:f.conta||undefined, tipo_conta:f.tipo_conta||undefined,
      dependentes:parseInt(f.dependentes)||0, status:"ativo", observacoes:f.observacoes||undefined });
    if (ok) { onOk(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo Funcionário</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2"><Label>Nome completo *</Label><Input value={f.nome} onChange={e=>s("nome",e.target.value)} placeholder="Nome completo"/></div>
          <div><Label>CPF *</Label><Input value={f.cpf} onChange={e=>s("cpf",e.target.value)} placeholder="000.000.000-00"/></div>
          <div><Label>PIS/PASEP</Label><Input value={f.pis} onChange={e=>s("pis",e.target.value)} placeholder="000.00000.00-0"/></div>
          <div><Label>Cargo</Label><Input value={f.cargo} onChange={e=>s("cargo",e.target.value)} placeholder="Ex: Auxiliar Administrativo"/></div>
          <div><Label>Departamento</Label><Input value={f.departamento} onChange={e=>s("departamento",e.target.value)} placeholder="Ex: Financeiro"/></div>
          <div><Label>Salário Base *</Label><Input type="number" value={f.salario_base} onChange={e=>s("salario_base",e.target.value)} min="0" step="0.01"/></div>
          <div><Label>Data de Admissão *</Label><Input type="date" value={f.data_admissao} onChange={e=>s("data_admissao",e.target.value)}/></div>
          <div><Label>Tipo Contrato</Label>
            <Select value={f.tipo_contrato} onValueChange={v=>s("tipo_contrato",v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{Object.entries(TIPO_LABEL).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Jornada</Label>
            <Select value={f.jornada} onValueChange={v=>s("jornada",v)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="44h_semana">44h/semana</SelectItem>
                <SelectItem value="40h_semana">40h/semana</SelectItem>
                <SelectItem value="36h_semana">36h/semana</SelectItem>
                <SelectItem value="20h_semana">20h/semana (estágio)</SelectItem>
                <SelectItem value="horista">Horista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Dependentes (IRRF)</Label><Input type="number" min="0" value={f.dependentes} onChange={e=>s("dependentes",e.target.value)}/></div>
          <div className="col-span-2 border-t pt-2 text-sm font-medium text-muted-foreground">Dados Bancários</div>
          <div><Label>Banco</Label><Input value={f.banco} onChange={e=>s("banco",e.target.value)} placeholder="Ex: 001 - BB"/></div>
          <div><Label>Agência</Label><Input value={f.agencia} onChange={e=>s("agencia",e.target.value)} placeholder="0000-0"/></div>
          <div><Label>Conta</Label><Input value={f.conta} onChange={e=>s("conta",e.target.value)} placeholder="00000-0"/></div>
          <div><Label>Tipo de Conta</Label>
            <Select value={f.tipo_conta} onValueChange={v=>s("tipo_conta",v)}>
              <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="salario">Conta Salário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Observações</Label><Input value={f.observacoes} onChange={e=>s("observacoes",e.target.value)}/></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>{loading?"Salvando...":"Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog Demitir ───────────────────────────────────────────────────────────
function DemitirDialog({ open, onClose, funcId, funcNome, onOk }:
  { open:boolean; onClose:()=>void; funcId:string; funcNome:string; onOk:()=>void }) {
  const { demitir, loading } = useDemitirFuncionario();
  const [tipo, setTipo] = useState<TipoRescisao>("sem_justa_causa");
  const [data, setData] = useState("");
  const ok = async () => {
    if (!data) { toast.error("Informe a data de demissão"); return; }
    const r = await demitir(funcId, data, tipo);
    if (r) { onOk(); onClose(); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-destructive">Demitir: {funcNome}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Tipo de Rescisão</Label>
            <Select value={tipo} onValueChange={v=>setTipo(v as TipoRescisao)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_justa_causa">Sem Justa Causa</SelectItem>
                <SelectItem value="com_justa_causa">Com Justa Causa</SelectItem>
                <SelectItem value="pedido_demissao">Pedido de Demissão</SelectItem>
                <SelectItem value="acordo">Acordo (§484-A)</SelectItem>
                <SelectItem value="aposentadoria">Aposentadoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Data de Demissão</Label><Input type="date" value={data} onChange={e=>setData(e.target.value)}/></div>
          <p className="text-xs text-muted-foreground">Um registro de rescisão será criado. Calcule e lance os valores manualmente na folha.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={ok} disabled={loading}>{loading?"Processando...":"Confirmar Demissão"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-aba Funcionários ─────────────────────────────────────────────────────
function SubAbaFuncionarios({ clienteId }: { clienteId: string }) {
  const { funcionarios, loading, refresh } = useFuncionarios(clienteId);
  const [novo, setNovo] = useState(false);
  const [demitindo, setDemitindo] = useState<{id:string;nome:string}|null>(null);
  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  const criticos = funcionarios.filter(f=>f.status==="ativo"&&(f.dias_sem_ferias??0)>330);
  return (
    <div className="space-y-4">
      {criticos.length>0&&(
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0"/>
          <span><strong>{criticos.length}</strong> funcionário(s) com mais de 330 dias sem tirar férias.</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{funcionarios.filter(f=>f.status==="ativo").length} ativo(s) · {funcionarios.length} total</p>
        <Button size="sm" onClick={()=>setNovo(true)}><Plus className="h-4 w-4 mr-1"/>Novo Funcionário</Button>
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="ft-table w-full text-sm">
          <thead><tr>
            <th>Nome</th><th>CPF</th><th>Cargo</th><th>Contrato</th>
            <th className="text-right">Salário</th><th>Admissão</th><th>Status</th><th>Férias</th><th></th>
          </tr></thead>
          <tbody>
            {funcionarios.length===0&&<tr><td colSpan={9} className="text-center text-muted-foreground py-8">Nenhum funcionário cadastrado</td></tr>}
            {funcionarios.map(f=>{
              const alerta=f.status==="ativo"&&(f.dias_sem_ferias??0)>330;
              return (
                <tr key={f.id} className={alerta?"bg-orange-50/50":""}>
                  <td className="font-medium">{f.nome}</td>
                  <td className="text-muted-foreground font-mono text-xs">{MASK_CPF(f.cpf)}</td>
                  <td>{f.cargo??"—"}</td>
                  <td>{TIPO_LABEL[f.tipo_contrato]}</td>
                  <td className="text-right">{FMT_BRL(f.salario_base)}</td>
                  <td>{FMT_DATE(f.data_admissao)}</td>
                  <td>
                    <Badge variant={f.status==="ativo"?"default":f.status==="afastado"?"secondary":"outline"}>
                      {f.status.charAt(0).toUpperCase()+f.status.slice(1)}
                    </Badge>
                  </td>
                  <td>
                    {alerta
                      ?<span className="flex items-center gap-1 text-orange-600 text-xs font-medium"><AlertTriangle className="h-3 w-3"/>{f.dias_sem_ferias}d</span>
                      :<span className="text-xs text-muted-foreground">{f.dias_sem_ferias}d</span>}
                  </td>
                  <td>{f.status==="ativo"&&
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={()=>setDemitindo({id:f.id,nome:f.nome})}>
                      <UserX className="h-4 w-4"/>
                    </Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <NovoFuncDialog open={novo} onClose={()=>setNovo(false)} clienteId={clienteId} onOk={refresh}/>
      {demitindo&&<DemitirDialog open={!!demitindo} onClose={()=>setDemitindo(null)}
        funcId={demitindo.id} funcNome={demitindo.nome} onOk={refresh}/>}
    </div>
  );
}

// ─── Sub-aba Folha Mensal ─────────────────────────────────────────────────────
function SubAbaFolha({ clienteId }: { clienteId: string }) {
  const [competencia, setComp] = useState(MES_ATUAL());
  const { folha, loading, refresh } = useFolhaMensal(clienteId, competencia);
  const { createFolha, loading: criando } = useCreateFolha();
  const { fecharFolha, loading: fechando } = useFecharFolha();
  const [confirmFechar, setConfirm] = useState(false);
  const meses = Array.from({length:12},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;});
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Competência:</Label>
        <Select value={competencia} onValueChange={setComp}>
          <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
          <SelectContent>{meses.map(c=><SelectItem key={c} value={c}>{COMP_LABEL(c)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {loading&&<div className="text-center py-8 text-muted-foreground">Carregando...</div>}
      {!loading&&!folha&&(
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">Nenhuma folha aberta para <strong>{COMP_LABEL(competencia)}</strong></p>
          <Button onClick={async()=>{const ok=await createFolha(clienteId,competencia);if(ok)refresh();}} disabled={criando}>
            <Plus className="h-4 w-4 mr-1"/>{criando?"Abrindo...":"Abrir Folha do Mês"}
          </Button>
        </div>
      )}
      {!loading&&folha&&(
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Folha de {COMP_LABEL(folha.competencia)}</h3>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${FOLHA_COR[folha.status]??""}`}>
              {folha.status.charAt(0).toUpperCase()+folha.status.slice(1)}
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[{l:"Funcionários",v:folha.total_funcionarios,m:false},
              {l:"Total Proventos",v:folha.total_proventos,m:true},
              {l:"Total Descontos",v:folha.total_descontos,m:true},
              {l:"Total Líquido",v:folha.total_liquido,m:true},
              {l:"FGTS",v:folha.total_fgts,m:true},
              {l:"INSS Empresa",v:folha.total_inss_empresa,m:true}].map(i=>(
              <div key={i.l} className="surface-card p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">{i.l}</p>
                <p className="text-lg font-semibold mt-1">{i.m?FMT_BRL(i.v as number):i.v}</p>
              </div>
            ))}
          </div>
          {folha.status==="aberta"&&(!confirmFechar
            ?<Button variant="outline" onClick={()=>setConfirm(true)}><CheckSquare className="h-4 w-4 mr-1"/>Fechar Folha</Button>
            :<div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm flex-1">Confirmar fechamento de {COMP_LABEL(folha.competencia)}?</p>
              <Button size="sm" variant="destructive" onClick={async()=>{const ok=await fecharFolha(folha.id);if(ok){refresh();setConfirm(false);}}} disabled={fechando}>{fechando?"Fechando...":"Confirmar"}</Button>
              <Button size="sm" variant="ghost" onClick={()=>setConfirm(false)}>Cancelar</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-aba Férias ───────────────────────────────────────────────────────────
function SubAbaFerias({ clienteId }: { clienteId: string }) {
  const { ferias, loading } = useFerias(clienteId);
  const [showDialog, setShow] = useState(false);
  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  const hoje = new Date(); const em30=new Date(); em30.setDate(hoje.getDate()+30);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{ferias.length} período(s) pendente(s) ou vencido(s)</p>
        <Button size="sm" onClick={()=>setShow(true)}><Calendar className="h-4 w-4 mr-1"/>Agendar Férias</Button>
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="ft-table w-full text-sm">
          <thead><tr><th>Funcionário</th><th>Cargo</th><th>Período Aquisitivo</th><th>Vencimento</th><th>Dias</th><th>Status</th></tr></thead>
          <tbody>
            {ferias.length===0&&<tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma férias pendente</td></tr>}
            {ferias.map(f=>{
              const venc=new Date(f.periodo_aquisitivo_fim+"T00:00:00");
              const critico=venc<=em30; const vencido=venc<hoje&&f.status==="pendente";
              return (
                <tr key={f.id} className={vencido?"bg-red-50/50":critico?"bg-orange-50/50":""}>
                  <td className="font-medium">{f.funcionario?.nome??"—"}</td>
                  <td className="text-muted-foreground">{f.funcionario?.cargo??"—"}</td>
                  <td className="text-xs">{FMT_DATE(f.periodo_aquisitivo_ini)} – {FMT_DATE(f.periodo_aquisitivo_fim)}</td>
                  <td><span className={critico||vencido?"text-red-600 font-medium":""}>
                    {venc.toLocaleDateString("pt-BR")}{critico&&<AlertTriangle className="h-3 w-3 inline ml-1"/>}
                  </span></td>
                  <td>{f.dias_gozo}d</td>
                  <td><Badge variant={f.status==="vencida"?"destructive":"secondary"}>{f.status.charAt(0).toUpperCase()+f.status.slice(1)}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog open={showDialog} onOpenChange={setShow}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Agendar Férias</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-4">Selecione o funcionário e o período. Os valores devem ser calculados e registrados manualmente.</p>
          <DialogFooter><Button variant="outline" onClick={()=>setShow(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export function TabDP({ clienteId }: { clienteId: string }) {
  const navigate = useNavigate();
  return (
    <div className="animate-fade-up space-y-4">
      {/* Link para página completa */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate({ to: "/dp/$empresaId", params: { empresaId: clienteId } })}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir DP Completo
        </button>
      </div>
      <Tabs defaultValue="funcionarios">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="folha">Folha Mensal</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
        </TabsList>
        <TabsContent value="funcionarios" className="mt-4"><SubAbaFuncionarios clienteId={clienteId}/></TabsContent>
        <TabsContent value="folha" className="mt-4"><SubAbaFolha clienteId={clienteId}/></TabsContent>
        <TabsContent value="ferias" className="mt-4"><SubAbaFerias clienteId={clienteId}/></TabsContent>
      </Tabs>
    </div>
  );
}
export default TabDP;

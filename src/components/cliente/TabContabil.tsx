/**
 * TabContabil — Contabilidade
 * Sub-abas: Período | Lançamentos | Balancete | Conciliação Bancária
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Plus, CheckSquare, Printer, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useLancamentos, usePeriodosContabeis, usePlanoContas,
  useAbrirPeriodo, useFecharPeriodo, useExtratosBancarios,
  type Lancamento,
} from "@/hooks/use-contabil";

// ─── Utils ────────────────────────────────────────────────────────────────────
const FMT_BRL  = (v: number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const FMT_DATE = (d: string) => new Date(d+"T00:00:00").toLocaleDateString("pt-BR");
const MES_ATUAL = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const COMP_LABEL = (c: string) => { const [a,m]=c.split("-"); return `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][+m-1]}/${a}`; };
const MESES_LIST = () => Array.from({length:12},(_,i)=>{const d=new Date();d.setMonth(d.getMonth()-i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;});

// ─── Sub-aba Período ──────────────────────────────────────────────────────────
function SubAbaPeriodo({ clienteId, temEmpregados }: { clienteId: string; temEmpregados?: boolean }) {
  const { periodos, loading, refresh } = usePeriodosContabeis(clienteId);
  const { abrirPeriodo, loading: abrindo } = useAbrirPeriodo();
  const { fecharPeriodo, loading: fechando } = useFecharPeriodo();
  const [confirm, setConfirm] = useState<string|null>(null);
  const [novoComp, setNovoComp] = useState(MES_ATUAL());
  const atual = periodos.find(p=>p.competencia===MES_ATUAL());

  const CHECKLIST = [
    { id:"nf_entrada",    label:"NF-e de entrada escrituradas" },
    { id:"nf_saida",      label:"NF-e de saída escrituradas" },
    ...(temEmpregados ? [{ id:"folha", label:"Folha lançada" }] : []),
    { id:"conciliacao",   label:"Conciliação bancária 100%" },
    { id:"depreciacao",   label:"Depreciação lançada" },
    { id:"balancete",     label:"Balancete equilibrado" },
  ];
  const [checks, setChecks] = useState<Record<string,boolean>>({});
  const todosMarcados = CHECKLIST.every(c=>checks[c.id]);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Período atual */}
      <div className="surface-card p-4 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Período Atual — {COMP_LABEL(MES_ATUAL())}</h3>
          {atual
            ?<span className={`text-xs font-medium px-2 py-1 rounded-full ${atual.status==="aberto"?"bg-yellow-100 text-yellow-800":"bg-green-100 text-green-800"}`}>
              {atual.status==="aberto"?"Aberto":"Fechado"}
            </span>
            :<span className="text-xs text-muted-foreground">Sem período aberto</span>}
        </div>

        {!atual&&(
          <div className="flex items-center gap-3">
            <Select value={novoComp} onValueChange={setNovoComp}>
              <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
              <SelectContent>{MESES_LIST().map(c=><SelectItem key={c} value={c}>{COMP_LABEL(c)}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={async()=>{const ok=await abrirPeriodo(clienteId,novoComp);if(ok)refresh();}} disabled={abrindo}>
              <Plus className="h-4 w-4 mr-1"/>{abrindo?"Abrindo...":"Abrir Período"}
            </Button>
          </div>
        )}

        {atual?.status==="aberto"&&(
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">Checklist de Fechamento</p>
              {CHECKLIST.map(c=>(
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!checks[c.id]}
                    onChange={e=>setChecks(p=>({...p,[c.id]:e.target.checked}))}
                    className="rounded"/>
                  <span className={checks[c.id]?"line-through text-muted-foreground":""}>{c.label}</span>
                </label>
              ))}
            </div>
            {!confirm
              ?<Button size="sm" disabled={!todosMarcados} onClick={()=>setConfirm(atual.id)}>
                <CheckSquare className="h-4 w-4 mr-1"/>Fechar Período
              </Button>
              :<div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm flex-1">Confirmar fechamento de {COMP_LABEL(atual.competencia)}?</p>
                <Button size="sm" variant="destructive" onClick={async()=>{const ok=await fecharPeriodo(atual.id);if(ok){refresh();setConfirm(null);}}} disabled={fechando}>{fechando?"Fechando...":"Confirmar"}</Button>
                <Button size="sm" variant="ghost" onClick={()=>setConfirm(null)}>Cancelar</Button>
              </div>
            }
          </>
        )}
      </div>

      {/* Histórico */}
      <div>
        <p className="text-sm font-medium mb-3">Histórico de Períodos</p>
        <div className="rounded-md border overflow-hidden">
          <table className="ft-table w-full text-sm">
            <thead><tr><th>Competência</th><th>Status</th><th>Fechado em</th></tr></thead>
            <tbody>
              {periodos.length===0&&<tr><td colSpan={3} className="text-center text-muted-foreground py-6">Nenhum período registrado</td></tr>}
              {periodos.map(p=>(
                <tr key={p.id}>
                  <td>{COMP_LABEL(p.competencia)}</td>
                  <td><Badge variant={p.status==="aberto"?"secondary":"outline"}>{p.status==="aberto"?"Aberto":"Fechado"}</Badge></td>
                  <td>{p.fechado_em?FMT_DATE(p.fechado_em.split("T")[0]):"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Dialog Novo Lançamento ───────────────────────────────────────────────────
function NovoLancDialog({ open, onClose, clienteId, competencia, contas, onOk }:
  { open:boolean; onClose:()=>void; clienteId:string; competencia:string; contas:{id:string;codigo:string;nome:string}[]; onOk:()=>void }) {
  const [form, setForm] = useState({ data:"", historico:"", conta_debito:"", conta_credito:"", valor:"" });
  const s = (k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  const [saving, setSaving] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { supabase: _sb } = { supabase: null }; // unused
  const submit = async () => {
    if (!form.data||!form.historico||!form.conta_debito||!form.conta_credito||!form.valor) {
      toast.error("Preencha todos os campos"); return;
    }
    setSaving(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data:{user} } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("lancamentos_contabeis").insert({
        empresa_id: clienteId, data_lancamento: form.data, historico: form.historico,
        conta_debito: form.conta_debito, conta_credito: form.conta_credito,
        valor: parseFloat(form.valor), competencia, tipo: "manual",
        criado_por: user?.email, criado_por_tipo: "humano",
      });
      if (error) throw error;
      toast.success("Lançamento criado"); onOk(); onClose();
    } catch(e) { toast.error(e instanceof Error?e.message:"Erro ao salvar"); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Novo Lançamento Contábil</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Data *</Label><Input type="date" value={form.data} onChange={e=>s("data",e.target.value)}/></div>
            <div><Label>Valor *</Label><Input type="number" min="0" step="0.01" value={form.valor} onChange={e=>s("valor",e.target.value)} placeholder="0,00"/></div>
          </div>
          <div><Label>Histórico *</Label><Input value={form.historico} onChange={e=>s("historico",e.target.value)} placeholder="Descrição do lançamento"/></div>
          <div><Label>Conta Débito *</Label>
            <Select value={form.conta_debito} onValueChange={v=>s("conta_debito",v)}>
              <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
              <SelectContent>{contas.map(c=><SelectItem key={c.id} value={c.codigo}>{c.codigo} — {c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Conta Crédito *</Label>
            <Select value={form.conta_credito} onValueChange={v=>s("conta_credito",v)}>
              <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
              <SelectContent>{contas.map(c=><SelectItem key={c.id} value={c.codigo}>{c.codigo} — {c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.conta_debito===form.conta_credito&&form.conta_debito&&(
            <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Conta débito e crédito iguais</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving||form.conta_debito===form.conta_credito}>{saving?"Salvando...":"Criar Lançamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-aba Lançamentos ──────────────────────────────────────────────────────
function SubAbaLancamentos({ clienteId }: { clienteId: string }) {
  const [comp, setComp] = useState(MES_ATUAL());
  const { lancamentos, loading, totais, refresh } = useLancamentos(clienteId, comp);
  const { contas } = usePlanoContas(clienteId);
  const [filtroContas, setFiltroContas] = useState("todas");
  const [novoOpen, setNovoOpen] = useState(false);
  const desequilibrado = totais.totalDebito!==totais.totalCredito&&(totais.totalDebito>0||totais.totalCredito>0);

  const lista = filtroContas==="todas" ? lancamentos
    : lancamentos.filter((l:Lancamento)=>l.conta_debito===filtroContas||l.conta_credito===filtroContas);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={comp} onValueChange={setComp}>
          <SelectTrigger className="w-36"><SelectValue/></SelectTrigger>
          <SelectContent>{MESES_LIST().map(c=><SelectItem key={c} value={c}>{COMP_LABEL(c)}</SelectItem>)}</SelectContent>
        </Select>
        {contas.length>0&&(
          <Select value={filtroContas} onValueChange={setFiltroContas}>
            <SelectTrigger className="w-60"><SelectValue placeholder="Filtrar por conta"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              {contas.map(c=><SelectItem key={c.id} value={c.codigo}>{c.codigo} — {c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={()=>setNovoOpen(true)}><Plus className="h-4 w-4 mr-1"/>Novo Lançamento</Button>
        </div>
      </div>

      {desequilibrado&&(
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0"/>
          <span>Débitos ({FMT_BRL(totais.totalDebito)}) ≠ Créditos ({FMT_BRL(totais.totalCredito)}). Verifique os lançamentos.</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="surface-card p-3 rounded-lg"><p className="text-xs text-muted-foreground">Total Débitos</p><p className="font-bold">{FMT_BRL(totais.totalDebito)}</p></div>
        <div className="surface-card p-3 rounded-lg"><p className="text-xs text-muted-foreground">Total Créditos</p><p className="font-bold">{FMT_BRL(totais.totalCredito)}</p></div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="ft-table w-full text-sm">
          <thead><tr><th>Data</th><th>Histórico</th><th>Débito</th><th>Crédito</th><th className="text-right">Valor</th><th>Origem</th></tr></thead>
          <tbody>
            {lista.length===0&&<tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lançamento para {COMP_LABEL(comp)}</td></tr>}
            {lista.map((l:Lancamento)=>(
              <tr key={l.id}>
                <td className="text-xs">{FMT_DATE(l.data_lancamento)}</td>
                <td>{l.historico}</td>
                <td className="font-mono text-xs">{l.conta_debito}</td>
                <td className="font-mono text-xs">{l.conta_credito}</td>
                <td className="text-right font-medium">{FMT_BRL(l.valor)}</td>
                <td><Badge variant={l.criado_por_tipo==="agente"?"secondary":"outline"} className="text-xs">
                  {l.criado_por_tipo==="agente"?"Agente":"Manual"}
                </Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NovoLancDialog open={novoOpen} onClose={()=>setNovoOpen(false)}
        clienteId={clienteId} competencia={comp} contas={contas} onOk={refresh}/>
    </div>
  );
}

// ─── Sub-aba Balancete ────────────────────────────────────────────────────────
function SubAbaBalancete({ clienteId }: { clienteId: string }) {
  const [comp, setComp] = useState(MES_ATUAL());
  const { lancamentos, loading } = useLancamentos(clienteId, comp);
  const { contas } = usePlanoContas(clienteId);

  // Agrupar por tipo de conta
  const grupos: Record<string, { nome:string; debitos:number; creditos:number }> = {};
  for (const l of lancamentos) {
    const cd = contas.find(c=>c.codigo===l.conta_debito);
    const cc = contas.find(c=>c.codigo===l.conta_credito);
    if (cd) { if (!grupos[cd.tipo]) grupos[cd.tipo]={nome:cd.tipo,debitos:0,creditos:0}; grupos[cd.tipo].debitos+=l.valor; }
    if (cc) { if (!grupos[cc.tipo]) grupos[cc.tipo]={nome:cc.tipo,debitos:0,creditos:0}; grupos[cc.tipo].creditos+=l.valor; }
  }

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={comp} onValueChange={setComp}>
          <SelectTrigger className="w-36"><SelectValue/></SelectTrigger>
          <SelectContent>{MESES_LIST().map(c=><SelectItem key={c} value={c}>{COMP_LABEL(c)}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={()=>window.print()}>
          <Printer className="h-4 w-4 mr-1"/>Exportar PDF
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="ft-table w-full text-sm">
          <thead><tr><th>Grupo / Conta</th><th className="text-right">Débitos</th><th className="text-right">Créditos</th><th className="text-right">Saldo</th></tr></thead>
          <tbody>
            {Object.keys(grupos).length===0&&<tr><td colSpan={4} className="text-center text-muted-foreground py-8">Nenhum lançamento em {COMP_LABEL(comp)}</td></tr>}
            {Object.entries(grupos).map(([tipo,g])=>(
              <tr key={tipo}>
                <td className="font-medium capitalize">{tipo.replace("_"," ")}</td>
                <td className="text-right">{FMT_BRL(g.debitos)}</td>
                <td className="text-right">{FMT_BRL(g.creditos)}</td>
                <td className="text-right font-semibold">{FMT_BRL(g.debitos-g.creditos)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2">
              <td>Total</td>
              <td className="text-right">{FMT_BRL(Object.values(grupos).reduce((s,g)=>s+g.debitos,0))}</td>
              <td className="text-right">{FMT_BRL(Object.values(grupos).reduce((s,g)=>s+g.creditos,0))}</td>
              <td className="text-right">{FMT_BRL(Object.values(grupos).reduce((s,g)=>s+g.debitos-g.creditos,0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-aba Conciliação ──────────────────────────────────────────────────────
function SubAbaConciliacao({ clienteId }: { clienteId: string }) {
  const [comp, setComp] = useState(MES_ATUAL());
  const { extratos, loading, conciliados, pendentes, refresh } = useExtratosBancarios(clienteId, comp);

  const conciliar = async (extratoId: string) => {
    const { supabase } = await import("@/integrations/supabase/client");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("extrato_bancario").update({ conciliado:true }).eq("id",extratoId);
    if (!error) { toast.success("Conciliado"); refresh(); }
    else toast.error("Erro ao conciliar");
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={comp} onValueChange={setComp}>
          <SelectTrigger className="w-36"><SelectValue/></SelectTrigger>
          <SelectContent>{MESES_LIST().map(c=><SelectItem key={c} value={c}>{COMP_LABEL(c)}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1 text-sm text-green-600"><CheckCircle2 className="h-4 w-4"/>{conciliados} conciliados</span>
          <span className="flex items-center gap-1 text-sm text-yellow-600"><Clock className="h-4 w-4"/>{pendentes} pendentes</span>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="ft-table w-full text-sm">
          <thead><tr><th>Data</th><th>Descrição</th><th className="text-right">Valor</th><th>Tipo</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {extratos.length===0&&<tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhum extrato para {COMP_LABEL(comp)}</td></tr>}
            {extratos.map(e=>(
              <tr key={e.id} className={!e.conciliado?"bg-yellow-50/30":""}>
                <td className="text-xs">{FMT_DATE(e.data_movimento)}</td>
                <td>{e.descricao}</td>
                <td className="text-right font-medium">{FMT_BRL(e.valor)}</td>
                <td><Badge variant={e.tipo==="credito"?"default":"secondary"}>{e.tipo==="credito"?"Crédito":"Débito"}</Badge></td>
                <td>
                  {e.conciliado
                    ?<span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 className="h-3 w-3"/>Conciliado</span>
                    :<span className="flex items-center gap-1 text-yellow-600 text-xs"><Clock className="h-3 w-3"/>Pendente</span>}
                </td>
                <td>
                  {!e.conciliado&&<Button size="sm" variant="ghost" onClick={()=>conciliar(e.id)}>
                    <CheckCircle2 className="h-4 w-4"/>
                  </Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export function TabContabil({ clienteId, temEmpregados }: { clienteId: string; temEmpregados?: boolean }) {
  return (
    <div className="animate-fade-up space-y-4">
      <Tabs defaultValue="periodo">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="periodo">Período</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="balancete">Balancete</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
        </TabsList>
        <TabsContent value="periodo" className="mt-4"><SubAbaPeriodo clienteId={clienteId} temEmpregados={temEmpregados}/></TabsContent>
        <TabsContent value="lancamentos" className="mt-4"><SubAbaLancamentos clienteId={clienteId}/></TabsContent>
        <TabsContent value="balancete" className="mt-4"><SubAbaBalancete clienteId={clienteId}/></TabsContent>
        <TabsContent value="conciliacao" className="mt-4"><SubAbaConciliacao clienteId={clienteId}/></TabsContent>
      </Tabs>
    </div>
  );
}
export default TabContabil;

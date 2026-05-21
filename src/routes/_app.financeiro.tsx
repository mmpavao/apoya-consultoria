import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, DollarSign,
  Link2, Loader2, MessageCircle, ShieldAlert, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef, type BadgeColor } from "@/components/DataTable";
import { financeiroStore, type Cobranca, type CobrancaStatus, type ReguaStage } from "@/lib/financeiro-store";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const ST_C: Record<CobrancaStatus, BadgeColor> = { pendente:"blue", paga:"green", vencida:"red", cancelada:"gray" };
const ST_L: Record<CobrancaStatus, string>     = { pendente:"Pendente", paga:"Paga", vencida:"Vencida", cancelada:"Cancelada" };
const RG_C: Record<ReguaStage, BadgeColor>     = { ok:"green", lembrete:"blue", cobranca:"amber" as BadgeColor, negativacao:"orange", suspensao:"red" };
const RG_L: Record<ReguaStage, string>         = { ok:"Em dia", lembrete:"Lembrete", cobranca:"Cobrança", negativacao:"Negativação", suspensao:"Suspensão" };

const fmtBRL = (v:number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

function FinanceiroPage(){
  const now = new Date();
  const [ano, setAno]       = useState(now.getFullYear());
  const [mes, setMes]       = useState(now.getMonth()+1);
  const [items, setItems]   = useState<Cobranca[]>([]);
  const [query, setQuery]   = useState("");
  const [status, setStatus] = useState<"todos"|CobrancaStatus>("todos");
  const [stage, setStage]   = useState<"todos"|ReguaStage>("todos");
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const [busy, setBusy]     = useState(false);
  const comp = `${ano}-${mes.toString().padStart(2,"0")}`;

  useEffect(()=>{
    const fn=()=>setItems(financeiroStore.listByCompetencia(comp));
    fn();
    window.addEventListener("apoya:financeiro:changed",fn);
    window.addEventListener("apoya:clientes:changed",fn);
    return ()=>{ window.removeEventListener("apoya:financeiro:changed",fn); window.removeEventListener("apoya:clientes:changed",fn); };
  },[comp]);
  useEffect(()=>setSel(new Set()),[comp]);

  const filtered = useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items
      .filter(c=>q?`${c.clienteNome} ${c.cnpj}`.toLowerCase().includes(q):true)
      .filter(c=>status==="todos"||c.status===status)
      .filter(c=>stage==="todos"||c.reguaStage===stage)
      .sort((a,b)=>b.diasAtraso-a.diasAtraso||a.clienteNome.localeCompare(b.clienteNome));
  },[items,query,status,stage]);

  const kpi = useMemo(()=>({
    total:   items.reduce((s,c)=>s+c.valor,0),
    pago:    items.filter(c=>c.status==="paga").reduce((s,c)=>s+c.valor,0),
    vencido: items.filter(c=>c.status==="vencida").reduce((s,c)=>s+c.valor,0),
    inad:    items.filter(c=>c.reguaStage==="suspensao"||c.reguaStage==="negativacao").length,
    count:   items.length,
  }),[items]);

  const toggleAll=()=>setSel(sel.size===filtered.length?new Set():new Set(filtered.map(c=>c.id)));
  const toggleOne=(id:string)=>{ const s=new Set(sel); s.has(id)?s.delete(id):s.add(id); setSel(s); };

  async function gerarAsaas(){
    const ids=filtered.filter(c=>sel.has(c.id)&&!c.asaasId).map(c=>c.id);
    if(!ids.length){ toast.error("Selecione cobranças sem link Asaas"); return; }
    setBusy(true);
    toast.loading(`Gerando ${ids.length} cobrança(s)…`,{id:"fin-asaas"});
    await new Promise(r=>setTimeout(r,900));
    ids.forEach(id=>financeiroStore.update(id,{asaasId:`ASAAS_${id.slice(-6).toUpperCase()}`,linkPagamento:`https://pay.asaas.com/mock/${id.slice(-6)}`}));
    toast.success(`${ids.length} cobrança(s) gerada(s)`,{id:"fin-asaas"});
    setBusy(false); setSel(new Set());
  }
  async function enviarWpp(){
    const ids=filtered.filter(c=>sel.has(c.id)).map(c=>c.id);
    if(!ids.length){ toast.error("Selecione ao menos uma cobrança"); return; }
    setBusy(true);
    toast.loading(`Enviando ${ids.length} msg…`,{id:"fin-wpp"});
    await new Promise(r=>setTimeout(r,700));
    ids.forEach(id=>financeiroStore.update(id,{ultimoEnvioWhatsapp:new Date().toISOString()}));
    toast.success(`${ids.length} mensagem(ns) enviada(s)`,{id:"fin-wpp"});
    setBusy(false); setSel(new Set());
  }

  const cols: ColDef<Cobranca>[] = [
    {
      key:"cliente", header:"Cliente",
      cell: c=>(
        <div style={{overflow:"visible",whiteSpace:"normal"}}>
          <div className="font-medium text-foreground leading-tight">{c.clienteNome}</div>
          <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{c.cnpj}</div>
        </div>
      ),
    },
    {
      key:"descricao", header:"Descrição",
      headerClassName:"hidden lg:table-cell", className:"hidden lg:table-cell text-sm text-muted-foreground",
      cell: c=><span className="line-clamp-1 max-w-[160px]">{c.descricao}</span>,
    },
    {
      key:"vencimento", header:"Vencimento",
      headerClassName:"hidden md:table-cell", className:"hidden md:table-cell",
      cell: c=>{
        const late=c.diasAtraso>0&&c.status!=="paga";
        return (
          <div style={{overflow:"visible",whiteSpace:"normal"}}>
            <div className={late?"font-semibold text-red-600":""}>
              {new Date(c.vencimento+"T12:00:00").toLocaleDateString("pt-BR")}
            </div>
            {late && <div className="text-[10px] text-red-500">{c.diasAtraso}d atraso</div>}
          </div>
        );
      },
    },
    {
      key:"regua", header:"Régua",
      headerClassName:"hidden sm:table-cell", className:"hidden sm:table-cell",
      cell: c=><InlineBadge color={RG_C[c.reguaStage]} dot>{RG_L[c.reguaStage]}</InlineBadge>,
    },
    {
      key:"valor", header:"Valor",
      headerClassName:"text-right", className:"text-right tabular-nums font-semibold",
      cell: c=>fmtBRL(c.valor),
    },
    {
      key:"status", header:"Status",
      cell: c=>(
        <div style={{overflow:"visible",whiteSpace:"normal"}}>
          <InlineBadge color={ST_C[c.status]} dot>{ST_L[c.status]}</InlineBadge>
          {c.ultimoEnvioWhatsapp && <div className="text-[10px] text-emerald-600 mt-0.5">✓ WhatsApp</div>}
          {c.asaasId && <div className="text-[10px] text-muted-foreground">Asaas ✓</div>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">

      {/* Header + nav mês */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Régua de cobrança · {MESES[mes-1]} {ano}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground"
            onClick={()=>{let m=mes-1,a=ano;if(m<1){m=12;a--;}setMes(m);setAno(a);}}>‹</Button>
          <span className="min-w-[110px] text-center text-sm font-semibold">{MESES[mes-1]} {ano}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground"
            onClick={()=>{let m=mes+1,a=ano;if(m>12){m=1;a++;}setMes(m);setAno(a);}}>›</Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {icon:Wallet,       label:"Total previsto", val:fmtBRL(kpi.total),   color:"text-foreground",  bg:"bg-card",       sub:`${kpi.count} clientes`},
          {icon:CheckCircle2, label:"Recebido",       val:fmtBRL(kpi.pago),    color:"text-emerald-600", bg:"bg-emerald-50", sub:`${Math.round(kpi.pago/(kpi.total||1)*100)}%`},
          {icon:AlertTriangle,label:"Em atraso",      val:fmtBRL(kpi.vencido), color:"text-red-600",     bg:"bg-red-50",     sub:`${items.filter(c=>c.status==="vencida").length} cobranças`},
          {icon:ShieldAlert,  label:"Risco alto",     val:`${kpi.inad}`,       color:"text-orange-600",  bg:"bg-orange-50",  sub:"negativação/suspensão"},
        ].map(({icon:Icon,label,val,color,bg,sub})=>(
          <div key={label} className={`ds-card flex items-start gap-3 p-3 ${bg}`}>
            <div className={`ds-icon-pill bg-white/60 shadow-sm ${color}`} style={{width:"2rem",height:"2rem",borderRadius:"0.5rem"}}>
              <Icon className="h-4 w-4 m-auto"/>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className={`truncate text-base font-bold tabular-nums ${color}`}>{val}</p>
              <p className="text-[11px] text-muted-foreground">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Barra de ações em lote */}
      {sel.size>0 && (
        <div className="flex items-center gap-3 rounded-xl border bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{sel.size} selecionada(s)</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-7 rounded-xl text-xs gap-1" disabled={busy} onClick={gerarAsaas}>
              {busy?<Loader2 className="h-3 w-3 animate-spin"/>:<Link2 className="h-3 w-3"/>} Gerar Asaas
            </Button>
            <Button size="sm" variant="outline" className="h-7 rounded-xl text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              disabled={busy} onClick={enviarWpp}>
              <MessageCircle className="h-3 w-3"/> WhatsApp
            </Button>
            <Button size="sm" variant="ghost" className="h-7 rounded-xl text-xs" onClick={()=>setSel(new Set())}>Cancelar</Button>
          </div>
        </div>
      )}

      <DataTable
        rows={filtered}
        cols={cols}
        getKey={c=>c.id}
        selected={sel}
        onToggleAll={toggleAll}
        onToggleRow={toggleOne}
        emptyIcon={<DollarSign className="h-8 w-8"/>}
        emptyText="Nenhuma cobrança encontrada"
        rowClassName={c=>c.reguaStage==="suspensao"?"bg-red-50/40":c.reguaStage==="negativacao"?"bg-orange-50/40":""}
        toolbar={
          <>
            <TableSearch value={query} onChange={setQuery} placeholder="Buscar cliente ou CNPJ…"/>
            <Select value={status} onValueChange={v=>setStatus(v as typeof status)}>
              <SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="vencida">Vencida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stage} onValueChange={v=>setStage(v as typeof stage)}>
              <SelectTrigger className="h-8 w-36 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Toda a régua</SelectItem>
                <SelectItem value="ok">Em dia</SelectItem>
                <SelectItem value="lembrete">Lembrete</SelectItem>
                <SelectItem value="cobranca">Cobrança</SelectItem>
                <SelectItem value="negativacao">Negativação</SelectItem>
                <SelectItem value="suspensao">Suspensão</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <TableFooter total={items.length} filtered={filtered.length} selected={sel.size}/>
    </div>
  );
}

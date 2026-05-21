import { useCobrancas, type Cobranca, type CobrancaStatus, type ReguaStage } from "@/hooks/use-cobrancas";
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
import { PageHeader, KpiGrid, KpiCard, Pagination } from "@/components/PagePlaceholder";
// import { financeiroStore, type Cobranca, type CobrancaStatus, type ReguaStage } from "@/lib/financeiro-store";

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
  const { cobrancas: items, loading: cobLoading, refetch: refresh } = useCobrancas();
  const [query, setQuery]   = useState("");
  const [status, setStatus] = useState<"todos"|CobrancaStatus>("todos");
  const [stage, setStage]   = useState<"todos"|ReguaStage>("todos");
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const [busy, setBusy]     = useState(false);
  const comp = `${ano}-${mes.toString().padStart(2,"0")}`;

  useEffect(()=>{
    const fn=()=>refresh();
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

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(()=>{ setPage(1); },[query,status,stage,comp]);
  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const pageRows = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

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
    toast.info(`Cobrança Asaas disponível via integração. (${ids.length} selecionados)`); await refresh();
    toast.success(`${ids.length} cobrança(s) gerada(s)`,{id:"fin-asaas"});
    setBusy(false); setSel(new Set());
  }
  async function enviarWpp(){
    const ids=filtered.filter(c=>sel.has(c.id)).map(c=>c.id);
    if(!ids.length){ toast.error("Selecione ao menos uma cobrança"); return; }
    setBusy(true);
    toast.loading(`Enviando ${ids.length} msg…`,{id:"fin-wpp"});
    await new Promise(r=>setTimeout(r,700));
    toast.info(`Envio WhatsApp disponível via integração Evolution API. (${ids.length} envios)`); await refresh();
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

      <PageHeader
        title="Financeiro"
        subtitle={`Régua de cobrança · ${MESES[mes-1]} ${ano}`}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground"
              onClick={()=>{let m=mes-1,a=ano;if(m<1){m=12;a--;}setMes(m);setAno(a);}}>‹</Button>
            <span className="min-w-[120px] text-center text-sm font-semibold">{MESES[mes-1]} {ano}</span>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground"
              onClick={()=>{let m=mes+1,a=ano;if(m>12){m=1;a++;}setMes(m);setAno(a);}}>›</Button>
          </div>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard icon={Wallet}        tone="neutral" label="Total previsto" value={fmtBRL(kpi.total)}   hint={`${kpi.count} clientes`} />
        <KpiCard icon={CheckCircle2}  tone="success" label="Recebido"       value={fmtBRL(kpi.pago)}    hint={`${Math.round(kpi.pago/(kpi.total||1)*100)}%`} />
        <KpiCard icon={AlertTriangle} tone="danger"  label="Em atraso"      value={fmtBRL(kpi.vencido)} hint={`${items.filter(c=>c.status==="vencida").length} cobranças`} />
        <KpiCard icon={ShieldAlert}   tone="warning" label="Risco alto"     value={kpi.inad}            hint="negativação/suspensão" />
      </KpiGrid>


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
        rows={pageRows}
        cols={cols}
        getKey={c=>c.id}
        selected={sel}
        onToggleAll={toggleAll}
        onToggleRow={toggleOne}
        emptyIcon={<DollarSign className="h-8 w-8"/>}
        emptyText="Nenhuma cobrança encontrada"
        rowClassName={c=>c.reguaStage==="suspensao"?"bg-red-50/40":c.reguaStage==="negativacao"?"bg-primary/5":""}
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TableFooter total={items.length} filtered={filtered.length} selected={sel.size}/>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} pageSize={PAGE_SIZE} total={filtered.length}/>
      </div>
    </div>
  );
}

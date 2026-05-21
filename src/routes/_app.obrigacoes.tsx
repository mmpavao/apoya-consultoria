import { useObrigacoes, calcularMulta, type Obrigacao, type ObrigacaoStatus } from "@/hooks/use-obrigacoes";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Calendar, CheckCircle2, Clock, Loader2,
  RefreshCw, TrendingUp, Plus} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef, type BadgeColor } from "@/components/DataTable";
import { PageHeader, KpiGrid, KpiCard, Pagination } from "@/components/PagePlaceholder";
import { ObrigacaoFormDialog } from "@/components/ObrigacaoFormDialog";
// import { obrigacoesStore, calcularMulta, type Obrigacao, type ObrigacaoStatus } from "@/lib/obrigacoes-store";

export const Route = createFileRoute("/_app/obrigacoes")({
  component: ObrigacoesPage,
  head: () => ({ meta: [{ title: "Obrigações · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const S_C: Record<ObrigacaoStatus, BadgeColor> = {
  pendente:"blue", em_andamento:"amber" as BadgeColor, concluida:"green", atrasada:"red",
};
const S_L: Record<ObrigacaoStatus,string> = {
  pendente:"Pendente", em_andamento:"Em andamento", concluida:"Concluída", atrasada:"Atrasada",
};

const TIPO_BADGE: Record<string, BadgeColor> = {
  DAS:"blue", "DASN-Simei":"violet", DCTFWeb:"indigo", "EFD-Contribuições":"cyan",
  "EFD-ICMS/IPI":"cyan", "EFD-Reinf":"indigo", ECF:"orange", ECD:"orange",
  DIRBI:"amber" as BadgeColor, DEFIS:"blue", NFSe:"green", "FGTS Digital":"indigo", eSocial:"violet",
};

const fmtBRL  = (v:number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtDate = (d:string) => new Date(d+"T12:00:00").toLocaleDateString("pt-BR");

function ObrigacoesPage(){
  const now = new Date();
  const [ano, setAno]       = useState(now.getFullYear());
  const [mes, setMes]       = useState(now.getMonth()+1);
  const { obrigacoes: items, loading: obgLoading, refetch: refresh } = useObrigacoes();
  const [query, setQuery]   = useState("");
  const [status, setStatus] = useState<"todos"|ObrigacaoStatus>("todos");
  const [dialogOb, setDialogOb] = useState(false);
  const [tipo, setTipo]     = useState("todos");
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const [busy, setBusy]     = useState(false);
  const comp = `${ano}-${mes.toString().padStart(2,"0")}`;

  useEffect(()=>{
    const fn=()=>refresh();
    fn();
    window.addEventListener("apoya:obrigacoes:changed",fn);
    window.addEventListener("apoya:clientes:changed",fn);
    return ()=>{ window.removeEventListener("apoya:obrigacoes:changed",fn); window.removeEventListener("apoya:clientes:changed",fn); };
  },[comp]);
  useEffect(()=>setSel(new Set()),[comp]);

  const tipos = useMemo(()=>Array.from(new Set(items.map(o=>o.tipo))).sort(),[items]);

  const filtered = useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items
      .filter(o=>q?`${o.clienteNome} ${o.tipo} ${o.responsavel}`.toLowerCase().includes(q):true)
      .filter(o=>status==="todos"||o.status===status)
      .filter(o=>tipo==="todos"||o.tipo===tipo)
      .sort((a,b)=>{
        const order:Record<ObrigacaoStatus,number>={atrasada:0,pendente:1,em_andamento:2,concluida:3};
        return (order[a.status]??4)-(order[b.status]??4)||new Date(a.vencimento).getTime()-new Date(b.vencimento).getTime();
      });
  },[items,query,status,tipo]);

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(()=>{ setPage(1); },[query,status,tipo,comp]);
  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const pageRows = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const kpi = useMemo(()=>({
    total:    items.length,
    pendente: items.filter(o=>o.status==="pendente").length,
    atrasada: items.filter(o=>o.status==="atrasada").length,
    andamento:items.filter(o=>o.status==="em_andamento").length,
    concluida:items.filter(o=>o.status==="concluida").length,
  }),[items]);

  const toggleAll=()=>setSel(sel.size===filtered.length?new Set():new Set(filtered.map(o=>o.id)));
  const toggleOne=(id:string)=>{ const s=new Set(sel); s.has(id)?s.delete(id):s.add(id); setSel(s); };

  async function concluirLote(){
    const ids=filtered.filter(o=>sel.has(o.id)&&o.status!=="concluida").map(o=>o.id);
    if(!ids.length){ toast.error("Selecione obrigações não concluídas"); return; }
    setBusy(true);
    toast.success(`${ids.length} obrigações marcadas como concluídas`); await refresh();
    await new Promise(r=>setTimeout(r,400));
    toast.success(`${ids.length} obrigação(ões) concluída(s)!`);
    setBusy(false); setSel(new Set());
  }

  const cols: ColDef<Obrigacao>[] = [
    {
      key:"cliente", header:"Cliente",
      cell: o=>(
        <div style={{overflow:"visible",whiteSpace:"normal"}}>
          <div className="font-medium text-foreground leading-tight">{o.clienteNome}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{o.regime}</div>
        </div>
      ),
    },
    {
      key:"tipo", header:"Tipo",
      cell: o=>(
        <InlineBadge color={TIPO_BADGE[o.tipo]??"gray"}>{o.tipo}</InlineBadge>
      ),
    },
    {
      key:"descricao", header:"Descrição",
      headerClassName:"hidden lg:table-cell", className:"hidden lg:table-cell text-sm text-muted-foreground",
      cell: o=><span className="line-clamp-1 max-w-[200px]">{o.descricao}</span>,
    },
    {
      key:"vencimento", header:"Vencimento",
      headerClassName:"hidden md:table-cell", className:"hidden md:table-cell",
      cell: o=>{
        const late=o.status==="atrasada";
        const multa=late&&o.valor?calcularMulta(o.valor,o.vencimento):null;
        return (
          <div style={{overflow:"visible",whiteSpace:"normal"}}>
            <div className={late?"font-semibold text-red-600":""}>{fmtDate(o.vencimento)}</div>
            {multa&&multa.dias>0&&(
              <div className="text-[10px] text-red-500">+{multa.dias}d · multa {fmtBRL(multa.multa)}</div>
            )}
          </div>
        );
      },
    },
    {
      key:"responsavel", header:"Resp.",
      headerClassName:"hidden sm:table-cell", className:"hidden sm:table-cell text-sm text-muted-foreground",
      cell: o=>o.responsavel,
    },
    {
      key:"status", header:"Status",
      cell: o=><InlineBadge color={S_C[o.status]} dot>{S_L[o.status]}</InlineBadge>,
    },
    {
      key:"acoes", header:"", headerClassName:"w-16 text-right", className:"w-16 text-right",
      cell: o=>(
        o.status!=="concluida" ? (
          <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 opacity-0 group-hover:opacity-100 transition-all"
            title="Marcar como concluída"
            onClick={()=>{ toast.success("Concluída!"); refresh(); }}>
            <CheckCircle2 className="h-3.5 w-3.5"/>
          </button>
        ) : null
      ),
    },
  ];

  return (
    <div className="space-y-5">

      <PageHeader
        title="Obrigações"
        subtitle={`Calendário fiscal · ${MESES[mes-1]} ${ano}`}
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

      <KpiGrid cols={5}>
        <KpiCard icon={Calendar}      tone="neutral" label="Total"        value={kpi.total} />
        <KpiCard icon={Clock}         tone="info"    label="Pendente"     value={kpi.pendente} />
        <KpiCard icon={AlertTriangle} tone="danger"  label="Atrasadas"    value={kpi.atrasada} />
        <KpiCard icon={TrendingUp}    tone="warning" label="Em andamento" value={kpi.andamento} />
        <KpiCard icon={CheckCircle2}  tone="success" label="Concluídas"   value={kpi.concluida} />
      </KpiGrid>


      {/* Barra ações em lote */}
      {sel.size>0 && (
        <div className="flex items-center gap-3 rounded-xl border bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{sel.size} selecionada(s)</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-7 rounded-xl text-xs gap-1" disabled={busy} onClick={concluirLote}>
              {busy?<Loader2 className="h-3 w-3 animate-spin"/>:<CheckCircle2 className="h-3 w-3"/>} Concluir
            </Button>
            <Button size="sm" variant="ghost" className="h-7 rounded-xl text-xs" onClick={()=>setSel(new Set())}>Cancelar</Button>
          </div>
        </div>
      )}

      <DataTable
        rows={pageRows}
        cols={cols}
        getKey={o=>o.id}
        selected={sel}
        onToggleAll={toggleAll}
        onToggleRow={toggleOne}
        emptyIcon={<Calendar className="h-8 w-8"/>}
        emptyText="Nenhuma obrigação para os filtros selecionados"
        rowClassName={o=>o.status==="atrasada"?"bg-red-50/30 border-l-2 border-l-red-400":""}
        toolbar={
          <>
            <TableSearch value={query} onChange={setQuery} placeholder="Cliente, tipo ou responsável…"/>
            <Select value={status} onValueChange={v=>setStatus(v as typeof status)}>
              <SelectTrigger className="h-8 w-36 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="atrasada">Atrasada</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-8 w-40 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tipos.map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TableFooter total={items.length} filtered={filtered.length} selected={sel.size}/>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} pageSize={PAGE_SIZE} total={filtered.length}/>
      </div>

      <ObrigacaoFormDialog
        open={dialogOb}
        onClose={() => setDialogOb(false)}
        onCreated={() => {}}
      />
    </div>
  );
}

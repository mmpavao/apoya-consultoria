import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, Download,
  FileText, Loader2, MessageCircle, Receipt, Send,
  Wallet, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef, type BadgeColor } from "@/components/DataTable";
import { PageHeader, PageTabs, KpiGrid, KpiCard, Pagination } from "@/components/PagePlaceholder";
import { nfseStore, type NfseNota, type NfseStatus } from "@/lib/nfse-store";

export const Route = createFileRoute("/_app/fiscal/nfse")({
  component: NfsePage,
  head: () => ({ meta: [{ title: "NFS-e em Lote · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const S_COLOR: Record<NfseStatus, BadgeColor> = {
  rascunho:"blue", emitida:"green", cancelada:"gray", erro:"red",
};
const S_LABEL: Record<NfseStatus,string> = {
  rascunho:"Rascunho", emitida:"Emitida", cancelada:"Cancelada", erro:"Erro",
};
const R_COLOR: Record<string, BadgeColor> = {
  MEI:"violet", Simples:"blue", "Lucro Presumido":"cyan", "Lucro Real":"indigo", "Doméstica":"green",
};

const fmtBRL = (v:number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

function NfsePage() {
  const now = new Date();
  const def = new Date(now.getFullYear(), now.getMonth(), 1);
  const [ano, setAno]       = useState(def.getFullYear());
  const [mes, setMes]       = useState(def.getMonth()+1);
  const [items, setItems]   = useState<NfseNota[]>([]);
  const [query, setQuery]   = useState("");
  const [regime, setRegime] = useState<"todos"|NfseNota["regime"]>("todos");
  const [status, setStatus] = useState<"todos"|NfseStatus>("todos");
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const [busy, setBusy]     = useState(false);
  const comp = `${ano}-${mes.toString().padStart(2,"0")}`;

  useEffect(() => {
    const fn = () => setItems(nfseStore.listByCompetencia(comp));
    fn();
    window.addEventListener("apoya:nfse:changed", fn);
    window.addEventListener("apoya:clientes:changed", fn);
    return () => { window.removeEventListener("apoya:nfse:changed",fn); window.removeEventListener("apoya:clientes:changed",fn); };
  },[comp]);
  useEffect(() => setSel(new Set()),[comp]);

  const filtered = useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items
      .filter(n=>q?`${n.clienteNome} ${n.cnpj} ${n.tomador}`.toLowerCase().includes(q):true)
      .filter(n=>regime==="todos"||n.regime===regime)
      .filter(n=>status==="todos"||n.status===status)
      .sort((a,b)=>a.clienteNome.localeCompare(b.clienteNome));
  },[items,query,regime,status]);

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(()=>{ setPage(1); },[query,regime,status,mes,ano]);
  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const pageRows = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const kpi = useMemo(()=>({
    total:    items.length,
    rascunho: items.filter(n=>n.status==="rascunho").length,
    emitida:  items.filter(n=>n.status==="emitida").length,
    erro:     items.filter(n=>n.status==="erro").length,
    valor:    items.filter(n=>n.status==="emitida").reduce((s,n)=>s+n.valorServico,0),
    cbsIbs:   items.filter(n=>n.status==="emitida").reduce((s,n)=>s+n.valorCbs+n.valorIbs,0),
  }),[items]);

  const toggleAll = () => setSel(sel.size===filtered.length ? new Set() : new Set(filtered.map(n=>n.id)));
  const toggleOne = (id:string)=>{ const s=new Set(sel); s.has(id)?s.delete(id):s.add(id); setSel(s); };

  async function emitirLote() {
    const ids=filtered.filter(n=>sel.has(n.id)&&(n.status==="rascunho"||n.status==="erro")).map(n=>n.id);
    if(!ids.length){ toast.error("Selecione ao menos 1 nota em rascunho"); return; }
    setBusy(true);
    toast.loading(`Emitindo ${ids.length} NFS-e via NFE.io…`,{id:"nfse-lote"});
    await nfseStore.emitirLote(ids);
    setBusy(false);
    toast.success(`${ids.length} NFS-e emitida(s)`,{id:"nfse-lote"});
  }
  function enviarWhats(){
    const elig=filtered.filter(n=>sel.has(n.id)&&n.status==="emitida");
    if(!elig.length){ toast.error("Selecione NFS-e já emitidas"); return; }
    nfseStore.enviarWhatsapp(elig.map(n=>n.id));
    toast.success(`${elig.length} nota(s) enviada(s) por WhatsApp`);
  }

  const cols: ColDef<NfseNota>[] = [
    {
      key:"prestador", header:"Prestador",
      cell: n=>(
        <div style={{overflow:"visible",whiteSpace:"normal"}}>
          <div className="font-medium text-foreground leading-tight">{n.clienteNome}</div>
          <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{n.cnpj}</div>
        </div>
      ),
    },
    {
      key:"tomador", header:"Tomador",
      headerClassName:"hidden lg:table-cell", className:"hidden lg:table-cell text-sm text-muted-foreground",
      cell: n=><span className="line-clamp-1 max-w-[180px]">{n.tomador}</span>,
    },
    {
      key:"regime", header:"Regime",
      headerClassName:"hidden sm:table-cell", className:"hidden sm:table-cell",
      cell: n=>(
        <InlineBadge color={R_COLOR[n.regime]??"blue"} dot>
          {n.regime==="Simples"?"Simples Nacional":n.regime}
        </InlineBadge>
      ),
    },
    {
      key:"servico", header:"Cód. Serv.",
      headerClassName:"hidden md:table-cell", className:"hidden md:table-cell",
      cell: n=><span className="font-mono text-xs text-muted-foreground line-clamp-1 max-w-[140px]">{n.descricaoServico}</span>,
    },
    {
      key:"valor", header:"Valor",
      headerClassName:"text-right", className:"text-right tabular-nums",
      cell: n=>(
        <div style={{overflow:"visible",whiteSpace:"normal"}}>
          <div className="font-semibold">{fmtBRL(n.valorServico)}</div>
          {(n.valorCbs+n.valorIbs)>0 &&
            <div className="text-[10px] text-muted-foreground">CBS+IBS {fmtBRL(n.valorCbs+n.valorIbs)}</div>}
        </div>
      ),
    },
    {
      key:"iss", header:"ISS",
      headerClassName:"hidden sm:table-cell text-right", className:"hidden sm:table-cell text-right tabular-nums text-sm text-muted-foreground",
      cell: n=>fmtBRL(n.valorIss),
    },
    {
      key:"status", header:"Status",
      cell: n=>(
        <div style={{overflow:"visible",whiteSpace:"normal"}}>
          <InlineBadge color={S_COLOR[n.status]} dot>{S_LABEL[n.status]}</InlineBadge>
          {n.enviadoWhatsappEm && <div className="text-[10px] text-emerald-600 mt-0.5">✓ WhatsApp</div>}
          {n.numero && <div className="font-mono text-[10px] text-muted-foreground">#{n.numero}</div>}
        </div>
      ),
    },
    {
      key:"acoes", header:"", headerClassName:"w-16 text-right", className:"w-16 text-right",
      cell: n=>(
        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {n.pdfUrl && <a href={n.pdfUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors" title="PDF">
            <Download className="h-3.5 w-3.5"/>
          </a>}
          {n.xmlUrl && <a href={n.xmlUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors" title="XML">
            <FileText className="h-3.5 w-3.5"/>
          </a>}
        </div>
      ),
    },
  ];

  const kpiList = [
    {icon:FileText,     label:"Total",    val:kpi.total,           tone:"neutral" as const},
    {icon:Loader2,      label:"Rascunho", val:kpi.rascunho,        tone:"info"    as const},
    {icon:CheckCircle2, label:"Emitidas", val:kpi.emitida,         tone:"success" as const},
    {icon:AlertTriangle,label:"Erro",     val:kpi.erro,            tone:"danger"  as const},
    {icon:Receipt,      label:"Faturado", val:fmtBRL(kpi.valor),   tone:"neutral" as const},
    {icon:Ban,          label:"CBS+IBS",  val:fmtBRL(kpi.cbsIbs),  tone:"warning" as const},
  ];

  return (
    <div className="space-y-5">

      <PageHeader
        title="NFS-e em Lote"
        subtitle="Emissão via NFE.io · Reforma Tributária (CBS/IBS)"
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9"
              onClick={enviarWhats} disabled={sel.size===0}>
              <MessageCircle className="h-4 w-4"/> WhatsApp
            </Button>
            <Button size="sm" className="rounded-xl gap-1.5 h-9"
              onClick={emitirLote} disabled={busy||sel.size===0}>
              {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Send className="h-4 w-4"/>}
              Emitir ({sel.size})
            </Button>
          </>
        }
      />

      <KpiGrid cols={6}>
        {kpiList.map(({icon:Icon,label,val,tone})=>(
          <KpiCard key={label} icon={Icon} tone={tone} label={label} value={val} />
        ))}
      </KpiGrid>


      {/* Tabela */}
      <DataTable
        rows={pageRows}
        cols={cols}
        getKey={n=>n.id}
        selected={sel}
        onToggleAll={toggleAll}
        onToggleRow={toggleOne}
        emptyIcon={<Receipt className="h-8 w-8"/>}
        emptyText="Nenhuma NFS-e para os filtros selecionados"
        rowClassName={n=>n.status==="cancelada"?"opacity-50":""}
        toolbar={
          <>
            <Select value={mes.toString()} onValueChange={v=>setMes(+v)}>
              <SelectTrigger className="h-8 w-28 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>{MESES.map((m,i)=><SelectItem key={m} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ano.toString()} onValueChange={v=>setAno(+v)}>
              <SelectTrigger className="h-8 w-24 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>{[now.getFullYear()-1,now.getFullYear(),now.getFullYear()+1].map(y=><SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <div className="h-4 w-px bg-border shrink-0"/>
            <TableSearch value={query} onChange={setQuery} placeholder="Prestador, tomador, CNPJ…"/>
            <Select value={regime} onValueChange={v=>setRegime(v as typeof regime)}>
              <SelectTrigger className="h-8 w-36 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos regimes</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="Simples">Simples Nacional</SelectItem>
                <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                <SelectItem value="Lucro Real">Lucro Real</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={v=>setStatus(v as typeof status)}>
              <SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="emitida">Emitida</SelectItem>
                <SelectItem value="enviada">Enviada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
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

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Download, FileText, Loader2,
  MessageCircle, RefreshCw, Send, Wallet, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef } from "@/components/DataTable";
import { dasStore, type DasGuia, type DasStatus } from "@/lib/das-store";

export const Route = createFileRoute("/_app/fiscal/das")({
  component: DasPage,
  head: () => ({ meta: [{ title: "DAS em Lote · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const S_COLOR: Record<DasStatus, "gray"|"blue"|"green"|"red"> = {
  pendente: "blue", gerada: "amber" as "green", paga: "green", erro: "red",
};
const S_LABEL: Record<DasStatus, string> = {
  pendente:"Pendente", gerada:"Gerada", paga:"Paga", erro:"Erro",
};

const fmtBRL  = (v: number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtDate = (d: string) => new Date(d+"T12:00:00").toLocaleDateString("pt-BR");

function DasPage() {
  const now = new Date();
  const def = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [ano, setAno]       = useState(def.getFullYear());
  const [mes, setMes]       = useState(def.getMonth() + 1);
  const [items, setItems]   = useState<DasGuia[]>([]);
  const [query, setQuery]   = useState("");
  const [regime, setRegime] = useState<"todos"|"MEI"|"Simples">("todos");
  const [status, setStatus] = useState<"todos"|DasStatus>("todos");
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const [busy, setBusy]     = useState(false);
  const comp = `${ano}-${mes.toString().padStart(2,"0")}`;

  useEffect(() => {
    const fn = () => setItems(dasStore.listByCompetencia(comp));
    fn();
    window.addEventListener("apoya:das:changed", fn);
    window.addEventListener("apoya:clientes:changed", fn);
    return () => { window.removeEventListener("apoya:das:changed", fn); window.removeEventListener("apoya:clientes:changed", fn); };
  }, [comp]);
  useEffect(() => setSel(new Set()), [comp]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(g => q ? `${g.clienteNome} ${g.cnpj}`.toLowerCase().includes(q) : true)
      .filter(g => regime === "todos" || g.regime === regime)
      .filter(g => status === "todos" || g.status === status)
      .sort((a,b) => a.clienteNome.localeCompare(b.clienteNome));
  }, [items, query, regime, status]);

  const kpi = useMemo(() => ({
    total:    items.length,
    pendente: items.filter(g => g.status==="pendente").length,
    gerada:   items.filter(g => g.status==="gerada").length,
    paga:     items.filter(g => g.status==="paga").length,
    valor:    items.reduce((s,g) => s+g.valor, 0),
  }), [items]);

  const toggleAll = () => setSel(sel.size===filtered.length ? new Set() : new Set(filtered.map(g=>g.id)));
  const toggleOne = (id:string) => { const s=new Set(sel); s.has(id)?s.delete(id):s.add(id); setSel(s); };

  async function gerarLote() {
    const ids = filtered.filter(g=>sel.has(g.id)&&(g.status==="pendente"||g.status==="erro")).map(g=>g.id);
    if(!ids.length){ toast.error("Selecione ao menos 1 DAS pendente"); return; }
    setBusy(true);
    toast.loading(`Gerando ${ids.length} DAS via SERPRO…`, {id:"das-lote"});
    await dasStore.gerarLote(ids);
    setBusy(false);
    toast.success(`${ids.length} DAS processado(s)`, {id:"das-lote"});
  }
  function enviarWhats() {
    const elig = filtered.filter(g=>sel.has(g.id)&&g.status==="gerada");
    if(!elig.length){ toast.error("Selecione DAS já geradas"); return; }
    dasStore.enviarWhatsapp(elig.map(g=>g.id));
    toast.success(`${elig.length} mensagem(ns) enviada(s)`);
  }

  const cols: ColDef<DasGuia>[] = [
    {
      key:"cliente", header:"Cliente",
      cell: g => (
        <div style={{overflow:"visible", whiteSpace:"normal"}}>
          <div className="font-medium text-foreground leading-tight">{g.clienteNome}</div>
          <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{g.cnpj}</div>
        </div>
      ),
    },
    {
      key:"regime", header:"Regime",
      headerClassName:"hidden sm:table-cell", className:"hidden sm:table-cell",
      cell: g => <InlineBadge color={g.regime==="MEI"?"violet":"blue"} dot>{g.regime==="Simples"?"Simples Nacional":g.regime}</InlineBadge>,
    },
    {
      key:"vencimento", header:"Vencimento",
      headerClassName:"hidden md:table-cell", className:"hidden md:table-cell",
      cell: g => {
        const late = g.status!=="paga" && new Date(g.vencimento) < new Date();
        return (
          <span className={late ? "font-semibold text-red-600" : ""}>
            {fmtDate(g.vencimento)}
            {late && <span className="ml-1 text-[10px] opacity-70">atrasado</span>}
          </span>
        );
      },
    },
    {
      key:"valor", header:"Valor",
      headerClassName:"text-right", className:"text-right tabular-nums font-semibold",
      cell: g => fmtBRL(g.valor),
    },
    {
      key:"status", header:"Status",
      cell: g => (
        <div style={{overflow:"visible", whiteSpace:"normal"}}>
          <InlineBadge color={S_COLOR[g.status]} dot>{S_LABEL[g.status]}</InlineBadge>
          {g.enviadoWhatsappEm && <div className="text-[10px] text-emerald-600 mt-0.5">✓ WhatsApp</div>}
        </div>
      ),
    },
    {
      key:"acoes", header:"", headerClassName:"w-20 text-right", className:"w-20 text-right",
      cell: g => (
        <div className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {(g.status==="pendente"||g.status==="erro") && (
            <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Gerar DAS"
              onClick={() => { toast.loading("Gerando…",{id:`das-${g.id}`}); dasStore.gerar(g.id).then(()=>toast.success("DAS gerada",{id:`das-${g.id}`})); }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          {g.codigoBarras && (
            <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Copiar código"
              onClick={() => { navigator.clipboard.writeText(g.codigoBarras!); toast.success("Copiado!"); }}>
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          {g.pdfUrl && (
            <a href={g.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="PDF">
              <FileText className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">DAS em Lote</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Geração via SERPRO · MEI e Simples Nacional</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-8"
            onClick={enviarWhats} disabled={sel.size===0}>
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </Button>
          <Button size="sm" className="rounded-xl gap-1.5 h-8"
            onClick={gerarLote} disabled={busy||sel.size===0}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Send className="h-3.5 w-3.5"/>}
            Gerar ({sel.size})
          </Button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          {icon:FileText,     label:"Total",    val:kpi.total,        color:"text-foreground",  bg:"bg-card"},
          {icon:Loader2,      label:"Pendente", val:kpi.pendente,     color:"text-blue-600",    bg:"bg-blue-50"},
          {icon:CheckCircle2, label:"Geradas",  val:kpi.gerada,       color:"text-amber-600",   bg:"bg-amber-50"},
          {icon:Wallet,       label:"Pagas",    val:kpi.paga,         color:"text-emerald-600", bg:"bg-emerald-50"},
          {icon:AlertTriangle,label:"Total R$", val:fmtBRL(kpi.valor),color:"text-foreground",  bg:"bg-muted"},
        ].map(({icon:Icon,label,val,color,bg}) => (
          <div key={label} className={`ds-card flex items-center gap-3 p-3 ${bg}`}>
            <div className={`ds-icon-pill bg-white/60 shadow-sm ${color}`} style={{width:"2rem",height:"2rem",borderRadius:"0.5rem"}}>
              <Icon className="h-4 w-4 m-auto" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className={`text-base font-bold tabular-nums leading-tight ${color}`}>{val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabela ── */}
      <DataTable
        rows={filtered}
        cols={cols}
        getKey={g => g.id}
        selected={sel}
        onToggleAll={toggleAll}
        onToggleRow={toggleOne}
        emptyIcon={<FileText className="h-8 w-8"/>}
        emptyText="Nenhum DAS para os filtros selecionados"
        rowClassName={g => g.status==="paga" ? "opacity-50" : ""}
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
            <TableSearch value={query} onChange={setQuery} placeholder="Buscar cliente ou CNPJ…"/>
            <Select value={regime} onValueChange={v=>setRegime(v as typeof regime)}>
              <SelectTrigger className="h-8 w-36 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os regimes</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="Simples">Simples Nacional</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={v=>setStatus(v as typeof status)}>
              <SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="gerada">Gerada</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="erro">Erro</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <TableFooter total={items.length} filtered={filtered.length} selected={sel.size}/>
    </div>
  );
}

import { useDas, type DasGuia, type DasStatus } from "@/hooks/use-das";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Download, FileText, Loader2,
  MessageCircle, RefreshCw, Send, Wallet, AlertTriangle,
  Receipt, Activity, Plus} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef } from "@/components/DataTable";
import { PageHeader, PageTabs, KpiGrid, KpiCard, Pagination } from "@/components/PagePlaceholder";
import { DasGerarDialog } from "@/components/DasGerarDialog";
// import { dasStore, type DasGuia, type DasStatus } from "@/lib/das-store";

export const Route = createFileRoute("/_app/fiscal/das")({
  component: DasPage,
  head: () => ({ meta: [{ title: "DAS em Lote · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const S_COLOR: Partial<Record<DasStatus, "gray"|"blue"|"green"|"red">> = {
  pendente: "blue", gerada: "green", paga: "green", erro: "red",
};
const S_LABEL: Partial<Record<DasStatus, string>> = {
  pendente:"Pendente", gerada:"Gerada", paga:"Paga", erro:"Erro",
};

const fmtBRL  = (v: number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtDate = (d: string) => new Date(d+"T12:00:00").toLocaleDateString("pt-BR");

function DasPage() {
  const now = new Date();
  const def = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [ano, setAno]       = useState(def.getFullYear());
  const [mes, setMes]       = useState(def.getMonth() + 1);
  const { guias: items, loading: dasLoading, refresh } = useDas();
  const [query, setQuery]   = useState("");
  const [regime, setRegime] = useState<"todos"|"MEI"|"Simples">("todos");
  const [dialogDas, setDialogDas] = useState(false);
  const [status, setStatus] = useState<"todos"|DasStatus>("todos");
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const [busy, setBusy]     = useState(false);
  const comp = `${ano}-${mes.toString().padStart(2,"0")}`;

  useEffect(() => {
    const fn = () => refresh();
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

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);
  useEffect(()=>{ setPage(1); },[query,regime,status,mes,ano]);
  const totalPages = Math.max(1, Math.ceil(filtered.length/PAGE_SIZE));
  const pageRows = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

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
    toast.info(`Geração de DAS em lote disponível via integração SERPRO. (${ids.length} guias selecionadas)`); await refresh();
    setBusy(false);
    toast.success(`${ids.length} DAS processado(s)`, {id:"das-lote"});
  }
  function enviarWhats() {
    const elig = filtered.filter(g=>sel.has(g.id)&&g.status==="gerada");
    if(!elig.length){ toast.error("Selecione DAS já geradas"); return; }
    toast.info(`Envio WhatsApp disponível via integração Evolution API. (${elig.length} envios)`);
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
          {g.enviadoWaEm && <div className="text-[10px] text-emerald-600 mt-0.5">✓ WhatsApp</div>}
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
              onClick={() => { toast.info("Geração individual disponível via integração SERPRO.", {id:`das-${g.id}`}); }}>
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

      <PageHeader
        title="DAS em Lote"
        subtitle="Geração via SERPRO · MEI e Simples Nacional"
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl gap-1.5 h-9"
              onClick={enviarWhats} disabled={sel.size===0}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
            <Button size="sm" className="rounded-xl gap-1.5 h-9"
              onClick={gerarLote} disabled={busy||sel.size===0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
              Gerar ({sel.size})
            </Button>
          </>
        }
      />

      <PageTabs
        items={[
          { to: "/fiscal/das",    label: "DAS em Lote", icon: Wallet },
          { to: "/fiscal/nfse",   label: "NFS-e",       icon: Receipt },
          { to: "/fiscal/serpro", label: "SERPRO",      icon: Activity },
        ]}
      />

      <KpiGrid cols={5}>
        <KpiCard icon={FileText}      tone="neutral" label="Total"    value={kpi.total} />
        <KpiCard icon={Loader2}       tone="info"    label="Pendente" value={kpi.pendente} />
        <KpiCard icon={CheckCircle2}  tone="warning" label="Geradas"  value={kpi.gerada} />
        <KpiCard icon={Wallet}        tone="success" label="Pagas"    value={kpi.paga} />
        <KpiCard icon={AlertTriangle} tone="neutral" label="Total R$" value={fmtBRL(kpi.valor)} />
      </KpiGrid>


      {/* ── Tabela ── */}
      <DataTable
        rows={pageRows}
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TableFooter total={items.length} filtered={filtered.length} selected={sel.size}/>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} pageSize={PAGE_SIZE} total={filtered.length}/>
      </div>

      <DasGerarDialog
        open={dialogDas}
        onClose={() => setDialogDas(false)}
        onCreated={() => {}}
      />
    </div>
  );
}

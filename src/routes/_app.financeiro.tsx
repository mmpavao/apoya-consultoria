import { useCobrancas, type Cobranca, type CobrancaStatus, type ReguaStage } from "@/hooks/use-cobrancas";
import { SectorGuard } from "@/components/SectorGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PipelineKanban } from "@/components/PipelineKanban";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertTriangle, CheckCircle2, DollarSign,
  Link2, Loader2, MessageCircle, ShieldAlert, Wallet, Plus,
  RefreshCw, Zap, ExternalLink, TrendingDown, FileCheck2, ReceiptText, FileClock} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef, type BadgeColor } from "@/components/DataTable";
import { PageHeader, KpiGrid, KpiCard, Pagination } from "@/components/PagePlaceholder";
import { CobrancaFormDialog } from "@/components/CobrancaFormDialog";
import { PagamentoDialog } from "@/components/PagamentoDialog";
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

function FinanceiroPage__Inner(){
  const now = new Date();
  const [ano, setAno]       = useState(now.getFullYear());
  const [mes, setMes]       = useState(now.getMonth()+1);
  const { cobrancas: items, loading: cobLoading, refetch: refresh } = useCobrancas();
  const [query, setQuery]   = useState("");
  const [status, setStatus] = useState<"todos"|CobrancaStatus>("todos");
  const [dialogCob, setDialogCob]     = useState(false);
  const [emitindoNf,  setEmitindoNf]  = useState<string|null>(null);

  const emitirNfManual = async (cobrancaId: string) => {
    setEmitindoNf(cobrancaId);
    try {
      const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
      const token = session?.access_token ?? '';
      const res = await fetch('/api/nfse/emitir-cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cobranca_id: cobrancaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao emitir NFS-e');
      } else {
        toast.success(`NFS-e nº ${data.numero} emitida com sucesso!`);
        refresh();
      }
    } catch (e: any) {
      toast.error('Erro ao emitir NFS-e: ' + (e?.message ?? ''));
    } finally {
      setEmitindoNf(null);
    }
  };

  const { roles } = useAuth();
  const podeAprovar = roles.includes("admin") || roles.includes("contador");
  type FinView = "pipeline" | "cobrancas" | "inadimplencia";
  const [finView, setFinView]          = useState<FinView>("cobrancas");
  const [pagDialog, setPagDialog]      = useState<Cobranca | null>(null);
  const [executandoRegua, setExecRegua] = useState(false);
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
    if(!ids.length){ toast.error("Selecione cobranças sem link de pagamento"); return; }
    setBusy(true);
    toast.loading(`Emitindo ${ids.length} cobrança(s) no Asaas…`,{id:"fin-asaas"});
    try {
      const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada", {id:"fin-asaas"}); return; }
      let emitidas = 0; let erros = 0;
      for (const cobId of ids) {
        const res = await fetch("/api/cobranca/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
          body: JSON.stringify({ mode: "individual", cobranca_id: cobId }),
        });
        const data = await res.json() as any;
        if (data.ok && data.emitidas > 0) emitidas++;
        else erros++;
      }
      await refresh();
      if (erros === 0) toast.success(`${emitidas} cobrança(s) emitida(s) no Asaas! 🎉`,{id:"fin-asaas"});
      else toast.warning(`${emitidas} emitida(s) · ${erros} com erro`,{id:"fin-asaas"});
      setSel(new Set());
    } catch(e:any) {
      toast.error("Erro Asaas: " + (e?.message ?? "Tente novamente"), {id:"fin-asaas"});
    } finally {
      setBusy(false);
    }
  }
  async function enviarWpp(){
    const cobs=filtered.filter(c=>sel.has(c.id)&&c.linkPagamento);
    if(!cobs.length){ toast.error("Selecione cobranças com link de pagamento gerado"); return; }
    setBusy(true);
    toast.loading(`Enviando ${cobs.length} mensagem(ns) WhatsApp…`,{id:"fin-wpp"});
    try {
      const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada", {id:"fin-wpp"}); return; }
      let enviadas = 0; let erros = 0;
      for (const cob of cobs) {
        const fmtBRLv = (v:number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
        const fmtDt   = (d:string) => new Date(d+"T12:00:00").toLocaleDateString("pt-BR");
        const nome    = cob.clienteNome.split(" ")[0];
        const msg     = cob.diasAtraso > 0
          ? `❗ ${nome}, sua mensalidade APOYA de ${fmtBRLv(cob.valor)} está *vencida há ${cob.diasAtraso} dia(s)*.
🔗 Regularize: ${cob.linkPagamento}`
          : `💰 Olá ${nome}! Sua mensalidade APOYA de ${fmtBRLv(cob.valor)} vence em *${fmtDt(cob.vencimento)}*.
🔗 Pague: ${cob.linkPagamento}`;
        const res = await fetch("/api/wa/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
          body: JSON.stringify({ telefone: cob.clienteId, mensagem: msg, cliente_id: cob.clienteId }),
        });
        const data = await res.json() as any;
        if (data.ok) enviadas++; else erros++;
      }
      await refresh();
      if (erros === 0) toast.success(`${enviadas} mensagem(ns) enviada(s)! 📱`,{id:"fin-wpp"});
      else toast.warning(`${enviadas} enviada(s) · ${erros} com erro`,{id:"fin-wpp"});
      setSel(new Set());
    } catch(e:any) {
      toast.error("Erro WhatsApp: " + (e?.message ?? "Tente novamente"), {id:"fin-wpp"});
    } finally {
      setBusy(false);
    }
  }

  async function gerarMensal(){
    setBusy(true);
    toast.loading("Gerando cobranças mensais e emitindo no Asaas…",{id:"fin-mensal"});
    try {
      const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada", {id:"fin-mensal"}); return; }
      const res = await fetch("/api/cobranca/emitir", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: "gerar_mensal", competencia: comp }),
      });
      const data = await res.json() as any;
      await refresh();
      if (data.ok) {
        toast.success(`${data.geradas ?? 0} cobranças geradas · ${data.emitidas ?? 0} emitidas no Asaas 🎉`,{id:"fin-mensal"});
      } else {
        toast.error(data.error ?? "Erro ao gerar cobranças",{id:"fin-mensal"});
      }
    } catch(e:any) {
      toast.error("Erro: " + (e?.message ?? "Tente novamente"), {id:"fin-mensal"});
    } finally {
      setBusy(false);
    }
  }


  async function executarRegua() {
    setExecRegua(true);
    toast.loading("Executando régua…", { id: "fin-regua" });
    try {
      const { data: { session } } = await (await import("@/integrations/supabase/client")).supabase.auth.getSession();
      if (!session) { toast.error("Sessão expirada", { id:"fin-regua" }); return; }
      const res = await fetch("/api/cobranca/regua", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},
        body: JSON.stringify({ mode:"manual" }),
      });
      const data = await res.json() as Record<string,unknown>;
      await refresh();
      if (data.ok) toast.success(`Régua executada: ${data.processadas ?? 0} cobrança(s)`, { id:"fin-regua" });
      else toast.error(String(data.error??"Erro"), { id:"fin-regua" });
    } catch(e) {
      toast.error("Erro: " + (e instanceof Error ? e.message : "Tente novamente"), { id:"fin-regua" });
    } finally { setExecRegua(false); }
  }

  // ── Dados de inadimplência ────────────────────────────────────────────────
  const hoje = new Date().toISOString().split("T")[0];
  const inadimplentes = items.filter(c => c.status==="vencida" || (c.status==="pendente" && c.vencimento < hoje));
  const totalInad      = inadimplentes.reduce((s,c) => s+c.valor, 0);
  const suspensas      = items.filter(c => c.reguaStage==="suspensao").length;
  const vencidasMais30 = inadimplentes.filter(c => c.diasAtraso > 30).length;
  const agingFaixas    = [
    { label:"0–15 dias",  count: inadimplentes.filter(c=>c.diasAtraso<=15&&c.diasAtraso>=0).length,  cor:"text-amber-600" },
    { label:"16–30 dias", count: inadimplentes.filter(c=>c.diasAtraso>15&&c.diasAtraso<=30).length,  cor:"text-orange-600" },
    { label:"31–60 dias", count: inadimplentes.filter(c=>c.diasAtraso>30&&c.diasAtraso<=60).length,  cor:"text-red-600" },
    { label:">60 dias",   count: inadimplentes.filter(c=>c.diasAtraso>60).length,                     cor:"text-rose-800 font-bold" },
  ];
  const STAGE_BADGE: Record<ReguaStage,{label:string;cls:string}> = {
    ok:         {label:"Em dia",      cls:"bg-emerald-100 text-emerald-700"},
    lembrete:   {label:"Lembrete",    cls:"bg-blue-100 text-blue-700"},
    cobranca:   {label:"Cobrança",    cls:"bg-amber-100 text-amber-700"},
    negativacao:{label:"Negativação", cls:"bg-orange-100 text-orange-700"},
    suspensao:  {label:"Suspensão",   cls:"bg-rose-100 text-rose-700"},
  };

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
    {
      key:"nfse", header:"NFS-e",
      headerClassName:"hidden md:table-cell", className:"hidden md:table-cell",
      cell: (c) => {
        const st = c.nfseStatus;
        if (st === "emitida") {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
              <FileCheck2 className="h-3.5 w-3.5" /> Emitida
            </span>
          );
        }
        if (st === "processando") {
          return (
            <span className="inline-flex items-center gap-1 text-[11px] text-blue-600">
              <FileClock className="h-3.5 w-3.5 animate-pulse" /> Processando
            </span>
          );
        }
        if (st === "erro") {
          return (
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium">
                <ReceiptText className="h-3.5 w-3.5" /> Erro
              </span>
              {c.status === "paga" && (
                <button
                  onClick={() => emitirNfManual(c.id)}
                  disabled={emitindoNf === c.id}
                  className="flex items-center gap-1 text-[10px] text-primary hover:underline disabled:opacity-50"
                >
                  {emitindoNf === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Retentar
                </button>
              )}
            </div>
          );
        }
        // Sem nota: mostrar botão apenas se paga
        if (c.status === "paga") {
          return (
            <button
              onClick={() => emitirNfManual(c.id)}
              disabled={emitindoNf === c.id}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium disabled:opacity-50 hover:underline"
            >
              {emitindoNf === c.id
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Emitindo…</>
                : <><ReceiptText className="h-3.5 w-3.5" /> Emitir NF</>
              }
            </button>
          );
        }
        return <span className="text-[11px] text-muted-foreground">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-5">

      <PageHeader
        title="Financeiro"
        subtitle={`Régua de cobrança · ${MESES[mes-1]} ${ano}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground"
                onClick={()=>{let m=mes-1,a=ano;if(m<1){m=12;a--;}setMes(m);setAno(a);}}>‹</Button>
              <span className="min-w-[120px] text-center text-sm font-semibold">{MESES[mes-1]} {ano}</span>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground"
                onClick={()=>{let m=mes+1,a=ano;if(m>12){m=1;a++;}setMes(m);setAno(a);}}>›</Button>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl gap-1 text-xs" onClick={gerarMensal} disabled={busy}>
              {busy?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Zap className="h-3.5 w-3.5"/>}Emitir cobranças
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl gap-1 text-xs" onClick={executarRegua} disabled={executandoRegua}>
              {executandoRegua?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<RefreshCw className="h-3.5 w-3.5"/>}Régua
            </Button>
            <Button size="sm" onClick={() => setDialogCob(true)} className="rounded-xl gap-1.5">
              <Plus className="h-4 w-4" /> Nova Cobrança
            </Button>
          </div>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard icon={Wallet}        tone="neutral" label="Total previsto" value={fmtBRL(kpi.total)}   hint={`${kpi.count} clientes`} />
        <KpiCard icon={CheckCircle2}  tone="success" label="Recebido"       value={fmtBRL(kpi.pago)}    hint={`${Math.round(kpi.pago/(kpi.total||1)*100)}%`} />
        <KpiCard icon={AlertTriangle} tone="danger"  label="Em atraso"      value={fmtBRL(kpi.vencido)} hint={`${items.filter(c=>c.status==="vencida").length} cobranças`} />
        <KpiCard icon={ShieldAlert}   tone="warning" label="Risco alto"     value={kpi.inad}            hint="negativação/suspensão" />
      </KpiGrid>



      {/* ── Tabs de view ── */}
      <div className="flex items-center gap-1 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${finView==="pipeline"?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={()=>setFinView("pipeline")}>
          Pipeline
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${finView==="cobrancas"?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={()=>setFinView("cobrancas")}>
          Cobranças
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${finView==="inadimplencia"?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={()=>setFinView("inadimplencia")}>
          <TrendingDown className="h-3.5 w-3.5"/>Inadimplência
          {inadimplentes.length>0&&<span className="bg-rose-100 text-rose-700 text-[11px] font-bold px-1.5 py-0.5 rounded-full">{inadimplentes.length}</span>}
        </button>
      </div>

      {finView==="pipeline"&&(
        <PipelineKanban setor="financeiro" podeAprovar={podeAprovar} />
      )}

      {/* ── VIEW: INADIMPLÊNCIA ── */}
      {finView==="inadimplencia"&&(
        <div className="space-y-5">
          {/* KPIs inadimplência */}
          <KpiGrid cols={4}>
            <KpiCard icon={AlertTriangle} tone="danger"   label="Total inadimplentes"  value={inadimplentes.length} hint="clientes"/>
            <KpiCard icon={DollarSign}   tone="danger"   label="Valor em aberto"       value={totalInad.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} hint="em atraso"/>
            <KpiCard icon={TrendingDown} tone="warning"  label="Vencidas +30d"         value={vencidasMais30} hint="requer ação"/>
            <KpiCard icon={ShieldAlert}  tone="warning"  label="Suspensas"             value={suspensas} hint="aguardando pagamento"/>
          </KpiGrid>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Aging list */}
            <div className="lg:col-span-2 surface-card rounded-xl border p-5">
              <h3 className="font-semibold text-sm mb-4">Aging por faixa</h3>
              <div className="space-y-3">
                {agingFaixas.map(f=>(
                  <div key={f.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{f.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-2">
                        <div className="bg-primary/60 h-2 rounded-full" style={{width:`${Math.min(100,(f.count/(inadimplentes.length||1))*100)}%`}}/>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums w-6 text-right ${f.cor}`}>{f.count}</span>
                    </div>
                  </div>
                ))}
                {inadimplentes.length===0&&<p className="text-sm text-muted-foreground italic">Sem inadimplentes 🎉</p>}
              </div>
            </div>

            {/* Tabela inadimplência */}
            <div className="lg:col-span-3 surface-card rounded-xl border overflow-hidden">
              <table className="ft-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Valor</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Atraso</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Régua</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {inadimplentes.length===0&&<tr><td colSpan={5} className="text-center p-6 text-muted-foreground">Nenhum inadimplente no período. 🎉</td></tr>}
                  {inadimplentes.map(c=>(
                    <tr key={c.id} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="p-3"><div className="font-medium text-sm leading-tight">{c.clienteNome}</div><div className="text-[11px] text-muted-foreground font-mono">{c.cnpj}</div></td>
                      <td className="p-3 text-right font-semibold tabular-nums">{c.valor.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td>
                      <td className="p-3 hidden md:table-cell"><span className={`font-semibold ${c.diasAtraso>30?"text-rose-600":c.diasAtraso>15?"text-orange-600":"text-amber-600"}`}>{c.diasAtraso}d</span></td>
                      <td className="p-3 hidden sm:table-cell"><span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STAGE_BADGE[c.reguaStage].cls}`}>{STAGE_BADGE[c.reguaStage].label}</span></td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {c.linkPagamento&&<button title="Copiar link" onClick={()=>{navigator.clipboard.writeText(c.linkPagamento!);toast.success("Link copiado");}} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"><ExternalLink className="h-3.5 w-3.5"/></button>}
                          <button title="Registrar pagamento" onClick={()=>setPagDialog(c)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW: COBRANÇAS (original) ── */}
      {finView==="cobrancas"&&(
      <div>
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
      )} {/* fim finView=cobrancas */}

      <CobrancaFormDialog
        open={dialogCob}
        onClose={() => setDialogCob(false)}
        onCreated={() => {}}
      />
      <PagamentoDialog
        cobranca={pagDialog}
        open={!!pagDialog}
        onClose={() => setPagDialog(null)}
        onSaved={() => { void refresh(); }}
      />
    </div>
  );
}

function FinanceiroPage() {
  return (
    <SectorGuard setor="financeiro">
      <FinanceiroPage__Inner />
    </SectorGuard>
  );
}

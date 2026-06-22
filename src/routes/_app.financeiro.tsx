import { useCobrancas, type Cobranca, type CobrancaStatus, type ReguaStage } from "@/hooks/use-cobrancas";
import { fmtBRL } from "@/lib/format";
import { SectorGuard } from "@/components/SectorGuard";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KanbanModulo } from "@/components/KanbanModulo";
import { useAuth } from "@/hooks/use-auth";
import { useDepartamentoConfig } from "@/hooks/use-departamento-config";
import {
  AlertTriangle, CheckCircle2, DollarSign,
  Link2, Loader2, MessageCircle, ShieldAlert, Wallet, Plus,
  RefreshCw, Zap, ExternalLink, TrendingDown, FileCheck2, ReceiptText, FileClock,
  ToggleLeft, ToggleRight, Settings2, X, Save, Pencil, Trash2} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleDashboard } from "@/components/layout/ModuleDashboard";
import { ModuleDocumentosTab } from "@/components/layout/ModuleDocumentosTab";
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


function FinanceiroPage__Inner(){
  const now = new Date();
  const [ano, setAno]       = useState(now.getFullYear());
  const [mes, setMes]       = useState(now.getMonth()+1);
  const { cobrancas: items, loading: cobLoading, error: cobError, refetch: refresh, deletarCobranca } = useCobrancas();
  const [editCob, setEditCob] = useState<Cobranca | null>(null);
  async function excluirCobranca(c: Cobranca) {
    if (c.asaasId || c.status === "paga") { toast.error("Não dá pra excluir cobrança paga ou já enviada ao gateway"); return; }
    if (!confirm(`Excluir a cobrança de ${c.clienteNome} (${fmtBRL(c.valor)})?`)) return;
    if (await deletarCobranca(c.id)) refresh();
  }
  const [query, setQuery]   = useState("");
  const [status, setStatus] = useState<"todos"|CobrancaStatus>("todos");
  const [dialogCob, setDialogCob]     = useState(false);
  const [showReguaModal, setShowReguaModal] = useState(false);
  // Config REAL da régua (tabela regua_cobranca_config — execução automática removida no pivô manual).
  const [reguaCfg, setReguaCfg] = useState({
    dias_lembrete_1: 5, dias_primeiro_contato: 1, dias_segundo_contato: 15, dias_suspensao: 45,
    percentual_multa: 2, percentual_juros_mes: 1,
    msg_lembrete: "", msg_vencida: "", msg_suspensao: "",
  });
  const [reguaLoaded, setReguaLoaded] = useState(false);
  const [reguaLoadError, setReguaLoadError] = useState<string | null>(null);
  useEffect(() => {
    if (!showReguaModal || reguaLoaded) return;
    (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await (supabase as any).from("regua_cobranca_config")
        .select("dias_lembrete_1,dias_primeiro_contato,dias_segundo_contato,dias_suspensao,percentual_multa,percentual_juros_mes,msg_lembrete,msg_vencida,msg_suspensao")
        .eq("escritorio_id", "apoya").maybeSingle();
      if (error) {
        setReguaLoadError(error.message);
      } else if (data) {
        const limpo = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null));
        setReguaCfg(c => ({ ...c, ...limpo }));
      }
      setReguaLoaded(true);
    })();
  }, [showReguaModal, reguaLoaded]);
  const setCfg = (k: string, v: string | number) => setReguaCfg(c => ({ ...c, [k]: v }));
  const [salvandoRegua, setSalvandoRegua] = useState(false);
  const { config: depConfig, saving: savingCfg, save: saveDepConfig, error: depCfgError } = useDepartamentoConfig("financeiro");
  const [configsFin, setConfigsFin] = useState([
    { key: "nfse_auto",    label: "Registrar NFS-e após pagamento (manual)",     enabled: false },
    { key: "bloquear",     label: "Bloquear cliente inadimplente",             enabled: true  },
    { key: "juros_auto",   label: "Calcular juros/multa manualmente",          enabled: false },
    { key: "notif_wpp",    label: "Lembrete via wa.me (link manual)",          enabled: true  },
  ]);
  // hidrata os toggles com o que está salvo no banco
  useEffect(() => {
    if (depConfig && Object.keys(depConfig).length) {
      setConfigsFin(c => c.map(x => ({ ...x, enabled: (depConfig[x.key] as boolean) ?? x.enabled })));
    }
  }, [depConfig]);
  const salvarConfigsFin = () =>
    saveDepConfig(Object.fromEntries(configsFin.map(c => [c.key, c.enabled])));

  async function salvarRegua() {
    setSalvandoRegua(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const db = supabase as any;
      const payload = {
        dias_lembrete_1:       Number(reguaCfg.dias_lembrete_1),
        dias_primeiro_contato: Number(reguaCfg.dias_primeiro_contato),
        dias_segundo_contato:  Number(reguaCfg.dias_segundo_contato),
        dias_suspensao:        Number(reguaCfg.dias_suspensao),
        percentual_multa:      Number(reguaCfg.percentual_multa),
        percentual_juros_mes:  Number(reguaCfg.percentual_juros_mes),
        msg_lembrete:          reguaCfg.msg_lembrete || null,
        msg_vencida:           reguaCfg.msg_vencida || null,
        msg_suspensao:         reguaCfg.msg_suspensao || null,
        updated_at:            new Date().toISOString(),
      };
      // grava na tabela REAL que a execução lê (escritorio_id="apoya"); update-or-insert
      const { data: existing } = await db.from("regua_cobranca_config")
        .select("id").eq("escritorio_id", "apoya").maybeSingle();
      const { error } = existing
        ? await db.from("regua_cobranca_config").update(payload).eq("escritorio_id", "apoya")
        : await db.from("regua_cobranca_config").insert({ escritorio_id: "apoya", ...payload });
      if (error) throw error;
      toast.success("Régua salva com sucesso!");
      setShowReguaModal(false);
    } catch (e: any) {
      toast.error("Erro ao salvar régua: " + (e?.message ?? ""));
    } finally { setSalvandoRegua(false); }
  }


  const { roles } = useAuth();
  const podeAprovar = roles.includes("admin") || roles.includes("contador");

  const [pagDialog, setPagDialog]      = useState<Cobranca | null>(null);
  const [stage, setStage]   = useState<"todos"|ReguaStage>("todos");
  const [sel, setSel]       = useState<Set<string>>(new Set());
  const comp = `${ano}-${mes.toString().padStart(2,"0")}`;

  useEffect(()=>{
    const fn=()=>refresh();
    fn();
    window.addEventListener("apoya:financeiro:changed",fn);
    window.addEventListener("apoya:clientes:changed",fn);
    return ()=>{ window.removeEventListener("apoya:financeiro:changed",fn); window.removeEventListener("apoya:clientes:changed",fn); };
  },[comp]);
  useEffect(()=>setSel(new Set()),[comp]);

  // Aba "Cobranças" reflete o mês selecionado (competência). KPIs e a aba
  // Inadimplência permanecem globais (visão acumulada de atraso/risco).
  const filtered = useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items
      .filter(c=>(c.competencia ?? "").startsWith(comp))
      .filter(c=>q?`${c.clienteNome} ${c.cnpj}`.toLowerCase().includes(q):true)
      .filter(c=>status==="todos"||c.status===status)
      .filter(c=>stage==="todos"||c.reguaStage===stage)
      .sort((a,b)=>b.diasAtraso-a.diasAtraso||a.clienteNome.localeCompare(b.clienteNome));
  },[items,query,status,stage,comp]);

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
      key:"acoes", header:"", className:"text-right whitespace-nowrap",
      cell: c=>(
        <div className="flex items-center justify-end gap-1">
          <button title="Editar" onClick={()=>setEditCob(c)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5"/></button>
          {!c.asaasId && c.status !== "paga" && (
            <button title="Excluir" onClick={()=>excluirCobranca(c)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5"/></button>
          )}
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
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground"
                onClick={()=>{let m=mes-1,a=ano;if(m<1){m=12;a--;}setMes(m);setAno(a);}}>‹</Button>
              <span className="min-w-[120px] text-center text-sm font-semibold">{MESES[mes-1]} {ano}</span>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground"
                onClick={()=>{let m=mes+1,a=ano;if(m>12){m=1;a++;}setMes(m);setAno(a);}}>›</Button>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl gap-1 text-xs" onClick={() => setShowReguaModal(true)}>
              <Settings2 className="h-3.5 w-3.5"/>Configurar Régua
            </Button>
            <Button size="sm" onClick={() => setDialogCob(true)} className="rounded-xl gap-1.5">
              <Plus className="h-4 w-4" /> Nova Cobrança
            </Button>
          </div>
        }
      />





      {/* erro≠zero: falha ao carregar cobranças não pode virar R$0 silencioso */}
      {cobError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Erro ao carregar cobranças: {cobError}. Os valores podem estar incompletos.
          <button onClick={() => refresh()} className="ml-auto underline font-medium">Tentar de novo</button>
        </div>
      )}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
          <TabsTrigger value="inadimplencia">
            Inadimplência{inadimplentes.length > 0 && <span className="ml-1.5 text-[10px] font-bold bg-red-100 text-red-600 px-1.5 rounded-full">{inadimplentes.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <ModuleDashboard
            kpisLoading={cobLoading}
            kpis={cobError ? [
              { label: "Total previsto", value: "—", icon: Wallet, variant: "default" },
              { label: "Recebido", value: "—", icon: CheckCircle2, variant: "success" },
              { label: "Em atraso", value: "—", icon: AlertTriangle, variant: "danger" },
              { label: "Risco alto", value: "—", icon: ShieldAlert, variant: "warning" },
            ] : [
              { label: "Total previsto", value: fmtBRL(kpi.total),   icon: Wallet,        variant: "default", hint: `${kpi.count} clientes` },
              { label: "Recebido",       value: fmtBRL(kpi.pago),    icon: CheckCircle2,  variant: "success", hint: `${Math.round(kpi.pago/(kpi.total||1)*100)}%` },
              { label: "Em atraso",      value: fmtBRL(kpi.vencido), icon: AlertTriangle, variant: "danger",  hint: `${items.filter(c=>c.status==="vencida").length} cobranças` },
              { label: "Risco alto",     value: kpi.inad,             icon: ShieldAlert,   variant: "warning", hint: "negativação/suspensão" },
            ]}
            quickActions={[
              { label: "Nova Cobrança", icon: Plus,       onClick: () => setDialogCob(true), variant: "outline" },
            ]}
          />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-0">
          <KanbanModulo
              setor="financeiro"
              titulo="Processos"
              fases={[
    { key: "emissao",     label: "Emissão",       cor: { border: "border-t-blue-400",   bg: "bg-blue-50/30",   header: "text-blue-700",   dot: "bg-blue-400" } },
    { key: "cobranca",    label: "Cobrança",      cor: { border: "border-t-amber-400",  bg: "bg-amber-50/30",  header: "text-amber-700",  dot: "bg-amber-400" } },
    { key: "inadimplencia",label: "Inadimplência",cor: { border: "border-t-red-400",    bg: "bg-red-50/30",    header: "text-red-700",    dot: "bg-red-400" } },
    { key: "negociacao",  label: "Negociação",    cor: { border: "border-t-purple-400", bg: "bg-purple-50/30", header: "text-purple-700", dot: "bg-purple-400" } },
    { key: "concluido",   label: "Concluído",     cor: { border: "border-t-emerald-400",bg: "bg-emerald-50/30",header: "text-emerald-700",dot: "bg-emerald-400"} },
  ]}
              camposForm={[
    { key: "titulo",      label: "Descrição",     tipo: "text" as const,   placeholder: "Ex: Honorário Maio/2026 — Empresa W", obrigatorio: true },
    { key: "tipo",        label: "Tipo",          tipo: "select" as const, opcoes: [
      { value: "honorario",   label: "Honorário" },
      { value: "avulso",      label: "Serviço Avulso" },
      { value: "parcelamento",label: "Parcelamento" },
      { value: "reembolso",   label: "Reembolso" },
      { value: "outros",      label: "Outros" },
    ]},
    { key: "responsavel", label: "Responsável",   tipo: "text" as const,   placeholder: "Nome do responsável" },
  ]}
            />
        </TabsContent>

        <TabsContent value="inadimplencia" className="mt-0">
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
        </TabsContent>

        <TabsContent value="cobrancas" className="mt-0">
      <div>
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
        </TabsContent>



        <TabsContent value="config" className="mt-0">
        <div className="rounded-xl border bg-card p-6 space-y-5">
          {depCfgError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Não foi possível carregar preferências salvas — exibindo padrões. ({depCfgError})
            </div>
          )}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Configurações Financeiras</h3>
            <Button size="sm" className="h-7 text-xs gap-1.5" disabled={savingCfg} onClick={salvarConfigsFin}>
              <Save className="h-3.5 w-3.5"/> {savingCfg ? "Salvando…" : "Salvar"}
            </Button>
          </div>
          <div className="space-y-2">
            {configsFin.map((item, i) => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                </div>
                <button onClick={() => setConfigsFin(c => c.map((x, j) => j === i ? { ...x, enabled: !x.enabled } : x))} className={`transition-colors ${item.enabled ? "text-emerald-600" : "text-muted-foreground/40"}`}>
                  {item.enabled ? <ToggleRight className="h-6 w-6"/> : <ToggleLeft className="h-6 w-6"/>}
                </button>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Régua de Cobrança</p>
            <p className="text-xs text-muted-foreground mb-3">
              Prazos e mensagens da régua de cobrança (configuração persistida).
              A execução é manual — operador acompanha vencimentos e contata clientes.
            </p>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowReguaModal(true)}>
              <Settings2 className="h-3.5 w-3.5"/> Configurar Régua
            </Button>
          </div>
        </div>
        </TabsContent>
        <TabsContent value="documentos" className="mt-0"><ModuleDocumentosTab modulo="financeiro" /></TabsContent>
        </Tabs>

      {/* Modal Régua de Cobrança */}
      {showReguaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setShowReguaModal(false); }}>
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-border overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="font-semibold text-foreground">Régua de Cobrança (configuração manual)</p>
                <p className="text-xs text-muted-foreground mt-0.5">Prazos e mensagens de referência — execução pelo operador</p>
              </div>
              <button onClick={() => setShowReguaModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                <X className="h-4 w-4"/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {!reguaLoaded && <p className="text-xs text-muted-foreground">Carregando configuração…</p>}
              {reguaLoadError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Erro ao carregar régua: {reguaLoadError}. Valores abaixo são padrão local.
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Prazos (dias)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Lembrete (dias antes do venc.)</label>
                    <Input type="number" min={0} max={30} className="h-8 text-sm" value={reguaCfg.dias_lembrete_1} onChange={e => setCfg("dias_lembrete_1", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">1º contato (dias após venc.)</label>
                    <Input type="number" min={1} max={90} className="h-8 text-sm" value={reguaCfg.dias_primeiro_contato} onChange={e => setCfg("dias_primeiro_contato", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Negativação (dias após venc.)</label>
                    <Input type="number" min={1} max={180} className="h-8 text-sm" value={reguaCfg.dias_segundo_contato} onChange={e => setCfg("dias_segundo_contato", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Suspensão (dias após venc.)</label>
                    <Input type="number" min={1} max={365} className="h-8 text-sm" value={reguaCfg.dias_suspensao} onChange={e => setCfg("dias_suspensao", Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Encargos</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Multa (%)</label>
                    <Input type="number" min={0} step="0.1" className="h-8 text-sm" value={reguaCfg.percentual_multa} onChange={e => setCfg("percentual_multa", Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Juros ao mês (%)</label>
                    <Input type="number" min={0} step="0.1" className="h-8 text-sm" value={reguaCfg.percentual_juros_mes} onChange={e => setCfg("percentual_juros_mes", Number(e.target.value))} />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensagens</p>
                {[
                  { k: "msg_lembrete",  label: "Lembrete (antes do vencimento)" },
                  { k: "msg_vencida",   label: "Cobrança (após vencimento)" },
                  { k: "msg_suspensao", label: "Suspensão" },
                ].map(m => (
                  <div key={m.k}>
                    <label className="text-xs font-medium mb-1 block">{m.label}</label>
                    <textarea rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                      placeholder="Use {nome}, {empresa}, {valor}, {dias}, {vencimento}"
                      value={(reguaCfg as any)[m.k] ?? ""} onChange={e => setCfg(m.k, e.target.value)} />
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">Variáveis: {"{nome}"} {"{empresa}"} {"{valor}"} {"{dias}"} {"{vencimento}"}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
              <Button variant="ghost" size="sm" onClick={() => setShowReguaModal(false)}>Cancelar</Button>
              <Button size="sm" className="gap-1.5" onClick={salvarRegua} disabled={salvandoRegua}>
                {salvandoRegua ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>} Salvar Régua
              </Button>
            </div>
          </div>
        </div>
      )}
      <CobrancaFormDialog
        open={dialogCob}
        onClose={() => setDialogCob(false)}
        onCreated={() => refresh()}
      />
      <CobrancaFormDialog
        open={!!editCob}
        onClose={() => setEditCob(null)}
        onCreated={() => refresh()}
        cobranca={editCob ? {
          id: editCob.id, clienteId: editCob.clienteId, descricao: editCob.descricao,
          valor: editCob.valor, forma: editCob.forma, vencimento: editCob.vencimento,
          competencia: editCob.competencia,
        } : null}
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

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
  ToggleLeft, ToggleRight, Settings2, X, Save} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleDashboard } from "@/components/layout/ModuleDashboard";
import { useAgenteAtividade } from "@/hooks/use-agente-atividade";
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
  const { cobrancas: items, loading: cobLoading, error: cobError, refetch: refresh } = useCobrancas();
  const [query, setQuery]   = useState("");
  const [status, setStatus] = useState<"todos"|CobrancaStatus>("todos");
  const [dialogCob, setDialogCob]     = useState(false);
  const [emitindoNf,  setEmitindoNf]  = useState<string|null>(null);
  const [showReguaModal, setShowReguaModal] = useState(false);
  const [reguaDisparos, setReguaDisparos] = useState([
    { id: "d3",  label: "D+3",  dias: 3,  ativo: true,  canal: "WhatsApp", msg: "Olá {nome}, seu honorário de {valor} venceu há 3 dias. Por favor, regularize para evitar bloqueios." },
    { id: "d7",  label: "D+7",  dias: 7,  ativo: true,  canal: "Email",    msg: "Prezado {nome}, identificamos que o honorário de {valor} está em atraso há 7 dias. Entre em contato conosco." },
    { id: "d15", label: "D+15", dias: 15, ativo: true,  canal: "Ambos",    msg: "URGENTE: O honorário de {valor} da empresa {empresa} está há 15 dias em atraso. Regularize em 48h." },
    { id: "d30", label: "D+30", dias: 30, ativo: false, canal: "WhatsApp", msg: "Comunicado: O contrato da {empresa} será suspenso por inadimplência de {valor} após 30 dias." },
  ]);
  const [salvandoRegua, setSalvandoRegua] = useState(false);
  const [autosFin, setAutosFin] = useState([
    { id: "regua",  nome: "Régua de Cobrança",          desc: "Lembretes automáticos por WhatsApp/Email", agente: "agente-financeiro", freq: "Diária 08:00", ativo: true,  resultado: null as null|"ok"|"erro" },
    { id: "inadim", nome: "Alerta Inadimplência",        desc: "Notifica após 5 dias de atraso",           agente: "agente-financeiro", freq: "Diária 09:00", ativo: true,  resultado: null as null|"ok"|"erro" },
    { id: "nfse",   nome: "NFS-e pós-pagamento",         desc: "Emite nota após confirmar pagamento",      agente: "agente-financeiro", freq: "Imediato",     ativo: false, resultado: null as null|"ok"|"erro" },
  ]);
  const [novaAuto, setNovaAuto] = useState({ nome: "", agente_edge_fn: "agente-financeiro", freq_tipo: "diaria", horario: "08:00", ativo: true });
  const [showNovaAuto, setShowNovaAuto] = useState(false);
  const [salvandoAuto, setSalvandoAuto] = useState(false);
  const [runningAutoId, setRunningAutoId] = useState<string|null>(null);
  const { config: depConfig, saving: savingCfg, save: saveDepConfig } = useDepartamentoConfig("financeiro");
  const [configsFin, setConfigsFin] = useState([
    { key: "nfse_auto",    label: "Emitir NFS-e após pagamento",     enabled: false },
    { key: "bloquear",     label: "Bloquear cliente inadimplente",   enabled: true  },
    { key: "juros_auto",   label: "Juros automático após vencimento", enabled: false },
    { key: "notif_wpp",    label: "Notificar via WhatsApp",           enabled: true  },
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
      await (supabase as any).from("pipeline_config").upsert({
        setor: "financeiro", tipo: "regua_cobranca",
        config: { disparos: reguaDisparos },
      }, { onConflict: "setor,tipo" });
      toast.success("Régua salva com sucesso!");
      setShowReguaModal(false);
    } catch (e: any) {
      toast.error("Erro ao salvar régua: " + (e?.message ?? ""));
    } finally { setSalvandoRegua(false); }
  }

  async function executarAutoFin(id: string, agente: string) {
    const { session } = (await (await import('@/integrations/supabase/client')).supabase.auth.getSession()).data;
    if (!session?.access_token) { toast.error("Sessão expirada"); return; }
    setRunningAutoId(id);
    toast.loading("Executando…", { id: "auto-fin-" + id });
    try {
      const res = await fetch("https://ajaqbdsalxfgrwpjbtbn.supabase.co/functions/v1/" + agente, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ trigger: "manual" }),
      });
      if (res.ok) { toast.success("Executado!", { id: "auto-fin-" + id }); setAutosFin(a => a.map(x => x.id === id ? { ...x, resultado: "ok" } : x)); }
      else { toast.error("Erro na execução", { id: "auto-fin-" + id }); setAutosFin(a => a.map(x => x.id === id ? { ...x, resultado: "erro" } : x)); }
    } catch (e: any) { toast.error(e?.message, { id: "auto-fin-" + id }); }
    finally { setRunningAutoId(null); }
  }

  async function criarNovaAutomacao() {
    if (!novaAuto.nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSalvandoAuto(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      await (supabase as any).from("pipeline_config").insert({
        setor: "financeiro", tipo: "automacao_custom",
        config: { ...novaAuto, criada_em: new Date().toISOString() },
      });
      setAutosFin(a => [...a, { id: "custom-" + Date.now(), nome: novaAuto.nome, desc: "Freq: " + novaAuto.freq_tipo, agente: novaAuto.agente_edge_fn, freq: novaAuto.freq_tipo, ativo: novaAuto.ativo, resultado: null }]);
      toast.success("Automação criada!");
      setNovaAuto({ nome: "", agente_edge_fn: "agente-financeiro", freq_tipo: "diaria", horario: "08:00", ativo: true });
      setShowNovaAuto(false);
    } catch (e: any) { toast.error("Erro: " + (e?.message ?? "")); }
    finally { setSalvandoAuto(false); }
  }

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
  const agenteAtiv = useAgenteAtividade("financeiro");
  const podeAprovar = roles.includes("admin") || roles.includes("contador");

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
          // telefone resolvido no backend a partir do cliente_id (cadastro)
          body: JSON.stringify({ telefone: "", mensagem: msg, cliente_id: cob.clienteId }),
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
            <Button variant="outline" size="sm" className="rounded-xl gap-1 text-xs" onClick={() => setShowReguaModal(true)}>
              <Settings2 className="h-3.5 w-3.5"/>Configurar Régua
            </Button>
            <Button variant="ghost" size="sm" className="rounded-xl gap-1 text-xs" onClick={executarRegua} disabled={executandoRegua}>
              {executandoRegua?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<RefreshCw className="h-3.5 w-3.5"/>}Executar Régua
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
          <TabsTrigger value="gateway">Gateway</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <ModuleDashboard
            kpis={[
              { label: "Total previsto", value: fmtBRL(kpi.total),   icon: Wallet,        variant: "default", hint: `${kpi.count} clientes` },
              { label: "Recebido",       value: fmtBRL(kpi.pago),    icon: CheckCircle2,  variant: "success", hint: `${Math.round(kpi.pago/(kpi.total||1)*100)}%` },
              { label: "Em atraso",      value: fmtBRL(kpi.vencido), icon: AlertTriangle, variant: "danger",  hint: `${items.filter(c=>c.status==="vencida").length} cobranças` },
              { label: "Risco alto",     value: kpi.inad,             icon: ShieldAlert,   variant: "warning", hint: "negativação/suspensão" },
            ]}
            agente={agenteAtiv.status}
            onRunAgente={agenteAtiv.executar}
            agenteRunning={agenteAtiv.running}
            logs={agenteAtiv.logs}
            logsLoading={agenteAtiv.loading}
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
        </TabsContent>

        <TabsContent value="gateway" className="mt-0">
        <div className="rounded-xl border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Gateway de Pagamento</h3>
              <p className="text-sm text-muted-foreground">Asaas — configuração e status</p>
            </div>
            <a href="/configuracoes"><button className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">Config completa</button></a>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {/* status real fica em Configurações › Integrações; não afirmar "Configurado ✓" aqui (era fixo/falso) */}
            {[
              { label: "Gateway", value: "Asaas" },
              { label: "Webhook / Pix", value: "Ver em Configurações › Integrações" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
        </TabsContent>

        <TabsContent value="automacoes" className="mt-0">
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Automações Financeiras</h3>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setShowNovaAuto(v => !v)}>
              <Plus className="h-3.5 w-3.5"/> Nova Automação
            </Button>
          </div>
          {showNovaAuto && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Nova Automação</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1 block">Nome</label>
                  <Input className="h-8 text-sm" placeholder="Ex: Cobrança D+3" value={novaAuto.nome} onChange={e => setNovaAuto(a => ({ ...a, nome: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Agente (Edge Fn)</label>
                  <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm" value={novaAuto.agente_edge_fn} onChange={e => setNovaAuto(a => ({ ...a, agente_edge_fn: e.target.value }))}>
                    <option value="agente-financeiro">agente-financeiro</option>
                    <option value="agente-fiscal">agente-fiscal</option>
                    <option value="agente-orquestrador">agente-orquestrador</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Frequência</label>
                  <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm" value={novaAuto.freq_tipo} onChange={e => setNovaAuto(a => ({ ...a, freq_tipo: e.target.value }))}>
                    <option value="manual">Manual</option>
                    <option value="diaria">Diária</option>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                  </select>
                </div>
                {novaAuto.freq_tipo !== "manual" && (
                  <div>
                    <label className="text-xs font-medium mb-1 block">Horário</label>
                    <Input type="time" className="h-8 text-sm" value={novaAuto.horario} onChange={e => setNovaAuto(a => ({ ...a, horario: e.target.value }))} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => setNovaAuto(a => ({ ...a, ativo: !a.ativo }))}>
                    {novaAuto.ativo ? <ToggleRight className="h-5 w-5 text-emerald-600"/> : <ToggleLeft className="h-5 w-5 text-muted-foreground/40"/>}
                  </button>
                  <span className="text-xs">{novaAuto.ativo ? "Ativa" : "Inativa"}</span>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowNovaAuto(false)}>Cancelar</Button>
                <Button size="sm" className="gap-1.5" onClick={criarNovaAutomacao} disabled={salvandoAuto}>
                  {salvandoAuto ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>} Salvar
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Automações do Sistema</p>
          {autosFin.map(a => (
            <div key={a.id} className="rounded-lg border bg-card p-4 flex items-start gap-4">
              <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${a.ativo ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{a.nome}</p>
                  {a.resultado === "ok"   && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500"/>}
                  {a.resultado === "erro" && <AlertTriangle className="h-3.5 w-3.5 text-red-500"/>}
                  <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded ml-auto">Sistema</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                  <span>Agente: <code className="text-foreground">{a.agente}</code></span>
                  <span>Freq: <strong className="text-foreground">{a.freq}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={runningAutoId === a.id} onClick={() => executarAutoFin(a.id, a.agente)}>
                  {runningAutoId === a.id ? <Loader2 className="h-3 w-3 animate-spin"/> : <Zap className="h-3 w-3"/>} Executar
                </Button>
                <button onClick={() => setAutosFin(list => list.map(x => x.id === a.id ? { ...x, ativo: !x.ativo } : x))} className={`p-1 rounded ${a.ativo ? "text-emerald-600" : "text-muted-foreground/40"}`}>
                  {a.ativo ? <ToggleRight className="h-5 w-5"/> : <ToggleLeft className="h-5 w-5"/>}
                </button>
              </div>
            </div>
          ))}
        </div>
        </TabsContent>

        <TabsContent value="config" className="mt-0">
        <div className="rounded-xl border bg-card p-6 space-y-5">
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
            <p className="text-xs font-semibold mb-3 uppercase tracking-wide text-muted-foreground">Régua de Cobrança</p>
            <div className="space-y-2">
              {reguaDisparos.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg border bg-background">
                  <button onClick={() => setReguaDisparos(r => r.map((x, j) => j === i ? { ...x, ativo: !x.ativo } : x))} className={d.ativo ? "text-emerald-600" : "text-muted-foreground/40"}>
                    {d.ativo ? <ToggleRight className="h-5 w-5"/> : <ToggleLeft className="h-5 w-5"/>}
                  </button>
                  <span className="text-xs font-bold text-foreground w-8">{d.label}</span>
                  <span className="text-xs text-muted-foreground flex-1">{d.canal}</span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setShowReguaModal(true)}>Editar</Button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5 text-xs" onClick={() => setShowReguaModal(true)}>
              <Settings2 className="h-3.5 w-3.5"/> Configurar Régua Completa
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
                <p className="font-semibold text-foreground">Régua de Cobrança Automática</p>
                <p className="text-xs text-muted-foreground mt-0.5">Configure os disparos automáticos por atraso</p>
              </div>
              <button onClick={() => setShowReguaModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted">
                <X className="h-4 w-4"/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {reguaDisparos.map((d, i) => (
                <div key={d.id} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setReguaDisparos(r => r.map((x, j) => j === i ? { ...x, ativo: !x.ativo } : x))} className={d.ativo ? "text-emerald-600" : "text-muted-foreground/40"}>
                      {d.ativo ? <ToggleRight className="h-6 w-6"/> : <ToggleLeft className="h-6 w-6"/>}
                    </button>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{d.label} — {d.ativo ? "Ativo" : "Inativo"}</p>
                      <p className="text-xs text-muted-foreground">Disparo após {d.dias} dias do vencimento</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Dias após vencimento</label>
                      <Input type="number" min={1} max={90} className="h-8 text-sm" value={d.dias} onChange={e => setReguaDisparos(r => r.map((x, j) => j === i ? { ...x, dias: Number(e.target.value) } : x))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Canal</label>
                      <select className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm" value={d.canal} onChange={e => setReguaDisparos(r => r.map((x, j) => j === i ? { ...x, canal: e.target.value } : x))}>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Email">Email</option>
                        <option value="Ambos">Ambos</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Mensagem template</label>
                    <textarea rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Use {nome}, {empresa}, {valor}, {dias}" value={d.msg} onChange={e => setReguaDisparos(r => r.map((x, j) => j === i ? { ...x, msg: e.target.value } : x))} />
                    <p className="text-[11px] text-muted-foreground mt-1">Variáveis: {"{nome}"} {"{empresa}"} {"{valor}"} {"{dias}"} {"{vencimento}"}</p>
                  </div>
                </div>
              ))}
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

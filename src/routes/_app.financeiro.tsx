import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, Clock, DollarSign,
  ExternalLink, MessageCircle, Send, ShieldAlert, TrendingUp,
  Wallet, Link2, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { financeiroStore, type Cobranca, type CobrancaStatus, type ReguaStage } from "@/lib/financeiro-store";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const STATUS_CFG: Record<CobrancaStatus, { bg: string; text: string; Icon: React.ElementType; label: string }> = {
  pendente:  { bg: "bg-blue-50",    text: "text-blue-700",    Icon: Clock,        label: "Pendente"  },
  paga:      { bg: "bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle2, label: "Paga"      },
  vencida:   { bg: "bg-red-50",     text: "text-red-700",     Icon: AlertTriangle,label: "Vencida"   },
  cancelada: { bg: "bg-gray-100",   text: "text-gray-500",    Icon: Ban,          label: "Cancelada" },
};

const REGUA_CFG: Record<ReguaStage, { label: string; bg: string; text: string; Icon: React.ElementType }> = {
  ok:          { label: "Em dia",      bg: "bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle2 },
  lembrete:    { label: "Lembrete",    bg: "bg-blue-50",    text: "text-blue-700",    Icon: Clock        },
  cobranca:    { label: "Cobrança",    bg: "bg-amber-50",   text: "text-amber-700",   Icon: AlertTriangle},
  negativacao: { label: "Negativação", bg: "bg-orange-50",  text: "text-orange-700",  Icon: ShieldAlert  },
  suspensao:   { label: "Suspensão",   bg: "bg-red-50",     text: "text-red-700",     Icon: Ban          },
};

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function FinanceiroPage() {
  const now = new Date();
  const [ano, setAno]       = useState(now.getFullYear());
  const [mes, setMes]       = useState(now.getMonth() + 1);
  const [items, setItems]   = useState<Cobranca[]>([]);
  const [query, setQuery]   = useState("");
  const [status, setStatus] = useState<"todos" | CobrancaStatus>("todos");
  const [stage, setStage]   = useState<"todos" | ReguaStage>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const competencia = `${ano}-${mes.toString().padStart(2, "0")}`;

  useEffect(() => {
    const fn = () => setItems(financeiroStore.listByCompetencia(competencia));
    fn();
    window.addEventListener("apoya:financeiro:changed", fn);
    window.addEventListener("apoya:clientes:changed", fn);
    return () => {
      window.removeEventListener("apoya:financeiro:changed", fn);
      window.removeEventListener("apoya:clientes:changed", fn);
    };
  }, [competencia]);

  useEffect(() => setSelected(new Set()), [competencia]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((c) => q ? `${c.clienteNome} ${c.cnpj}`.toLowerCase().includes(q) : true)
      .filter((c) => status === "todos" || c.status === status)
      .filter((c) => stage  === "todos" || c.reguaStage === stage)
      .sort((a, b) => b.diasAtraso - a.diasAtraso || a.clienteNome.localeCompare(b.clienteNome));
  }, [items, query, status, stage]);

  const kpi = useMemo(() => {
    const total  = items.reduce((s, c) => s + c.valor, 0);
    const pago   = items.filter((c) => c.status === "paga").reduce((s, c) => s + c.valor, 0);
    const vencido= items.filter((c) => c.status === "vencida").reduce((s, c) => s + c.valor, 0);
    const inad   = items.filter((c) => c.reguaStage === "suspensao" || c.reguaStage === "negativacao").length;
    return { total, pago, vencido, inad, count: items.length };
  }, [items]);

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)));
  }
  function toggleOne(id: string) {
    const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s);
  }

  async function gerarLote() {
    const ids = filtered.filter((c) => selected.has(c.id) && !c.asaasId).map((c) => c.id);
    if (!ids.length) { toast.error("Selecione cobranças sem link gerado"); return; }
    setLoading(true);
    toast.loading(`Gerando ${ids.length} cobrança(s) no Asaas…`, { id: "fin-lote" });
    await new Promise((r) => setTimeout(r, 1200));
    ids.forEach((id) => {
      financeiroStore.update(id, {
        asaasId: `ASAAS_${id.slice(-6).toUpperCase()}`,
        linkPagamento: `https://pay.asaas.com/mock/${id.slice(-6)}`,
      });
    });
    toast.success(`${ids.length} cobrança(s) gerada(s)!`, { id: "fin-lote" });
    setLoading(false);
    setSelected(new Set());
  }

  async function enviarWhatsapp() {
    const ids = filtered.filter((c) => selected.has(c.id)).map((c) => c.id);
    if (!ids.length) { toast.error("Selecione ao menos uma cobrança"); return; }
    setLoading(true);
    toast.loading(`Enviando ${ids.length} mensagem(ns)…`, { id: "fin-wpp" });
    await new Promise((r) => setTimeout(r, 1000));
    ids.forEach((id) => financeiroStore.update(id, { ultimoEnvioWhatsapp: new Date().toISOString() }));
    toast.success(`${ids.length} mensagem(ns) enviada(s)!`, { id: "fin-wpp" });
    setLoading(false);
    setSelected(new Set());
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Régua de cobrança · {MESES[mes - 1]} {ano}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"
            onClick={() => { let m = mes - 1, a = ano; if (m < 1) { m = 12; a--; } setMes(m); setAno(a); }}>‹</Button>
          <span className="flex h-8 min-w-[110px] items-center justify-center rounded-xl border bg-card px-3 text-sm font-semibold">
            {MESES[mes - 1]} {ano}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"
            onClick={() => { let m = mes + 1, a = ano; if (m > 12) { m = 1; a++; } setMes(m); setAno(a); }}>›</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Wallet}        label="Total previsto"   value={fmt(kpi.total)}   sub={`${kpi.count} clientes`}           bg="bg-card"         accent="text-foreground" />
        <KpiCard icon={CheckCircle2}  label="Recebido"        value={fmt(kpi.pago)}    sub={`${Math.round(kpi.pago/kpi.total*100||0)}% do total`} bg="bg-emerald-50"   accent="text-emerald-700" />
        <KpiCard icon={AlertTriangle} label="Em atraso"       value={fmt(kpi.vencido)} sub={`${items.filter(c=>c.status==="vencida").length} cobranças`} bg="bg-red-50"   accent="text-red-700" />
        <KpiCard icon={ShieldAlert}   label="Risco alto"      value={`${kpi.inad}`}    sub="negativação ou suspensão"          bg="bg-orange-50"    accent="text-orange-700" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente ou CNPJ…"
          className="h-9 min-w-[200px] flex-1 rounded-xl" />
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="h-9 min-w-[140px] rounded-xl text-sm">
            <SelectValue>{status === "todos" ? "Todos status" : STATUS_CFG[status as CobrancaStatus]?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {(["pendente","paga","vencida","cancelada"] as CobrancaStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={(v) => setStage(v as any)}>
          <SelectTrigger className="h-9 min-w-[140px] rounded-xl text-sm">
            <SelectValue>{stage === "todos" ? "Toda a régua" : REGUA_CFG[stage as ReguaStage]?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Toda a régua</SelectItem>
            {(["ok","lembrete","cobranca","negativacao","suspensao"] as ReguaStage[]).map((s) => (
              <SelectItem key={s} value={s}>{REGUA_CFG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Ações em lote */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs gap-1" disabled={loading} onClick={gerarLote}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              Gerar no Asaas
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50" disabled={loading} onClick={enviarWhatsapp}>
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs" onClick={() => setSelected(new Set())}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Cabeçalho de coluna */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 px-4 text-xs font-medium text-muted-foreground">
          <Checkbox checked={selected.size === filtered.length} onCheckedChange={toggleAll} className="rounded" />
          <span className="flex-1">Cliente</span>
          <span className="hidden w-24 sm:block">Régua</span>
          <span className="hidden w-24 sm:block">Vencimento</span>
          <span className="hidden w-20 sm:block text-right">Status</span>
          <span className="w-24 text-right">Valor</span>
        </div>
      )}

      {/* Lista de cobranças */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-16 text-center">
          <DollarSign className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">Nenhuma cobrança encontrada</p>
          <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou o mês de competência</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <CobrancaCard key={c.id} cobranca={c} selected={selected.has(c.id)} onToggle={() => toggleOne(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── KpiCard ─────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, bg, accent }: {
  icon: React.ElementType; label: string; value: string; sub: string; bg: string; accent: string;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${bg}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${accent}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

/* ── CobrancaCard ────────────────────────────────────────────── */
function CobrancaCard({ cobranca: c, selected, onToggle }: {
  cobranca: Cobranca; selected: boolean; onToggle: () => void;
}) {
  const sCfg = STATUS_CFG[c.status];
  const rCfg = REGUA_CFG[c.reguaStage];

  const riskBorder =
    c.reguaStage === "suspensao"   ? "border-l-red-500"    :
    c.reguaStage === "negativacao" ? "border-l-orange-400"  :
    c.reguaStage === "cobranca"    ? "border-l-amber-400"   :
    "border-l-transparent";

  return (
    <div className={`group flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md border-l-4 ${riskBorder} ${selected ? "ring-2 ring-primary/30" : ""}`}>
      <Checkbox checked={selected} onCheckedChange={onToggle} className="rounded shrink-0" />

      {/* Info cliente */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{c.clienteNome}</span>
          {c.asaasId && (
            <a href={c.linkPagamento} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </a>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{c.cnpj}</span>
          <span>{c.descricao}</span>
          {c.diasAtraso > 0 && (
            <span className="font-medium text-red-600">{c.diasAtraso}d de atraso</span>
          )}
        </div>
      </div>

      {/* Régua badge */}
      <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex ${rCfg.bg} ${rCfg.text}`}>
        <rCfg.Icon className="h-3 w-3" />
        {rCfg.label}
      </span>

      {/* Vencimento */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-sm font-medium">
          {new Date(c.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
        </div>
        <div className="text-[11px] text-muted-foreground">{c.forma}</div>
      </div>

      {/* Status */}
      <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex ${sCfg.bg} ${sCfg.text}`}>
        <sCfg.Icon className="h-3 w-3" />
        {sCfg.label}
      </span>

      {/* Valor */}
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums">{fmt(c.valor)}</div>
        {c.ultimoEnvioWhatsapp && (
          <div className="flex items-center justify-end gap-1 text-[11px] text-emerald-600">
            <MessageCircle className="h-3 w-3" /> enviado
          </div>
        )}
      </div>
    </div>
  );
}

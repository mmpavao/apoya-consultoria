import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Calendar, CheckCircle2, Clock,
  LayoutGrid, List, RefreshCw, Search, Sparkles,
  TrendingUp, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { obrigacoesStore, calcularMulta, type Obrigacao, type ObrigacaoStatus } from "@/lib/obrigacoes-store";

export const Route = createFileRoute("/_app/obrigacoes")({
  component: ObrigacoesPage,
  head: () => ({ meta: [{ title: "Obrigações · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const STATUS_CFG: Record<ObrigacaoStatus, { bg: string; text: string; border: string; Icon: React.ElementType; label: string }> = {
  pendente:     { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    Icon: Clock,         label: "Pendente"     },
  em_andamento: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   Icon: TrendingUp,    label: "Em andamento" },
  concluida:    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", Icon: CheckCircle2,  label: "Concluída"    },
  atrasada:     { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200",     Icon: AlertTriangle, label: "Atrasada"     },
};

const TIPO_COLOR: Record<string, string> = {
  DAS:                "bg-blue-100 text-blue-800",
  "DASN-Simei":       "bg-violet-100 text-violet-800",
  DCTFWeb:            "bg-orange-100 text-orange-800",
  "EFD-Contribuições":"bg-cyan-100 text-cyan-800",
  "EFD-ICMS/IPI":     "bg-indigo-100 text-indigo-800",
  "EFD-Reinf":        "bg-pink-100 text-pink-800",
  ECF:                "bg-rose-100 text-rose-800",
  ECD:                "bg-purple-100 text-purple-800",
  DIRBI:              "bg-amber-100 text-amber-800",
  DEFIS:              "bg-lime-100 text-lime-800",
  NFSe:               "bg-teal-100 text-teal-800",
  "FGTS Digital":     "bg-green-100 text-green-800",
  eSocial:            "bg-sky-100 text-sky-800",
};

const KANBAN_COLS: { key: ObrigacaoStatus; label: string }[] = [
  { key: "pendente",     label: "A fazer"      },
  { key: "em_andamento", label: "Em andamento" },
  { key: "concluida",    label: "Concluídas"   },
  { key: "atrasada",     label: "Atrasadas"    },
];

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function diasRestantes(venc: string) {
  const diff = Math.ceil((new Date(venc).getTime() - Date.now()) / 86400000);
  return diff;
}

function ObrigacoesPage() {
  const now = new Date();
  const [items, setItems]     = useState<Obrigacao[]>([]);
  const [ano, setAno]         = useState(now.getFullYear());
  const [mes, setMes]         = useState(now.getMonth() + 1);
  const [query, setQuery]     = useState("");
  const [regime, setRegime]   = useState("todos");
  const [status, setStatus]   = useState("todos");
  const [resp, setResp]       = useState("todos");
  const [view, setView]       = useState<"lista" | "kanban">("lista");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fn = () => setItems(obrigacoesStore.list());
    fn();
    window.addEventListener("apoya:obrigacoes:changed", fn);
    window.addEventListener("apoya:clientes:changed", fn);
    return () => {
      window.removeEventListener("apoya:obrigacoes:changed", fn);
      window.removeEventListener("apoya:clientes:changed", fn);
    };
  }, []);

  const competencia = `${ano}-${mes.toString().padStart(2, "0")}`;
  const responsaveis = useMemo(() => Array.from(new Set(items.map((o) => o.responsavel))), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((o) => o.competencia === competencia)
      .filter((o) => q ? `${o.clienteNome} ${o.tipo} ${o.descricao}`.toLowerCase().includes(q) : true)
      .filter((o) => regime === "todos" || o.regime === regime)
      .filter((o) => status === "todos" || o.status === status)
      .filter((o) => resp   === "todos" || o.responsavel === resp)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [items, competencia, query, regime, status, resp]);

  const counts = useMemo(() => {
    const m = items.filter((o) => o.competencia === competencia);
    return {
      total:    m.length,
      pendente: m.filter((o) => o.status === "pendente").length,
      atrasada: m.filter((o) => o.status === "atrasada").length,
      concluida:m.filter((o) => o.status === "concluida").length,
    };
  }, [items, competencia]);

  function markSelected(newStatus: ObrigacaoStatus) {
    selected.forEach((id) => obrigacoesStore.updateStatus(id, newStatus));
    toast.success(`${selected.size} obrigação(ões) marcadas como "${STATUS_CFG[newStatus].label}"`);
    setSelected(new Set());
  }

  function gerarMes() {
    obrigacoesStore.generateForMonth(competencia);
    toast.success(`Obrigações de ${MESES[mes - 1]}/${ano} geradas!`);
  }

  function toggleOne(id: string) {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  }

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((o) => o.id)));
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Obrigações Fiscais</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {counts.total} obrigações em {MESES[mes - 1]}/{ano}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={gerarMes}>
            <RefreshCw className="h-3.5 w-3.5" /> Gerar mês
          </Button>
          <Button size="sm" className="rounded-xl gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Marcar em lote
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total",     v: counts.total,     bg: "bg-muted",      text: "text-foreground"    },
          { label: "Pendentes", v: counts.pendente,  bg: "bg-blue-50",    text: "text-blue-700"      },
          { label: "Atrasadas", v: counts.atrasada,  bg: "bg-red-50",     text: "text-red-700"       },
          { label: "Concluídas",v: counts.concluida, bg: "bg-emerald-50", text: "text-emerald-700"   },
        ].map(({ label, v, bg, text }) => (
          <div key={label} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${bg}`}>
            <span className={`text-2xl font-bold ${text}`}>{v}</span>
            <span className={`text-xs font-medium ${text} opacity-70`}>{label}</span>
          </div>
        ))}
      </div>

      {/* Nav mês */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"
          onClick={() => { let m = mes - 1, a = ano; if (m < 1) { m = 12; a--; } setMes(m); setAno(a); }}>
          ‹
        </Button>
        <span className="min-w-[110px] text-center text-sm font-semibold">
          {MESES[mes - 1]} {ano}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl"
          onClick={() => { let m = mes + 1, a = ano; if (m > 12) { m = 1; a++; } setMes(m); setAno(a); }}>
          ›
        </Button>
        <div className="h-4 w-px bg-border mx-1" />

        {/* Filtros */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente ou tipo…" className="h-8 rounded-xl pl-8 text-sm w-52" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 rounded-xl text-xs w-36">
            <SelectValue>{status === "todos" ? "Todos status" : STATUS_CFG[status as ObrigacaoStatus]?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {(["pendente","em_andamento","concluida","atrasada"] as ObrigacaoStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CFG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1 rounded-xl border bg-card p-1">
          <button onClick={() => setView("lista")}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${view === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setView("kanban")}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Ações em lote */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs gap-1"
              onClick={() => markSelected("em_andamento")}>
              <TrendingUp className="h-3 w-3" /> Em andamento
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              onClick={() => markSelected("concluida")}>
              <CheckCircle2 className="h-3 w-3" /> Concluir
            </Button>
            <Button size="sm" variant="ghost" className="rounded-xl h-7 text-xs"
              onClick={() => setSelected(new Set())}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Vista lista */}
      {view === "lista" && (
        <div className="space-y-2">
          {/* Cabeçalho lista */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-3 px-4 text-xs font-medium text-muted-foreground pb-1">
              <Checkbox checked={selected.size === filtered.length && filtered.length > 0}
                onCheckedChange={toggleAll} className="rounded" />
              <span className="flex-1">Obrigação</span>
              <span className="hidden w-28 sm:block">Vencimento</span>
              <span className="hidden w-24 sm:block">Status</span>
              <span className="w-20 text-right">Valor</span>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-16 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Nenhuma obrigação para este mês</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Gerar mês" para criar automaticamente</p>
            </div>
          ) : (
            filtered.map((o) => <ObrCard key={o.id} ob={o} selected={selected.has(o.id)} onToggle={() => toggleOne(o.id)} />)
          )}
        </div>
      )}

      {/* Vista kanban */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KANBAN_COLS.map(({ key, label }) => {
            const col = filtered.filter((o) => o.status === key);
            const cfg = STATUS_CFG[key];
            return (
              <div key={key} className="space-y-2">
                <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${cfg.bg}`}>
                  <cfg.Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                  <span className={`text-xs font-semibold ${cfg.text}`}>{label}</span>
                  <span className={`ml-auto text-xs font-bold ${cfg.text}`}>{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((o) => <KanbanCard key={o.id} ob={o} />)}
                  {col.length === 0 && (
                    <div className="rounded-xl border border-dashed bg-card p-4 text-center text-xs text-muted-foreground">
                      Nenhuma
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── ObrCard (lista) ─────────────────────────────────────────── */
function ObrCard({ ob, selected, onToggle }: { ob: Obrigacao; selected: boolean; onToggle: () => void }) {
  const cfg  = STATUS_CFG[ob.status];
  const dias = diasRestantes(ob.vencimento);
  const multa = ob.status === "atrasada" && ob.valor ? calcularMulta(ob.valor, ob.vencimento) : null;

  const urgencia = dias <= 0 ? "border-l-red-500" : dias <= 3 ? "border-l-amber-400" : "border-l-transparent";

  return (
    <div className={`group flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition-all hover:shadow-md border-l-4 ${urgencia} ${selected ? "ring-2 ring-primary/30" : ""}`}>
      <Checkbox checked={selected} onCheckedChange={onToggle} className="rounded shrink-0" />

      {/* Tipo badge */}
      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-bold ${TIPO_COLOR[ob.tipo] ?? "bg-gray-100 text-gray-700"}`}>
        {ob.tipo}
      </span>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{ob.clienteNome}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">· {ob.descricao}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{ob.responsavel}</span>
          {multa && multa.dias > 0 && (
            <span className="text-red-600 font-medium">
              +{multa.dias}d atraso · multa ~{new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(multa.multa)}
            </span>
          )}
        </div>
      </div>

      {/* Vencimento */}
      <div className="hidden shrink-0 text-right sm:block">
        <div className="text-sm font-medium">
          {new Date(ob.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
        </div>
        {ob.status !== "concluida" && (
          <div className={`text-[11px] ${dias < 0 ? "text-red-600 font-semibold" : dias <= 3 ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
            {dias < 0 ? `${Math.abs(dias)}d atrasado` : dias === 0 ? "Vence hoje!" : `${dias}d restantes`}
          </div>
        )}
      </div>

      {/* Status */}
      <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex ${cfg.bg} ${cfg.text}`}>
        <cfg.Icon className="h-3 w-3" />{cfg.label}
      </span>

      {/* Valor */}
      {ob.valor ? (
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums">{fmt(ob.valor)}</div>
        </div>
      ) : (
        <div className="w-16 shrink-0" />
      )}
    </div>
  );
}

/* ── KanbanCard ─────────────────────────────────────────────── */
function KanbanCard({ ob }: { ob: Obrigacao }) {
  const dias = diasRestantes(ob.vencimento);
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${TIPO_COLOR[ob.tipo] ?? "bg-gray-100 text-gray-700"}`}>
          {ob.tipo}
        </span>
        {ob.valor && <span className="text-xs font-semibold tabular-nums">{fmt(ob.valor)}</span>}
      </div>
      <p className="text-xs font-semibold leading-snug truncate">{ob.clienteNome}</p>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          {new Date(ob.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
        </span>
        {ob.status !== "concluida" && (
          <span className={`text-[11px] font-medium ${dias < 0 ? "text-red-600" : dias <= 3 ? "text-amber-600" : "text-muted-foreground"}`}>
            {dias < 0 ? `${Math.abs(dias)}d atraso` : `${dias}d`}
          </span>
        )}
      </div>
    </div>
  );
}

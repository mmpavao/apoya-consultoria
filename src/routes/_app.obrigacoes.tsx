import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar as CalendarIcon, CheckCircle2, Clock, Info, LayoutGrid, List, RefreshCw, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PagePlaceholder";
import { obrigacoesStore, calcularMulta, type Obrigacao, type ObrigacaoStatus } from "@/lib/obrigacoes-store";

export const Route = createFileRoute("/_app/obrigacoes")({
  component: ObrigacoesPage,
  head: () => ({ meta: [{ title: "Obrigações · APOYA Gestão" }] }),
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const KANBAN_COLS: { key: ObrigacaoStatus; label: string; tone: string }[] = [
  { key: "pendente", label: "A fazer", tone: "bg-info/10 text-info border-info/20" },
  { key: "em_andamento", label: "Em andamento", tone: "bg-warning/10 text-warning border-warning/20" },
  { key: "concluida", label: "Concluídas", tone: "bg-success/10 text-success border-success/20" },
  { key: "atrasada", label: "Atrasadas", tone: "bg-destructive/10 text-destructive border-destructive/20" },
];

function ObrigacoesPage() {
  const now = new Date();
  const [items, setItems] = useState<Obrigacao[]>([]);
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [query, setQuery] = useState("");
  const [regime, setRegime] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [responsavel, setResponsavel] = useState("todos");
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [reformaDismissed, setReformaDismissed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("apoya:reforma:dismissed") === "1"
  );

  useEffect(() => {
    const refresh = () => setItems(obrigacoesStore.list());
    refresh();
    window.addEventListener("apoya:obrigacoes:changed", refresh);
    window.addEventListener("apoya:clientes:changed", refresh);
    return () => {
      window.removeEventListener("apoya:obrigacoes:changed", refresh);
      window.removeEventListener("apoya:clientes:changed", refresh);
    };
  }, []);

  const competencia = `${ano}-${mes.toString().padStart(2, "0")}`;

  const responsaveis = useMemo(() => Array.from(new Set(items.map((o) => o.responsavel))), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((o) => o.competencia === competencia)
      .filter((o) => (q ? `${o.clienteNome} ${o.tipo} ${o.descricao}`.toLowerCase().includes(q) : true))
      .filter((o) => regime === "todos" || o.regime === regime)
      .filter((o) => status === "todos" || o.status === status)
      .filter((o) => responsavel === "todos" || o.responsavel === responsavel)
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [items, competencia, query, regime, status, responsavel]);

  const counts = useMemo(() => {
    const monthItems = items.filter((o) => o.competencia === competencia);
    return {
      total: monthItems.length,
      pendente: monthItems.filter((o) => o.status === "pendente").length,
      atrasada: monthItems.filter((o) => o.status === "atrasada").length,
      concluida: monthItems.filter((o) => o.status === "concluida").length,
    };
  }, [items, competencia]);

  // Alertas: atrasadas + vencendo em ≤3 dias
  const alertas = useMemo(() => {
    const monthItems = items.filter((o) => o.competencia === competencia);
    const atrasadas = monthItems.filter((o) => o.status === "atrasada");
    const proximas = monthItems.filter((o) => {
      if (o.status !== "pendente") return false;
      const days = Math.ceil((new Date(o.vencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 3;
    });
    const multaTotal = atrasadas.reduce((acc, o) => acc + (o.valor ? calcularMulta(o.valor, o.vencimento).multa + calcularMulta(o.valor, o.vencimento).juros : 0), 0);
    return { atrasadas, proximas, multaTotal };
  }, [items, competencia]);

  function handleRegenerate() {
    obrigacoesStore.regenerate(ano, mes);
    toast.success(`Obrigações de ${MESES[mes - 1]}/${ano} geradas`);
  }

  function dismissReforma() {
    localStorage.setItem("apoya:reforma:dismissed", "1");
    setReformaDismissed(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Obrigações"
        subtitle="Calendário fiscal por cliente e regime tributário"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border bg-card p-0.5">
              <Button
                variant={view === "lista" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-lg"
                onClick={() => setView("lista")}
              >
                <List className="h-4 w-4" /> Lista
              </Button>
              <Button
                variant={view === "kanban" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-lg"
                onClick={() => setView("kanban")}
              >
                <LayoutGrid className="h-4 w-4" /> Kanban
              </Button>
            </div>
            <Button variant="outline" className="rounded-xl" onClick={handleRegenerate}>
              <RefreshCw className="h-4 w-4" /> Gerar do mês
            </Button>
          </div>
        }
      />

      {/* Banner Reforma Tributária */}
      {!reformaDismissed && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Reforma Tributária 2026 — CBS e IBS</h3>
              <Badge variant="outline" className="rounded-full border-primary/30 text-primary">EC 132/2023</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              A partir de jan/2026 entra a fase de testes da CBS (federal) e IBS (estadual/municipal). NFS-e nacional já é obrigatória para MEI.
              Revise CNAEs e códigos de serviço dos seus clientes.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={dismissReforma}>Ocultar</Button>
        </div>
      )}

      {/* Alertas de multa */}
      {(alertas.atrasadas.length > 0 || alertas.proximas.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {alertas.atrasadas.length > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-sm font-semibold">{alertas.atrasadas.length} obrigações atrasadas</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Multa de mora estimada (0,33%/dia, máx. 20%) + juros Selic acumulados:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {alertas.multaTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </p>
            </div>
          )}
          {alertas.proximas.length > 0 && (
            <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-center gap-2 text-warning">
                <Clock className="h-5 w-5" />
                <h3 className="text-sm font-semibold">{alertas.proximas.length} vencem em até 3 dias</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Priorize estas obrigações para evitar multas e juros.
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Kpi icon={CalendarIcon} label="Total no mês" value={counts.total} tone="default" />
        <Kpi icon={Clock} label="Pendentes" value={counts.pendente} tone="info" />
        <Kpi icon={AlertTriangle} label="Atrasadas" value={counts.atrasada} tone="destructive" />
        <Kpi icon={CheckCircle2} label="Concluídas" value={counts.concluida} tone="success" />
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Select value={mes.toString()} onValueChange={(v) => setMes(parseInt(v, 10))}>
            <SelectTrigger className="w-[130px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ano.toString()} onValueChange={(v) => setAno(parseInt(v, 10))}>
            <SelectTrigger className="w-[110px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente ou obrigação" className="rounded-xl pl-9" />
          </div>

          <FilterSelect label="Regime" value={regime} onChange={setRegime} options={["todos", "MEI", "Simples", "Lucro Presumido", "Lucro Real", "Doméstica"]} />
          {view === "lista" && (
            <FilterSelect label="Status" value={status} onChange={setStatus} options={["todos", "pendente", "em_andamento", "atrasada", "concluida"]} capitalize />
          )}
          <FilterSelect label="Responsável" value={responsavel} onChange={setResponsavel} options={["todos", ...responsaveis]} />
        </div>

        {view === "lista" ? (
          <ListaView filtered={filtered} />
        ) : (
          <KanbanView items={filtered} />
        )}
      </div>
    </div>
  );
}

function ListaView({ filtered }: { filtered: Obrigacao[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[44px]"></TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Obrigação</TableHead>
          <TableHead>Regime</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead className="text-right">Valor</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
              <CalendarIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
              Nenhuma obrigação para os filtros selecionados
            </TableCell>
          </TableRow>
        )}
        {filtered.map((o) => {
          const multa = o.valor && o.status === "atrasada" ? calcularMulta(o.valor, o.vencimento) : null;
          return (
            <TableRow key={o.id} className={o.status === "concluida" ? "opacity-60" : ""}>
              <TableCell>
                <Checkbox
                  checked={o.status === "concluida"}
                  onCheckedChange={() => obrigacoesStore.toggle(o.id)}
                  aria-label="Marcar como concluída"
                />
              </TableCell>
              <TableCell className="font-medium">{o.clienteNome}</TableCell>
              <TableCell>
                <div className="font-medium">{o.tipo}</div>
                <div className="text-xs text-muted-foreground">{o.descricao}</div>
              </TableCell>
              <TableCell><Badge variant="outline" className="rounded-full">{o.regime}</Badge></TableCell>
              <TableCell className="text-sm">{formatDate(o.vencimento)}</TableCell>
              <TableCell><StatusBadge status={o.status} vencimento={o.vencimento} /></TableCell>
              <TableCell className="text-sm">{o.responsavel}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {o.valor != null ? o.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
                {multa && (
                  <div className="text-[10px] font-normal text-destructive">
                    +{(multa.multa + multa.juros).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} multa
                  </div>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function KanbanView({ items }: { items: Obrigacao[] }) {
  const [dragId, setDragId] = useState<string | null>(null);

  function handleDrop(target: ObrigacaoStatus) {
    if (!dragId) return;
    obrigacoesStore.setStatus(dragId, target);
    setDragId(null);
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        <CalendarIcon className="mx-auto mb-3 h-8 w-8 opacity-40" />
        Nenhuma obrigação para os filtros selecionados
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
      {KANBAN_COLS.map((col) => {
        const colItems = items.filter((o) => o.status === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.key)}
            className="flex min-h-[280px] flex-col rounded-2xl border bg-muted/30 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{col.label}</span>
              <Badge variant="outline" className={`rounded-full border ${col.tone}`}>{colItems.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {colItems.map((o) => {
                const multa = o.valor && col.key === "atrasada" ? calcularMulta(o.valor, o.vencimento) : null;
                return (
                  <div
                    key={o.id}
                    draggable
                    onDragStart={() => setDragId(o.id)}
                    onDragEnd={() => setDragId(null)}
                    className="cursor-grab rounded-xl border bg-card p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">{o.tipo}</span>
                      <Badge variant="outline" className="rounded-full text-[10px]">{o.regime}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{o.clienteNome}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Venc. {formatDate(o.vencimento)}</span>
                      {o.valor != null && (
                        <span className="font-mono font-medium">
                          {o.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      )}
                    </div>
                    {multa && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        +{(multa.multa + multa.juros).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} ({multa.dias}d)
                      </div>
                    )}
                    <div className="mt-2 text-[10px] text-muted-foreground">{o.responsavel}</div>
                  </div>
                );
              })}
              {colItems.length === 0 && (
                <div className="flex items-center justify-center rounded-xl border border-dashed py-6 text-xs text-muted-foreground">
                  <Info className="mr-1 h-3 w-3" /> Arraste cards aqui
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function StatusBadge({ status, vencimento }: { status: ObrigacaoStatus; vencimento: string }) {
  const map: Record<ObrigacaoStatus, string> = {
    pendente: "bg-info/10 text-info border-info/20",
    em_andamento: "bg-warning/10 text-warning border-warning/20",
    atrasada: "bg-destructive/10 text-destructive border-destructive/20",
    concluida: "bg-success/10 text-success border-success/20",
  };
  const labels: Record<ObrigacaoStatus, string> = {
    pendente: "Pendente",
    em_andamento: "Em andamento",
    atrasada: "Atrasada",
    concluida: "Concluída",
  };
  const days = Math.ceil((new Date(vencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const hint = status === "pendente" && days <= 5 && days >= 0 ? ` · ${days}d` : status === "atrasada" ? ` · ${Math.abs(days)}d` : "";
  return <Badge variant="outline" className={`rounded-full border ${map[status]}`}>{labels[status]}{hint}</Badge>;
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof CalendarIcon; label: string; value: number; tone: "default" | "info" | "destructive" | "success" }) {
  const toneCls = {
    default: "bg-muted text-foreground",
    info: "bg-info/10 text-info",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options, capitalize,
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; capitalize?: boolean }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[170px] rounded-xl">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className={capitalize ? "capitalize" : undefined}>
            {o === "todos" ? `${label}: todos` : o.replace("_", " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

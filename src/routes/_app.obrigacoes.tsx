import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calendar as CalendarIcon, CheckCircle2, Clock, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PagePlaceholder";
import { obrigacoesStore, type Obrigacao, type ObrigacaoStatus } from "@/lib/obrigacoes-store";

export const Route = createFileRoute("/_app/obrigacoes")({
  component: ObrigacoesPage,
  head: () => ({ meta: [{ title: "Obrigações · APOYA Gestão" }] }),
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function ObrigacoesPage() {
  const now = new Date();
  const [items, setItems] = useState<Obrigacao[]>([]);
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [query, setQuery] = useState("");
  const [regime, setRegime] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [responsavel, setResponsavel] = useState("todos");

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

  function handleRegenerate() {
    obrigacoesStore.regenerate(ano, mes);
    toast.success(`Obrigações de ${MESES[mes - 1]}/${ano} geradas`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Obrigações"
        subtitle="Calendário fiscal por cliente e regime tributário"
        actions={
          <Button variant="outline" className="rounded-xl" onClick={handleRegenerate}>
            <RefreshCw className="h-4 w-4" /> Gerar do mês
          </Button>
        }
      />

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

          <FilterSelect label="Regime" value={regime} onChange={setRegime} options={["todos", "MEI", "Simples", "Lucro Presumido", "Lucro Real"]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={["todos", "pendente", "atrasada", "concluida"]} capitalize />
          <FilterSelect label="Responsável" value={responsavel} onChange={setResponsavel} options={["todos", ...responsaveis]} />
        </div>

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
            {filtered.map((o) => (
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
    atrasada: "bg-destructive/10 text-destructive border-destructive/20",
    concluida: "bg-success/10 text-success border-success/20",
  };
  const labels: Record<ObrigacaoStatus, string> = {
    pendente: "Pendente",
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
            {o === "todos" ? `${label}: todos` : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

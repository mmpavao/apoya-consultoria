import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, Clock, DollarSign, Link2,
  Loader2, MessageCircle, Send, ShieldAlert, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PagePlaceholder";
import { financeiroStore, type Cobranca, type CobrancaStatus, type ReguaStage } from "@/lib/financeiro-store";

export const Route = createFileRoute("/_app/financeiro")({
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro · APOYA Gestão" }] }),
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function FinanceiroPage() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<Cobranca[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | CobrancaStatus>("todos");
  const [stage, setStage] = useState<"todos" | ReguaStage>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const competencia = `${ano}-${mes.toString().padStart(2, "0")}`;

  useEffect(() => {
    const refresh = () => setItems(financeiroStore.listByCompetencia(competencia));
    refresh();
    window.addEventListener("apoya:financeiro:changed", refresh);
    window.addEventListener("apoya:clientes:changed", refresh);
    return () => {
      window.removeEventListener("apoya:financeiro:changed", refresh);
      window.removeEventListener("apoya:clientes:changed", refresh);
    };
  }, [competencia]);

  useEffect(() => setSelected(new Set()), [competencia]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((c) => (q ? `${c.clienteNome} ${c.cnpj}`.toLowerCase().includes(q) : true))
      .filter((c) => status === "todos" || c.status === status)
      .filter((c) => stage === "todos" || c.reguaStage === stage)
      .sort((a, b) => b.diasAtraso - a.diasAtraso || a.clienteNome.localeCompare(b.clienteNome));
  }, [items, query, status, stage]);

  const kpi = useMemo(() => {
    const total = items.reduce((s, c) => s + c.valor, 0);
    const pago = items.filter((c) => c.status === "paga").reduce((s, c) => s + c.valor, 0);
    const vencido = items.filter((c) => c.status === "vencida").reduce((s, c) => s + c.valor, 0);
    const inad = items.filter((c) => c.reguaStage === "suspensao" || c.reguaStage === "negativacao").length;
    return { total, pago, vencido, inad, count: items.length };
  }, [items]);

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function gerarLote() {
    const ids = filtered.filter((c) => selected.has(c.id) && !c.asaasId).map((c) => c.id);
    if (ids.length === 0) { toast.error("Selecione cobranças sem link gerado"); return; }
    setLoading(true);
    toast.loading(`Gerando ${ids.length} cobrança(s) no Asaas…`, { id: "fin-lote" });
    await financeiroStore.gerarLote(ids);
    setLoading(false);
    toast.success(`${ids.length} cobrança(s) geradas`, { id: "fin-lote" });
  }

  function enviarWhats() {
    if (selected.size === 0) { toast.error("Selecione pelo menos 1"); return; }
    financeiroStore.enviarWhatsapp(Array.from(selected));
    toast.success(`${selected.size} mensagem(ns) enviada(s) via WhatsApp (mock)`);
  }

  function suspender() {
    const n = financeiroStore.suspenderInadimplentes();
    if (n === 0) toast.info("Nenhum cliente em estágio de suspensão");
    else toast.success(`${n} cliente(s) marcado(s) para suspensão de serviços (mock)`);
  }

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        subtitle="Cobranças Asaas (PIX/Boleto/Débito) e régua de inadimplência 7/15/30/45 dias"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Faturamento do mês" value={brl(kpi.total)} icon={DollarSign} tone="default" />
        <Kpi label="Recebido" value={brl(kpi.pago)} icon={CheckCircle2} tone="success" />
        <Kpi label="Vencido" value={brl(kpi.vencido)} icon={AlertTriangle} tone="destructive" />
        <Kpi label="Em régua crítica" value={kpi.inad.toString()} icon={ShieldAlert} tone="destructive" />
        <Kpi label="Cobranças" value={kpi.count.toString()} icon={Wallet} tone="info" />
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

          <Input
            placeholder="Buscar por cliente ou CNPJ"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[220px] flex-1 rounded-xl"
          />

          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[160px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status: todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="paga">Paga</SelectItem>
              <SelectItem value="vencida">Vencida</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stage} onValueChange={(v) => setStage(v as typeof stage)}>
            <SelectTrigger className="w-[170px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Régua: todos</SelectItem>
              <SelectItem value="ok">Em dia</SelectItem>
              <SelectItem value="lembrete">Lembrete (1-6d)</SelectItem>
              <SelectItem value="cobranca">Cobrança (7-14d)</SelectItem>
              <SelectItem value="negativacao">Negativação (15-29d)</SelectItem>
              <SelectItem value="suspensao">Suspensão (30+d)</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={suspender}>
              <Ban className="h-4 w-4" /> Suspender inadimplentes
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={enviarWhats} disabled={selected.size === 0}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
            <Button className="rounded-xl" onClick={gerarLote} disabled={loading || selected.size === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gerar no Asaas ({selected.size})
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]">
                <Checkbox
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todas"
                />
              </TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Régua</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center text-sm text-muted-foreground">
                  <Wallet className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  Nenhuma cobrança para os filtros selecionados
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id} className={c.status === "cancelada" ? "opacity-60" : ""}>
                <TableCell>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                </TableCell>
                <TableCell className="font-medium">
                  {c.clienteNome}
                  <div className="mt-0.5 text-xs text-muted-foreground">{c.cnpj}</div>
                  {c.ultimoEnvioWhatsapp && (
                    <div className="mt-1 text-xs text-success">WhatsApp ✓ {new Date(c.ultimoEnvioWhatsapp).toLocaleDateString("pt-BR")}</div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{c.descricao}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-full">{c.forma}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {new Date(c.vencimento).toLocaleDateString("pt-BR")}
                  {c.diasAtraso > 0 && (
                    <div className="text-xs text-destructive">{c.diasAtraso}d atraso</div>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{brl(c.valor)}</TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell><ReguaBadge stage={c.reguaStage} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.linkPagamento && (
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg"
                        onClick={() => { navigator.clipboard?.writeText(c.linkPagamento!); toast.success("Link copiado"); }}>
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {c.status !== "paga" && c.status !== "cancelada" && (
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg"
                        onClick={() => { financeiroStore.marcarPaga(c.id); toast.success("Marcada como paga"); }}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {c.status !== "cancelada" && c.status !== "paga" && (
                      <Button size="sm" variant="outline" className="h-8 rounded-lg"
                        onClick={() => { financeiroStore.cancelar(c.id); toast.success("Cobrança cancelada"); }}>
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CobrancaStatus }) {
  const map: Record<CobrancaStatus, { cls: string; label: string }> = {
    pendente: { cls: "bg-info/10 text-info border-info/20", label: "Pendente" },
    paga: { cls: "bg-success/10 text-success border-success/20", label: "Paga" },
    vencida: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Vencida" },
    cancelada: { cls: "bg-muted text-muted-foreground border-border", label: "Cancelada" },
  };
  const { cls, label } = map[status];
  return <Badge variant="outline" className={`rounded-full border ${cls}`}>{label}</Badge>;
}

function ReguaBadge({ stage }: { stage: ReguaStage }) {
  const map: Record<ReguaStage, { cls: string; label: string; icon: typeof Clock }> = {
    ok: { cls: "bg-muted text-muted-foreground border-border", label: "Em dia", icon: CheckCircle2 },
    lembrete: { cls: "bg-info/10 text-info border-info/20", label: "Lembrete", icon: Clock },
    cobranca: { cls: "bg-warning/10 text-warning border-warning/20", label: "Cobrança", icon: AlertTriangle },
    negativacao: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Negativação", icon: ShieldAlert },
    suspensao: { cls: "bg-destructive/15 text-destructive border-destructive/30", label: "Suspensão", icon: Ban },
  };
  const { cls, label, icon: Icon } = map[stage];
  return (
    <Badge variant="outline" className={`gap-1 rounded-full border ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </Badge>
  );
}

function Kpi({ icon: Icon, label, value, tone }: {
  icon: typeof DollarSign; label: string; value: string;
  tone: "default" | "info" | "destructive" | "success";
}) {
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
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

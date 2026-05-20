import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Copy, Download, FileText, Loader2,
  MessageCircle, RefreshCw, Send, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PagePlaceholder";
import { dasStore, type DasGuia, type DasStatus } from "@/lib/das-store";

export const Route = createFileRoute("/_app/fiscal/das")({
  component: DasPage,
  head: () => ({ meta: [{ title: "DAS em Lote · APOYA Gestão" }] }),
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function DasPage() {
  const now = new Date();
  // competência padrão = mês anterior
  const def = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [ano, setAno] = useState(def.getFullYear());
  const [mes, setMes] = useState(def.getMonth() + 1);
  const [items, setItems] = useState<DasGuia[]>([]);
  const [query, setQuery] = useState("");
  const [regime, setRegime] = useState<"todos" | "MEI" | "Simples">("todos");
  const [status, setStatus] = useState<"todos" | DasStatus>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const competencia = `${ano}-${mes.toString().padStart(2, "0")}`;

  useEffect(() => {
    const refresh = () => setItems(dasStore.listByCompetencia(competencia));
    refresh();
    window.addEventListener("apoya:das:changed", refresh);
    window.addEventListener("apoya:clientes:changed", refresh);
    return () => {
      window.removeEventListener("apoya:das:changed", refresh);
      window.removeEventListener("apoya:clientes:changed", refresh);
    };
  }, [competencia]);

  useEffect(() => setSelected(new Set()), [competencia]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((g) => (q ? `${g.clienteNome} ${g.cnpj}`.toLowerCase().includes(q) : true))
      .filter((g) => regime === "todos" || g.regime === regime)
      .filter((g) => status === "todos" || g.status === status)
      .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
  }, [items, query, regime, status]);

  const counts = useMemo(() => ({
    total: items.length,
    pendente: items.filter((g) => g.status === "pendente").length,
    gerada: items.filter((g) => g.status === "gerada").length,
    paga: items.filter((g) => g.status === "paga").length,
    erro: items.filter((g) => g.status === "erro").length,
    valorTotal: items.reduce((s, g) => s + g.valor, 0),
  }), [items]);

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((g) => g.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function gerarLote() {
    const ids = filtered
      .filter((g) => selected.has(g.id) && (g.status === "pendente" || g.status === "erro"))
      .map((g) => g.id);
    if (ids.length === 0) { toast.error("Selecione pelo menos 1 DAS pendente"); return; }
    setLoading(true);
    toast.loading(`Gerando ${ids.length} DAS via SERPRO…`, { id: "das-lote" });
    await dasStore.gerarLote(ids);
    setLoading(false);
    toast.success(`${ids.length} DAS processado(s)`, { id: "das-lote" });
  }

  async function gerarUm(id: string) {
    toast.loading("Gerando DAS via SERPRO…", { id: `das-${id}` });
    await dasStore.gerar(id);
    toast.success("DAS atualizado", { id: `das-${id}` });
  }

  function enviarWhats() {
    const elig = filtered.filter((g) => selected.has(g.id) && g.status === "gerada");
    if (elig.length === 0) { toast.error("Selecione DAS já geradas"); return; }
    dasStore.enviarWhatsapp(elig.map((g) => g.id));
    toast.success(`${elig.length} mensagem(s) enviada(s) por WhatsApp (mock)`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="DAS em Lote"
        subtitle="Geração via SERPRO e envio em massa para clientes MEI e Simples"
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Clientes" value={counts.total.toString()} tone="default" icon={FileText} />
        <Kpi label="Pendentes" value={counts.pendente.toString()} tone="info" icon={Loader2} />
        <Kpi label="Geradas" value={counts.gerada.toString()} tone="success" icon={CheckCircle2} />
        <Kpi label="Pagas" value={counts.paga.toString()} tone="success" icon={Wallet} />
        <Kpi label="Total no mês" value={counts.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} tone="default" icon={Wallet} />
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

          <Select value={regime} onValueChange={(v) => setRegime(v as typeof regime)}>
            <SelectTrigger className="w-[150px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Regime: todos</SelectItem>
              <SelectItem value="MEI">MEI</SelectItem>
              <SelectItem value="Simples">Simples</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[160px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status: todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="gerada">Gerada</SelectItem>
              <SelectItem value="paga">Paga</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={enviarWhats} disabled={selected.size === 0}>
              <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
            </Button>
            <Button className="rounded-xl" onClick={gerarLote} disabled={loading || selected.size === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Gerar em lote ({selected.size})
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
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Regime</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  Nenhum DAS para os filtros selecionados
                </TableCell>
              </TableRow>
            )}
            {filtered.map((g) => (
              <TableRow key={g.id} className={g.status === "paga" ? "opacity-60" : ""}>
                <TableCell>
                  <Checkbox checked={selected.has(g.id)} onCheckedChange={() => toggleOne(g.id)} />
                </TableCell>
                <TableCell className="font-medium">
                  {g.clienteNome}
                  {g.enviadoWhatsappEm && (
                    <div className="mt-1 text-xs text-success">WhatsApp enviado ✓</div>
                  )}
                  {g.erro && <div className="mt-1 text-xs text-destructive">{g.erro}</div>}
                </TableCell>
                <TableCell className="font-mono text-xs">{g.cnpj}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-full">{g.regime}</Badge></TableCell>
                <TableCell className="text-sm">{formatDate(g.vencimento)}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {g.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
                <TableCell><StatusBadge status={g.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {(g.status === "pendente" || g.status === "erro") && (
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => gerarUm(g.id)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {g.status === "gerada" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg"
                          onClick={() => { navigator.clipboard.writeText(g.codigoBarras ?? ""); toast.success("Código de barras copiado"); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg"
                          onClick={() => toast.info("Download do PDF (mock)")}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-lg"
                          onClick={() => { dasStore.marcarPaga(g.id); toast.success("DAS marcado como pago"); }}>
                          <Wallet className="h-3.5 w-3.5" /> Pago
                        </Button>
                      </>
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

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function StatusBadge({ status }: { status: DasStatus }) {
  const map: Record<DasStatus, { cls: string; label: string }> = {
    pendente: { cls: "bg-muted text-muted-foreground border-border", label: "Pendente" },
    gerada: { cls: "bg-info/10 text-info border-info/20", label: "Gerada" },
    paga: { cls: "bg-success/10 text-success border-success/20", label: "Paga" },
    erro: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Erro" },
  };
  const { cls, label } = map[status];
  return <Badge variant="outline" className={`rounded-full border ${cls}`}>{label}</Badge>;
}

function Kpi({ icon: Icon, label, value, tone }: {
  icon: typeof FileText; label: string; value: string;
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

// silence unused import warnings for icons reserved for future status mapping
void AlertTriangle;

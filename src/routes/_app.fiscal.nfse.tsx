import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Ban, CheckCircle2, Download, FileText, Loader2,
  MessageCircle, Receipt, RefreshCw, Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PagePlaceholder";
import { nfseStore, type NfseNota, type NfseStatus } from "@/lib/nfse-store";

export const Route = createFileRoute("/_app/fiscal/nfse")({
  component: NfsePage,
  head: () => ({ meta: [{ title: "NFS-e em Lote · APOYA Gestão" }] }),
});

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function NfsePage() {
  const now = new Date();
  const def = new Date(now.getFullYear(), now.getMonth(), 1);
  const [ano, setAno] = useState(def.getFullYear());
  const [mes, setMes] = useState(def.getMonth() + 1);
  const [items, setItems] = useState<NfseNota[]>([]);
  const [query, setQuery] = useState("");
  const [regime, setRegime] = useState<"todos" | NfseNota["regime"]>("todos");
  const [status, setStatus] = useState<"todos" | NfseStatus>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const competencia = `${ano}-${mes.toString().padStart(2, "0")}`;

  useEffect(() => {
    const refresh = () => setItems(nfseStore.listByCompetencia(competencia));
    refresh();
    window.addEventListener("apoya:nfse:changed", refresh);
    window.addEventListener("apoya:clientes:changed", refresh);
    return () => {
      window.removeEventListener("apoya:nfse:changed", refresh);
      window.removeEventListener("apoya:clientes:changed", refresh);
    };
  }, [competencia]);

  useEffect(() => setSelected(new Set()), [competencia]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((n) => (q ? `${n.clienteNome} ${n.cnpj} ${n.tomador}`.toLowerCase().includes(q) : true))
      .filter((n) => regime === "todos" || n.regime === regime)
      .filter((n) => status === "todos" || n.status === status)
      .sort((a, b) => a.clienteNome.localeCompare(b.clienteNome));
  }, [items, query, regime, status]);

  const counts = useMemo(() => ({
    total: items.length,
    rascunho: items.filter((n) => n.status === "rascunho").length,
    emitida: items.filter((n) => n.status === "emitida").length,
    erro: items.filter((n) => n.status === "erro").length,
    valor: items.filter((n) => n.status === "emitida").reduce((s, n) => s + n.valorServico, 0),
    cbsIbs: items.filter((n) => n.status === "emitida").reduce((s, n) => s + n.valorCbs + n.valorIbs, 0),
  }), [items]);

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((n) => n.id)));
  }
  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function emitirLote() {
    const ids = filtered
      .filter((n) => selected.has(n.id) && (n.status === "rascunho" || n.status === "erro"))
      .map((n) => n.id);
    if (ids.length === 0) { toast.error("Selecione pelo menos 1 NFS-e em rascunho"); return; }
    setLoading(true);
    toast.loading(`Emitindo ${ids.length} NFS-e via NFE.io…`, { id: "nfse-lote" });
    await nfseStore.emitirLote(ids);
    setLoading(false);
    toast.success(`${ids.length} NFS-e processada(s)`, { id: "nfse-lote" });
  }

  async function emitirUma(id: string) {
    toast.loading("Emitindo NFS-e via NFE.io…", { id: `nfse-${id}` });
    await nfseStore.emitir(id);
    toast.success("NFS-e atualizada", { id: `nfse-${id}` });
  }

  function enviarWhats() {
    const elig = filtered.filter((n) => selected.has(n.id) && n.status === "emitida");
    if (elig.length === 0) { toast.error("Selecione NFS-e já emitidas"); return; }
    nfseStore.enviarWhatsapp(elig.map((n) => n.id));
    toast.success(`${elig.length} mensagem(ns) enviada(s) por WhatsApp (mock)`);
  }

  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="NFS-e em Lote"
        subtitle="Emissão via NFE.io com cálculo CBS/IBS 2026 (MEI isento)"
      />

      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Receipt className="h-5 w-5" />
        </div>
        <div className="flex-1 text-sm">
          <div className="font-semibold">NFS-e Nacional + Reforma Tributária 2026</div>
          <p className="mt-0.5 text-muted-foreground">
            MEI prestador de serviço deve emitir NFS-e pelo padrão nacional desde set/2023. Em 2026, alíquota de teste CBS 0,9% + IBS 0,1% (sem efeito arrecadatório).
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Notas no mês" value={counts.total.toString()} tone="default" icon={Receipt} />
        <Kpi label="Em rascunho" value={counts.rascunho.toString()} tone="info" icon={FileText} />
        <Kpi label="Emitidas" value={counts.emitida.toString()} tone="success" icon={CheckCircle2} />
        <Kpi label="Faturamento" value={brl(counts.valor)} tone="default" icon={Receipt} />
        <Kpi label="CBS + IBS" value={brl(counts.cbsIbs)} tone="info" icon={Receipt} />
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
            placeholder="Buscar por cliente, CNPJ ou tomador"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-[240px] flex-1 rounded-xl"
          />

          <Select value={regime} onValueChange={(v) => setRegime(v as typeof regime)}>
            <SelectTrigger className="w-[180px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Regime: todos</SelectItem>
              <SelectItem value="Simples">Simples</SelectItem>
              <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
              <SelectItem value="Lucro Real">Lucro Real</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-[160px] rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status: todos</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="emitida">Emitida</SelectItem>
              <SelectItem value="cancelada">Cancelada</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" className="rounded-xl" onClick={enviarWhats} disabled={selected.size === 0}>
              <MessageCircle className="h-4 w-4" /> Enviar WhatsApp
            </Button>
            <Button className="rounded-xl" onClick={emitirLote} disabled={loading || selected.size === 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Emitir em lote ({selected.size})
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
              <TableHead>Prestador</TableHead>
              <TableHead>Tomador</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">ISS</TableHead>
              <TableHead className="text-right">CBS/IBS</TableHead>
              <TableHead>Nº</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center text-sm text-muted-foreground">
                  <Receipt className="mx-auto mb-3 h-8 w-8 opacity-40" />
                  Nenhuma NFS-e para os filtros selecionados
                </TableCell>
              </TableRow>
            )}
            {filtered.map((n) => (
              <TableRow key={n.id} className={n.status === "cancelada" ? "opacity-60" : ""}>
                <TableCell>
                  <Checkbox checked={selected.has(n.id)} onCheckedChange={() => toggleOne(n.id)} />
                </TableCell>
                <TableCell className="font-medium">
                  {n.clienteNome}
                  <div className="mt-0.5 text-xs text-muted-foreground">{n.regime} · {n.cnpj}</div>
                  {n.enviadoWhatsappEm && (
                    <div className="mt-1 text-xs text-success">WhatsApp enviado ✓</div>
                  )}
                  {n.erro && <div className="mt-1 text-xs text-destructive">{n.erro}</div>}
                </TableCell>
                <TableCell className="text-sm">
                  {n.tomador}
                  <div className="font-mono text-xs text-muted-foreground">{n.cnpjTomador}</div>
                </TableCell>
                <TableCell className="max-w-[220px] truncate text-sm" title={n.descricaoServico}>
                  {n.descricaoServico}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{brl(n.valorServico)}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {brl(n.valorIss)}
                  <div className="text-[10px] text-muted-foreground">{n.aliquotaIss}%</div>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {brl(n.valorCbs + n.valorIbs)}
                  <div className="text-[10px] text-muted-foreground">0,9% + 0,1%</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{n.numero ?? "—"}</TableCell>
                <TableCell><StatusBadge status={n.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {(n.status === "rascunho" || n.status === "erro") && (
                      <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => emitirUma(n.id)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {n.status === "emitida" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg"
                          onClick={() => toast.info("Download do XML (mock)")}>
                          <Download className="h-3.5 w-3.5" /> XML
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 rounded-lg"
                          onClick={() => toast.info("Download do PDF (mock)")}>
                          <Download className="h-3.5 w-3.5" /> PDF
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-lg"
                          onClick={() => { nfseStore.cancelar(n.id); toast.success("NFS-e cancelada"); }}>
                          <Ban className="h-3.5 w-3.5" />
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

function StatusBadge({ status }: { status: NfseStatus }) {
  const map: Record<NfseStatus, { cls: string; label: string }> = {
    rascunho: { cls: "bg-muted text-muted-foreground border-border", label: "Rascunho" },
    emitida: { cls: "bg-success/10 text-success border-success/20", label: "Emitida" },
    cancelada: { cls: "bg-muted text-muted-foreground border-border", label: "Cancelada" },
    erro: { cls: "bg-destructive/10 text-destructive border-destructive/20", label: "Erro" },
  };
  const { cls, label } = map[status];
  return <Badge variant="outline" className={`rounded-full border ${cls}`}>{label}</Badge>;
}

function Kpi({ icon: Icon, label, value, tone }: {
  icon: typeof Receipt; label: string; value: string;
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

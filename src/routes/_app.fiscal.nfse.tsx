/**
 * Página /fiscal/nfse — NFS-e emitidas e recebidas
 * Integrada ao Focus NF-e via /api/nfse
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  AlertCircle, CheckCircle2, Download, FileText, Loader2,
  Plus, RefreshCw, Search, XCircle, FileCode2, Receipt,
  Send, Trash2, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, PageTabs, TabsSimple, KpiGrid, KpiCard, Pagination } from "@/components/PagePlaceholder";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef } from "@/components/DataTable";
import { useNfse, type NfseEmitida, type NfseRecebida } from "@/hooks/use-nfse";
import { useClientes } from "@/hooks/use-clientes";
import { EmitirNfseModal } from "@/components/nfse/EmitirNfseModal";

export const Route = createFileRoute("/_app/fiscal/nfse")({
  component: NfsePage,
  head: () => ({ meta: [{ title: "NFS-e · APOYA Gestão" }] }),
});

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const STATUS_COLOR: Record<string, "gray"|"blue"|"green"|"red"> = {
  rascunho: "gray", processando: "blue", emitida: "green", cancelada: "gray", erro: "red",
};
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", processando: "Processando", emitida: "Emitida", cancelada: "Cancelada", erro: "Erro",
};

const fmtBRL = (v?: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtDate = (d?: string | null) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

function downloadBlob(b64: string, filename: string, mime: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


function NfsePage() {
  const now = new Date();
  const { clientes } = useClientes();
  const { loading, listarEmitidas, listarRecebidas, cancelar, baixarPdf, baixarXml, sincronizarRecebidas } = useNfse();

  const [sub, setSub] = useState<"emitidas" | "recebidas">("emitidas");
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [clienteFilter, setClienteFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [emitidas, setEmitidas] = useState<NfseEmitida[]>([]);
  const [recebidas, setRecebidas] = useState<NfseRecebida[]>([]);
  const [fetching, setFetching] = useState(false);

  const [dialogEmitir, setDialogEmitir] = useState(false);
  const [clienteSel, setClienteSel] = useState<typeof clientes[0] | null>(null);

  const competencia = `${ano}-${String(mes).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const cId = clienteFilter !== "todos" ? clienteFilter : undefined;
      if (sub === "emitidas") {
        setEmitidas(await listarEmitidas(cId, competencia));
      } else {
        setRecebidas(await listarRecebidas(cId, competencia));
      }
    } finally {
      setFetching(false);
    }
  }, [sub, clienteFilter, competencia]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, clienteFilter, sub, ano, mes]);

  const filteredE = useMemo(() => {
    const q = query.trim().toLowerCase();
    return emitidas.filter(n =>
      !q || `${n.tomador_nome} ${n.tomador_cnpj_cpf} ${n.numero}`.toLowerCase().includes(q)
    );
  }, [emitidas, query]);

  const filteredR = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recebidas.filter(n =>
      !q || `${n.prestador_nome} ${n.prestador_cnpj} ${n.numero}`.toLowerCase().includes(q)
    );
  }, [recebidas, query]);

  const currentList = sub === "emitidas" ? filteredE : filteredR;
  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE));
  const pageRows = currentList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const kpi = useMemo(() => ({
    total: emitidas.length,
    emitidas_ok: emitidas.filter(n => n.status === "emitida").length,
    valor: emitidas.reduce((s, n) => s + (n.valor_servico ?? 0), 0),
    recebidas_total: recebidas.length,
  }), [emitidas, recebidas]);

  async function handlePdf(nota: NfseEmitida) {
    const pdfUrl = await obterPdf(nota.id);
        if (pdfUrl) { window.open(pdfUrl, '_blank'); return; }
    if (b64) downloadBlob(b64, `NFS-e_${nota.numero ?? nota.id}.pdf`, "application/pdf");
  }

  async function handleXml(nota: NfseEmitida) {
    const xml = await baixarXml(nota.id);
    if (xml) downloadText(xml, `NFS-e_${nota.numero ?? nota.id}.xml`);
  }

  async function handleCancelar(nota: NfseEmitida) {
    if (!confirm(`Cancelar NFS-e #${nota.numero}? Esta ação não pode ser desfeita.`)) return;
    const ok = await cancelar(nota.id);
    if (ok) load();
  }

  async function handleSincronizar() {
    if (clienteFilter === "todos") {
      toast.error("Selecione um cliente para sincronizar notas recebidas");
      return;
    }
    const cli = clientes.find(c => c.id === clienteFilter);
    if (!cli?.cnpj) { toast.error("Cliente sem CNPJ cadastrado"); return; }
    await sincronizarRecebidas(clienteFilter, cli.cnpj);
    load();
  }

  // Colunas emitidas
  const colsEmitidas: ColDef<NfseEmitida>[] = [
    { key: "numero", header: "#", width: 60, render: r => r.numero ?? "—" },
    { key: "tomador_nome", header: "Tomador", render: r => (
      <div>
        <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{r.tomador_nome ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{r.tomador_cnpj_cpf ?? "—"}</p>
      </div>
    )},
    { key: "competencia", header: "Competência", width: 110, render: r => r.competencia ?? "—" },
    { key: "data_emissao", header: "Emissão", width: 100, render: r => fmtDate(r.data_emissao) },
    { key: "valor_servico", header: "Valor", width: 120, render: r => fmtBRL(r.valor_servico) },
    { key: "status", header: "Status", width: 100, render: r => (
      <InlineBadge color={STATUS_COLOR[r.status] ?? "gray"}>{STATUS_LABEL[r.status] ?? r.status}</InlineBadge>
    )},
    { key: "_acao", header: "", width: 120, render: r => (
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Baixar PDF"
          onClick={() => handlePdf(r)} disabled={loading}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Baixar XML"
          onClick={() => handleXml(r)} disabled={loading}>
          <FileCode2 className="h-3.5 w-3.5" />
        </Button>
        {r.status === "emitida" && (
          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600"
            title="Cancelar" onClick={() => handleCancelar(r)} disabled={loading}>
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    )},
  ];

  const colsRecebidas: ColDef<NfseRecebida>[] = [
    { key: "numero", header: "#", width: 60, render: r => r.numero ?? "—" },
    { key: "prestador_nome", header: "Prestador", render: r => (
      <div>
        <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{r.prestador_nome ?? "—"}</p>
        <p className="text-xs text-muted-foreground">{r.prestador_cnpj ?? "—"}</p>
      </div>
    )},
    { key: "competencia", header: "Competência", width: 110, render: r => r.competencia ?? "—" },
    { key: "data_emissao", header: "Emissão", width: 100, render: r => fmtDate(r.data_emissao) },
    { key: "valor_servico", header: "Valor", width: 120, render: r => fmtBRL(r.valor_servico) },
    { key: "fonte", header: "Fonte", width: 80, render: r => (
      <InlineBadge color={(r as any).fonte === "nfeio" ? "blue" : "gray"}>{(r as any).fonte}</InlineBadge>
    )},
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="NFS-e"
        subtitle="Emissão e controle de Notas Fiscais de Serviço"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={load} disabled={fetching}>
              <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" className="h-8 gap-1.5"
              onClick={() => {
                const cli = clienteFilter !== "todos" ? clientes.find(c => c.id === clienteFilter) ?? null : null;
                setClienteSel(cli);
                setDialogEmitir(true);
              }}>
              <Plus className="h-3.5 w-3.5" />
              Nova NFS-e
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <KpiGrid cols={4}>
        <KpiCard label="Emitidas no mês" value={kpi.emitidas_ok} tone="success" />
        <KpiCard label="Total emitidas" value={kpi.total} tone="neutral" />
        <KpiCard label="Valor total" value={fmtBRL(kpi.valor)} tone="primary" />
        <KpiCard label="Recebidas" value={kpi.recebidas_total} tone="neutral" />
      </KpiGrid>

      {/* Sub-tabs */}
      <TabsSimple tabs={[
          { id: "emitidas", label: `Emitidas (${emitidas.length})` },
          { id: "recebidas", label: `Recebidas (${recebidas.length})` },
        ]}
        activeTab={sub}
        onTabChange={(v) => setSub(v as any)}
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Mês/Ano */}
        <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
          <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MESES.map((m, i) => (
              <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
          <SelectTrigger className="h-8 w-24 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026, 2027].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Cliente */}
        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="h-8 w-48 text-sm"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{(c as any).razaoSocial ?? (c as any).nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Busca */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Buscar por tomador, CNPJ..." value={query}
            onChange={(e) => setQuery(e.target.value)} />
        </div>

        {/* Sincronizar recebidas */}
        {sub === "recebidas" && (
          <Button size="sm" variant="outline" className="h-8 gap-1.5 ml-auto" onClick={handleSincronizar} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        )}
      </div>

      {/* Tabela */}
      {fetching ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando notas…</span>
        </div>
      ) : sub === "emitidas" ? (
        <>
          <DataTable
            columns={colsEmitidas}
            rows={pageRows as NfseEmitida[]}
            emptyState={
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma NFS-e emitida em {MESES[mes - 1]}/{ano}</p>
                <Button size="sm" className="mt-1" onClick={() => setDialogEmitir(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Emitir primeira nota
                </Button>
              </div>
            }
          />
          <TableFooter total={filteredE.length} pageSize={PAGE_SIZE} page={page}>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </TableFooter>
        </>
      ) : (
        <>
          <DataTable
            columns={colsRecebidas}
            rows={pageRows as NfseRecebida[]}
            emptyState={
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Receipt className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma NFS-e recebida em {MESES[mes - 1]}/{ano}</p>
                <p className="text-xs">Selecione um cliente e clique em "Sincronizar"</p>
              </div>
            }
          />
          <TableFooter total={filteredR.length} pageSize={PAGE_SIZE} page={page}>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </TableFooter>
        </>
      )}

      {/* Diálogo emissão */}
      <EmitirNfseModal
        open={dialogEmitir}
        onClose={() => setDialogEmitir(false)}
        clientePreSelecionado={clienteSel ?? undefined}
        onSucesso={() => { setDialogEmitir(false); load(); }}
      />
    </div>
  );
}

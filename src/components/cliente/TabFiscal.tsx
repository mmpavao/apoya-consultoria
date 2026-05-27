/**
 * TabFiscal — Aba Fiscal do cliente (refatorada)
 *
 * Sub-abas:
 *   Resumo Fiscal  → dados fixos + status PGDAS/DAS/DTE (auto-fetch SERPRO)
 *   NF Emitidas    → notas emitidas pela empresa (NFE.io)
 *   NF Recebidas   → notas recebidas pela empresa
 *   Emitir NFS-e   → formulário de emissão
 *   Consultas      → acesso completo ao MCP SERPRO
 *
 * Filosofia: dados fixos já preenchidos, JSON nunca exposto ao usuário.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Download, FileCode2, FileText, Hash, Info, Loader2,
  MapPin, Plus, Receipt, ReceiptText, RefreshCw, Search,
  Send, ShieldCheck, Users, XCircle, Zap, Building2, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSerpro } from "@/hooks/use-serpro";
import { useNfse } from "@/hooks/use-nfse";
import { useNfseEmitidas, useNfseRecebidas } from "@/hooks/use-nfse-local";
import { useObrigacoes } from "@/hooks/use-obrigacoes";
import { DocumentosFiscaisTab } from "@/components/motor/DocumentosFiscaisTab";
import { ApuracaoMensalCard } from "@/components/motor/ApuracaoMensalCard";
import { REGIME_LABEL, type Cliente } from "@/hooks/use-clientes";
import { SerproClientePanel } from "@/components/serpro/SerproClientePanel";
import { EmitirNfseModal } from "@/components/nfse/EmitirNfseModal";

// ── helpers ────────────────────────────────────────────────────────────────
const fmtBRL  = (v?: number | null) => v != null ? v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }) : "—";
const fmtDate = (d?: string | null) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";

function downloadBlob(b64: string, filename: string, mime: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── sub-tipos de tab ───────────────────────────────────────────────────────
type FiscalTab = "resumo" | "emitidas" | "recebidas" | "emitir" | "serpro" | "docs" | "apuracao";

const SUB_TABS: { id: FiscalTab; label: string }[] = [
  { id: "resumo",   label: "Resumo Fiscal" },
  { id: "emitidas", label: "NF Emitidas"   },
  { id: "recebidas",label: "NF Recebidas"  },
  { id: "emitir",   label: "Emitir NFS-e"  },
  { id: "serpro",   label: "Consultas Fiscais" },
  { id: "docs",     label: "Doc. Fiscais" },
  { id: "apuracao", label: "Apuração" },
];

// ── badge inline ───────────────────────────────────────────────────────────
function Pill({ cor, children }: { cor: "green"|"red"|"amber"|"gray"|"blue"; children: React.ReactNode }) {
  const cls = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red:   "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    gray:  "bg-slate-50 text-slate-500 border-slate-200",
    blue:  "bg-blue-50 text-blue-700 border-blue-200",
  }[cor];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>;
}

// ── linha de dado ──────────────────────────────────────────────────────────
function DataRow({ label, value, loading }: { label: string; value?: string | null; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      {loading
        ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        : <span className="text-sm font-medium text-foreground text-right">{value || "—"}</span>
      }
    </div>
  );
}

// ── card de seção ──────────────────────────────────────────────────────────
function FiscalCard({ title, icon: Icon, children, expandable, defaultOpen }: {
  title: string; icon: any; children: React.ReactNode;
  expandable?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? !expandable);
  return (
    <div className="surface-card overflow-hidden">
      <button
        className={`w-full flex items-center justify-between px-4 py-3 text-left ${expandable ? "hover:bg-muted/30 transition-colors" : ""}`}
        onClick={expandable ? () => setOpen(o => !o) : undefined}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {expandable && (open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── status item (PGDAS, DTE, etc.) ─────────────────────────────────────────
function StatusItem({ label, ok, detail, loading }: {
  label: string; ok: boolean | null; detail?: string; loading?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {detail && <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>}
      </div>
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        : ok === null
          ? <Pill cor="gray">Verificando…</Pill>
          : ok
            ? <Pill cor="green">✓ Em dia</Pill>
            : <Pill cor="red">Pendente</Pill>
      }
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RESUMO FISCAL (auto-fetch SERPRO)
// ────────────────────────────────────────────────────────────────────────────
function ResumoFiscal({ cliente }: { cliente: Cliente & { tem_certificado?: boolean; tem_procuracao?: boolean } }) {
  const { call } = useSerpro();
  const { obrigacoes } = useObrigacoes();
  const cnpj = (cliente.cnpj ?? "").replace(/\D/g, "");
  const regime = (cliente.regime ?? "").toUpperCase()
    .replace("SIMPLES NACIONAL", "SIMPLES")
    .replace("SIMPLES", "SIMPLES");

  const isMEI     = regime === "MEI";
  const isSimples = regime.includes("SIMPLES");

  const [dteStatus, setDteStatus]         = useState<boolean | null>(null);
  const [dteLbl, setDteLbl]               = useState<string>("…");
  const [pgdasOk, setPgdasOk]             = useState<boolean | null>(null);
  const [pgdasDetail, setPgdasDetail]     = useState<string>("Verificando última declaração…");
  const [regimeAnos, setRegimeAnos]       = useState<{ ano: number; regime: string }[]>([]);
  const [loadingAuto, setLoadingAuto]     = useState(false);
  const [autoFetched, setAutoFetched]     = useState(false);
  const [fetchError, setFetchError]       = useState(false);
  const didRun = useRef(false);

  // Helper: wraps a promise with a 10s timeout
  const withTimeout = <T,>(p: Promise<T>, ms = 10_000): Promise<T> =>
    Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  const obgCliente = obrigacoes.filter(o => o.clienteId === cliente.id);
  const obgAtrasada = obgCliente.filter(o => o.status === "atrasada").length;
  const obgPendente = obgCliente.filter(o => o.status === "pendente").length;

  const autoFetch = useCallback(async () => {
    if (!cnpj || didRun.current) return;
    didRun.current = true;
    setLoadingAuto(true);
    setFetchError(false);

    try {
      // DTE — com timeout de 10s
      const dteRes = await withTimeout(call("serpro_dte", { cnpj }, cliente.id));
      if (dteRes.ok) {
        try {
          const raw = (dteRes.content ?? [])[0]?.text ?? "{}";
          const outer = JSON.parse(raw);
          const result = outer?.result ?? outer;
          const status = result?.statusEnquadramento ?? "";
          const ind    = result?.indicadorEnquadramento;
          setDteStatus(ind === 2 || status.toLowerCase().includes("optante"));
          setDteLbl(status || "Enquadrado");
        } catch { setDteStatus(true); setDteLbl("Ativo"); }
      } else {
        setDteStatus(false); setDteLbl("Não foi possível consultar agora");
      }

      // Regime anos — com timeout de 10s
      const raRes = await withTimeout(call("serpro_regime_anos", { cnpj }, cliente.id));
      if (raRes.ok) {
        try {
          const outer = JSON.parse((raRes.content ?? [])[0]?.text ?? "{}");
          const list = outer?.result ?? [];
          setRegimeAnos(list.slice(0, 4).map((a: any) => ({
            ano: a.anoCalendario,
            regime: a.regimeApurado === "COMPETENCIA" ? "Competência" : a.regimeApurado,
          })));
        } catch {}
      }

      // PGDAS (Simples) ou PGMEI — com timeout de 10s
      if (isSimples && !isMEI) {
        const pgRes = await withTimeout(call("serpro_pgdas_ultima", { cnpj }, cliente.id));
        if (pgRes.ok) {
          try {
            const outer = JSON.parse((pgRes.content ?? [])[0]?.text ?? "{}");
            const result = outer?.result ?? outer;
            if (!result || result === "" || (typeof result === "object" && Object.keys(result).length === 0)) {
              setPgdasOk(true); setPgdasDetail("Sem pendências de declaração");
            } else if (outer?.ok === false) {
              setPgdasOk(false); setPgdasDetail(outer.error ?? "Erro ao verificar");
            } else {
              const periodo = result?.periodoApuracao ?? result?.periodo ?? "";
              setPgdasOk(true); setPgdasDetail(periodo ? `Última declaração: ${periodo}` : "Declarações em dia");
            }
          } catch { setPgdasOk(null); setPgdasDetail("Não verificado"); }
        } else {
          setPgdasOk(null); setPgdasDetail("Não foi possível consultar agora. Tente novamente.");
        }
      }
    } catch (err) {
      // timeout ou erro de rede
      setFetchError(true);
      setDteStatus(false);
      setDteLbl("Não foi possível consultar agora. Tente novamente.");
      setPgdasOk(false);
      setPgdasDetail("Não foi possível consultar agora. Tente novamente.");
    } finally {
      setLoadingAuto(false);
      setAutoFetched(true);
    }
  }, [cnpj, isSimples, isMEI, cliente.id]);

  useEffect(() => { if (cnpj) autoFetch(); }, [autoFetch]);

  return (
    <div className="space-y-4">
      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Regime",      value: REGIME_LABEL[cliente.regime] ?? cliente.regime },
          { label: "CNPJ",        value: cliente.cnpj || "—" },
          { label: "Venc. DAS",   value: "Todo dia 20" },
          { label: "Obrigações",  value: obgAtrasada > 0 ? `${obgAtrasada} atrasada${obgAtrasada>1?"s":""}` : obgPendente > 0 ? `${obgPendente} pendente${obgPendente>1?"s":""}` : "Em dia" },
        ].map(k => (
          <div key={k.label} className="surface-card px-4 py-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-sm font-semibold text-foreground truncate">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status Federal (auto-fetch) */}
        <FiscalCard title="Status Federal — SERPRO" icon={ShieldCheck} defaultOpen>
          {loadingAuto && !autoFetched && (
            <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Consultando Receita Federal…
            </div>
          )}
          <StatusItem
            label="DTE — Domicílio Tributário Eletrônico"
            ok={dteStatus}
            detail={dteLbl !== "…" ? dteLbl : undefined}
            loading={loadingAuto && dteStatus === null}
          />
          {(isSimples && !isMEI) && (
            <StatusItem
              label="PGDAS-D — Última Declaração"
              ok={pgdasOk}
              detail={pgdasDetail}
              loading={loadingAuto && pgdasOk === null}
            />
          )}
          <StatusItem
            label="Obrigações na APOYA"
            ok={obgAtrasada === 0}
            detail={obgAtrasada > 0 ? `${obgAtrasada} em atraso` : obgPendente > 0 ? `${obgPendente} pendentes` : "Todas em dia"}
          />
          {fetchError && (
            <div className="flex items-center gap-2 py-2 px-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs mt-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Não foi possível consultar o SERPRO agora. Verifique a conexão e tente novamente.</span>
            </div>
          )}
          {(autoFetched || fetchError) && (
            <button
              className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={loadingAuto}
              onClick={() => {
                if (loadingAuto) return;
                didRun.current = false;
                setDteStatus(null); setPgdasOk(null); setRegimeAnos([]);
                setAutoFetched(false); setFetchError(false);
                autoFetch();
              }}
            >
              <RefreshCw className={`h-3 w-3 ${loadingAuto ? "animate-spin" : ""}`} />
              {loadingAuto ? "Consultando…" : "Atualizar consultas"}
            </button>
          )}
        </FiscalCard>

        {/* Dados fiscais fixos */}
        <FiscalCard title="Configuração Fiscal" icon={FileText} defaultOpen>
          <DataRow label="Tipo DAS"       value={isMEI ? "DASMEI (Carnê MEI)" : isSimples ? "DAS — Simples Nacional" : "—"} />
          <DataRow label="Regime Híbrido" value={cliente.regimeHibrido ? "Sim — alíquotas separadas" : "Não"} />
          <DataRow label="Município"      value={cliente.municipio ?? cliente.endereco?.municipio} />
          <DataRow label="Cód. Serviço NFS-e" value={cliente.codigoServicoNfse} />
          <DataRow label="Insc. Municipal" value={cliente.inscricaoMunicipal} />
          <DataRow label="Alíquota ISS"  value={cliente.aliquotaIss ? `${cliente.aliquotaIss}%` : undefined} />
          <DataRow label="Incentivo Fiscal" value={cliente.temIncentivoFiscal ? "Sim — redução de alíquota" : "Não"} />
        </FiscalCard>

        {/* Histórico de regime (SERPRO) */}
        {regimeAnos.length > 0 && (
          <FiscalCard title="Histórico de Regime — SERPRO" icon={Calendar} expandable>
            {regimeAnos.map(r => (
              <DataRow key={r.ano} label={String(r.ano)} value={r.regime} />
            ))}
          </FiscalCard>
        )}

        {/* eSocial */}
        <FiscalCard title="eSocial / Folha" icon={Users} defaultOpen>
          <DataRow label="Tem Empregados" value={cliente.temEmpregados ? "Sim — sujeito ao eSocial" : "Não"} />
          {cliente.temEmpregados && <>
            <DataRow label="DCTFWeb"         value="Mensal — até dia 15" />
            <DataRow label="EFD-Contribuições" value="Mensal — até o 2º dia útil do 2º mês seguinte" />
          </>}
        </FiscalCard>

        {/* Obrigações deste cliente (expandível) */}
        {obgCliente.length > 0 && (
          <FiscalCard title={`Obrigações (${obgCliente.length})`} icon={Clock} expandable defaultOpen={obgAtrasada > 0}>
            <div className="divide-y divide-border/40">
              {obgCliente.map(o => (
                <div key={o.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{o.tipo}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.competencia} · Venc. {fmtDate(o.vencimento)}
                    </p>
                  </div>
                  <Pill cor={o.status === "concluida" ? "green" : o.status === "atrasada" ? "red" : o.status === "em_andamento" ? "blue" : "amber"}>
                    {o.status === "concluida" ? "Concluída" : o.status === "atrasada" ? "Atrasada" : o.status === "em_andamento" ? "Em andamento" : "Pendente"}
                  </Pill>
                </div>
              ))}
            </div>
          </FiscalCard>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// NF EMITIDAS
// ────────────────────────────────────────────────────────────────────────────
function NfEmitidas({ cliente }: { cliente: Cliente }) {
  const { cancelar } = useNfse();
  const [query, setQuery] = useState("");
  const now = new Date();
  const [mes, setMes] = useState<number | null>(null);
  const [ano, setAno] = useState(now.getFullYear());

  const competencia = mes ? `${ano}-${String(mes).padStart(2, "0")}` : undefined;
  const { notas, loading: fetching, syncing, error, cascata, refetch: load, sincronizar } = useNfseEmitidas(cliente.id, competencia);

  // Auto-sync ao montar — busca automaticamente sem precisar clicar
  useEffect(() => {
    if (cliente.cnpj) {
      sincronizar(cliente.cnpj);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.cnpj]);

  const filtradas = notas.filter(n => {
    const q = query.trim().toLowerCase();
    return !q || `${n.tomador_nome ?? ""} ${n.numero ?? ""}`.toLowerCase().includes(q);
  });

  const STATUS_COR: Record<string, "green"|"blue"|"gray"|"red"> = {
    emitida: "green", processando: "blue", rascunho: "gray", cancelada: "gray", erro: "red"
  };
  const STATUS_LBL: Record<string, string> = {
    emitida: "Emitida", processando: "Processando", rascunho: "Rascunho", cancelada: "Cancelada", erro: "Erro"
  };

  const CAMADA_CLS: Record<number, string> = {
    1: "bg-emerald-50 text-emerald-700 border-emerald-200",
    2: "bg-blue-50 text-blue-700 border-blue-200",
    3: "bg-amber-50 text-amber-700 border-amber-200",
    4: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={mes ?? ""} onChange={e => setMes(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Todos os meses</option>
          {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m,i) => (
            <option key={i} value={i+1}>{m}</option>
          ))}
        </select>
        <select className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={ano} onChange={e => setAno(Number(e.target.value))}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Buscar por tomador…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={load} disabled={fetching || syncing}>
          <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
        </Button>
        {cliente.cnpj && (
          <Button size="sm" variant="default"
            className="h-8 gap-1.5 bg-[oklch(0.66_0.195_44)] hover:opacity-90 text-white"
            onClick={() => sincronizar(cliente.cnpj!)} disabled={syncing || fetching}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </Button>
        )}
      </div>

      {cascata.camada_usada && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${CAMADA_CLS[cascata.camada_usada] ?? ""}`}>
          <Wifi className="h-3.5 w-3.5" />
          <span>Fonte: {cascata.fonte_label ?? "Camada " + cascata.camada_usada} · {cascata.total ?? notas.length} nota{(cascata.total ?? notas.length) !== 1 ? "s" : ""} encontrada{(cascata.total ?? notas.length) !== 1 ? "s" : ""}</span>
          {(cascata.camada_usada ?? 0) >= 3 && (
            <span className="opacity-60">(custo: {cascata.camada_usada === 3 ? "R$ 0,24" : "pago"})</span>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {fetching ? (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">Carregando notas…</span>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
          <ReceiptText className="h-8 w-8 opacity-30" />
          <p className="text-sm font-medium">Nenhuma NFS-e emitida{mes ? " neste período" : ""}</p>
          <p className="text-xs opacity-60">Buscando notas emitidas…</p>
          {cliente.cnpj && (
            <Button size="sm" variant="outline" className="mt-1 gap-1.5"
              onClick={() => sincronizar(cliente.cnpj!)} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Sincronizar agora
            </Button>
          )}
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="ft-table w-full">
            <thead>
              <tr>
                <th className="w-14">#</th>
                <th>Tomador</th>
                <th className="w-24">Competência</th>
                <th className="w-24">Emissão</th>
                <th className="w-28 text-right">Valor</th>
                <th className="w-24">Status</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(n => (
                <tr key={n.id}>
                  <td className="text-muted-foreground text-xs">{n.numero ?? "—"}</td>
                  <td>
                    <p className="font-medium truncate max-w-[180px]">{n.tomador_nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{n.tomador_cnpj_cpf ?? ""}</p>
                  </td>
                  <td className="text-sm">{n.competencia ?? "—"}</td>
                  <td className="text-sm">{fmtDate(n.data_emissao)}</td>
                  <td className="text-right font-medium text-sm">{fmtBRL(n.valor_servico)}</td>
                  <td><Pill cor={STATUS_COR[n.status] ?? "gray"}>{STATUS_LBL[n.status] ?? n.status}</Pill></td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      {n.pdf_url && (
                        <a href={n.pdf_url} target="_blank" rel="noopener noreferrer"
                          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="PDF">
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {n.status === "emitida" && (
                        <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Cancelar"
                          onClick={async () => { if (confirm(`Cancelar NFS-e #${n.numero}?`)) { await cancelar(n.id); load(); } }}>
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground">
            {filtradas.length} nota{filtradas.length !== 1 ? "s" : ""} · Total: {fmtBRL(filtradas.reduce((s,n) => s + (n.valor_servico ?? 0), 0))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// NF RECEBIDAS
// ────────────────────────────────────────────────────────────────────────────

function NfRecebidas({ cliente }: { cliente: Cliente }) {
  const [mes, setMes] = useState<number | null>(null);
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const competencia = mes ? `${ano}-${String(mes).padStart(2, "0")}` : undefined;
  const { notas, loading: fetching, syncing, error, cascata, refetch: load, sincronizar } = useNfseRecebidas(cliente.id, competencia);

  // Auto-sync ao montar
  useEffect(() => {
    if (cliente.cnpj) {
      sincronizar(cliente.cnpj);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente.cnpj]);

  const CAMADA_CLS: Record<number, string> = {
    1: "bg-emerald-50 text-emerald-700 border-emerald-200",
    2: "bg-blue-50 text-blue-700 border-blue-200",
    3: "bg-amber-50 text-amber-700 border-amber-200",
    4: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={mes ?? ""} onChange={e => setMes(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Todos os meses</option>
          {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m,i) => (
            <option key={i} value={i+1}>{m}</option>
          ))}
        </select>
        <select className="h-8 rounded border border-input bg-background px-2 text-sm"
          value={ano} onChange={e => setAno(Number(e.target.value))}>
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 ml-auto" onClick={load} disabled={fetching || syncing}>
          <RefreshCw className={`h-3.5 w-3.5 ${fetching ? "animate-spin" : ""}`} />
        </Button>
        {cliente.cnpj && (
          <Button size="sm" variant="default"
            className="h-8 gap-1.5 bg-[oklch(0.66_0.195_44)] hover:opacity-90 text-white"
            onClick={() => sincronizar(cliente.cnpj!)} disabled={syncing || fetching}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {syncing ? "Sincronizando…" : "Sincronizar"}
          </Button>
        )}
      </div>

      {cascata.camada_usada && (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${CAMADA_CLS[cascata.camada_usada] ?? ""}`}>
          <Wifi className="h-3.5 w-3.5" />
          <span>Fonte: {cascata.fonte_label ?? "Camada " + cascata.camada_usada} · {cascata.total ?? notas.length} nota{(cascata.total ?? notas.length) !== 1 ? "s" : ""} encontrada{(cascata.total ?? notas.length) !== 1 ? "s" : ""}</span>
          {(cascata.camada_usada ?? 0) >= 3 && (
            <span className="opacity-60">(custo: {cascata.camada_usada === 3 ? "R$ 0,24" : "pago"})</span>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {fetching ? (
        <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">Carregando notas…</span>
        </div>
      ) : notas.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
          <FileText className="h-8 w-8 opacity-30" />
          <p className="text-sm font-medium">Nenhuma NFS-e recebida{mes ? " neste período" : ""}</p>
          <p className="text-xs opacity-60">Buscando notas recebidas…</p>
          {cliente.cnpj && (
            <Button size="sm" variant="outline" className="mt-1 gap-1.5"
              onClick={() => sincronizar(cliente.cnpj!)} disabled={syncing}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Sincronizar agora
            </Button>
          )}
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="ft-table w-full">
            <thead>
              <tr>
                <th className="w-14">#</th>
                <th>Prestador</th>
                <th className="w-24">Competência</th>
                <th className="w-24">Emissão</th>
                <th className="w-28 text-right">Valor</th>
                <th className="w-24">Fonte</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {notas.map(n => (
                <tr key={n.id}>
                  <td className="text-muted-foreground text-xs">{n.numero ?? "—"}</td>
                  <td>
                    <p className="font-medium truncate max-w-[180px]">{n.prestador_nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{n.prestador_cnpj ?? ""}</p>
                  </td>
                  <td className="text-sm">{n.competencia ?? "—"}</td>
                  <td className="text-sm">{fmtDate(n.data_emissao)}</td>
                  <td className="text-right font-medium text-sm">{fmtBRL(n.valor_servico)}</td>
                  <td><Pill cor="gray">{n.fonte ?? "—"}</Pill></td>
                  <td>
                    {n.pdf_url && (
                      <a href={n.pdf_url} target="_blank" rel="noopener noreferrer"
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="PDF">
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground">
            {notas.length} nota{notas.length !== 1 ? "s" : ""} · Total: {fmtBRL(notas.reduce((s,n) => s + (n.valor_servico ?? 0), 0))}
          </div>
        </div>
      )}
    </div>
  );
}


// ── EMITIR NFS-e (formulário inline)
// ────────────────────────────────────────────────────────────────────────────
function EmitirNfse({ cliente }: { cliente: Cliente }) {
  const { emitir, loading } = useNfse();
  const now = new Date();
  const [form, setForm] = useState({
    description: "",
    servicesAmount: "",
    cityServiceCode: cliente.codigoServicoNfse ?? "",
    issRate: String(cliente.aliquotaIss ?? "2"),
    competencia: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`,
    tomadorNome: "", tomadorCnpj: "", tomadorEmail: "",
    tomadorUf: cliente.municipio ? (cliente.uf ?? "SP") : "SP",
    tomadorCidade: cliente.municipio ?? "São Paulo",
    tomadorCidadeCodigo: (cliente as any).codigo_municipio_ibge ?? "3550308",
  });

  async function handleEmitir() {
    if (!form.description || !form.servicesAmount) {
      toast.error("Preencha a descrição e o valor"); return;
    }
    const result = await emitir(cliente.id, {
      description: form.description,
      servicesAmount: parseFloat(form.servicesAmount.replace(",",".")),
      cityServiceCode: form.cityServiceCode,
      issRate: parseFloat(form.issRate) / 100 || 0,
      competencia: form.competencia,
      borrower: {
        name: form.tomadorNome || cliente.razaoSocial,
        federalTaxNumber: form.tomadorCnpj.replace(/\D/g,"") || (cliente.cnpj ?? "").replace(/\D/g,""),
        email: form.tomadorEmail || undefined,
        address: {
          country: "BRA", state: form.tomadorUf,
          city: { code: form.tomadorCidadeCodigo, name: form.tomadorCidade },
        },
      },
    } as any);
    if (result) setForm(p => ({ ...p, description: "", servicesAmount: "" }));
  }

  return (
    <div className="max-w-xl space-y-4">
      <div className="surface-card p-4 space-y-4">
        <p className="text-sm font-semibold text-foreground">Dados do Serviço</p>
        <div>
          <Label className="text-xs mb-1 block">Descrição do Serviço *</Label>
          <Textarea rows={2} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Serviços de contabilidade — mês de referência…" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Valor (R$) *</Label>
            <Input value={form.servicesAmount}
              onChange={e => setForm(p => ({ ...p, servicesAmount: e.target.value }))}
              placeholder="1.500,00" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Competência</Label>
            <Input type="month" value={form.competencia}
              onChange={e => setForm(p => ({ ...p, competencia: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Cód. Serviço LC116</Label>
            <Input value={form.cityServiceCode}
              onChange={e => setForm(p => ({ ...p, cityServiceCode: e.target.value }))}
              placeholder="17.19" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Alíquota ISS (%)</Label>
            <Input value={form.issRate}
              onChange={e => setForm(p => ({ ...p, issRate: e.target.value }))}
              placeholder="2" />
          </div>
        </div>
      </div>

      <div className="surface-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Tomador do Serviço</p>
        <p className="text-xs text-muted-foreground">Se vazio, usa os dados cadastrados do cliente.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Razão Social / Nome</Label>
            <Input value={form.tomadorNome}
              onChange={e => setForm(p => ({ ...p, tomadorNome: e.target.value }))}
              placeholder={cliente.razaoSocial} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">CNPJ / CPF</Label>
            <Input value={form.tomadorCnpj}
              onChange={e => setForm(p => ({ ...p, tomadorCnpj: e.target.value }))}
              placeholder={cliente.cnpj ?? "—"} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">E-mail</Label>
            <Input value={form.tomadorEmail}
              onChange={e => setForm(p => ({ ...p, tomadorEmail: e.target.value }))}
              placeholder={cliente.email ?? "—"} />
          </div>
        </div>
      </div>

      <Button className="gap-2 w-full" onClick={handleEmitir} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Emitir Nota Fiscal
      </Button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ────────────────────────────────────────────────────────────────────────────
export function TabFiscal({ cliente }: { cliente: Cliente & { tem_certificado?: boolean; tem_procuracao?: boolean; cnpj?: string; regime?: string } }) {
  const [sub, setSub] = useState<FiscalTab>("resumo");
  const [modalNfse, setModalNfse] = useState(false);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-0.5 border-b border-border/60 overflow-x-auto">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
              sub === t.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "resumo"    && <ResumoFiscal   cliente={cliente} />}
      {sub === "emitidas"  && <NfEmitidas     cliente={cliente} />}
      {sub === "recebidas" && <NfRecebidas    cliente={cliente} />}
      {sub === "emitir" && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Send className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">Emissão de NFS-e</p>
            <p className="text-xs text-muted-foreground mt-1">
              Preencha os dados da nota no formulário de emissão
            </p>
          </div>
          <button
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 transition-opacity"
            onClick={() => setModalNfse(true)}
          >
            <Send className="h-4 w-4" /> Abrir formulário de emissão
          </button>
        </div>
      )}
      <EmitirNfseModal
        open={modalNfse}
        onClose={() => setModalNfse(false)}
        clientePreSelecionado={cliente as any}
      />
      {sub === "serpro"    && (
        <SerproClientePanel
          cliente={{
            id: cliente.id,
            cnpj: cliente.cnpj,
            cpf: cliente.cpf,
            regime: (cliente.regime ?? "").toUpperCase(),
            tem_certificado: (cliente as any).tem_certificado ?? false,
            tem_procuracao:  (cliente as any).tem_procuracao  ?? false,
          }}
        />
      )}

      {sub === "docs" && (
        <DocumentosFiscaisTab
          clienteId={cliente.id}
          clienteCnpj={cliente.cnpj ?? ""}
        />
      )}

      {sub === "apuracao" && (
        <ApuracaoMensalCard
          clienteId={cliente.id}
          regime={cliente.regime ?? "simples_nacional"}
        />
      )}
    </div>
  );
}

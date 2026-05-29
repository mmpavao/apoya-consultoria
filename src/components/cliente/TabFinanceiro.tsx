/**
 * TabFinanceiro — Aba Financeiro do cliente (refatorada)
 *
 * Sub-abas:
 *   Resumo       → KPIs + configuração + resumo de cobranças
 *   Cobranças    → lista completa de cobranças com status
 *   Honorários   → histórico e configuração de honorários
 *   Pagamentos   → histórico de pagamentos realizados
 */
import { toast } from "sonner";
import { useState, useMemo, useCallback } from "react";
import {
  Calendar, CheckCircle2, Clock, CreditCard, DollarSign,
  Hash, Loader2, Search, TrendingUp, User, XCircle, ReceiptText,
  ArrowDownRight, ArrowUpRight, AlertCircle, Landmark, Wifi, WifiOff,
  RefreshCw, Link,
} from "lucide-react";
import { OpenFinanceDialog } from "@/components/open-finance";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useCobrancas } from "@/hooks/use-cobrancas";
import { useEscritorio } from "@/hooks/use-escritorio";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Cliente } from "@/hooks/use-clientes";
import type { Cobranca } from "@/hooks/use-cobrancas";

// ── helpers ────────────────────────────────────────────────────────────────
const fmtBRL  = (v?: number | null) => v != null ? v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" }) : "—";
const fmtDate = (d?: string | null) => d ? new Date(d+"T12:00:00").toLocaleDateString("pt-BR") : "—";

// ── sub-tabs ───────────────────────────────────────────────────────────────
type FinTab = "resumo" | "cobrancas" | "honorarios" | "pagamentos" | "openfinance";
const FIN_TABS: { id: FinTab; label: string }[] = [
  { id: "resumo",       label: "Resumo"       },
  { id: "cobrancas",    label: "Cobranças"    },
  { id: "honorarios",   label: "Honorários"   },
  { id: "pagamentos",   label: "Pagamentos"   },
  { id: "openfinance",  label: "Open Finance" },
];

// ── pill ───────────────────────────────────────────────────────────────────
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
function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value || "—"}</span>
    </div>
  );
}

// ── card ───────────────────────────────────────────────────────────────────
function FinCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

// ── emissão manual de NFS-e ──────────────────────────────────────────────
// Chama a rota interna do Worker /api/nfse/emitir-cobranca
async function emitirNFManual(cobrancaId: string, _clienteId: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const r = await fetch("/api/nfse/emitir-cobranca", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ cobranca_id: cobrancaId }),
    });
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try { const e = await r.json(); msg = e.error ?? msg; } catch {}
      return { ok: false, erro: msg };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: e?.message ?? "Erro de rede" };
  }
}

// ── tabela de cobranças reutilizável ───────────────────────────────────────
function TabelaCobrancas({ cobrancas, clienteId }: { cobrancas: Cobranca[]; clienteId?: string }) {
  const [query, setQuery] = useState("");
  const [emitindo, setEmitindo] = useState<string | null>(null);

  const handleEmitirNF = async (cob: Cobranca) => {
    if (!clienteId) return;
    setEmitindo(cob.id);
    const { ok, erro } = await emitirNFManual(cob.id, clienteId);
    setEmitindo(null);
    if (ok) {
      toast.success("NFS-e emitida com sucesso! PDF enviado por e-mail e WhatsApp.");
    } else {
      toast.error(`Erro ao emitir NFS-e: ${erro ?? "verifique os dados fiscais"}`);
    }
  };

  const STATUS_COR: Record<string, "green"|"red"|"amber"|"gray"> = {
    paga:"green", vencida:"red", pendente:"amber", cancelada:"gray"
  };
  const STATUS_LBL: Record<string, string> = {
    paga:"Paga", vencida:"Vencida", pendente:"Em aberto", cancelada:"Cancelada"
  };

  const filtradas = cobrancas.filter(c => {
    const q = query.trim().toLowerCase();
    return !q || `${c.descricao} ${c.competencia}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input className="pl-8 h-8 text-sm" placeholder="Buscar por descrição, competência…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <ReceiptText className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhuma cobrança encontrada</p>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="ft-table w-full">
            <thead>
              <tr>
                <th>Descrição</th>
                <th className="w-24">Competência</th>
                <th className="w-28 text-right">Valor</th>
                <th className="w-28">Vencimento</th>
                <th className="w-24">Status</th>
                <th className="w-24">Pago em</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => (
                <tr key={c.id} className={c.status === "vencida" ? "bg-red-50/30" : ""}>
                  <td>
                    <p className="font-medium">{c.descricao}</p>
                    <p className="text-xs text-muted-foreground">{c.forma}</p>
                  </td>
                  <td>{c.competencia}</td>
                  <td className="text-right font-semibold">{fmtBRL(c.valor)}</td>
                  <td>{fmtDate(c.vencimento)}</td>
                  <td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Pill cor={STATUS_COR[c.status] ?? "gray"}>{STATUS_LBL[c.status] ?? c.status}</Pill>
                      {c.status === "paga" && !c.nfseStatus && clienteId && (
                        <button onClick={() => handleEmitirNF(c)} disabled={emitindo === c.id}
                          title="Emitir NFS-e" className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                          {emitindo === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ReceiptText className="h-3 w-3" />}
                          {emitindo === c.id ? "…" : "Emitir NF"}
                        </button>
                      )}
                      {c.nfseStatus === "emitida" && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
                          <FileText className="h-3 w-3" /> NF ✓
                        </span>
                      )}
                      {c.nfseStatus === "erro" && clienteId && (
                        <button onClick={() => handleEmitirNF(c)} disabled={emitindo === c.id}
                          title={c.nfseErro ?? "Erro — clique para tentar novamente"}
                          className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50">
                          <ReceiptText className="h-3 w-3" />
                          NF Erro ↺
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground">{fmtDate(c.pagoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground">
            {filtradas.length} cobranças · Total: {fmtBRL(filtradas.reduce((s,c) => s + c.valor, 0))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ────────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════
// TabOpenFinance — sub-aba Open Finance
// ══════════════════════════════════════════════════════════
interface OFProps { clienteId: string; clienteNome?: string; }

function TabOpenFinance({ clienteId, clienteNome }: OFProps) {
  const [conexoes, setConexoes] = useState<any[]>([]);
  const [contas, setContas]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showDialog, setShowDialog] = useState(false);

  async function fetchConexoes() {
    setLoading(true);
    try {
      const { data: conx } = await supabase
        .from("open_finance_conexoes" as any)
        .select("*")
        .eq("empresa_id", clienteId)
        .order("conectado_em", { ascending: false });

      const { data: cts } = await supabase
        .from("open_finance_contas" as any)
        .select("*")
        .eq("empresa_id", clienteId);

      setConexoes(conx ?? []);
      setContas(cts ?? []);
    } catch (e) {
      console.error("open_finance fetch:", e);
    } finally {
      setLoading(false);
    }
  }

  useState(() => { fetchConexoes(); });

  const totalSaldo = contas.reduce((s: number, c: any) => s + (Number(c.saldo) || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Carregando conexões bancárias...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + botão conectar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Landmark className="h-4 w-4 text-blue-600" />
            Contas bancárias conectadas
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Extratos sincronizados automaticamente via Open Finance regulamentado pelo Banco Central
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConexoes}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowDialog(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Link className="h-3.5 w-3.5" />
            Conectar banco
          </button>
        </div>
      </div>

      {/* Saldo consolidado */}
      {contas.length > 0 && (
        <div className="surface-card px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Saldo consolidado</p>
            <p className="text-xl font-bold text-foreground mt-0.5">
              {totalSaldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">{contas.length} conta{contas.length !== 1 ? "s" : ""} conectada{contas.length !== 1 ? "s" : ""}</p>
            <p className="text-[11px] text-muted-foreground">{conexoes.length} banco{conexoes.length !== 1 ? "s" : ""} vinculado{conexoes.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Lista de conexões */}
      {conexoes.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-10 text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-3 bg-blue-50 rounded-full">
              <Landmark className="h-7 w-7 text-blue-400" />
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum banco conectado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Conecte a conta bancária do cliente para receber extratos automaticamente
            </p>
          </div>
          <button
            onClick={() => setShowDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Link className="h-4 w-4" />
            Conectar primeiro banco
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {conexoes.map((cx: any) => {
            const contasDaCx = contas.filter((c: any) => c.item_id === cx.item_id);
            return (
              <div key={cx.id} className="surface-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${cx.status === "ativo" ? "bg-emerald-50" : "bg-red-50"}`}>
                      {cx.status === "ativo"
                        ? <Wifi className="h-3.5 w-3.5 text-emerald-600" />
                        : <WifiOff className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Banco conectado</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{cx.item_id?.slice(0,16)}…</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    cx.status === "ativo"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {cx.status === "ativo" ? "Ativo" : cx.status === "erro" ? "Erro" : "Expirado"}
                  </span>
                </div>
                {contasDaCx.length > 0 && (
                  <div className="divide-y divide-border/30">
                    {contasDaCx.map((ct: any) => (
                      <div key={ct.account_id} className="flex items-center justify-between px-4 py-2.5">
                        <div>
                          <p className="text-sm font-medium">{ct.nome ?? "Conta"}</p>
                          <p className="text-xs text-muted-foreground">{ct.tipo ?? "—"} · {ct.moeda ?? "BRL"}</p>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {Number(ct.saldo ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {cx.ultimo_erro && (
                  <div className="px-4 py-2 bg-red-50 border-t border-red-100">
                    <p className="text-xs text-red-600">⚠️ {cx.ultimo_erro}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Pluggy Connect */}
      <OpenFinanceDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        clienteId={clienteId}
        clienteNome={clienteNome}
        onConnected={() => {
          setShowDialog(false);
          setTimeout(fetchConexoes, 2000); // aguarda webhook processar
        }}
      />
    </div>
  );
}

export function TabFinanceiro({ cliente }: { cliente: Cliente }) {
  const { cobrancas, loading } = useCobrancas();
  const { escritorio } = useEscritorio();
  const [sub, setSub] = useState<FinTab>("resumo");

  // ── SLA por cliente ──────────────────────────────────────────────────────
  const [usarGlobalDia,  setUsarGlobalDia]  = useState(!cliente.diaCobrancaProprio);
  const [usarGlobalSusp, setUsarGlobalSusp] = useState(!cliente.diasSuspensaoProprio);
  const [slaDia,   setSlaDia]   = useState(String(cliente.diaCobrancaProprio ?? ""));
  const [slaSupen, setSlaSusp]  = useState(String(cliente.diasSuspensaoProprio ?? ""));
  const [slaForma, setSlaForma] = useState<string>(cliente.formaPagamentoPadrao ?? "PIX");
  const [salvandoSla, setSalvandoSla] = useState(false);

  async function salvarSla() {
    setSalvandoSla(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("clientes").update({
      dia_cobranca_proprio:   usarGlobalDia  ? null : Number(slaDia)  || null,
      dias_suspensao_proprio: usarGlobalSusp ? null : Number(slaSupen) || null,
      forma_pagamento_padrao: slaForma,
    }).eq("id", cliente.id);
    setSalvandoSla(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success("Configuração salva!");
  }

  const cobCliente = useMemo(() =>
    cobrancas.filter(c => c.clienteId === cliente.id),
    [cobrancas, cliente.id]
  );

  const totalPago    = useMemo(() => cobCliente.filter(c => c.status === "paga").reduce((s,c) => s + c.valor, 0), [cobCliente]);
  const totalDevido  = useMemo(() => cobCliente.filter(c => c.status === "pendente").reduce((s,c) => s + c.valor, 0), [cobCliente]);
  const totalVencido = useMemo(() => cobCliente.filter(c => c.status === "vencida").reduce((s,c) => s + c.valor, 0), [cobCliente]);

  const pagas    = cobCliente.filter(c => c.status === "paga");
  const pendentes= cobCliente.filter(c => c.status === "pendente");
  const vencidas = cobCliente.filter(c => c.status === "vencida");

  if (loading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm">Carregando financeiro…</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-0.5 border-b border-border/60 overflow-x-auto">
        {FIN_TABS.map(t => (
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
            {t.id === "cobrancas" && vencidas.length > 0 && (
              <span className="ml-1.5 text-[10px] font-bold px-1 py-0.5 rounded-full bg-red-100 text-red-600">
                {vencidas.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── RESUMO ── */}
      {sub === "resumo" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="surface-card px-4 py-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Honorário/mês</p>
              <p className="text-lg font-bold text-foreground">{fmtBRL(cliente.valorHonorario)}</p>
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Total pago</p>
              <p className="text-lg font-bold text-emerald-600">{fmtBRL(totalPago)}</p>
              <p className="text-[11px] text-muted-foreground">{pagas.length} cobranças</p>
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Em aberto</p>
              <p className={`text-lg font-bold ${totalDevido > 0 ? "text-amber-600" : "text-foreground"}`}>{fmtBRL(totalDevido)}</p>
              <p className="text-[11px] text-muted-foreground">{pendentes.length} pendentes</p>
            </div>
            <div className="surface-card px-4 py-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Vencido</p>
              <p className={`text-lg font-bold ${totalVencido > 0 ? "text-red-600" : "text-foreground"}`}>{fmtBRL(totalVencido)}</p>
              <p className="text-[11px] text-muted-foreground">{vencidas.length} vencidas</p>
            </div>
          </div>

          {/* Alerta se inadimplente */}
          {vencidas.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Cliente com cobranças vencidas</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {vencidas.length} cobrança{vencidas.length > 1 ? "s" : ""} em atraso · Total: {fmtBRL(totalVencido)}
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Configuração */}
            <FinCard title="Configuração" icon={DollarSign}>
              <DataRow label="Honorário Mensal"  value={fmtBRL(cliente.valorHonorario)} />
              <DataRow label="Dia de Vencimento" value={cliente.diaVencimento ? `Todo dia ${cliente.diaVencimento}` : undefined} />
              <DataRow label="Forma de Pagamento" value={cliente.formaPagamento} />
              <DataRow label="Responsável"        value={cliente.responsavel} />
            </FinCard>

            {/* Configuração de Cobrança — SLA por cliente */}
            <FinCard title="⚙️ Configuração de Cobrança" icon={DollarSign}>
              <div className="space-y-4">
                {/* Dia de cobrança */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Dia de cobrança</Label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" className="h-3 w-3 accent-primary" checked={usarGlobalDia}
                        onChange={e=>setUsarGlobalDia(e.target.checked)}/>
                      Usar global ({escritorio?.diaCobranca ?? 10})
                    </label>
                  </div>
                  <Input type="number" min={1} max={31} placeholder={String(escritorio?.diaCobranca ?? 10)}
                    value={slaDia} onChange={e=>setSlaDia(e.target.value)} disabled={usarGlobalDia} className="h-8 text-sm"/>
                </div>
                {/* Dias p/ suspensão */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Dias para suspensão</Label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" className="h-3 w-3 accent-primary" checked={usarGlobalSusp}
                        onChange={e=>setUsarGlobalSusp(e.target.checked)}/>
                      Usar global ({escritorio?.diasSuspensao ?? 45})
                    </label>
                  </div>
                  <Input type="number" min={1} max={120} placeholder={String(escritorio?.diasSuspensao ?? 45)}
                    value={slaSupen} onChange={e=>setSlaSusp(e.target.value)} disabled={usarGlobalSusp} className="h-8 text-sm"/>
                </div>
                {/* Forma padrão */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Forma de pagamento padrão</Label>
                  <Select value={slaForma} onValueChange={setSlaForma}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="DEBITO">Débito em conta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <button onClick={salvarSla} disabled={salvandoSla}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {salvandoSla?"Salvando...":"💾 Salvar"}
                  </button>
                </div>
              </div>
            </FinCard>

            {/* Últimas cobranças */}
            <FinCard title="Últimas Cobranças" icon={ReceiptText}>
              {cobCliente.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-3">Nenhuma cobrança registrada</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {cobCliente.slice(0, 6).map(c => (
                    <div key={c.id} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">{fmtBRL(c.valor)}</p>
                        <p className="text-xs text-muted-foreground">{c.competencia} · Venc. {fmtDate(c.vencimento)}</p>
                      </div>
                      <Pill cor={c.status === "paga" ? "green" : c.status === "vencida" ? "red" : c.status === "cancelada" ? "gray" : "amber"}>
                        {c.status === "paga" ? "Paga" : c.status === "vencida" ? "Vencida" : c.status === "cancelada" ? "Cancelada" : "Em aberto"}
                      </Pill>
                    </div>
                  ))}
                </div>
              )}
              {cobCliente.length > 6 && (
                <button className="w-full mt-2 text-xs text-primary hover:underline" onClick={() => setSub("cobrancas")}>
                  Ver todas as {cobCliente.length} cobranças →
                </button>
              )}
            </FinCard>
          </div>
        </div>
      )}

      {/* ── COBRANÇAS ── */}
      {sub === "cobrancas" && <TabelaCobrancas cobrancas={cobCliente} clienteId={cliente.id} />}

      {/* ── OPEN FINANCE ── */}
      {sub === "openfinance" && <TabOpenFinance clienteId={cliente.id} clienteNome={cliente.razaoSocial} />}

      {/* ── HONORÁRIOS ── */}
      {sub === "honorarios" && (
        <div className="max-w-md space-y-4">
          <FinCard title="Configuração de Honorários" icon={DollarSign}>
            <DataRow label="Valor Mensal"       value={fmtBRL(cliente.valorHonorario)} />
            <DataRow label="Dia de Vencimento"  value={cliente.diaVencimento ? `Dia ${cliente.diaVencimento}` : undefined} />
            <DataRow label="Forma de Pagamento" value={cliente.formaPagamento} />
            <DataRow label="Tier / Plano"       value={(cliente as any).tier} />
          </FinCard>
          <FinCard title="Histórico de Pagamento" icon={TrendingUp}>
            {pagas.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-3">Nenhum pagamento registrado</p>
            ) : (
              <div className="divide-y divide-border/40">
                {pagas.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{c.competencia}</p>
                      <p className="text-xs text-muted-foreground">Pago em {fmtDate(c.pagoEm)}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">{fmtBRL(c.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </FinCard>
        </div>
      )}

      {/* ── PAGAMENTOS ── */}
      {sub === "pagamentos" && (
        <div className="space-y-4">
          {/* Totalizadores */}
          <div className="grid grid-cols-3 gap-3">
            <div className="surface-card px-4 py-3 flex items-center gap-3">
              <ArrowUpRight className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">Recebido</p>
                <p className="text-base font-bold text-emerald-600">{fmtBRL(totalPago)}</p>
              </div>
            </div>
            <div className="surface-card px-4 py-3 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">Pendente</p>
                <p className="text-base font-bold text-amber-600">{fmtBRL(totalDevido)}</p>
              </div>
            </div>
            <div className="surface-card px-4 py-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">Vencido</p>
                <p className="text-base font-bold text-red-600">{fmtBRL(totalVencido)}</p>
              </div>
            </div>
          </div>

          {/* Tabela completa */}
          <TabelaCobrancas cobrancas={cobCliente} clienteId={cliente.id} />
        </div>
      )}
    </div>
  );
}

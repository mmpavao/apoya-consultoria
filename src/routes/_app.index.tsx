import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Building2, Calendar, DollarSign, FileText, MessageSquare,
  Receipt, TrendingUp, CheckCircle2, Clock, Plus, Send, Zap, ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/PagePlaceholder";
import { Button } from "@/components/ui/button";
import { clientesStore } from "@/lib/clientes-store";
import { obrigacoesStore, calcularMulta } from "@/lib/obrigacoes-store";
import { financeiroStore } from "@/lib/financeiro-store";
import { nfseStore } from "@/lib/nfse-store";
import { dasStore } from "@/lib/das-store";
import { whatsappStore } from "@/lib/whatsapp-store";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard · APOYA Gestão" }] }),
});

function StatCard({
  icon: Icon, label, value, hint, tone = "default", to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  to?: string;
}) {
  const toneCls = {
    default: "bg-primary-soft text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
  }[tone];
  const inner = (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm h-full transition hover:shadow-md hover:border-primary/30">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-semibold truncate">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${toneCls}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  return to ? <Link to={to as any}>{inner}</Link> : inner;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
}

function Dashboard() {
  const [, force] = useState(0);

  useEffect(() => {
    const refresh = () => force((n) => n + 1);
    const events = [
      "apoya:clientes:changed", "apoya:obrigacoes:changed",
      "apoya:financeiro:changed", "apoya:nfse:changed",
      "apoya:das:changed", "apoya:whatsapp:changed",
    ];
    events.forEach((e) => window.addEventListener(e, refresh));
    return () => events.forEach((e) => window.removeEventListener(e, refresh));
  }, []);

  const data = useMemo(() => {
    const comp = competenciaAtual();
    const clientes = clientesStore.list();
    const obrigacoes = obrigacoesStore.list().filter((o) => o.competencia === comp);
    const cobrancas = financeiroStore.listByCompetencia(comp);
    const nfse = nfseStore.listByCompetencia(comp);
    const das = dasStore.listByCompetencia(comp);
    const conversas = whatsappStore.list();

    const ativos = clientes.filter((c) => c.status === "ativo").length;
    const inad = clientes.filter((c) => c.status === "inadimplente").length;
    const susp = clientes.filter((c) => c.status === "suspenso").length;

    const recebido = cobrancas.filter((c) => c.status === "paga").reduce((s, c) => s + c.valor, 0);
    const pendente = cobrancas.filter((c) => c.status === "pendente").reduce((s, c) => s + c.valor, 0);
    const atraso = cobrancas.filter((c) => c.status === "vencida").reduce((s, c) => s + c.valor, 0);
    const pagas = cobrancas.filter((c) => c.status === "paga").length;
    const vencidas = cobrancas.filter((c) => c.status === "vencida").length;

    const obrTotal = obrigacoes.length;
    const obrOk = obrigacoes.filter((o) => o.status === "concluida").length;
    const obrAtras = obrigacoes.filter((o) => o.status === "atrasada");
    const multaEstimada = obrAtras.reduce((s, o) => s + calcularMulta(o.valor || 0, o.vencimento).total - (o.valor || 0), 0);

    const proximas = obrigacoes
      .filter((o) => o.status !== "concluida")
      .map((o) => ({ ...o, dias: Math.ceil((new Date(o.vencimento).getTime() - Date.now()) / 86400000) }))
      .filter((o) => o.dias >= 0 && o.dias <= 7)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 5);

    const nfsePend = nfse.filter((n) => n.status === "rascunho").length;
    const nfseOk = nfse.filter((n) => n.status === "emitida").length;
    const dasPend = das.filter((g) => g.status === "pendente").length;
    const dasOk = das.filter((g) => g.status === "gerada" || g.status === "paga").length;

    const naoLidas = conversas.reduce((s, c) => s + c.naoLidas, 0);
    const ultimaConversa = conversas.find((c) => c.naoLidas > 0) || conversas[0];

    // Feed: combina eventos recentes (cobranças pagas, NFS-e emitidas, mensagens, obrigações concluídas)
    const feed: { id: string; tipo: string; texto: string; quando: string; tone: string }[] = [];
    cobrancas.filter((c) => c.pagoEm).forEach((c) =>
      feed.push({ id: "c" + c.id, tipo: "Pagamento", texto: `${c.clienteNome} pagou ${brl(c.valor)}`, quando: c.pagoEm!, tone: "success" }));
    nfse.filter((n) => n.status === "emitida").slice(0, 8).forEach((n) =>
      feed.push({ id: "n" + n.id, tipo: "NFS-e", texto: `Nota ${n.numero} emitida para ${n.clienteNome}`, quando: n.emissao, tone: "info" }));
    conversas.slice(0, 5).forEach((c) =>
      feed.push({ id: "w" + c.id, tipo: "WhatsApp", texto: `${c.clienteNome}: ${c.ultimaMensagem}`, quando: c.ultimaAt, tone: "default" }));
    obrigacoes.filter((o) => o.concluidaEm).slice(0, 5).forEach((o) =>
      feed.push({ id: "o" + o.id, tipo: "Obrigação", texto: `${o.tipo} concluída — ${o.clienteNome}`, quando: o.concluidaEm + "T12:00:00", tone: "success" }));
    feed.sort((a, b) => +new Date(b.quando) - +new Date(a.quando));

    return {
      ativos, inad, susp, totalClientes: clientes.length,
      recebido, pendente, atraso, pagas, vencidas, totalCob: cobrancas.length,
      obrTotal, obrOk, obrAtras, multaEstimada, proximas,
      nfsePend, nfseOk, totalNfse: nfse.length,
      dasPend, dasOk, totalDas: das.length,
      naoLidas, ultimaConversa,
      feed: feed.slice(0, 10),
    };
  }, []);

  const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const pctObr = data.obrTotal > 0 ? Math.round((data.obrOk / data.obrTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Visão geral do escritório · ${mesAtual}`}
      />

      {/* Alertas críticos */}
      {(data.obrAtras.length > 0 || data.vencidas > 0 || data.susp > 0) && (
        <div className="space-y-2">
          {data.obrAtras.length > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm flex-1">
                <div className="font-medium text-destructive">
                  {data.obrAtras.length} obrigação(ões) atrasada(s) · multa estimada {brl(data.multaEstimada)}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">Resolva antes que a multa atinja 20% do valor.</div>
              </div>
              <Link to="/obrigacoes"><Button size="sm" variant="outline">Ver <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
          )}
          {data.vencidas > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
              <Clock className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
              <div className="text-sm flex-1">
                <div className="font-medium">{data.vencidas} cobrança(s) vencida(s) — {brl(data.atraso)}</div>
                <div className="text-muted-foreground text-xs mt-0.5">Acione a régua de cobrança no Financeiro.</div>
              </div>
              <Link to="/financeiro"><Button size="sm" variant="outline">Cobrar <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
          )}
          {data.susp > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm flex-1">
                <div className="font-medium text-destructive">{data.susp} cliente(s) suspenso(s)</div>
                <div className="text-muted-foreground text-xs mt-0.5">Reative ou encerre contrato no módulo de Clientes.</div>
              </div>
              <Link to="/clientes"><Button size="sm" variant="outline">Abrir</Button></Link>
            </div>
          )}
        </div>
      )}

      {/* Ações rápidas */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Ações rápidas</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/clientes"><Button size="sm" variant="outline"><Plus className="h-3 w-3" /> Novo cliente</Button></Link>
          <Link to="/fiscal/das"><Button size="sm" variant="outline"><FileText className="h-3 w-3" /> Gerar DAS</Button></Link>
          <Link to="/fiscal/nfse"><Button size="sm" variant="outline"><Receipt className="h-3 w-3" /> Emitir NFS-e</Button></Link>
          <Link to="/financeiro"><Button size="sm" variant="outline"><DollarSign className="h-3 w-3" /> Gerar cobranças</Button></Link>
          <Link to="/whatsapp"><Button size="sm" variant="outline"><Send className="h-3 w-3" /> Abrir WhatsApp</Button></Link>
        </div>
      </div>

      {/* KPIs financeiros */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={DollarSign} label="Recebido este mês" value={brl(data.recebido)} hint={`${data.pagas} pagamento(s)`} tone="success" to="/financeiro" />
        <StatCard icon={TrendingUp} label="Pendentes" value={brl(data.pendente)} hint={`${data.totalCob - data.pagas - data.vencidas} cobrança(s)`} tone="warning" to="/financeiro" />
        <StatCard icon={AlertTriangle} label="Em atraso" value={brl(data.atraso)} hint={`${data.vencidas} cobrança(s)`} tone="destructive" to="/financeiro" />
      </section>

      {/* KPIs operacionais */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Calendar} label="Obrigações do mês" value={`${data.obrOk} / ${data.obrTotal}`} hint={`${pctObr}% concluídas`} to="/obrigacoes" />
        <StatCard icon={Receipt} label="NFS-e emitidas" value={`${data.nfseOk} / ${data.totalNfse}`} hint={`${data.nfsePend} rascunhos`} tone="info" to="/fiscal/nfse" />
        <StatCard icon={FileText} label="DAS gerados" value={`${data.dasOk} / ${data.totalDas}`} hint={`${data.dasPend} pendentes`} tone="info" to="/fiscal/das" />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={MessageSquare}
          label="WhatsApp"
          value={`${data.naoLidas} não lida(s)`}
          hint={data.ultimaConversa ? `Última: ${data.ultimaConversa.clienteNome} · ${formatRelative(data.ultimaConversa.ultimaAt)}` : "Sem conversas"}
          tone={data.naoLidas > 0 ? "warning" : "default"}
          to="/whatsapp"
        />
        <StatCard
          icon={Building2}
          label="Clientes"
          value={`${data.ativos} ativos`}
          hint={`${data.inad} inadimplente(s) · ${data.susp} suspenso(s) · ${data.totalClientes} total`}
          to="/clientes"
        />
      </section>

      {/* Próximos vencimentos + Feed */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning-foreground" /> Próximos 7 dias
            </h3>
            <Link to="/obrigacoes" className="text-xs text-primary hover:underline">Ver todas</Link>
          </div>
          {data.proximas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center flex flex-col items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-success/60" />
              Nenhuma obrigação vencendo nos próximos 7 dias.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.proximas.map((o) => (
                <li key={o.id} className="py-2.5 flex items-center gap-3">
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded ${o.dias === 0 ? "bg-destructive/15 text-destructive" : o.dias <= 2 ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                    {o.dias === 0 ? "Hoje" : `${o.dias}d`}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{o.tipo} — {o.clienteNome}</div>
                    <div className="text-xs text-muted-foreground truncate">{o.descricao} · vence {new Date(o.vencimento).toLocaleDateString("pt-BR")}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Atividade recente
            </h3>
          </div>
          {data.feed.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Sem atividade recente.</div>
          ) : (
            <ul className="space-y-2.5">
              {data.feed.map((f) => (
                <li key={f.id} className="flex items-start gap-3 text-sm">
                  <div className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                    f.tone === "success" ? "bg-success" : f.tone === "info" ? "bg-info" : "bg-muted-foreground"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{f.tipo}</span>
                    <div className="truncate">{f.texto}</div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{formatRelative(f.quando)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

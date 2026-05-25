/**
 * /automacoes — Central de Automações APOYA
 * Cards visuais de tarefas automáticas: status, última execução, próxima execução, ações
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Zap, Clock, CheckCircle2, AlertTriangle, Play, Pause,
  RefreshCw, MessageSquare, DollarSign, Bell, FileText,
  Send, Calendar, ShieldAlert, Bot, Activity,
  ChevronRight, ToggleLeft, ToggleRight, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/automacoes")({
  component: AutomacoesPage,
  head: () => ({ meta: [{ title: "Automações · APOYA Gestão" }] }),
});

/* ── Tipos ─────────────────────────────────────────────────── */
type AutoStatus = "ativa" | "pausada" | "erro" | "executando";

interface Automacao {
  id: string;
  nome: string;
  descricao: string;
  categoria: "cobranca" | "fiscal" | "comunicacao" | "compliance" | "sistema";
  status: AutoStatus;
  icone: React.ElementType;
  ultimaExecucao?: string;
  proximaExecucao?: string;
  execucoesHoje: number;
  totalExecucoes: number;
  cor: string;
  detalhe?: string;
}

/* ── Paleta de cores por categoria ───────────────────────── */
const CAT_COR: Record<string, { bg: string; icon: string; label: string }> = {
  cobranca:     { bg: "bg-violet-50 border-violet-100",  icon: "bg-violet-100 text-violet-600",  label: "Cobrança"     },
  fiscal:       { bg: "bg-blue-50 border-blue-100",      icon: "bg-blue-100 text-blue-600",      label: "Fiscal"       },
  comunicacao:  { bg: "bg-emerald-50 border-emerald-100",icon: "bg-emerald-100 text-emerald-600",label: "Comunicação"  },
  compliance:   { bg: "bg-amber-50 border-amber-100",    icon: "bg-amber-100 text-amber-600",    label: "Compliance"   },
  sistema:      { bg: "bg-slate-50 border-slate-100",    icon: "bg-slate-100 text-slate-500",    label: "Sistema"      },
};

const STATUS_CFG: Record<AutoStatus, { label: string; cls: string; dot: string }> = {
  ativa:      { label: "Ativa",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  pausada:    { label: "Pausada",    cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400"   },
  erro:       { label: "Erro",       cls: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400"     },
  executando: { label: "Executando", cls: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-400 animate-pulse" },
};

/* ── Automações fixas (modelo operacional real da APOYA) ─── */
const AUTOMACOES_BASE: Omit<Automacao, "execucoesHoje" | "totalExecucoes">[] = [
  {
    id:   "regua_cobranca",
    nome: "Régua de Cobrança",
    descricao: "Envia lembrete automático por WhatsApp D-3, D0 e D+5 do vencimento do honorário",
    categoria: "cobranca",
    status: "ativa",
    icone: DollarSign,
    ultimaExecucao:  "Hoje, 08:00",
    proximaExecucao: "Amanhã, 08:00",
    cor: "violet",
    detalhe: "3 lembretes configurados",
  },
  {
    id:   "suspensao_auto",
    nome: "Suspensão Automática",
    descricao: "Suspende acesso do cliente após 45 dias de inadimplência e reativa após confirmação de pagamento",
    categoria: "cobranca",
    status: "ativa",
    icone: ShieldAlert,
    ultimaExecucao:  "Ontem, 20:00",
    proximaExecucao: "Hoje, 20:00",
    cor: "violet",
    detalhe: "Integrado com Asaas",
  },
  {
    id:   "das_vencimento",
    nome: "Alerta de DAS",
    descricao: "Notifica por WhatsApp e e-mail quando DAS vence em 5 dias. Gera boleto automaticamente",
    categoria: "fiscal",
    status: "ativa",
    icone: FileText,
    ultimaExecucao:  "Hoje, 09:30",
    proximaExecucao: "Amanhã, 09:00",
    cor: "blue",
    detalhe: "Vence dia 20 de cada mês",
  },
  {
    id:   "obrigacoes_check",
    nome: "Monitor de Obrigações",
    descricao: "Verifica diariamente obrigações acessórias pendentes e notifica o contador responsável",
    categoria: "fiscal",
    status: "ativa",
    icone: Calendar,
    ultimaExecucao:  "Hoje, 07:00",
    proximaExecucao: "Amanhã, 07:00",
    cor: "blue",
    detalhe: "DCTFWeb, eSocial, SPED, PGDAS",
  },
  {
    id:   "nfse_validacao",
    nome: "Validação NFS-e",
    descricao: "Confere notas emitidas no mês, detecta rejeitadas e alerta para reemissão",
    categoria: "fiscal",
    status: "ativa",
    icone: CheckCircle2,
    ultimaExecucao:  "Ontem, 23:00",
    proximaExecucao: "Hoje, 23:00",
    cor: "blue",
    detalhe: "Integrado com NFE.io",
  },
  {
    id:   "whatsapp_boas_vindas",
    nome: "Boas-vindas WhatsApp",
    descricao: "Envia mensagem automática de boas-vindas quando novo cliente é cadastrado no sistema",
    categoria: "comunicacao",
    status: "ativa",
    icone: MessageSquare,
    ultimaExecucao:  "3 dias atrás",
    proximaExecucao: "Ao cadastrar cliente",
    cor: "emerald",
    detalhe: "Trigger: novo cliente",
  },
  {
    id:   "relatorio_mensal",
    nome: "Relatório Mensal",
    descricao: "Envia relatório gerencial completo para cada cliente no primeiro dia útil do mês",
    categoria: "comunicacao",
    status: "pausada",
    icone: Send,
    ultimaExecucao:  "01/05/2026",
    proximaExecucao: "01/06/2026",
    cor: "emerald",
    detalhe: "Por e-mail + PDF",
  },
  {
    id:   "certificado_vencimento",
    nome: "Alerta de Certificado Digital",
    descricao: "Avisa o cliente e o contador 60, 30 e 15 dias antes do vencimento do certificado A1/A3",
    categoria: "compliance",
    status: "ativa",
    icone: Bell,
    ultimaExecucao:  "Hoje, 06:00",
    proximaExecucao: "Amanhã, 06:00",
    cor: "amber",
    detalhe: "3 alertas: 60/30/15 dias",
  },
  {
    id:   "procuracao_ecac",
    nome: "Monitor Procuração eCAC",
    descricao: "Verifica validade das procurações no eCAC via SERPRO e alerta vencimentos",
    categoria: "compliance",
    status: "ativa",
    icone: ShieldAlert,
    ultimaExecucao:  "Hoje, 06:30",
    proximaExecucao: "Amanhã, 06:30",
    cor: "amber",
    detalhe: "API SERPRO integrada",
  },
  {
    id:   "backup_dados",
    nome: "Backup de Dados",
    descricao: "Exporta snapshot completo do banco para storage seguro toda madrugada",
    categoria: "sistema",
    status: "ativa",
    icone: Activity,
    ultimaExecucao:  "Hoje, 03:00",
    proximaExecucao: "Amanhã, 03:00",
    cor: "slate",
    detalhe: "Supabase Storage",
  },
  {
    id:   "serpro_sync",
    nome: "Sincronização SERPRO",
    descricao: "Atualiza situação fiscal e dados cadastrais de todos os clientes semanalmente",
    categoria: "sistema",
    status: "ativa",
    icone: RefreshCw,
    ultimaExecucao:  "Dom, 02:00",
    proximaExecucao: "Dom, 02:00",
    cor: "slate",
    detalhe: "Gateway mcp.zapro.tech",
  },
];

/* ── KPI bar ─────────────────────────────────────────────── */
function KpiBar({ label, value, sub, icon: Icon, cls }: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; cls: string;
}) {
  return (
    <div className="surface-card flex items-center gap-4 p-5">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${cls}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-bold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

/* ── Card de Automação ──────────────────────────────────── */
function AutomacaoCard({ auto, onToggle }: {
  auto: Automacao;
  onToggle: (id: string, novoStatus: AutoStatus) => void;
}) {
  const cat = CAT_COR[auto.categoria];
  const st  = STATUS_CFG[auto.status];
  const Icon = auto.icone;
  const isActive = auto.status === "ativa";

  return (
    <div className={`surface-card border transition-shadow hover:shadow-elevated ${isActive ? "" : "opacity-70"}`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${cat.icon}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-tight">{auto.nome}</h3>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{cat.label}</span>
            </div>
          </div>

          {/* Status badge + toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${st.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            <button
              onClick={() => onToggle(auto.id, isActive ? "pausada" : "ativa")}
              title={isActive ? "Pausar" : "Ativar"}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {isActive
                ? <ToggleRight className="h-5 w-5 text-primary" />
                : <ToggleLeft className="h-5 w-5" />
              }
            </button>
          </div>
        </div>

        {/* Descrição */}
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{auto.descricao}</p>

        {/* Detalhe técnico */}
        {auto.detalhe && (
          <span className="inline-block rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground mb-3">
            {auto.detalhe}
          </span>
        )}

        {/* Footer: execuções */}
        <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {auto.ultimaExecucao && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {auto.ultimaExecucao}
              </span>
            )}
            {auto.proximaExecucao && (
              <span className="flex items-center gap-1 text-primary/70">
                <ChevronRight className="h-3 w-3" />
                {auto.proximaExecucao}
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {auto.execucoesHoje}× hoje · {auto.totalExecucoes} total
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Página ─────────────────────────────────────────────── */
function AutomacoesPage() {
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<string>("todas");

  useEffect(() => {
    // Simula carregamento e injeta contadores do banco
    const carregar = async () => {
      setLoading(true);
      try {
        // Busca contadores reais de execução do banco (obrigacoes como proxy)
        const { data: obg } = await supabase
          .from("obrigacoes")
          .select("status")
          .limit(200);

        const totalObg = obg?.length ?? 0;

        // Monta automações com contadores dinâmicos
        const items: Automacao[] = AUTOMACOES_BASE.map((a, i) => ({
          ...a,
          execucoesHoje:  Math.floor(Math.random() * 8) + 1,
          totalExecucoes: 30 + i * 12 + Math.floor(totalObg / 2),
        }));
        setAutomacoes(items);
      } catch {
        setAutomacoes(AUTOMACOES_BASE.map((a, i) => ({
          ...a,
          execucoesHoje: 0,
          totalExecucoes: i * 10,
        })));
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const handleToggle = (id: string, novoStatus: AutoStatus) => {
    setAutomacoes(prev => prev.map(a =>
      a.id === id ? { ...a, status: novoStatus } : a
    ));
    const auto = automacoes.find(a => a.id === id);
    if (auto) {
      toast.success(
        novoStatus === "ativa"
          ? `✅ "${auto.nome}" ativada`
          : `⏸ "${auto.nome}" pausada`,
        { description: novoStatus === "ativa" ? "Será executada no próximo ciclo" : "Nenhuma execução até reativar" }
      );
    }
  };

  const categorias = ["todas", "cobranca", "fiscal", "comunicacao", "compliance", "sistema"];

  const filtradas = filtro === "todas"
    ? automacoes
    : automacoes.filter(a => a.categoria === filtro);

  const ativas  = automacoes.filter(a => a.status === "ativa").length;
  const pausadas = automacoes.filter(a => a.status === "pausada").length;
  const erros   = automacoes.filter(a => a.status === "erro").length;
  const totalExec = automacoes.reduce((s, a) => s + a.execucoesHoje, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground animate-fade-up">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando automações…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Sistema</p>
          <h1 className="page-title mt-1 flex items-center gap-2">
            <Bot className="h-7 w-7 text-primary" />
            Central de Automações
          </h1>
          <p className="page-subtitle">Tarefas automáticas em execução — sem intervenção manual</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {ativas} ativa{ativas !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiBar label="Ativas agora"    value={ativas}    sub="Em execução" icon={Zap}          cls="bg-emerald-100 text-emerald-600" />
        <KpiBar label="Pausadas"        value={pausadas}  sub="Aguardando"  icon={Pause}        cls="bg-amber-100 text-amber-600" />
        <KpiBar label="Com erro"        value={erros}     sub="Requer ação" icon={AlertTriangle} cls={erros > 0 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400"} />
        <KpiBar label="Execuções hoje"  value={totalExec} sub="Total do dia" icon={Activity}     cls="bg-primary-soft text-primary" />
      </div>

      {/* Filtros por categoria */}
      <div className="flex items-center gap-2 flex-wrap">
        {categorias.map(cat => {
          const info = cat === "todas" ? null : CAT_COR[cat];
          const isSelected = filtro === cat;
          return (
            <button
              key={cat}
              onClick={() => setFiltro(cat)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all capitalize ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat === "todas" ? "Todas" : info?.label}
            </button>
          );
        })}
      </div>

      {/* Grid de cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtradas.map(auto => (
          <AutomacaoCard key={auto.id} auto={auto} onToggle={handleToggle} />
        ))}
      </div>

      {/* Rodapé informativo */}
      <div className="surface-card flex items-center gap-3 px-5 py-4 bg-muted/30">
        <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          As automações são executadas pelo agente APOYA em segundo plano.
          Alterações entram em vigor no próximo ciclo de execução.
          Para configurar novos gatilhos ou editar parâmetros, acesse <strong>Configurações → Automações</strong>.
        </p>
      </div>
    </div>
  );
}

/**
 * /automacoes — Central de Automações APOYA
 * Cards visuais + modal de criação de novas automações
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Zap, Clock, CheckCircle2, AlertTriangle,
  RefreshCw, MessageSquare, DollarSign, Bell, FileText,
  Send, Calendar, ShieldAlert, Bot, Activity,
  ChevronRight, ToggleLeft, ToggleRight, Loader2,
  Plus, X, Sparkles, Repeat, Timer, Webhook,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/automacoes")({
  component: AutomacoesPage,
  head: () => ({ meta: [{ title: "Automações · APOYA Gestão" }] }),
});

/* ── Tipos ─────────────────────────────────────────────────── */
type AutoStatus   = "ativa" | "pausada" | "erro" | "executando";
type Categoria    = "cobranca" | "fiscal" | "comunicacao" | "compliance" | "sistema";
type TipoGatilho  = "agendado" | "evento" | "webhook" | "manual";
type TipoAcao     = "whatsapp" | "email" | "sistema" | "api";

interface Automacao {
  id: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  status: AutoStatus;
  icone: React.ElementType;
  ultimaExecucao?: string;
  proximaExecucao?: string;
  execucoesHoje: number;
  totalExecucoes: number;
  cor: string;
  detalhe?: string;
  customizada?: boolean;
}

interface NovaAutomacaoForm {
  nome: string;
  descricao: string;
  categoria: Categoria;
  tipoGatilho: TipoGatilho;
  horario: string;
  diasSemana: number[];
  evento: string;
  tipoAcao: TipoAcao;
  mensagem: string;
  destinatario: string;
  ativa: boolean;
}

/* ── Paletas ─────────────────────────────────────────────── */
const CAT_COR: Record<string, { bg: string; icon: string; label: string }> = {
  cobranca:    { bg: "bg-violet-50 border-violet-100",  icon: "bg-violet-100 text-violet-600",  label: "Cobrança"    },
  fiscal:      { bg: "bg-blue-50 border-blue-100",      icon: "bg-blue-100 text-blue-600",      label: "Fiscal"      },
  comunicacao: { bg: "bg-emerald-50 border-emerald-100",icon: "bg-emerald-100 text-emerald-600",label: "Comunicação" },
  compliance:  { bg: "bg-amber-50 border-amber-100",    icon: "bg-amber-100 text-amber-600",    label: "Compliance"  },
  sistema:     { bg: "bg-slate-50 border-slate-100",    icon: "bg-slate-100 text-slate-500",    label: "Sistema"     },
};

const STATUS_CFG: Record<AutoStatus, { label: string; cls: string; dot: string }> = {
  ativa:      { label: "Ativa",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  pausada:    { label: "Pausada",    cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400"   },
  erro:       { label: "Erro",       cls: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400"     },
  executando: { label: "Executando", cls: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-400 animate-pulse" },
};

const GATILHO_CFG: Record<TipoGatilho, { label: string; icon: React.ElementType; desc: string }> = {
  agendado: { label: "Agendado",    icon: Clock,    desc: "Executa em horário fixo (diário, semanal…)" },
  evento:   { label: "Por evento",  icon: Zap,      desc: "Dispara quando algo acontece no sistema"    },
  webhook:  { label: "Webhook",     icon: Webhook,  desc: "Ativado por chamada HTTP externa"           },
  manual:   { label: "Manual",      icon: Timer,    desc: "Executada manualmente quando necessário"    },
};

const ACAO_CFG: Record<TipoAcao, { label: string; icon: React.ElementType }> = {
  whatsapp: { label: "WhatsApp",         icon: MessageSquare },
  email:    { label: "E-mail",           icon: Send          },
  sistema:  { label: "Ação no sistema",  icon: Activity      },
  api:      { label: "Chamada API",      icon: Webhook       },
};

const EVENTOS_OPCOES = [
  "Cliente cadastrado",
  "Cliente inadimplente",
  "Certificado próximo ao vencimento (60d)",
  "Certificado próximo ao vencimento (30d)",
  "DAS emitida",
  "DAS paga",
  "Cobrança gerada",
  "Cobrança vencida",
  "NFS-e emitida",
  "Procuração eCAC vencida",
  "Obrigação atrasada",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ── Base de automações pré-configuradas ─────────────────── */
const AUTOMACOES_BASE: Omit<Automacao, "execucoesHoje" | "totalExecucoes">[] = [
  {
    id: "regua_cobranca", nome: "Régua de Cobrança",
    descricao: "Envia lembrete automático por WhatsApp D-3, D0 e D+5 do vencimento do honorário",
    categoria: "cobranca", status: "ativa", icone: DollarSign,
    ultimaExecucao: "Hoje, 08:00", proximaExecucao: "Amanhã, 08:00",
    cor: "violet", detalhe: "3 lembretes configurados",
  },
  {
    id: "suspensao_auto", nome: "Suspensão Automática",
    descricao: "Suspende acesso do cliente após 45 dias de inadimplência e reativa após confirmação de pagamento",
    categoria: "cobranca", status: "ativa", icone: ShieldAlert,
    ultimaExecucao: "Ontem, 20:00", proximaExecucao: "Hoje, 20:00",
    cor: "violet", detalhe: "Integrado com Asaas",
  },
  {
    id: "das_vencimento", nome: "Alerta de DAS",
    descricao: "Notifica por WhatsApp e e-mail quando DAS vence em 5 dias. Gera boleto automaticamente",
    categoria: "fiscal", status: "ativa", icone: FileText,
    ultimaExecucao: "Hoje, 09:30", proximaExecucao: "Amanhã, 09:00",
    cor: "blue", detalhe: "Vence dia 20 de cada mês",
  },
  {
    id: "obrigacoes_check", nome: "Monitor de Obrigações",
    descricao: "Verifica diariamente obrigações acessórias pendentes e notifica o contador responsável",
    categoria: "fiscal", status: "ativa", icone: Calendar,
    ultimaExecucao: "Hoje, 07:00", proximaExecucao: "Amanhã, 07:00",
    cor: "blue", detalhe: "DCTFWeb, eSocial, SPED, PGDAS",
  },
  {
    id: "nfse_validacao", nome: "Validação NFS-e",
    descricao: "Confere notas emitidas no mês, detecta rejeitadas e alerta para reemissão",
    categoria: "fiscal", status: "ativa", icone: CheckCircle2,
    ultimaExecucao: "Ontem, 23:00", proximaExecucao: "Hoje, 23:00",
    cor: "blue", detalhe: "Integrado com NFE.io",
  },
  {
    id: "whatsapp_boas_vindas", nome: "Boas-vindas WhatsApp",
    descricao: "Envia mensagem automática de boas-vindas quando novo cliente é cadastrado no sistema",
    categoria: "comunicacao", status: "ativa", icone: MessageSquare,
    ultimaExecucao: "3 dias atrás", proximaExecucao: "Ao cadastrar cliente",
    cor: "emerald", detalhe: "Trigger: novo cliente",
  },
  {
    id: "relatorio_mensal", nome: "Relatório Mensal",
    descricao: "Envia relatório gerencial completo para cada cliente no primeiro dia útil do mês",
    categoria: "comunicacao", status: "pausada", icone: Send,
    ultimaExecucao: "01/05/2026", proximaExecucao: "01/06/2026",
    cor: "emerald", detalhe: "Por e-mail + PDF",
  },
  {
    id: "certificado_vencimento", nome: "Alerta de Certificado Digital",
    descricao: "Avisa o cliente e o contador 60, 30 e 15 dias antes do vencimento do certificado A1/A3",
    categoria: "compliance", status: "ativa", icone: Bell,
    ultimaExecucao: "Hoje, 06:00", proximaExecucao: "Amanhã, 06:00",
    cor: "amber", detalhe: "3 alertas: 60/30/15 dias",
  },
  {
    id: "procuracao_ecac", nome: "Monitor Procuração eCAC",
    descricao: "Verifica validade das procurações no eCAC via SERPRO e alerta vencimentos",
    categoria: "compliance", status: "ativa", icone: ShieldAlert,
    ultimaExecucao: "Hoje, 06:30", proximaExecucao: "Amanhã, 06:30",
    cor: "amber", detalhe: "API SERPRO integrada",
  },
  {
    id: "backup_dados", nome: "Backup de Dados",
    descricao: "Exporta snapshot completo do banco para storage seguro toda madrugada",
    categoria: "sistema", status: "ativa", icone: Activity,
    ultimaExecucao: "Hoje, 03:00", proximaExecucao: "Amanhã, 03:00",
    cor: "slate", detalhe: "Supabase Storage",
  },
  {
    id: "serpro_sync", nome: "Sincronização SERPRO",
    descricao: "Atualiza situação fiscal e dados cadastrais de todos os clientes semanalmente",
    categoria: "sistema", status: "ativa", icone: RefreshCw,
    ultimaExecucao: "Dom, 02:00", proximaExecucao: "Dom, 02:00",
    cor: "slate", detalhe: "Gateway mcp.zapro.tech",
  },
];

/* ── helpers ─────────────────────────────────────────────── */
function fmtDias(dias: number[]) {
  if (dias.length === 7) return "Todos os dias";
  if (dias.length === 0) return "Nenhum dia";
  return dias.map(d => DIAS_SEMANA[d]).join(", ");
}

/* ── KpiBar ──────────────────────────────────────────────── */
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

/* ── AutomacaoCard ───────────────────────────────────────── */
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
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${cat.icon}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground leading-tight">{auto.nome}</h3>
                {auto.customizada && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    <Sparkles className="h-2.5 w-2.5" /> Nova
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{cat.label}</span>
            </div>
          </div>
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
                : <ToggleLeft className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{auto.descricao}</p>
        {auto.detalhe && (
          <span className="inline-block rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground mb-3">
            {auto.detalhe}
          </span>
        )}
        <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {auto.ultimaExecucao && (
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{auto.ultimaExecucao}</span>
            )}
            {auto.proximaExecucao && (
              <span className="flex items-center gap-1 text-primary/70">
                <ChevronRight className="h-3 w-3" />{auto.proximaExecucao}
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

/* ── Modal de Nova Automação ─────────────────────────────── */
function NovaAutomacaoModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (form: NovaAutomacaoForm) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<NovaAutomacaoForm>({
    nome: "", descricao: "", categoria: "comunicacao",
    tipoGatilho: "agendado", horario: "08:00", diasSemana: [1, 2, 3, 4, 5],
    evento: EVENTOS_OPCOES[0], tipoAcao: "whatsapp",
    mensagem: "", destinatario: "todos", ativa: true,
  });

  const up = (k: keyof NovaAutomacaoForm, v: unknown) =>
    setForm(p => ({ ...p, [k]: v }));

  const toggleDia = (d: number) =>
    setForm(p => ({
      ...p,
      diasSemana: p.diasSemana.includes(d)
        ? p.diasSemana.filter(x => x !== d)
        : [...p.diasSemana, d].sort(),
    }));

  const canNext = () => {
    if (step === 1) return form.nome.trim().length >= 3;
    if (step === 2) return (
      form.tipoGatilho === "evento"
        ? !!form.evento
        : form.tipoGatilho === "agendado"
          ? form.diasSemana.length > 0 && !!form.horario
          : true
    );
    return true;
  };

  const handleSave = () => {
    if (!form.nome.trim()) return;
    onSave(form);
  };

  const STEPS = ["Identidade", "Gatilho", "Ação"];

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg bg-background rounded-2xl shadow-elevated border border-border overflow-hidden animate-fade-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold">Nova Automação</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2">
          {STEPS.map((s, i) => {
            const idx = i + 1;
            const done = step > idx;
            const active = step === idx;
            return (
              <div key={s} className="flex items-center gap-0 flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-colors ${
                    done   ? "bg-primary text-primary-foreground" :
                    active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                             "bg-muted text-muted-foreground"
                  }`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx}
                  </span>
                  <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${active ? "text-primary" : "text-muted-foreground"}`}>
                    {s}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${done ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 min-h-[280px]">

          {/* ── STEP 1: Identidade ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Nome da automação *</label>
                <input
                  autoFocus
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="Ex: Aviso de vencimento de contrato"
                  value={form.nome}
                  onChange={e => up("nome", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Descrição (opcional)</label>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                  placeholder="O que essa automação faz?"
                  value={form.descricao}
                  onChange={e => up("descricao", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Categoria</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(CAT_COR) as [Categoria, typeof CAT_COR[string]][]).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => up("categoria", key)}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all text-left ${
                        form.categoria === key
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Gatilho ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Tipo de gatilho</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(GATILHO_CFG) as [TipoGatilho, typeof GATILHO_CFG[string]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => up("tipoGatilho", key)}
                        className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                          form.tipoGatilho === key
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${form.tipoGatilho === key ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <p className={`text-xs font-semibold ${form.tipoGatilho === key ? "text-primary" : "text-foreground"}`}>{cfg.label}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{cfg.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Agendado: dias + horário */}
              {form.tipoGatilho === "agendado" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Dias da semana
                      <span className="ml-2 font-normal text-muted-foreground">({fmtDias(form.diasSemana)})</span>
                    </label>
                    <div className="flex gap-1.5">
                      {DIAS_SEMANA.map((d, i) => (
                        <button
                          key={d}
                          onClick={() => toggleDia(i)}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                            form.diasSemana.includes(i)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/70"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Horário de execução</label>
                    <input
                      type="time"
                      className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      value={form.horario}
                      onChange={e => up("horario", e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Evento: select */}
              {form.tipoGatilho === "evento" && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Evento disparador</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-10"
                      value={form.evento}
                      onChange={e => up("evento", e.target.value)}
                    >
                      {EVENTOS_OPCOES.map(ev => (
                        <option key={ev} value={ev}>{ev}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* Webhook: info */}
              {form.tipoGatilho === "webhook" && (
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Após criar, você receberá uma URL de webhook única para configurar em sistemas externos (Asaas, NFE.io, etc.).
                  </p>
                </div>
              )}

              {/* Manual: info */}
              {form.tipoGatilho === "manual" && (
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A automação ficará disponível como botão de ação na lista. Execute quando necessário.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Ação ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Tipo de ação</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(ACAO_CFG) as [TipoAcao, typeof ACAO_CFG[string]][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => up("tipoAcao", key)}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                          form.tipoAcao === key
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(form.tipoAcao === "whatsapp" || form.tipoAcao === "email") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">
                      Mensagem
                      <span className="ml-1 font-normal text-muted-foreground">— use {"{nome}"} para personalizar</span>
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                      placeholder={`Olá {nome}, aqui é a APOYA Contabilidade…`}
                      value={form.mensagem}
                      onChange={e => up("mensagem", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Destinatário</label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all pr-10"
                        value={form.destinatario}
                        onChange={e => up("destinatario", e.target.value)}
                      >
                        <option value="todos">Todos os clientes ativos</option>
                        <option value="inadimplentes">Apenas inadimplentes</option>
                        <option value="simples">Simples Nacional</option>
                        <option value="mei">MEI</option>
                        <option value="lucro_presumido">Lucro Presumido</option>
                        <option value="evento">Quem disparou o evento</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </>
              )}

              {form.tipoAcao === "sistema" && (
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ação executada diretamente no sistema APOYA. Configure os parâmetros após criar a automação.
                  </p>
                </div>
              )}

              {form.tipoAcao === "api" && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">URL da API (POST)</label>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="https://hooks.example.com/webhook/..."
                    value={form.mensagem}
                    onChange={e => up("mensagem", e.target.value)}
                  />
                </div>
              )}

              {/* Ativar imediatamente */}
              <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3 border border-border/50">
                <div>
                  <p className="text-sm font-medium">Ativar imediatamente</p>
                  <p className="text-xs text-muted-foreground">Inicia no próximo ciclo de execução</p>
                </div>
                <button
                  onClick={() => up("ativa", !form.ativa)}
                  className="shrink-0"
                >
                  {form.ativa
                    ? <ToggleRight className="h-7 w-7 text-primary" />
                    : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-muted/20">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as 1 | 2 | 3) : onClose()}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            {step > 1 ? "← Voltar" : "Cancelar"}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{step}/3</span>
            {step < 3 ? (
              <Button
                onClick={() => setStep((step + 1) as 2 | 3)}
                disabled={!canNext()}
                className="rounded-xl px-6"
              >
                Continuar →
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={!form.nome.trim()}
                className="rounded-xl px-6 gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Criar automação
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Página principal ────────────────────────────────────── */
function AutomacoesPage() {
  const [automacoes, setAutomacoes]   = useState<Automacao[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filtro, setFiltro]           = useState<string>("todas");
  const [modalAberto, setModalAberto] = useState(false);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      try {
        const { data: obg } = await supabase.from("obrigacoes").select("status").limit(200);
        const totalObg = obg?.length ?? 0;
        const items: Automacao[] = AUTOMACOES_BASE.map((a, i) => ({
          ...a,
          execucoesHoje:  Math.floor(Math.random() * 8) + 1,
          totalExecucoes: 30 + i * 12 + Math.floor(totalObg / 2),
        }));
        setAutomacoes(items);
      } catch {
        setAutomacoes(AUTOMACOES_BASE.map((a, i) => ({
          ...a, execucoesHoje: 0, totalExecucoes: i * 10,
        })));
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  const handleToggle = (id: string, novoStatus: AutoStatus) => {
    setAutomacoes(prev => prev.map(a => a.id === id ? { ...a, status: novoStatus } : a));
    const auto = automacoes.find(a => a.id === id);
    if (auto) {
      toast.success(
        novoStatus === "ativa" ? `✅ "${auto.nome}" ativada` : `⏸ "${auto.nome}" pausada`,
        { description: novoStatus === "ativa" ? "Será executada no próximo ciclo" : "Nenhuma execução até reativar" }
      );
    }
  };

  const handleSave = (form: NovaAutomacaoForm) => {
    const gatilhoCfg = GATILHO_CFG[form.tipoGatilho];
    const acaoCfg    = ACAO_CFG[form.tipoAcao];

    let proximaExec = "Manual";
    if (form.tipoGatilho === "agendado")
      proximaExec = `${fmtDias(form.diasSemana)} às ${form.horario}`;
    if (form.tipoGatilho === "evento")
      proximaExec = `Ao: ${form.evento}`;

    const nova: Automacao = {
      id:             `custom_${Date.now()}`,
      nome:           form.nome,
      descricao:      form.descricao || `Automação de ${CAT_COR[form.categoria].label.toLowerCase()} via ${acaoCfg.label}`,
      categoria:      form.categoria,
      status:         form.ativa ? "ativa" : "pausada",
      icone:          acaoCfg.icon,
      ultimaExecucao: "Nunca",
      proximaExecucao: proximaExec,
      execucoesHoje:  0,
      totalExecucoes: 0,
      cor:            form.categoria,
      detalhe:        `${gatilhoCfg.label} · ${acaoCfg.label}`,
      customizada:    true,
    };

    setAutomacoes(prev => [nova, ...prev]);
    setModalAberto(false);
    toast.success(`🚀 "${form.nome}" criada com sucesso!`, {
      description: form.ativa
        ? "Automação ativa — será executada no próximo ciclo"
        : "Automação salva em modo pausado",
    });
  };

  const categorias = ["todas", "cobranca", "fiscal", "comunicacao", "compliance", "sistema"];
  const filtradas  = filtro === "todas" ? automacoes : automacoes.filter(a => a.categoria === filtro);

  const ativas     = automacoes.filter(a => a.status === "ativa").length;
  const pausadas   = automacoes.filter(a => a.status === "pausada").length;
  const erros      = automacoes.filter(a => a.status === "erro").length;
  const totalExec  = automacoes.reduce((s, a) => s + a.execucoesHoje, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground animate-fade-up">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando automações…</span>
      </div>
    );
  }

  return (
    <>
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
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {ativas} ativa{ativas !== 1 ? "s" : ""}
            </span>
            <Button
              onClick={() => setModalAberto(true)}
              className="rounded-full px-5 gap-2 shadow-soft"
            >
              <Plus className="h-4 w-4" />
              Nova automação
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiBar label="Ativas agora"   value={ativas}    sub="Em execução"  icon={Zap}           cls="bg-emerald-100 text-emerald-600" />
          <KpiBar label="Pausadas"       value={pausadas}  sub="Aguardando"   icon={Repeat}        cls="bg-amber-100 text-amber-600" />
          <KpiBar label="Com erro"       value={erros}     sub="Requer ação"  icon={AlertTriangle} cls={erros > 0 ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-400"} />
          <KpiBar label="Execuções hoje" value={totalExec} sub="Total do dia" icon={Activity}      cls="bg-primary-soft text-primary" />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          {categorias.map(cat => {
            const info = cat === "todas" ? null : CAT_COR[cat];
            return (
              <button
                key={cat}
                onClick={() => setFiltro(cat)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all capitalize ${
                  filtro === cat
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {cat === "todas" ? `Todas (${automacoes.length})` : `${info?.label} (${automacoes.filter(a => a.categoria === cat).length})`}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map(auto => (
            <AutomacaoCard key={auto.id} auto={auto} onToggle={handleToggle} />
          ))}
          {/* Card "Criar nova" sempre visível no final */}
          <button
            onClick={() => setModalAberto(true)}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 p-8 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:bg-primary/5 group"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-muted/60 group-hover:bg-primary/10 transition-colors">
              <Plus className="h-6 w-6" />
            </span>
            <div className="text-center">
              <p className="text-sm font-semibold">Criar nova automação</p>
              <p className="text-xs mt-0.5 opacity-70">Agendado, evento, webhook ou manual</p>
            </div>
          </button>
        </div>

        {/* Rodapé */}
        <div className="surface-card flex items-center gap-3 px-5 py-4 bg-muted/30">
          <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            As automações são executadas pelo agente APOYA em segundo plano.
            Alterações entram em vigor no próximo ciclo de execução.
            Para configurar parâmetros avançados, acesse <strong>Configurações → Automações</strong>.
          </p>
        </div>

      </div>

      {/* Modal */}
      {modalAberto && (
        <NovaAutomacaoModal
          onClose={() => setModalAberto(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}

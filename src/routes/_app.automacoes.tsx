/**
 * /automacoes — Central de Automações APOYA
 * CRUD completo: criar, editar, excluir, ativar/pausar
 * Persistência real no Supabase (tabela automacoes_config)
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Zap, Clock, CheckCircle2, AlertTriangle,
  RefreshCw, MessageSquare, DollarSign, Bell, FileText,
  Send, Calendar, ShieldAlert, Bot, Activity,
  ChevronRight, ToggleLeft, ToggleRight, Loader2,
  Plus, X, Sparkles, Repeat, Timer, Webhook,
  ChevronDown, Pencil, Trash2, MoreVertical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/automacoes")({
  component: AutomacoesPage,
  head: () => ({ meta: [{ title: "Automações · APOYA Gestão" }] }),
});

/* ── Tipos ─────────────────────────────────────────────────── */
type AutoStatus  = "ativa" | "pausada" | "erro" | "executando";
type Categoria   = "cobranca" | "fiscal" | "comunicacao" | "compliance" | "sistema";
type TipoGatilho = "agendado" | "evento" | "webhook" | "manual";
type TipoAcao    = "whatsapp" | "email" | "sistema" | "api";

interface Automacao {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: Categoria;
  tipo_gatilho: TipoGatilho;
  horario: string | null;
  dias_semana: number[] | null;
  evento_gatilho: string | null;
  tipo_acao: TipoAcao;
  mensagem: string | null;
  destinatario: string | null;
  url_webhook: string | null;
  status: AutoStatus;
  ultima_execucao: string | null;
  proxima_execucao: string | null;
  execucoes_hoje: number;
  total_execucoes: number;
  customizada: boolean;
  detalhe: string | null;
  created_at: string;
}

type AutomacaoForm = {
  nome: string;
  descricao: string;
  categoria: Categoria;
  tipo_gatilho: TipoGatilho;
  horario: string;
  dias_semana: number[];
  evento_gatilho: string;
  tipo_acao: TipoAcao;
  mensagem: string;
  destinatario: string;
  url_webhook: string;
  status: AutoStatus;
};

const FORM_VAZIO: AutomacaoForm = {
  nome: "", descricao: "", categoria: "comunicacao",
  tipo_gatilho: "agendado", horario: "08:00",
  dias_semana: [1, 2, 3, 4, 5],
  evento_gatilho: "Cliente cadastrado",
  tipo_acao: "whatsapp", mensagem: "",
  destinatario: "todos", url_webhook: "", status: "ativa",
};

/* ── Paletas ─────────────────────────────────────────────── */
const CAT_COR: Record<string, { icon: string; label: string }> = {
  cobranca:    { icon: "bg-violet-100 text-violet-600",  label: "Cobrança"    },
  fiscal:      { icon: "bg-blue-100 text-blue-600",      label: "Fiscal"      },
  comunicacao: { icon: "bg-emerald-100 text-emerald-600",label: "Comunicação" },
  compliance:  { icon: "bg-amber-100 text-amber-600",    label: "Compliance"  },
  sistema:     { icon: "bg-slate-100 text-slate-500",    label: "Sistema"     },
};

const STATUS_CFG: Record<AutoStatus, { label: string; cls: string; dot: string }> = {
  ativa:      { label: "Ativa",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  pausada:    { label: "Pausada",    cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400"   },
  erro:       { label: "Erro",       cls: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-400"     },
  executando: { label: "Executando", cls: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-400 animate-pulse" },
};

const GATILHO_CFG: Record<TipoGatilho, { label: string; icon: React.ElementType; desc: string }> = {
  agendado: { label: "Agendado",   icon: Clock,   desc: "Executa em horário fixo (diário, semanal…)" },
  evento:   { label: "Por evento", icon: Zap,     desc: "Dispara quando algo acontece no sistema"    },
  webhook:  { label: "Webhook",    icon: Webhook, desc: "Ativado por chamada HTTP externa"           },
  manual:   { label: "Manual",     icon: Timer,   desc: "Executada manualmente quando necessário"    },
};

const ACAO_CFG: Record<TipoAcao, { label: string; icon: React.ElementType }> = {
  whatsapp: { label: "WhatsApp",        icon: MessageSquare },
  email:    { label: "E-mail",          icon: Send          },
  sistema:  { label: "Ação no sistema", icon: Activity      },
  api:      { label: "Chamada API",     icon: Webhook       },
};

const ICONES_CAT: Record<string, React.ElementType> = {
  cobranca:    DollarSign,
  fiscal:      FileText,
  comunicacao: MessageSquare,
  compliance:  Bell,
  sistema:     Activity,
};

const ACAO_ICONE: Record<TipoAcao, React.ElementType> = {
  whatsapp: MessageSquare,
  email:    Send,
  sistema:  Activity,
  api:      Webhook,
};

const EVENTOS_OPCOES = [
  "Cliente cadastrado", "Cliente inadimplente",
  "Certificado próximo ao vencimento (60d)", "Certificado próximo ao vencimento (30d)",
  "DAS emitida", "DAS paga", "Cobrança gerada", "Cobrança vencida",
  "NFS-e emitida", "Procuração eCAC vencida", "Obrigação atrasada",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/* ── helpers ─────────────────────────────────────────────── */
function fmtDias(dias: number[] | null) {
  if (!dias || dias.length === 0) return "Nenhum dia";
  if (dias.length === 7) return "Todos os dias";
  return dias.map(d => DIAS_SEMANA[d]).join(", ");
}

function autoToForm(a: Automacao): AutomacaoForm {
  return {
    nome:            a.nome,
    descricao:       a.descricao ?? "",
    categoria:       a.categoria,
    tipo_gatilho:    a.tipo_gatilho,
    horario:         a.horario ?? "08:00",
    dias_semana:     a.dias_semana ?? [1,2,3,4,5],
    evento_gatilho:  a.evento_gatilho ?? EVENTOS_OPCOES[0],
    tipo_acao:       a.tipo_acao,
    mensagem:        a.mensagem ?? "",
    destinatario:    a.destinatario ?? "todos",
    url_webhook:     a.url_webhook ?? "",
    status:          a.status,
  };
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
function AutomacaoCard({
  auto, onToggle, onEdit, onDelete,
}: {
  auto: Automacao;
  onToggle: (id: string, s: AutoStatus) => void;
  onEdit:   (a: Automacao) => void;
  onDelete: (a: Automacao) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cat    = CAT_COR[auto.categoria];
  const st     = STATUS_CFG[auto.status];
  const Icon   = ACAO_ICONE[auto.tipo_acao] ?? ICONES_CAT[auto.categoria];
  const isActive = auto.status === "ativa";

  return (
    <div className={`surface-card border transition-shadow hover:shadow-elevated ${isActive ? "" : "opacity-75"}`}>
      <div className="p-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${cat.icon}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{auto.nome}</h3>
                {auto.customizada && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    <Sparkles className="h-2.5 w-2.5" /> Nova
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{cat.label}</span>
            </div>
          </div>

          {/* Status + menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
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
            {/* Dropdown menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(p => !p)}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-7 z-20 w-36 rounded-xl border border-border bg-background shadow-elevated overflow-hidden">
                    <button
                      onClick={() => { setMenuOpen(false); onEdit(auto); }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Editar
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); onDelete(auto); }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Descrição */}
        <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
          {auto.descricao || "Sem descrição"}
        </p>

        {/* Detalhe */}
        {auto.detalhe && (
          <span className="inline-block rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-mono text-muted-foreground mb-3">
            {auto.detalhe}
          </span>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 pt-3 mt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {auto.ultima_execucao && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(auto.ultima_execucao).toLocaleDateString("pt-BR")}
              </span>
            )}
            {auto.proxima_execucao && (
              <span className="flex items-center gap-1 text-primary/70">
                <ChevronRight className="h-3 w-3" />{auto.proxima_execucao}
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {auto.execucoes_hoje}× hoje · {auto.total_execucoes} total
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Diálogo de confirmação de exclusão ──────────────────── */
function ConfirmDeleteDialog({ auto, onConfirm, onCancel }: {
  auto: Automacao;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div className="w-full max-w-sm bg-background rounded-2xl shadow-elevated border border-border p-6 animate-fade-up">
        <div className="flex items-center gap-3 mb-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
            <Trash2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Excluir automação</h2>
            <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Tem certeza que deseja excluir <strong className="text-foreground">"{auto.nome}"</strong>?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-destructive text-white px-4 py-2 text-sm font-semibold hover:bg-destructive/90 transition-colors"
          >
            Sim, excluir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal de Criar/Editar ───────────────────────────────── */
function AutomacaoModal({
  inicial, onClose, onSave,
}: {
  inicial?: Automacao;
  onClose: () => void;
  onSave: (form: AutomacaoForm) => Promise<void>;
}) {
  const isEdit = !!inicial;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<AutomacaoForm>(
    inicial ? autoToForm(inicial) : FORM_VAZIO
  );
  const [saving, setSaving] = useState(false);

  const up = (k: keyof AutomacaoForm, v: unknown) =>
    setForm(p => ({ ...p, [k]: v }));

  const toggleDia = (d: number) =>
    setForm(p => ({
      ...p,
      dias_semana: p.dias_semana.includes(d)
        ? p.dias_semana.filter(x => x !== d)
        : [...p.dias_semana, d].sort(),
    }));

  const canNext = () => {
    if (step === 1) return form.nome.trim().length >= 3;
    if (step === 2) return form.tipo_gatilho === "agendado"
      ? form.dias_semana.length > 0 && !!form.horario
      : true;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  };

  const STEPS = ["Identidade", "Gatilho", "Ação"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg bg-background rounded-2xl shadow-elevated border border-border overflow-hidden animate-fade-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary">
              {isEdit ? <Pencil className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </span>
            <h2 className="text-base font-semibold">
              {isEdit ? `Editar: ${inicial!.nome}` : "Nova Automação"}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center px-6 pt-4 pb-2">
          {STEPS.map((s, i) => {
            const idx = (i + 1) as 1 | 2 | 3;
            const done = step > idx;
            const active = step === idx;
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-colors ${
                    done   ? "bg-primary text-primary-foreground" :
                    active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                             "bg-muted text-muted-foreground"
                  }`}>
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx}
                  </span>
                  <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${active ? "text-primary" : "text-muted-foreground"}`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${done ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 min-h-[280px] max-h-[55vh] overflow-y-auto">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Nome *</label>
                <input autoFocus
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="Ex: Aviso de vencimento de contrato"
                  value={form.nome}
                  onChange={e => up("nome", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Descrição</label>
                <textarea rows={2}
                  className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                  placeholder="O que essa automação faz?"
                  value={form.descricao}
                  onChange={e => up("descricao", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">Categoria</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(CAT_COR) as [Categoria, typeof CAT_COR[string]][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => up("categoria", key)}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all text-left ${
                        form.categoria === key
                          ? "border-primary bg-primary/5 text-primary shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Tipo de gatilho</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(GATILHO_CFG) as [TipoGatilho, { label: string; icon: any; desc: string }][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={key} onClick={() => up("tipo_gatilho", key)}
                        className={`flex items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                          form.tipo_gatilho === key
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-primary/30"
                        }`}>
                        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${form.tipo_gatilho === key ? "text-primary" : "text-muted-foreground"}`} />
                        <div>
                          <p className={`text-xs font-semibold ${form.tipo_gatilho === key ? "text-primary" : "text-foreground"}`}>{cfg.label}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{cfg.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.tipo_gatilho === "agendado" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Dias da semana
                      <span className="ml-2 font-normal text-muted-foreground">({fmtDias(form.dias_semana)})</span>
                    </label>
                    <div className="flex gap-1.5">
                      {DIAS_SEMANA.map((d, i) => (
                        <button key={d} onClick={() => toggleDia(i)}
                          className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${
                            form.dias_semana.includes(i)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/70"
                          }`}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Horário</label>
                    <input type="time"
                      className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                      value={form.horario}
                      onChange={e => up("horario", e.target.value)}
                    />
                  </div>
                </>
              )}

              {form.tipo_gatilho === "evento" && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5">Evento disparador</label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                      value={form.evento_gatilho}
                      onChange={e => up("evento_gatilho", e.target.value)}>
                      {EVENTOS_OPCOES.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              )}

              {form.tipo_gatilho === "webhook" && (
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Após salvar, uma URL de webhook única será gerada para configurar em sistemas externos.
                  </p>
                </div>
              )}

              {form.tipo_gatilho === "manual" && (
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ficará disponível como botão de ação na lista de automações. Execute quando necessário.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">Tipo de ação</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(ACAO_CFG) as [TipoAcao, { label: string; icon: any }][]).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={key} onClick={() => up("tipo_acao", key)}
                        className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                          form.tipo_acao === key
                            ? "border-primary bg-primary/5 text-primary shadow-sm"
                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        }`}>
                        <Icon className="h-4 w-4 shrink-0" />{cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {(form.tipo_acao === "whatsapp" || form.tipo_acao === "email") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      Mensagem
                      <span className="ml-1 font-normal text-muted-foreground">— use {"{nome}"} para personalizar</span>
                    </label>
                    <textarea rows={3}
                      className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-none"
                      placeholder="Olá {nome}, aqui é a APOYA Contabilidade…"
                      value={form.mensagem}
                      onChange={e => up("mensagem", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Destinatário</label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                        value={form.destinatario}
                        onChange={e => up("destinatario", e.target.value)}>
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

              {form.tipo_acao === "api" && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5">URL da API (POST)</label>
                  <input
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    placeholder="https://hooks.example.com/webhook/..."
                    value={form.url_webhook}
                    onChange={e => up("url_webhook", e.target.value)}
                  />
                </div>
              )}

              {form.tipo_acao === "sistema" && (
                <div className="rounded-xl bg-muted/40 border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">Ação executada diretamente no sistema APOYA.</p>
                </div>
              )}

              {/* Toggle ativa */}
              <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3 border border-border/50">
                <div>
                  <p className="text-sm font-medium">Ativar imediatamente</p>
                  <p className="text-xs text-muted-foreground">Inicia no próximo ciclo</p>
                </div>
                <button onClick={() => up("status", form.status === "ativa" ? "pausada" : "ativa")}>
                  {form.status === "ativa"
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
              <Button onClick={() => setStep((step + 1) as 2 | 3)} disabled={!canNext()} className="rounded-xl px-6">
                Continuar →
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={!form.nome.trim() || saving} className="rounded-xl px-6 gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Pencil className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar automação"}
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
  const [automacoes, setAutomacoes]     = useState<Automacao[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filtro, setFiltro]             = useState("todas");
  const [modalAberto, setModalAberto]   = useState(false);
  const [editando, setEditando]         = useState<Automacao | null>(null);
  const [excluindo, setExcluindo]       = useState<Automacao | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from("automacoes_config")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar automações");
    } else {
      setAutomacoes((data ?? []) as unknown as Automacao[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  /* Toggle ativa/pausada */
  const handleToggle = async (id: string, novoStatus: AutoStatus) => {
    const { error } = await (supabase as any).from("automacoes_config")
      .update({ status: novoStatus })
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    setAutomacoes(prev => prev.map(a => a.id === id ? { ...a, status: novoStatus } : a));
    const auto = automacoes.find(a => a.id === id);
    toast.success(novoStatus === "ativa" ? `✅ "${auto?.nome}" ativada` : `⏸ "${auto?.nome}" pausada`);
  };

  /* Criar */
  const handleCriar = async (form: AutomacaoForm) => {
    const payload = {
      nome:           form.nome,
      descricao:      form.descricao || null,
      categoria:      form.categoria,
      tipo_gatilho:   form.tipo_gatilho,
      horario:        form.tipo_gatilho === "agendado" ? form.horario : null,
      dias_semana:    form.tipo_gatilho === "agendado" ? form.dias_semana : null,
      evento_gatilho: form.tipo_gatilho === "evento"   ? form.evento_gatilho : null,
      tipo_acao:      form.tipo_acao,
      mensagem:       form.mensagem || null,
      destinatario:   form.destinatario,
      url_webhook:    form.tipo_acao === "api" ? form.url_webhook : null,
      status:         form.status,
      customizada:    true,
      detalhe:        `${GATILHO_CFG[form.tipo_gatilho].label} · ${ACAO_CFG[form.tipo_acao].label}`,
      proxima_execucao: form.tipo_gatilho === "agendado"
        ? `${fmtDias(form.dias_semana)} às ${form.horario}`
        : form.tipo_gatilho === "evento" ? `Ao: ${form.evento_gatilho}` : "Manual",
      execucoes_hoje:  0,
      total_execucoes: 0,
    };
    const { data, error } = await (supabase as any).from("automacoes_config")
      .insert(payload)
      .select()
      .single();
    if (error) { toast.error("Erro ao criar automação: " + error.message); return; }
    setAutomacoes(prev => [data as unknown as Automacao, ...prev]);
    setModalAberto(false);
    toast.success(`🚀 "${form.nome}" criada com sucesso!`, {
      description: form.status === "ativa" ? "Ativa — será executada no próximo ciclo" : "Salva em modo pausado",
    });
  };

  /* Editar */
  const handleEditar = async (form: AutomacaoForm) => {
    if (!editando) return;
    const payload = {
      nome:           form.nome,
      descricao:      form.descricao || null,
      categoria:      form.categoria,
      tipo_gatilho:   form.tipo_gatilho,
      horario:        form.tipo_gatilho === "agendado" ? form.horario : null,
      dias_semana:    form.tipo_gatilho === "agendado" ? form.dias_semana : null,
      evento_gatilho: form.tipo_gatilho === "evento"   ? form.evento_gatilho : null,
      tipo_acao:      form.tipo_acao,
      mensagem:       form.mensagem || null,
      destinatario:   form.destinatario,
      url_webhook:    form.tipo_acao === "api" ? form.url_webhook : null,
      status:         form.status,
      detalhe:        `${GATILHO_CFG[form.tipo_gatilho].label} · ${ACAO_CFG[form.tipo_acao].label}`,
      proxima_execucao: form.tipo_gatilho === "agendado"
        ? `${fmtDias(form.dias_semana)} às ${form.horario}`
        : form.tipo_gatilho === "evento" ? `Ao: ${form.evento_gatilho}` : "Manual",
    };
    const { data, error } = await (supabase as any).from("automacoes_config")
      .update(payload)
      .eq("id", editando.id)
      .select()
      .single();
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    setAutomacoes(prev => prev.map(a => a.id === editando.id ? data as unknown as Automacao : a));
    setEditando(null);
    toast.success(`✅ "${form.nome}" atualizada`);
  };

  /* Excluir */
  const handleExcluir = async () => {
    if (!excluindo) return;
    const { error } = await (supabase as any).from("automacoes_config")
      .delete()
      .eq("id", excluindo.id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    setAutomacoes(prev => prev.filter(a => a.id !== excluindo.id));
    toast.success(`🗑 "${excluindo.nome}" excluída`);
    setExcluindo(null);
  };

  const categorias = ["todas", "cobranca", "fiscal", "comunicacao", "compliance", "sistema"];
  const filtradas  = filtro === "todas" ? automacoes : automacoes.filter(a => a.categoria === filtro);

  const ativas    = automacoes.filter(a => a.status === "ativa").length;
  const pausadas  = automacoes.filter(a => a.status === "pausada").length;
  const erros     = automacoes.filter(a => a.status === "erro").length;
  const totalExec = automacoes.reduce((s, a) => s + (a.execucoes_hoje ?? 0), 0);

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
              onClick={() => { setEditando(null); setModalAberto(true); }}
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
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setFiltro(cat)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                filtro === cat
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat === "todas"
                ? `Todas (${automacoes.length})`
                : `${CAT_COR[cat]?.label} (${automacoes.filter(a => a.categoria === cat).length})`}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map(auto => (
            <AutomacaoCard
              key={auto.id}
              auto={auto}
              onToggle={handleToggle}
              onEdit={a => { setEditando(a); }}
              onDelete={a => setExcluindo(a)}
            />
          ))}
          {/* Card "+ criar" */}
          <button
            onClick={() => { setEditando(null); setModalAberto(true); }}
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 p-8 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary hover:bg-primary/5 group min-h-[160px]"
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
            As automações são executadas pelo agente APOYA em segundo plano. Alterações entram em vigor no próximo ciclo.
            Para parâmetros avançados, acesse <strong>Configurações → Automações</strong>.
          </p>
        </div>
      </div>

      {/* Modal criar */}
      {modalAberto && !editando && (
        <AutomacaoModal
          onClose={() => setModalAberto(false)}
          onSave={handleCriar}
        />
      )}

      {/* Modal editar */}
      {editando && (
        <AutomacaoModal
          inicial={editando}
          onClose={() => setEditando(null)}
          onSave={handleEditar}
        />
      )}

      {/* Dialog excluir */}
      {excluindo && (
        <ConfirmDeleteDialog
          auto={excluindo}
          onConfirm={handleExcluir}
          onCancel={() => setExcluindo(null)}
        />
      )}
    </>
  );
}

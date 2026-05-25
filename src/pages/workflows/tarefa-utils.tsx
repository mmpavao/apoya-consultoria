import { TarefaPrioridade, TarefaStatus, TarefaTipo, SlaStatus } from "@/hooks/use-tarefas";

// ── Responsáveis ──────────────────────────────────────────────────────────────
export const AGENTES_IA  = ["Ana", "Sofia", "Hugo", "Carla", "Pedro", "Rafael", "Marcos", "O Contador"];
export const HUMANOS      = ["Daniel Araújo", "Marcio Pavão"];
export const TODOS_RESPONSAVEIS = [
  ...AGENTES_IA.map(n => ({ nome: n, tipo: "agente" as const })),
  ...HUMANOS.map(n  => ({ nome: n, tipo: "humano" as const })),
];

// ── Labels ────────────────────────────────────────────────────────────────────
export const STATUS_LABEL: Record<TarefaStatus, string> = {
  aberta: "Aberta", em_andamento: "Em Andamento",
  aguardando_aprovacao: "Aguard. Aprovação", aprovada: "Aprovada",
  rejeitada: "Rejeitada", concluida: "Concluída",
  cancelada: "Cancelada", bloqueada: "Bloqueada",
};

export const TIPO_LABEL: Record<TarefaTipo, string> = {
  fiscal: "Fiscal", dp: "DP", financeiro: "Financeiro",
  societario: "Societário", compliance: "Compliance",
  contabilidade: "Contabilidade", atendimento: "Atendimento",
  comercial: "Comercial", interno: "Interno",
};

export const PRIORIDADE_LABEL: Record<TarefaPrioridade, string> = {
  critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa",
};

export const PRIORIDADE_EMOJI: Record<TarefaPrioridade, string> = {
  critica: "🔴", alta: "🟠", media: "🟡", baixa: "⚪",
};

// ── Cores via CSS classes (usando design tokens do sistema) ───────────────────
export const STATUS_CSS: Record<TarefaStatus, string> = {
  aberta:               "bg-blue-100   text-blue-700   border-blue-200",
  em_andamento:         "bg-amber-100  text-amber-700  border-amber-200",
  aguardando_aprovacao: "bg-violet-100 text-violet-700 border-violet-200",
  aprovada:             "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejeitada:            "bg-red-100    text-red-700    border-red-200",
  concluida:            "bg-slate-100  text-slate-600  border-slate-200",
  cancelada:            "bg-slate-100  text-slate-500  border-slate-200",
  bloqueada:            "bg-orange-100 text-orange-700 border-orange-200",
};

export const PRIORIDADE_CSS: Record<TarefaPrioridade, string> = {
  critica: "bg-red-100    text-red-700    border-red-200",
  alta:    "bg-orange-100 text-orange-700 border-orange-200",
  media:   "bg-amber-100  text-amber-700  border-amber-200",
  baixa:   "bg-slate-100  text-slate-500  border-slate-200",
};

export const TIPO_DOT: Record<TarefaTipo, string> = {
  fiscal:        "bg-[#E8721C]",
  dp:            "bg-indigo-500",
  financeiro:    "bg-emerald-500",
  societario:    "bg-sky-500",
  compliance:    "bg-rose-500",
  contabilidade: "bg-violet-500",
  atendimento:   "bg-amber-500",
  comercial:     "bg-pink-500",
  interno:       "bg-slate-400",
};

export const SLA_CSS: Record<SlaStatus, string> = {
  no_prazo: "bg-emerald-100 text-emerald-700 border-emerald-200",
  atencao:  "bg-amber-100   text-amber-700   border-amber-200",
  atrasada: "bg-red-100     text-red-700     border-red-200",
  expirada: "bg-red-200     text-red-900     border-red-300",
};

export const SLA_ICON: Record<SlaStatus, string> = {
  no_prazo: "🟢", atencao: "🟡", atrasada: "🔴", expirada: "💀",
};

// ── Componentes de badge (sem ícone X do Dialog) ──────────────────────────────
export function BadgeStatus({ status }: { status: TarefaStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_CSS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function BadgePrioridade({ prioridade }: { prioridade: TarefaPrioridade }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${PRIORIDADE_CSS[prioridade]}`}>
      {PRIORIDADE_EMOJI[prioridade]} {PRIORIDADE_LABEL[prioridade]}
    </span>
  );
}

export function BadgeTipo({ tipo }: { tipo: TarefaTipo }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      <span className={`w-1.5 h-1.5 rounded-full ${TIPO_DOT[tipo]}`} />
      {TIPO_LABEL[tipo]}
    </span>
  );
}

export function BadgeSLA({ sla_status, data_prazo }: { sla_status?: SlaStatus; data_prazo?: string }) {
  const st = sla_status ?? "no_prazo";
  const label = data_prazo ? formatSlaCountdown(data_prazo, st) : "";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${SLA_CSS[st]}`}>
      {SLA_ICON[st]} {label}
    </span>
  );
}

export function AvatarResponsavel({ nome, tipo, size = "sm" }: { nome: string; tipo: "agente" | "humano"; size?: "sm" | "md" }) {
  const initials = nome.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const isAgent = tipo === "agente";
  const sz = size === "md" ? "w-8 h-8 text-sm" : "w-6 h-6 text-xs";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`${sz} rounded-full flex items-center justify-center font-semibold shrink-0 ${
        isAgent ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
      }`}>
        {isAgent ? "AI" : initials}
      </span>
      <span className="text-sm text-slate-700">{nome}</span>
    </span>
  );
}

// ── Formatação de datas ───────────────────────────────────────────────────────
export function formatSlaCountdown(data_prazo: string, status: SlaStatus): string {
  const now   = new Date();
  const prazo = new Date(data_prazo);
  const diffMs = Math.abs(prazo.getTime() - now.getTime());
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  const atrasada = status === "atrasada" || status === "expirada";
  const prefix   = atrasada ? "+" : "";
  return h > 0 ? `${prefix}${h}h ${m}m` : `${prefix}${m}m`;
}

export function formatDataRelativa(iso: string): string {
  const diffM = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffM < 1)  return "agora";
  if (diffM < 60) return `há ${diffM}m`;
  const h = Math.floor(diffM / 60);
  if (h < 24)     return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

export function formatData(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatDataCurta(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

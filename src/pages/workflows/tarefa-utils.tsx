import { Badge } from "@/components/ui/badge";
import { TarefaPrioridade, TarefaStatus, TarefaTipo, SlaStatus } from "@/hooks/use-tarefas";

// Listas de agentes
export const AGENTES_IA = [
  "Ana", "Sofia", "Hugo", "Carla", "Pedro", "Rafael", "Marcos", "O Contador"
];
export const HUMANOS = ["Daniel Araújo", "Marcio Pavão"];
export const TODOS_RESPONSAVEIS = [
  ...AGENTES_IA.map(n => ({ nome: n, tipo: "agente" as const })),
  ...HUMANOS.map(n => ({ nome: n, tipo: "humano" as const })),
];

// Labels
export const STATUS_LABEL: Record<TarefaStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em Andamento",
  aguardando_aprovacao: "Aguard. Aprovação",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  concluida: "Concluída",
  cancelada: "Cancelada",
  bloqueada: "Bloqueada",
};

export const TIPO_LABEL: Record<TarefaTipo, string> = {
  fiscal: "Fiscal",
  dp: "DP",
  financeiro: "Financeiro",
  societario: "Societário",
  compliance: "Compliance",
  contabilidade: "Contabilidade",
  atendimento: "Atendimento",
  comercial: "Comercial",
  interno: "Interno",
};

export const PRIORIDADE_LABEL: Record<TarefaPrioridade, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Cores
export const STATUS_COLORS: Record<TarefaStatus, string> = {
  aberta: "bg-blue-100 text-blue-700 border-blue-200",
  em_andamento: "bg-yellow-100 text-yellow-700 border-yellow-200",
  aguardando_aprovacao: "bg-purple-100 text-purple-700 border-purple-200",
  aprovada: "bg-green-100 text-green-700 border-green-200",
  rejeitada: "bg-red-100 text-red-700 border-red-200",
  concluida: "bg-gray-100 text-gray-600 border-gray-200",
  cancelada: "bg-gray-100 text-gray-500 border-gray-200",
  bloqueada: "bg-orange-100 text-orange-700 border-orange-200",
};

export const PRIORIDADE_COLORS: Record<TarefaPrioridade, string> = {
  critica: "bg-red-100 text-red-700 border-red-200",
  alta: "bg-orange-100 text-orange-700 border-orange-200",
  media: "bg-yellow-100 text-yellow-700 border-yellow-200",
  baixa: "bg-gray-100 text-gray-500 border-gray-200",
};

export const PRIORIDADE_EMOJI: Record<TarefaPrioridade, string> = {
  critica: "🔴",
  alta: "🟠",
  media: "🟡",
  baixa: "⚪",
};

export const TIPO_COLORS: Record<TarefaTipo, string> = {
  fiscal: "#E8721C",
  dp: "#6366f1",
  financeiro: "#10b981",
  societario: "#0ea5e9",
  compliance: "#f43f5e",
  contabilidade: "#8b5cf6",
  atendimento: "#f59e0b",
  comercial: "#ec4899",
  interno: "#6b7280",
};

export const SLA_COLORS: Record<SlaStatus, string> = {
  no_prazo: "bg-green-100 text-green-700",
  atencao: "bg-yellow-100 text-yellow-700",
  atrasada: "bg-red-100 text-red-700",
  expirada: "bg-red-200 text-red-900",
};

export const SLA_EMOJI: Record<SlaStatus, string> = {
  no_prazo: "🟢",
  atencao: "🟡",
  atrasada: "🔴",
  expirada: "💀",
};

// Badges
export function BadgeStatus({ status }: { status: TarefaStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function BadgePrioridade({ prioridade }: { prioridade: TarefaPrioridade }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORIDADE_COLORS[prioridade]}`}>
      {PRIORIDADE_EMOJI[prioridade]} {PRIORIDADE_LABEL[prioridade]}
    </span>
  );
}

export function BadgeSLA({ sla_status, data_prazo }: { sla_status?: SlaStatus; data_prazo?: string }) {
  const status = sla_status ?? "no_prazo";
  const label = data_prazo ? formatSlaCountdown(data_prazo, status) : STATUS_LABEL[status as TarefaStatus];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${SLA_COLORS[status]}`}>
      {SLA_EMOJI[status]} {label}
    </span>
  );
}

export function BadgeTipo({ tipo }: { tipo: TarefaTipo }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
      {TIPO_LABEL[tipo]}
    </span>
  );
}

export function AvatarResponsavel({ nome, tipo }: { nome: string; tipo: "agente" | "humano" }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span>{tipo === "agente" ? "🤖" : "👤"}</span>
      <span>{nome}</span>
    </span>
  );
}

function formatSlaCountdown(data_prazo: string, status: SlaStatus): string {
  const now = new Date();
  const prazo = new Date(data_prazo);
  const diffMs = Math.abs(prazo.getTime() - now.getTime());
  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (status === "atrasada" || status === "expirada") {
    return h > 0 ? `Atrasada ${h}h${m}m` : `Atrasada ${m}m`;
  }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDataRelativa(iso: string): string {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  const diffM = Math.floor(diffMs / (1000 * 60));
  if (diffM < 1) return "agora";
  if (diffM < 60) return `há ${diffM}m`;
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `há ${diffD}d`;
}

export function formatData(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Versão do sistema APOYA CONTABILIDADE.
 * CARIMBADO AUTOMATICAMENTE no build/deploy (CI injeta VITE_APP_VERSION da tag
 * e VITE_APP_BUILD_TS do momento do deploy). Fallback p/ build local.
 */
const env = (import.meta as any).env ?? {};
export const APP_VERSION    = (env.VITE_APP_VERSION as string) || "3.3.0";
export const APP_BUILD_TS   = (env.VITE_APP_BUILD_TS as string) || "2026-06-15T00:00:00";
export const APP_BUILD_DATE = APP_BUILD_TS.slice(0, 10);
export const APP_SPRINT     = "Time multi-agente vivo + Societário unificado";

/** "15/06 23:45" — versão curta data/hora p/ o rodapé */
export function buildStamp(): string {
  const d = new Date(APP_BUILD_TS);
  if (isNaN(d.getTime())) return APP_BUILD_DATE;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export const VERSION_HISTORY = [
  {
    version: "2.0.0",
    date: "2026-06-12",
    sha: "edd625c",
    sprint: "Sprint B — Interação Humana",
    changes: [
      "feat(pipeline): botão '+ Nova Tarefa' em cada coluna com dialog completo",
      "feat(pipeline): criação salva em tarefas (setor+etapa_pipeline)",
      "feat(financeiro): régua de cobrança com modal real — 4 disparos configuráveis",
      "feat(financeiro): automações com formulário de criação + persistência banco",
      "feat(financeiro): aba Config com toggles reais e seção régua inline",
      "fix(fiscal): defaultValue corrigido para 'dashboard'",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-06-12",
    sha: "4400871",
    sprint: "Sprint A — Padronização módulos",
    changes: [
      "feat: sidebar reorganizada com grupos (VISÃO GERAL, CLIENTES, DEPARTAMENTOS, FERRAMENTAS, SISTEMA)",
      "feat: QuickSearch Cmd+K — busca live de clientes",
      "feat: ModuleDashboard + ModuleDocumentosTab reutilizáveis",
      "feat: 4 módulos padronizados (DP, Contábil, Financeiro, Societário)",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-12",
    sha: "411b642",
    sprint: "Sprint 1 — Agentes Autônomos",
    changes: [
      "Orquestrador Central — 3 agentes em paralelo (Promise.all)",
      "Agente Fiscal MVP — 57 obrigações monitoradas",
      "Agente RH/DP MVP + Financeiro MVP",
      "Dashboard com métricas reais (SHA 68e35e9)",
      "PRD v1.0 (docs/PRD.md — 312 linhas)",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-06-12",
    sha: "9f9a05f",
    sprint: "Sprint Fix — Segurança",
    changes: [
      "12 bugs de segurança corrigidos",
      "151 policies RLS ativas",
      "23 migrations aplicadas",
    ],
  },
];

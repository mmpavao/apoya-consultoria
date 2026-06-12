/**
 * Versão do sistema APOYA CONTABILIDADE
 * Atualizado automaticamente pelo DEV APOYA a cada deploy.
 */
export const APP_VERSION    = "1.8.0";
export const APP_BUILD_DATE = "2026-06-12";
export const APP_BUILD_TS   = "2026-06-12T20:30:00-03:00";
export const APP_SPRINT     = "v1.8.0 — SPRINT-A · Sidebar + QuickSearch";

export const VERSION_HISTORY = [
  {
    version: "1.8.0",
    date: "2026-06-12",
    sha: "pending",
    sprint: "Sprint 2 — Cron + Módulos",
    changes: [
      "feat: edge function agente-cron — execução paralela Fiscal+RH+Financeiro",
      "feat: automação diária 08:00 BRT — cron dos agentes autônomos",
      "feat: Dashboard — seção Histórico de Execuções com dados do banco",
      "feat(dp): 7 abas funcionais — Folha, Férias, eSocial, Automações, Config",
      "feat(contabil): 6 abas — Períodos, Lançamentos, Plano de Contas CFC",
      "feat(societario): Automações + Config com portais integrados",
      "feat(financeiro): Shadcn Tabs — 6 abas funcionais",
      "feat(fiscal): Dashboard com KPIs + timeline de obrigações",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-06-12",
    sha: "1109aba",
    sprint: "Sprint UX — Módulos",
    changes: [
      "feat(dp): abas Folha, Férias, eSocial, Automações, Config",
      "feat(contabil): abas Períodos, Lançamentos, Plano de Contas",
      "feat(societario): Automações + Config com portais",
      "feat(financeiro): migração para Shadcn Tabs",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-06-12",
    sha: "03ae1d0",
    sprint: "Sprint UX — Fiscal",
    changes: [
      "feat(fiscal): Dashboard tab com KPIs + timeline",
      "fix(fiscal): max-w removido em Configurações",
    ],
  },
  {
    version: "1.3.2",
    date: "2026-06-12",
    sha: "897fd03",
    sprint: "Hotfix",
    changes: [
      "fix(pipeline): fallback APOYA_SERVICE_TOKEN",
      "fix(server): env injection no CF Worker",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-06-12",
    sha: "a01fb0b",
    sprint: "Hotfix MCP token",
    changes: [
      "fix: APOYA_SERVICE_TOKEN configurado no Worker",
      "feat: aba Sistema em Configurações",
      "feat: src/lib/version.ts criado",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-12",
    sha: "411b642",
    sprint: "Sprint 1",
    changes: [
      "Orquestrador Central — 3 agentes em paralelo",
      "Agente Fiscal MVP — 57 obrigações monitoradas",
      "Agente RH/DP MVP + Financeiro MVP",
      "Dashboard com métricas reais",
      "PRD v1.0",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-06-12",
    sha: "9f9a05f",
    sprint: "Sprint Fix",
    changes: [
      "12 bugs de segurança corrigidos",
      "151 policies RLS ativas",
    ],
  },
];

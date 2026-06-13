/**
 * Versão do sistema APOYA CONTABILIDADE
 * Atualizado automaticamente pelo DEV APOYA a cada deploy.
 */
export const APP_VERSION    = "2.0.0";
export const APP_BUILD_DATE = "2026-06-12";
export const APP_BUILD_TS   = "2026-06-12T21:14:00-03:00";
export const APP_SPRINT     = "v2.0.0 — Sprint B: Pipeline humano + Régua + Automações";

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

/**
 * Versão do sistema APOYA CONTABILIDADE
 * Atualizado automaticamente pelo DEV APOYA a cada deploy.
 */
export const APP_VERSION = "1.1.0";
export const APP_BUILD_DATE = "2026-06-12";
export const APP_BUILD_TS   = "2026-06-12T14:20:00-03:00";
export const APP_SPRINT     = "Sprint 1 — Fundação dos Agentes";

export const VERSION_HISTORY = [
  {
    version: "1.1.0",
    date: "2026-06-12",
    sha: "411b642",
    sprint: "Sprint 1",
    changes: [
      "Orquestrador Central — 3 agentes em paralelo",
      "Agente Fiscal MVP — 57 obrigações monitoradas",
      "Agente RH/DP MVP — folhas + férias",
      "Agente Financeiro MVP — cobranças + NFS-e",
      "Dashboard com métricas reais",
      "DP/Contábil — empty states com instrução",
      "PRD v1.0 (docs/PRD.md)",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-06-12",
    sha: "9f9a05f",
    sprint: "Sprint Fix",
    changes: [
      "12 bugs de segurança corrigidos (FIX-001 a 012)",
      "151 policies RLS ativas",
      "Módulo /workflows implementado",
      "Auth: HIBP + senha mínima",
      "Redirect canônico workers.dev → zapro.tech",
    ],
  },
];

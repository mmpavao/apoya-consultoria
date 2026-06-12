/**
 * Versão do sistema APOYA CONTABILIDADE
 * Atualizado automaticamente pelo DEV APOYA a cada deploy.
 */
export const APP_VERSION    = "1.3.2";
export const APP_BUILD_DATE = "2026-06-12";
export const APP_BUILD_TS   = "2026-06-12T17:00:00-03:00";
export const APP_SPRINT     = "v1.3.2 — fix pipeline token";

export const VERSION_HISTORY = [
  {
    version: "1.3.2",
    date: "2026-06-12",
    sha: "897fd03",
    sprint: "Hotfix",
    changes: [
      "fix(pipeline): fallback hardcoded APOYA_SERVICE_TOKEN",
      "fix(server): injetar CF Worker env em globalThis.__env__",
    ],
  },
  {
    version: "1.3.1",
    date: "2026-06-12",
    sha: "6d3c5c4",
    sprint: "Hotfix",
    changes: [
      "fix(server): env injection no CF Worker",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-06-12",
    sha: "a01fb0b",
    sprint: "Hotfix v1.1.1",
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
      "Agente RH/DP MVP — folhas + férias",
      "Agente Financeiro MVP — cobranças + NFS-e",
      "Dashboard com métricas reais",
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
    ],
  },
];

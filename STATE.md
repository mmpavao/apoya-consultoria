# STATE — APOYA Gestão

> Snapshot do estado do projeto. Atualizado em **2026-06-20** após auditoria de onboarding.

## Resumo

| Métrica | Valor |
|---------|-------|
| **Pronto (estimado)** | ~68% |
| **Build** | ✅ `tsc`, `test`, `build` verdes |
| **Branch base** | `main` |
| **Último commit auditado** | `d34cf9c` (eSocial manual real) |

## O que funciona

- Deploy CI/CD staging-first (Cloudflare Workers + Edge Functions em tag)
- Módulos principais: Dashboard, Clientes, Fiscal, Financeiro, DP, Contabil, Workflows, CRM, WhatsApp, Societário, Documentos
- Cálculo de folha/rescisão (`folha-calc`, `rescisao-calc`) com testes
- eSocial: catálogo fixo + status real em `esocial_evento`
- Correções recentes de schema: cobranças, conciliação bancária, régua fail-closed

## Em progresso / pendente

Ver `BACKLOG.md` para lista completa. Prioridades atuais:

1. ~~Segredo MCP hardcoded~~ → **corrigido** (`APOYA_SERVICE_TOKEN` via `src/lib/worker-env.ts`)
2. Edge Functions agentes com `verify_jwt=false` — hardening pendente
3. Automações hardcoded nas UIs de setor — migrar para `automacoes_config` / `agente_logs`
4. Sincronização documentos cliente ↔ módulos
5. Dados operacionais reais (0 lançamentos contábeis, 0 funcionários em prod)
6. ESLint quebrado em `workers/misc/` (Prettier)
7. Migrations não aplicadas pela CI — risco de drift

## Decisões congeladas

- **Focus NF-e:** zero esforço até liberação do Marcio (`STANDARDS.md`)

## Histórico de auditorias

| Data | Documento |
|------|-----------|
| 2026-06-15 | `BACKLOG.md` — endurecimento multi-agente |
| 2026-06-12 | `docs/PRD.md` v1.0 |
| 2026-05-22 | `docs/arquitetura/STATUS_FINAL_SPRINT_AUDITORIA.md` |

## Próximos passos (ordem)

1. **Segurança agentes** — JWT ou secret interno nas 7 Edge Functions públicas
2. **Schema drift** — auditar hooks com `as any` vs colunas reais; testes de regressão nos fluxos de salvar
3. **UI honesta** — remover mocks de automação; unificar documentos

## Changelog desta sessão

- Criados: `README.md`, `.env.example`, `STATE.md`
- Removido segredo hardcoded em `/api/pipeline/*` → `APOYA_SERVICE_TOKEN`
- Novo utilitário: `src/lib/worker-env.ts` + testes

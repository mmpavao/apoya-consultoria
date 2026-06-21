# STATE — APOYA Gestão

> Snapshot do estado do projeto. Atualizado em **2026-06-20** — pronto para deploy produção.

## Resumo

| Métrica | Valor |
|---------|-------|
| **Pronto (estimado)** | ~75% |
| **Build** | ✅ `tsc`, `test`, `build` verdes |
| **Branch deploy** | `cursor/security-env-onboarding-d50a` → merge `main` → tag `v*.*.*` |
| **Checklist DevOps** | `docs/DEPLOY_PRODUCAO.md` |

## O que funciona

- Deploy CI/CD staging-first (Cloudflare Workers + Edge Functions em tag)
- Módulos principais operacionais (Clientes, Fiscal, Financeiro, DP, Contabil, Workflows, CRM, WhatsApp)
- Cálculo folha/rescisão com testes (`folha-calc`, `rescisao-calc`)
- eSocial real (`esocial_evento`), conciliação bancária (`data_linha`), régua fail-closed
- Pipeline MCP via `APOYA_SERVICE_TOKEN` (sem segredo hardcoded)
- Documentos unificados: bucket canônico `documentos-clientes` (cliente ↔ módulos)
- Webhook Asaas idempotente (re-entrega não re-dispara NFS-e)
- Agentes fail-closed (`AGENTS_GATE_SECRET` + cron Vault)

## Pendências pós-produção (não bloqueiam deploy)

- Automações hardcoded nas UIs de setor → migrar para `automacoes_config`
- Dados operacionais reais (lançamentos, funcionários em prod)
- ESLint quebrado em `workers/misc/` (Prettier)
- Focus NF-e congelado (decisão de produto)
- Cobertura de testes ainda baixa (libs puras)

## Changelog desta sessão

### Sessão 1 — Onboarding + segurança MCP
- `README.md`, `.env.example`, `STATE.md`
- `src/lib/worker-env.ts` — secrets fail-closed
- Removido API key hardcoded em `/api/pipeline/*`

### Sessão 2 — Pronto para produção
- Orquestrador + `requireAuth` fail-closed (cron Vault via RPC)
- Webhook Asaas idempotente + setup-webhook upsert `integracao_config`
- Documentos: bucket unificado `documentos-clientes`
- `docs/DEPLOY_PRODUCAO.md` — checklist completo DevOps
- CI: `WORKER_BASE_URL` + sync `AGENTS_GATE_SECRET` → Supabase

## Deploy — comando DevOps

```bash
# 1. Merge PR → main (staging automático)
# 2. Validar staging
# 3. Tag produção:
git tag v1.4.0 && git push origin v1.4.0
```

Ver `docs/DEPLOY_PRODUCAO.md` para checklist completo.

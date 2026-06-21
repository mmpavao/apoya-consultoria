# Checklist de Deploy — Produção APOYA Gestão

> Para o agente DevOps. Siga **nesta ordem**. Não pule gates.

## Pré-requisitos

- Acesso GitHub Actions (secrets configurados)
- Acesso Cloudflare Workers (`apoya-gestao`, `apoya-mcp`)
- Acesso Supabase project `ajaqbdsalxfgrwpjbtbn`
- Supabase CLI autenticado (`SUPABASE_ACCESS_TOKEN`)

---

## 1. Gates locais (obrigatório antes do merge)

```bash
npm ci
npx tsc --noEmit    # 0 erros
npm test            # todos verdes
npm run build       # dist/client + dist/server
```

---

## 2. Secrets GitHub Actions

Confirmar que **todos** existem em Settings → Secrets → Actions:

| Secret | Onde usa |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | Deploy Workers |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy Workers |
| `VITE_SUPABASE_URL` | Build Vite + runtime |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build Vite + runtime |
| `SUPABASE_URL` | Runtime Worker |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime Worker + Edge |
| `SUPABASE_ACCESS_TOKEN` | Deploy Edge Functions |
| `APOYA_SERVICE_TOKEN` | MCP + webhooks internos |
| `APOYA_INTERNAL_SECRET` | Chamadas internas |
| `AGENTS_GATE_SECRET` | Auth dos agentes (Edge Functions) |
| `ASAAS_API_KEY` | Cobrança |
| `FOCUSNFE_API_TOKEN` | NFS-e |
| `EVOLUTION_API_KEY` / `EVOLUTION_API_URL` | WhatsApp |
| `PLUGGY_CLIENT_ID` / `SECRET` / `WEBHOOK_SECRET` | Open Finance |

---

## 3. Secrets Supabase Edge Functions

Após deploy das functions, confirmar secrets no Supabase Dashboard  
(Project Settings → Edge Functions → Secrets) **ou** via CLI:

```bash
supabase secrets set \
  AGENTS_GATE_SECRET="<mesmo valor do GitHub AGENTS_GATE_SECRET>" \
  --project-ref ajaqbdsalxfgrwpjbtbn
```

**Crítico:** sem `AGENTS_GATE_SECRET`, agentes retornam 401 (fail-closed).

Migration `20260619_032_cron_orquestrador_auth.sql` deve estar aplicada  
(cron diário autentica via Vault + `verify_cron_secret` RPC).

---

## 4. Secrets Cloudflare Worker (`apoya-gestao`)

Injetados automaticamente pelo CI em cada deploy. Confirmar manualmente se necessário:

```bash
npx wrangler secret list --name apoya-gestao
```

Obrigatórios: `SUPABASE_SERVICE_ROLE_KEY`, `APOYA_SERVICE_TOKEN`, `ASAAS_API_KEY`, etc.  
Ver `.env.example` para lista completa.

Opcional: `WORKER_BASE_URL=https://apoyaproject.zapro.tech` (webhooks Asaas).

---

## 5. Fluxo de deploy

### Staging (automático)

```bash
git push origin main
```

- Deploy: `apoya-gestao-staging` + `apoya-mcp-staging`
- Smoke test HTTP 200
- **Não** deploya Edge Functions

### Produção (tag semântica)

```bash
git tag v1.4.0
git push origin v1.4.0
```

- Deploy: `apoya-gestao` + `apoya-mcp`
- Deploy **todas** as Edge Functions (job falha se qualquer uma falhar)
- Smoke tests

### Manual (workflow_dispatch)

GitHub Actions → Deploy → escolher `staging` ou `production`.

---

## 6. Pós-deploy — verificação

| Check | URL / Comando | Esperado |
|-------|---------------|----------|
| App carrega | https://apoyaproject.zapro.tech | HTTP 200, login OK |
| MCP health | https://apoya-mcp.talkzzbot.workers.dev/health | `tools=85` |
| Agente fiscal | POST `/functions/v1/agente-fiscal` com JWT ou gate secret | `{ success: true }` |
| Pipeline | GET `/api/pipeline?setor=fiscal` autenticado | Kanban JSON |
| Cron orquestrador | Supabase → Database → Cron Jobs | `apoya-orquestrador-diario` ativo |

---

## 7. Migrations pendentes

A CI **não aplica** migrations automaticamente. Antes de produção:

1. Conferir `supabase/migrations/` vs banco remoto
2. Aplicar pendentes via Supabase SQL Editor ou `supabase db push`
3. Validar colunas críticas via REST:

```bash
curl "https://ajaqbdsalxfgrwpjbtbn.supabase.co/rest/v1/cobrancas?select=id,status,nfse_status&limit=1" \
  -H "apikey: $ANON_KEY"
```

---

## 8. Rollback

```bash
# Reverter Worker para deploy anterior
npx wrangler rollback --name apoya-gestao

# Reverter código
git revert <commit>
git tag v1.3.1
git push origin v1.3.1
```

---

## 9. Incidentes conhecidos

| Incidente | Causa | Prevenção |
|-----------|-------|-----------|
| Boot crash 2026-06-11 | `VITE_*` ausentes no build | CI injeta no step Build |
| Agentes 401 | `AGENTS_GATE_SECRET` ausente | Checklist §3 |
| Webhook Asaas re-NFS-e | Re-entrega duplicada | Idempotência em `webhook.ts` (status=paga) |
| MCP pipeline 502 | `APOYA_SERVICE_TOKEN` ausente | Secret no Worker |

---

## 10. Contatos / refs

- Repo: https://github.com/mmpavao/apoya-consultoria
- PRD: `docs/PRD.md`
- Padrões: `STANDARDS.md`
- Estado: `STATE.md`

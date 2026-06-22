# Checklist de Deploy — APOYA Gestão (modo manual)

> Sistema **100% manual** — worker `apoya-gestao` + Supabase. Edge function: só `send-invite`.

## 1. Gates locais (obrigatório)

```bash
npm ci
npx tsc --noEmit
npm test
npm run build
deno check supabase/functions/send-invite/index.ts   # edge function
```

## 2. Secrets GitHub Actions

| Secret | Uso |
|--------|-----|
| `CLOUDFLARE_API_TOKEN` | Deploy Worker |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy Worker |
| `VITE_SUPABASE_URL` | Build Vite |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build Vite |
| `SUPABASE_URL` | Runtime Worker |
| `SUPABASE_SERVICE_ROLE_KEY` | Runtime Worker + send-invite |
| `SUPABASE_ACCESS_TOKEN` | CLI — deploy send-invite em prod |

Integrações (Asaas, Evolution, etc.) **não são necessárias** no pivô manual.

## 3. Fluxo

```bash
git push origin main          # → apoya-gestao-staging
# validar staging
git tag v3.37.0
git push origin v3.37.0       # → apoya-gestao + send-invite
gh run watch
```

## 4. Pós-deploy

| Check | URL | Esperado |
|-------|-----|----------|
| App | https://apoyaproject.zapro.tech | Login OK |
| Staging | https://apoya-gestao-staging.talkzzbot.workers.dev | HTTP 200 |

## 5. Migrations

Aplicadas **out-of-band** pelo agente ARQUITETO (Base44). CI não aplica migrations.

## 6. Rollback

```bash
npx wrangler rollback --name apoya-gestao
git revert <commit> && git tag v3.37.1 && git push origin v3.37.1
```

# APOYA Gestão

Software de contabilidade para escritórios (~8 clientes). **Modo manual:** operadores registram tudo direto no Supabase via CRUD — sem integrações externas ativas.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, TanStack Router/Start, Tailwind v4, shadcn/ui |
| Backend | Supabase PostgreSQL + Auth + Storage + RLS |
| Edge Function | Apenas `send-invite` (convite interno de usuário) |
| Deploy | Cloudflare Worker `apoya-gestao` |
| CI/CD | GitHub Actions — `main` → staging, tag `v*.*.*` → produção |

## URLs

- **Produção:** https://apoyaproject.zapro.tech
- **Staging:** https://apoya-gestao-staging.talkzzbot.workers.dev
- **Supabase:** `ajaqbdsalxfgrwpjbtbn`

## Setup local

```bash
cp .env.example .env.local
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY

npm install
npm run dev
```

## Gates antes de deploy

```bash
npx tsc --noEmit
npm test
npm run build
```

Ver `STANDARDS.md` para Definition of Done.

## Deploy

1. Push `main` → staging (automático)
2. Validar staging
3. Tag `v3.x.y` → produção

```bash
git tag v3.44.0 && git push origin v3.44.0
```

Detalhes: `docs/DEPLOY_PRODUCAO.md`

## Módulos (manual)

Clientes · Fiscal · Contábil · DP · Financeiro · Societário · Documentos · Workflows/Kanban

Contato WhatsApp: link `wa.me` a partir do cadastro do cliente (sem Evolution API).

## Documentação

- `STATE.md` — estado atual e regras do pivô manual
- `STANDARDS.md` — padrões de qualidade
- `BACKLOG.md` — bugs pendentes (fluxo manual)

## Repositório

https://github.com/mmpavao/apoya-consultoria

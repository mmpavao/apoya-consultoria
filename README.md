# APOYA Gestão

Sistema multi-agentes de gestão para escritórios contábeis — clientes, fiscal, DP, financeiro, workflows e integrações (Asaas, NFS-e, WhatsApp, Pluggy, ClickSign, SERPRO).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | React 19, TanStack Router/Start, Tailwind v4, shadcn/ui |
| Backend | Supabase PostgreSQL + 15 Edge Functions (Deno) |
| Deploy | Cloudflare Workers (`apoya-gestao` + `apoya-mcp`) |
| CI/CD | GitHub Actions — `main` → staging, tag `v*.*.*` → produção |

## URLs

- **Produção:** https://apoyaproject.zapro.tech
- **Worker (fallback):** https://apoya-gestao.talkzzbot.workers.dev
- **MCP:** https://apoya-mcp.talkzzbot.workers.dev
- **Supabase:** `ajaqbdsalxfgrwpjbtbn`

## Setup local

```bash
cp .env.example .env.local
# Preencha VITE_SUPABASE_* e secrets server-side

npm install
npm run dev          # http://localhost:5173
```

## Gates antes de deploy

```bash
npx tsc --noEmit
npm test
npm run build
```

Ver `STANDARDS.md` para Definition of Done completa.

## Deploy

**Automático (recomendado):** push em `main` → staging. Tag semântica `v1.2.3` → produção.

**Manual:**

```bash
npm run build
./deploy.sh
```

Detalhes em `DEPLOY.md` e `.github/workflows/deploy.yml`.

## Estrutura

```
src/routes/          Rotas UI + API (/api/*)
src/hooks/           Data fetching Supabase
src/components/      UI por domínio
supabase/migrations/ Schema SQL versionado
supabase/functions/  Edge Functions (agentes)
workers/apoya-mcp/   Worker MCP (85 tools)
docs/PRD.md          Product Requirements Document
BACKLOG.md           Bugs/endurecimento pendentes
STATE.md             Estado atual do projeto
```

## Documentação

- `docs/PRD.md` — visão de produto e módulos
- `STANDARDS.md` — regras de qualidade (nunca fabricar dado, erro ≠ zero)
- `BACKLOG.md` — auditoria de bugs por tema/prioridade
- `STATE.md` — snapshot do estado e próximos passos

## Repositório

https://github.com/mmpavao/apoya-consultoria

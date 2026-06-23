# STATE — APOYA Gestão

> Atualizado: **2026-06-22** · Pivô **100% manual** · **v3.53.0** em prod · **Backlog Phase 2 encerrado**

## Status do repositório

| Item | Estado |
|------|--------|
| Branch ativa | `main` |
| PRs abertas | **1** (PR #3 legado SERPRO — fechar manualmente no GitHub) |
| Versão prod | **v3.53.0** |
| Modo | 100% manual — CRUD Supabase |
| Backlog Phase 2 | **Encerrado** — ver `BACKLOG.md` |

## Decisão vigente

**Zero integrações/agentes ativos.** Operadores humanos fazem o trabalho e registram no sistema via CRUD Supabase. APIs voltam depois, uma de cada vez, sob coordenação do Marcio.

## Stack

TanStack Start (React 19) → Cloudflare Worker `apoya-gestao` + Supabase `ajaqbdsalxfgrwpjbtbn`.

## O que foi removido (não recriar)

- Agentes (`agente-*`), cron, MCP, `/api/pipeline/*`
- UI/código de agentes IA — v3.44.0
- SERPRO, NFS-e/Focus, Asaas, Pluggy, WhatsApp/Evolution, Clicksign-send
- Rotas: `/whatsapp`, `/automacoes`, `/fiscal/nfse`, `/fiscal/serpro`
- Edge functions: só **`send-invite`** permanece
- Dead code layout: `ModuleHeader`, `ModuleNav` — v3.50.0

## O que funciona (manual)

| Módulo | Como |
|--------|------|
| Clientes | CRUD + abas (CNPJ digitado, wa.me) |
| Fiscal | DAS, obrigações, documentos manuais |
| Financeiro | Cobrança criar/editar/baixa; régua só configura |
| DP | Folha calculada (`folha-calc`), férias, rescisão (`rescisao-calc`), eSocial manual |
| Contábil | Lançamentos, plano, conciliação |
| Contratos | Templates com placeholders substituídos; status manual |
| Kanban | `update tarefas.etapa_pipeline` direto no Supabase |
| Documentos | Bucket `documentos-clientes` |
| Workflows | Responsáveis = usuários reais do banco |

## Regras de deploy

```
npx tsc --noEmit && npm test && npm run build
→ push main (staging) → validar → tag v3.x.y (produção)
```

- Migrations: agente ARQUITETO (Base44), **não** CI
- Edge functions: só em tag prod + `deno check`
- Versão atual: **v3.53.0** (prod)

## Gates locais

✅ `tsc` · ✅ `test` · ✅ `build`

## Changelog recente

- **v3.50.0**: contratos — placeholders substituídos; copy assinatura manual; cleanup regime UI + dead code; backlog encerrado
- **v3.49.0**: KPIs/erros explícitos (fiscal, financeiro, contábil, societário); configs e eSocial honestos
- **v3.48.0**: Registrar DAS na apuração; erros explícitos obrigações/cliente; copy honesta modo manual
- **v3.47.0**: documentos módulo ↔ cliente unificados (`ModuleDocumentosTab` por `cliente_id`)
- **v3.46.0**: auth fail-closed centralizado (`api-auth.ts`) em todas as rotas `/api/*` restantes
- **v3.45.0**: plano_contas insert com `natureza`; hooks contábeis expõem erro
- **v3.44.0**: remoção resíduos agentes IA na UI; backlog P1 manual

## Pendências externas

- Migration `cobrancas.created_by` / `observacoes` — quando necessário, via ARQUITETO
- Fechar PR #3 (SERPRO legado) no GitHub

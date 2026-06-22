# STATE — APOYA Gestão

> Atualizado: **2026-06-22** · Pivô **100% manual** (decisão Marcio) · **v3.45.0** em prod

## Status do repositório

| Item | Estado |
|------|--------|
| Branch ativa | `main` |
| PRs abertas | **1** (PR #3 legado SERPRO — fechar manualmente no GitHub) |
| Versão prod | **v3.45.0** |
| Modo | 100% manual — CRUD Supabase |
| Próximo foco | Backlog Tema 4 (segurança régua) e schema P0 restante — ver `BACKLOG.md` |

## Decisão vigente

**Zero integrações/agentes ativos.** Operadores humanos fazem o trabalho e registram no sistema via CRUD Supabase. APIs voltam depois, uma de cada vez, sob coordenação do Marcio.

## Stack

TanStack Start (React 19) → Cloudflare Worker `apoya-gestao` + Supabase `ajaqbdsalxfgrwpjbtbn`.

## O que foi removido (não recriar)

- Agentes (`agente-*`), cron, MCP, `/api/pipeline/*`
- UI/código de agentes IA (cadastro, Ana/Sofia/Hugo nos workflows) — v3.44.0
- SERPRO, NFS-e/Focus, Asaas, Pluggy, WhatsApp/Evolution, Clicksign-send
- Rotas: `/whatsapp`, `/automacoes`, `/fiscal/nfse`, `/fiscal/serpro`
- Edge functions: só **`send-invite`** permanece

## O que funciona (manual)

| Módulo | Como |
|--------|------|
| Clientes | CRUD + abas (CNPJ digitado, wa.me) |
| Fiscal | DAS, obrigações, documentos manuais |
| Financeiro | Cobrança criar/editar/baixa; régua só configura |
| DP | Folha (`folha_linha`), férias, rescisão, eSocial manual |
| Contábil | Lançamentos, plano, conciliação |
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
- Versão atual: **v3.45.0** (prod)

## Gates locais

✅ `tsc` · ✅ `test` (33) · ✅ `build`

## Changelog recente

- **v3.45.0**: plano_contas insert com `natureza`; hooks contábeis expõem erro
- **v3.44.0**: remoção resíduos agentes IA na UI; backlog P1 manual (contábil, erros UI, config honesta, folha DP)
- v3.43.0: cleanup pós-pivô — DAS/fiscal 100% manual; dead code whatsapp/evolution
- Pivô L1–L3: remoção agentes + integrações

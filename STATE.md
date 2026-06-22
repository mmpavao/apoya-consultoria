# STATE — APOYA Gestão

> Atualizado: **2026-06-20** · Pivô **100% manual** (decisão Marcio)

## Decisão vigente

**Zero integrações/agentes ativos.** Operadores humanos fazem o trabalho e registram no sistema via CRUD Supabase. APIs voltam depois, uma de cada vez, sob coordenação do Marcio.

## Stack

TanStack Start (React 19) → Cloudflare Worker `apoya-gestao` + Supabase `ajaqbdsalxfgrwpjbtbn`.

## O que foi removido (não recriar)

- Agentes (`agente-*`), cron, MCP, `/api/pipeline/*`
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

## Regras de deploy

```
npx tsc --noEmit && npm test && npm run build
→ push main (staging) → validar → tag v3.x.y (produção)
```

- Migrations: agente ARQUITETO (Base44), **não** CI
- Edge functions: só em tag prod + `deno check`
- Versão atual: **v3.43.0** (prod — cleanup pós-pivô manual)

## Gates locais

✅ `tsc` · ✅ `test` (33) · ✅ `build`

## Changelog recente

- Pivô L1–L3: remoção agentes + integrações
- Cleanup: dashboard sem chamadas a edge functions removidas; docs alinhados
- Cleanup L4: DAS/fiscal 100% manual (sem SERPRO/WA API); dead code whatsapp/evolution removido

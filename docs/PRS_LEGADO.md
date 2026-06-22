# PRs legado — fechamento pós-pivô

> Atualizado: 2026-06-22 · após tag **v3.44.0**

## Situação

| PR | Título | Status | Ação |
|----|--------|--------|------|
| #7 | remover resíduos agentes IA (modo manual) | **MERGED** | — |
| #6 | backlog P1 — contábil, erros UI, config honesta | **MERGED** | — |
| #5 | cleanup pós-pivô — DAS manual | **MERGED** | — |
| #4 | security MCP + docs onboarding | **MERGED** | — |
| #3 | SEC-001 token SERPRO → env var | **ABERTA (obsoleta)** | Fechar no GitHub |

## PR #3 — por que fechar

- Branch `feature/sec-001-serpro-token` **removida** do remoto (2026-06-22).
- Objetivo (remover credencial SERPRO hardcoded) foi **supersedido** pelo pivô L1–L4: rotas `/api/serpro/*`, `/api/das/gerar` e edge `cnpj-enrich` não existem mais.
- Produção atual: **v3.44.0** — zero código SERPRO no repo.

### Fechar manualmente (1 clique)

1. Abrir https://github.com/mmpavao/apoya-consultoria/pull/3
2. **Close pull request**
3. Comentário sugerido: *Superseded pelo pivô 100% manual (v3.44.0). Integração SERPRO removida; branch deletada.*

## Branches removidas (limpeza)

- `cursor/remove-agentes-residuos-d50a` (PR #7 mergeada)
- `cursor/backlog-fixes-d50a` (PR #6 mergeada)
- `cursor/post-pivot-cleanup-d50a` (PR #5 mergeada)
- `cursor/security-env-onboarding-d50a` (PR #4 mergeada)
- `feature/sec-001-serpro-token` (PR #3 obsoleta)

Branches de feature antigas (`feature/dp-contabil`, etc.) permanecem no remoto por histórico — já mergeadas ou inativas.

# ADR 0001 — JARVIS como subprojeto isolado em `jarvis/`

## Status
Aceita.

## Contexto
O repositório `apoya-consultoria` hospeda o produto APOYA Gestão (SaaS de
contabilidade). Seu `AGENTS.md` proíbe explicitamente reintroduzir agentes,
integrações, automação ou MCP no app. O PRD do JARVIS é de um produto totalmente
diferente (assistente orquestrador desktop), que por natureza É um framework de
agentes/MCP.

## Decisão
JARVIS vive inteiramente em `jarvis/`, com `package.json`, toolchain e
`node_modules` próprios. **Não importa nem altera** nenhum código do APOYA. O
app de contabilidade permanece intocado.

## Consequências
- Coexistência segura: nada no APOYA depende de JARVIS e vice-versa.
- O CI/deploy do APOYA não é afetado (escopos de arquivos distintos).
- Duplicação mínima de toolchain é aceitável pelo isolamento que garante.

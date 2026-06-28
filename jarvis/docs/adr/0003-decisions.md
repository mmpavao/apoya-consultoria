# ADR 0003 — Decisões em aberto do PRD §12

## Status
Aceita (defaults escolhidos; todos reconfiguráveis).

## Decisões

| Item (PRD §12) | Decisão | Onde |
|---|---|---|
| Modelo default do Claude | `claude-sonnet-4-6` (custo/velocidade); override por settings | `core/src/infrastructure/llm/modelInfo.ts` |
| Vector store | sqlite-vec em produção; cosseno em memória por default (zero-dep) | `core/src/infrastructure/memory/VectorStore.ts` |
| Voz | Fase 6, opcional — fora desta entrega | — |
| Provider de embeddings | Local por privacidade; `HashingEmbeddingProvider` como default sem dependências, substituível por modelo local atrás de `EmbeddingProvider` | `core/src/infrastructure/memory/VectorStore.ts` |

## Notas
- A tabela de modelos inclui Opus 4.8/4.7/4.6, Sonnet 4.6, Haiku 4.5 e Fable 5,
  com preços e a flag `acceptsSamplingParams` (modelos 4.7+/Fable rejeitam
  `temperature`/`top_p`); o `AnthropicClient` remove esses parâmetros conforme
  o modelo, mantendo o cliente agnóstico.
- Stores em memória são o default para o núcleo rodar standalone; produção troca
  por implementações SQLite (Drizzle) sem alterar a aplicação.

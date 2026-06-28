# JARVIS — Arquitetura

Clean Architecture (PRD §4.2). Regra de dependência: camadas internas nunca
importam de externas; o domínio é puro (sem dependências de runtime além de Zod
para schemas).

```
PRESENTATION (React/TS)  ── IPC tipado ──►  APPLICATION (orquestração)
        ▲                                          │
        │                                          ▼
   OSBridge (Rust)  ◄── comandos Tauri ──   INFRASTRUCTURE  ──►  DOMAIN (puro)
```

## Camadas

### domain/
Entidades e contratos puros: `Session`, `Task`/`Plan`, `AgentDefinition`,
`ApprovalRequest`, `PermissionRule`, `AuditEntry`, `MemoryFact`. As duas
interfaces centrais:

- **`Tool`** — toda capacidade implementa a mesma interface (`name`,
  `description`, `inputSchema` Zod, `permission`, `reversible`, `execute`,
  `preview?`). Adicionar uma tool = um arquivo + um registro; o orquestrador
  não muda (PRD §11.4).
- **`LlmClient`** — contrato agnóstico de provedor (complete + stream + tool
  use). O orquestrador depende só disto; trocar de modelo/provedor é isolado em
  `infrastructure/llm` (PRD §1, §10).

Tempo e identidade são injetados (`Clock`, `IdGenerator`) para tornar o núcleo
determinístico sob teste.

### application/ (casos de uso)
- **Orchestrator** — ponto de entrada único. Planeja → executa os steps na ordem
  topológica das dependências → encadeia as saídas → emite eventos (PRD §6.1).
- **Planner** — pede um plano JSON ao LLM; valida com Zod; cai para um step
  único no agente default se a saída for inutilizável (sempre progride).
- **AgentRunner** — laço ReAct de tool use de um agente especialista até parar
  ou atingir o teto de iterações.
- **ToolExecutor** — **único** ponto por onde toda tool passa: valida input →
  avalia permissão → (aprovação) → executa → audita. O orquestrador nunca chama
  uma tool direto.
- **PermissionService / ApprovalService / AuditLog** — governança human-in-the-loop.
- **ToolRegistry** — registro central; expõe schemas (JSON Schema) ao LLM,
  filtrando por agente (menor privilégio).
- **CostTracker / TaskQueue / SessionManager** — custo em tempo real, fila
  persistível (outbox) com retry, sessões/mensagens.

### infrastructure/
- **llm/** — `AnthropicClient` (SDK), `FakeLlmClient` (testes), `createLlmClient`
  (fábrica = troca em 1 linha), `modelInfo` (capacidades + preços).
- **tools/** — tools nativas (`fs.*`, `shell.run` sandbox, `web.*`, `notify`,
  `memory.*`).
- **osbridge/** — interface `OSBridge` + `LocalOSBridge` (Node, p/ standalone);
  no app, a bridge em Rust serve os comandos privilegiados.
- **memory/** — `VectorStore` (sqlite-vec em produção; cosseno em memória por
  default) + `MemoryService` (RAG).
- **mcp/** — `McpClientPool`: conecta servidores MCP e registra suas tools com
  prefixo do servidor.
- **db/** — schema Drizzle + migrations SQL versionadas.

### Composition root
`bootstrap.ts` monta tudo a partir de settings — stores em memória por default
(núcleo roda standalone); produção troca por stores SQLite sem tocar nos call
sites.

## Fluxo de uma intenção (PRD §6.1)

1. `Orchestrator.handleIntent` → `Planner.plan` (LLM) → evento `plan_created`.
2. Para cada step (ordem topológica): `AgentRunner.run` com o subconjunto de
   tools do agente.
3. Cada tool call → `ToolExecutor`: `read` auto · `write` auto se allowlistado ·
   `destructive`/fora da allowlist → `ApprovalRequest` (bloqueia até decisão).
4. Resultado volta ao agente; saída do step encadeia no próximo; `done` com
   resumo + custo.

## Por que isto é verificável em Linux

O valor diferencial (orquestração, governança, desacoplamento, troca de modelo)
é TypeScript puro testável com `vitest`. O macOS-específico (osascript,
Keychain, empacotamento) fica atrás de `OSBridge`/Rust `#[cfg(target_os)]` e é
exercitado só no macOS — sem bloquear `tsc`/testes do núcleo.

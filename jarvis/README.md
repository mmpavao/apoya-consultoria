# JARVIS — Assistente Orquestrador Pessoal (macOS)

> Subprojeto **isolado** dentro do repositório `apoya-consultoria`. **Não importa
> nem altera** o app APOYA Gestão — vive inteiramente em `jarvis/` com seu
> próprio `package.json` e toolchain. Implementa o PRD do JARVIS (Tauri 2 +
> React/TS + núcleo de orquestração em TypeScript + bridge privilegiada em Rust).

JARVIS é um assistente pessoal **orquestrador** para macOS: recebe uma intenção,
**planeja**, **decompõe em tarefas**, delega a **agentes especialistas** e
**executa ações reais** sob um modelo de permissão com aprovação humana para
ações sensíveis. *"O LLM é a ferramenta; a arquitetura é o produto."*

## Estado desta entrega

Esta é a **fundação**: o **núcleo de orquestração em TypeScript** está
**implementado e testado** (é o diferencial do produto e roda/verifica em
qualquer SO), e o **shell desktop** (Tauri/Rust/React) está **scaffolded** com a
superfície de IPC e as 7 telas — as partes nativas do macOS (osascript,
Keychain, `say`, build/sign/notarize do `.app/.dmg`) ficam por trás de
interfaces e **só são exercitáveis em macOS**.

| Camada | Estado | Verificável em Linux/CI |
|---|---|---|
| Núcleo TS (domínio, tools, orquestrador, governança, memória, MCP, custo) | ✅ implementado + 40 testes | **Sim** (`tsc` + `vitest`) |
| Bridge Rust (`src-tauri`) | ✅ scaffold com `#[cfg(target_os)]` p/ macOS | Parcial (`cargo test` p/ guards) |
| Frontend React (7 telas, i18n, store) | ✅ scaffold tipado | `tsc --noEmit` |
| Build/assinatura `.app`/`.dmg`, voz | ⏳ requer macOS | Não |

## Estrutura

```
jarvis/
├── core/                 # Núcleo de orquestração (TypeScript, Clean Architecture)
│   ├── src/
│   │   ├── domain/       # Entidades + interfaces puras (Tool, LlmClient, …)
│   │   ├── application/  # Orchestrator, Planner, Permission, Approval, Audit, Cost, Queue
│   │   ├── infrastructure/  # AnthropicClient, tools nativas, OSBridge, DB, vetores, MCP
│   │   └── config/       # Agentes especialistas + settings
│   └── tests/            # 40 testes (vitest)
├── src-tauri/            # Bridge privilegiada (Rust) + config Tauri
└── src/                  # Frontend React (Chat, Agentes, Aprovações, Logs, Memória, Conectores, Settings)
```

Ver `docs/ARCHITECTURE.md` e `docs/adr/` para decisões.

## Como rodar/testar o que foi entregue

### Núcleo (funciona em qualquer SO)

```bash
cd jarvis/core
npm install
npm run typecheck    # tsc estrito, 0 erros
npm test             # vitest — 40 testes verdes
```

CLI de demonstração do orquestrador (PRD §9 Fase 1). Sem `ANTHROPIC_API_KEY`
usa um LLM falso determinístico; com a chave usa o modelo configurado:

```bash
npm run build
node dist/cli.js "Pesquise X e salve um resumo em Documentos"
# ANTHROPIC_API_KEY=sk-ant-... node dist/cli.js "..."
```

### Frontend (layout, browser-dev)

```bash
cd jarvis
npm install
npm run typecheck
npm run dev          # http://localhost:5173 (IPC vira no-op fora do Tauri)
```

### App nativo (requer macOS 14+ / Apple Silicon, Rust e Tauri CLI)

```bash
cd jarvis
npm run tauri dev    # ou: npm run tauri build  → .app/.dmg
```

## Trocar o modelo do LLM (PRD §10)

Um valor em settings (`JARVIS_MODEL`) ou `createLlmClient({ provider, model })`.
Default `claude-sonnet-4-6`; tabela de modelos/preços em
`core/src/infrastructure/llm/modelInfo.ts`. O orquestrador depende só da
interface `LlmClient` — nenhum outro arquivo muda ao trocar de modelo/provedor.

## Segurança (PRD §4.5)

- Secrets no **Keychain do macOS** — nunca em arquivo, nunca no contexto do LLM.
- Toda tool passa pelo `ToolExecutor`: validação → permissão → (aprovação) → audit.
- `read` automático; `write` automático só se allowlistado; `destructive` **sempre** pede aprovação com preview.
- Shell em sandbox: allowlist de binários, sem operadores/`sudo`, paths sensíveis bloqueados, timeout.
- Kill switch global rejeita todas as aprovações pendentes e pausa a fila.

## Mapa do PRD → código

| PRD | Onde |
|---|---|
| §4.4 Tools desacopladas | `core/src/domain/tools/Tool.ts`, `infrastructure/tools/*`, `application/ToolRegistry.ts` |
| §4.5 Governança | `application/{PermissionService,ApprovalService,AuditLog,ToolExecutor}.ts`, `infrastructure/tools/shellTool.ts` |
| §6.1 Plan-execute | `application/{Planner,AgentRunner,Orchestrator}.ts` |
| §4.3 Multi-agente | `config/agents.ts` |
| §4.3/§10 RAG | `infrastructure/memory/*` |
| §4 MCP | `infrastructure/mcp/McpClientPool.ts` |
| §1/§10 Troca de modelo | `infrastructure/llm/*` |
| §5 Modelo de dados | `infrastructure/db/schema.ts` + `db/migrations/` |
```

# ADR 0002 — Núcleo TypeScript verificável primeiro; macOS/UI atrás de interfaces

## Status
Aceita.

## Contexto
A entrega ocorre num container **Linux**. Um app Tauri/Rust para Apple Silicon
não pode ser compilado, assinado nem notarizado aqui; osascript, Keychain, `say`
e o atalho global são macOS-only e não testáveis. O PRD, porém, afirma que "a
arquitetura é o produto" — o núcleo de orquestração é o diferencial.

## Decisão
Implementar e **testar** o núcleo de orquestração em TypeScript (domínio,
tools, registry, `LlmClient`, orquestrador plan-execute, permissão/aprovação/
auditoria, memória/RAG, MCP, custo). Tudo macOS-específico fica atrás de
interfaces (`OSBridge`) e `#[cfg(target_os)]` no Rust. O shell Tauri/Rust/React
é scaffolded e tipado, mas suas partes nativas são exercitadas só no macOS.

## Consequências
- `tsc` estrito + `vitest` (40 testes) verificam o núcleo agora, em CI Linux.
- O `LlmClient` agnóstico cumpre "trocar de modelo = 1 valor" (PRD §10) e é
  testado com um `FakeLlmClient` determinístico, sem rede.
- `LocalOSBridge` (Node) permite rodar o núcleo standalone; o bridge Rust
  substitui em produção sem mudar call sites.
- Pendências explicitamente fora do escopo verificável aqui: build/assinatura
  do `.app`/`.dmg`, voz (Fase 6), e os comandos nativos do macOS em runtime.

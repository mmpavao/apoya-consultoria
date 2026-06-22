# APOYA Gestão — Backlog de Endurecimento (Phase 2)

> **Status: ENCERRADO em v3.50.0 (2026-06-20).** Modo 100% manual. Itens abaixo são histórico da auditoria multi-agente (15/06/2026). Ver `STATE.md` e `AGENTS.md`.

---

## Resumo executivo

| Tema | Status |
|------|--------|
| 1 — Schema/colunas | Código corrigido; migrations pendentes só via agente ARQUITETO |
| 2 — Dados fabricados | Concluído (v3.44–v3.50) |
| 3 — Folha/rescisão | Concluído (`folha-calc.ts`, `rescisao-calc.ts`, `use-dp.ts`) |
| 4 — Segurança API | Concluído v3.46 (`api-auth.ts`) |
| 5 — Idempotência webhooks | **Obsoleto** (integrações removidas no pivô) |
| 6 — Erros silenciosos | Concluído v3.48–v3.49 |
| 7 — Botões mortos | Concluído v3.44 + v3.48 |
| 8 — Documentos sync | Concluído v3.47 |
| 9 — Contratos/tipos/cleanup | Concluído v3.50 |

---

## Corrigido em v3.50.0 (entrega final Phase 2)

- **Tema 9:** `TabContratos` — placeholders substituídos via `substituirPlaceholders()` antes de gravar HTML
- **Tema 9:** copy honesta — assinatura manual (sem claims Clicksign/webhook)
- **Tema 2:** regime UI não fabrica mais "Simples" quando ausente (lista, detalhe, DP, fiscal)
- **Tema 3:** `useCreateFolha` checa erro na query de funcionários
- **Tema 9:** badge contábil trata `tipo === "manual"` sem cor falsa de crédito
- **Tema 7:** dead code removido (`ModuleHeader`, `ModuleNav`, `layout/index.ts`)
- **TabFiscal:** comentários atualizados (modo manual, sem SERPRO)

---

## Pendente fora do escopo de código (agente ARQUITETO)

- Colunas `cobrancas.created_by` e `cobrancas.observacoes` — código já não usa; migration quando necessário
- PR #3 legado SERPRO — fechar manualmente no GitHub

---

## Histórico de versões (Phase 2)

| Versão | Conteúdo principal |
|--------|-------------------|
| v3.44.0 | Pivô manual, contábil/régua/docs, remoção agentes UI |
| v3.45.0 | plano_contas `natureza`; hooks contábeis expõem erro |
| v3.46.0 | auth fail-closed (`api-auth.ts`) |
| v3.47.0 | documentos módulo ↔ cliente unificados |
| v3.48.0 | Registrar DAS; erros explícitos; copy honesta |
| v3.49.0 | KPIs/erros explícitos fiscal/financeiro/contábil/societário |
| **v3.50.0** | **Contratos placeholders + cleanup final backlog** |

---

## Auditoria original (referência)

<details>
<summary>Itens originais por tema (clique para expandir)</summary>

### TEMA 1 — Schema mismatch
- Cobrança, extrato, NovoLancDialog, régua, obrigações, plano_contas, documento_pasta — **corrigidos em código v3.44–v3.45**
- Migrations `created_by`/`observacoes` — pendente ARQUITETO

### TEMA 2 — Dados fabricados
- eSocial, automações, gateway, plano padrão, societário toggles — **corrigidos v3.44–v3.49**
- Regime UI — **v3.50**

### TEMA 3 — Folha/rescisão
- `calcFolhaTotais`, `calcFolhaFuncionario`, `calcRescisao` integrados — **v3.44+ / testes**

### TEMA 4 — Segurança
- Rotas removidas no pivô; 5 rotas `/api/*` com auth centralizada — **v3.46**

### TEMA 5 — Idempotência
- **Obsoleto** — webhooks/agentes removidos

### TEMA 6 — Erro silencioso
- Dashboard, fiscal, financeiro, contábil, societário — **v3.48–v3.49**

### TEMA 7 — Botões mortos
- Societário, config, contábil/DP refresh, Registrar DAS — **v3.44 + v3.48**

### TEMA 8 — Documentos
- `ModuleDocumentosTab` unificado — **v3.47**

### TEMA 9 — Outros
- Contratos placeholders, tipos, dead code — **v3.50**

</details>

# APOYA Gestão — Backlog de Endurecimento (auditoria multi-agente 15/06/2026)

> **Status pós-pivô (v3.43.0):** muitos itens abaixo referem integrações/agentes **removidos** (SERPRO, Asaas, WhatsApp, MCP, cron, webhooks). Trate como histórico. Itens ainda relevantes para o modo manual: **Tema 1** (schema/colunas), **Tema 3** (cálculo folha/rescisão), **Tema 7** (UI morta), partes de **Tema 2/6** (mock/erro silencioso). Ver `AGENTS.md` e `STATE.md`.

Auditoria de 7 domínios contra `STANDARDS.md`. Achados com arquivo:linha e severidade.
Falsos positivos da auditoria (gerados quando o working tree foi temporariamente
corrompido por um agente) foram REMOVIDOS. Rotas `api/wa/send`/`instances` **não existem mais** (pivô manual).

Ordem de ataque na Phase 2 = por TEMA (raiz comum), começando pelos que gravam/leem
errado no banco (saves que falham calado), depois fachadas, segurança e o resto.

---

## TEMA 1 — Escrita/leitura em colunas/tabelas que NÃO existem (o `types.ts` novo expôs)
**Impacto: salvar falha calado, telas vêm vazias, ou crash. MAIOR PRIORIDADE.**

- [P0] src/routes/api/cobranca/criar.ts:107-121 — insert em `cobrancas` com `created_by` (coluna não existe) → **criar cobrança pode estar falhando em produção**.
- [P0] src/components/PagamentoDialog.tsx:28-31 — update `cobrancas.observacoes` (coluna não existe) → **baixar pagamento com observação quebra**.
- [P0] src/hooks/use-contabil.ts:219-223 + cliente/TabContabil.tsx:354 — `extrato_bancario` lido por `data_movimento`/`descricao`/`conciliado` (reais: `data_linha`/`historico_banco`/`status`) → **conciliação bancária 100% quebrada**.
- [P0] cliente/TabContabil.tsx:143-148 — NovoLancDialog insere sem `data_competencia`/`mes_referencia` (NOT NULL) e em colunas inexistentes (`competencia`/`criado_por`/`criado_por_tipo`) → criar lançamento pelo card do cliente sempre falha.
- [P0] src/routes/_app.financeiro.tsx:87-90 e 119-122 — régua e automação custom gravam em `pipeline_config.tipo`/`config` (não existem) + `nome` NOT NULL ausente → **salvar régua/automação sempre falha**.
- [P1] src/routes/_app.fiscal.index.tsx:802 — select `obrigacoes.valor_estimado` (não existe) → painel "Obrigações próximas" e contadores **sempre vazios**.
- [P1] src/routes/_app.contabil.tsx:386 + use-contabil — `plano_contas.nome` (real `descricao`) → nome de conta em branco quando há plano custom.
- [P1] src/components/layout/ModuleDocumentosTab.tsx:193 — cria `documento_pasta` com `cliente_id: null` (NOT NULL) quando filtro="todos" → crash ao criar pasta.
- [P3] src/hooks/use-cliente-by-id.ts:126 — grava `clientes.nfseio_emitente_id` (não existe) — latente (form não seta hoje).

## TEMA 2 — Dado fabricado/hardcoded apresentado como real (viola STANDARDS #1)
- [P0] _app.dp.tsx:376-389,617 — `ESOCIAL_EVENTOS` 100% hardcoded; KPI "eSocial Pendentes" conta o mock.
- [P0] _app.dp.tsx:452-457 / _app.contabil.tsx:445-503 / _app.fiscal.index.tsx:717 / _app.financeiro.tsx:747 / _app.societario.tsx:228 — automações hardcoded com `ultima_resultado:"ok"` fixo; toggles só em `useState` (não persistem).
- [P1] _app.financeiro.tsx:677-688 — aba Gateway exibe "Webhook: Configurado ✓"/"Pix: Ativo" fixos (não lê `integracao_config`).
- [P1] _app.contabil.tsx:320-431 — `PLANO_PADRAO` hardcoded exibido como plano real; sem criar/persistir contas.
- [P2] _app.societario.tsx:255-292 — "Preferências"/"Portais Integrados" hardcoded; toggles com cursor-pointer sem onClick.
- [P2] cliente/TabFiscal.tsx:179 — catch do DTE SERPRO força status "Ativo" (compliance verde falso).
- [P2] src/hooks/use-clientes.ts:59 + use-cliente-by-id.ts:15 — `regime ?? "Simples"` fabricado (mesmo padrão proibido).
- [P2] _app.contabil.tsx:575,605 — KPIs "Sem Período"/"Com Divergência" hardcoded 0.

## TEMA 3 — Features-fachada (nascem R$0, sem cálculo)
- [P0] use-dp.ts:195-197 + dp/FolhaTab.tsx:118-149 — **folha de pagamento sem cálculo**: proventos/descontos/líquido/FGTS/INSS nunca calculados; tabela mostra "—". (= feature "cálculo de folha" pendente.)
- [P0] use-dp.ts:153-154 + dp/RescisaoDetalheDialog.tsx:10-11 — **rescisão sem cálculo**: verbas zeradas, só preenchimento manual.

## TEMA 4 — Segurança (auth não fail-closed / segredos)
- [P1] src/routes/api/cobranca/regua.ts:77-80 — `isCron = !user && !!token`: **qualquer Bearer inválido roda a régua** (suspende clientes, dispara WhatsApp). Não fail-closed.
- [P1] supabase/functions/* + config.toml — 6 edge functions com `verify_jwt=false` e sem checar auth no corpo; orquestrador dispara fan-out service-role sem auth.
- [P3] src/routes/api/pipeline/index.ts:13 + mover.ts:17 — API key do MCP hardcoded no fonte (segredo versionado).
- [P3] src/routes/api/cobranca/setup-webhook.ts:98 — `update().eq("tipo","asaas")` (não upsert): se a linha não existe, token nunca grava → webhook rejeita tudo.
- [P3] src/routes/api/serpro/status.ts:10 — GET sem auth (read-only, baixo impacto).

## TEMA 5 — Idempotência ausente (agentes/webhooks)
- [P2] _shared/agent.ts:51-77 + orquestrador:101-127 — `upsertPipelineTask` é read-then-insert racy (sem unique index em `metadados->>dedup_key`) → cron + manual duplicam tarefas.
- [P2] api/webhooks/pluggy/index.ts:206 — sem dedup por eventId → re-entrega reprocessa 90 dias.
- [P2] api/cobranca/webhook.ts:163-222 — re-entrega Asaas re-dispara NFS-e (sem checar estado antes).

## TEMA 6 — Erro → "0"/vazio silencioso (viola STANDARDS #2)
- [P1] _app.financeiro.tsx:45 — `useCobrancas.error` ignorado → KPIs viram R$0 sem sinal.
- [P2] use-contabil.ts (lançamentos/plano/períodos/extratos) — erro vira lista vazia, sem estado de erro.
- [P3] use-dashboard.ts:112-189 — queries secundárias (DAS/WhatsApp/NFS-e/calendário) engolem erro → KPI 0.
- [P3] use-societario.ts:112 — erro vira "Sem processos".

## TEMA 7 — Botões/abas mortas (viola STANDARDS #5)
- [P1] _app.societario.tsx:87 — TabsTrigger "Documentos" SEM TabsContent → aba vazia (e `ModuleDocumentosTab` importado e não usado).
- [P1] _app.configuracoes.tsx:756-804 — aba "Sistema" tem trigger mas o TabsContent está FORA do `<Tabs>` → aba não mostra nada.
- [P1] _app.contabil.tsx:584 / _app.dp.tsx:593 — botão "Atualizar" do header sem onClick.
- [P2] motor/ApuracaoMensalCard.tsx:303 — "Gerar DAS" só dá toast "em implementação".

## TEMA 8 — Documentos cliente ↔ módulos não sincronizam
- [P2] cliente/TabDocumentos.tsx vs layout/ModuleDocumentosTab.tsx — buckets e filtro `modulo` diferentes → documentos do cliente nunca aparecem nas abas dos módulos e vice-versa. (= a decisão de "store canônico" pendente.)

## TEMA 9 — Outros (tipos errados, duplicação divergente, contratos)
- [P1] _app.contabil.tsx:181 vs cliente/TabContabil.tsx:146 — `tipo` debito/credito vs "manual" → KPIs de totais ignoram lançamentos do card do cliente.
- [P2] cliente/TabContratos.tsx — templates ClickSign enviados com placeholders crus (`[CNPJ APOYA]`, `[VALOR]`…) sem substituição → documento jurídico malformado em assinatura externa.
- [P2] _app.clientes_.$id.tsx:260-261 — `valorHonorario`/`diaVencimento` (number) gravados como string.
- [P1] use-dp.ts:152-154 — demissão lê `func.empresa_id` sem checar erro (crash + estado inconsistente: funcionário demitido sem rescisão).
- [P2] dp: duas `FolhaTab`/`FeriasTab` distintas (rota vs components) com lógica divergente.
- [P3] vários — helpers `fmtBRL`/`fmtDate` locais reintroduzidos (contabil/dp/financeiro/societário) vs `@/lib/format`.
- [P3] código morto: ModuleHeader/ModuleNav (layout), imports não usados (vários), cliente/TabFinanceiro.tsx e TabServicos.tsx (não importados).

---

## Contagem (sem falsos positivos)
- **P0: ~13** (Temas 1, 2, 3) — bugs que quebram salvar/telas ou expõem mock como real.
- **P1: ~16** — alto impacto.
- **P2: ~17** · **P3: ~16**.

## Ordem recomendada (Phase 2 — cada correção com TESTE de regressão)
1. **Tema 1** (schema-mismatch) — destrava salvar/conciliar/cobrar. Maior valor, risco controlado.
2. **Tema 4** (segurança) — régua fail-closed + auth edge.
3. **Tema 7** (abas/botões mortos) — rápido, visível.
4. **Tema 2 + 6** (fachada + erro≠zero) — honestidade da UI.
5. **Tema 3** (cálculo de folha/rescisão) — feature grande, precisa spec do Marcio.
6. **Tema 8/9** (docs, contratos, tipos, duplicação) — conforme prioridade.


## Diagnóstico

Você está certo: o que está construído hoje é uma **casca visual com localStorage** e cobre apenas ~40% do PRD. Antes de "ligar o Supabase", precisamos fechar as lacunas. Abaixo o que falta e o plano para chegar a 100%.

### Divergências relevantes entre PRD e código atual

**1. Stack — diferença importante**
- PRD pede: React + Vite + React Router + Supabase Edge Functions (Deno).
- Projeto atual: **TanStack Start** (React 19 + Vite + SSR em Cloudflare Worker).
- Recomendação Lovable: manter TanStack Start e usar `createServerFn` em vez de Edge Functions Deno para a lógica do app (SERPRO, NFE.io, Asaas, WhatsApp). Webhooks externos (Asaas, Evolution) ficam em rotas `src/routes/api/public/*`. Mesma segurança (JWT via middleware), melhor DX, sem dois runtimes.
- **Decisão sua:** seguir com TanStack (recomendado) ou reescrever para Vite puro como o PRD literal.

**2. Schema de Clientes (M1) — campos faltando**
- Status enum atual: `ativo|inativo|pendente`. PRD: `ativo|inadimplente|suspenso|inativo|em_analise`.
- Regimes: falta `Doméstica`. Falta `regime_hibrido` (bool, só SN), `tier_servico`, `codigo_servico_nfse`, `dia_vencimento_cobranca`, `valor_honorario`, `forma_pagamento`, `tem_empregados`, `tem_incentivo_fiscal`, `usuario_responsavel_id`.
- Falta botão **"Buscar na Receita Federal"** (consulta CNPJ).
- Falta página **detalhes do cliente** com 6 tabs.

**3. Obrigações (M2)**
- Hoje: store básica. Falta **gerador automático** por regime/calendário fiscal (DASMEI, PGDAS-D, DAS, DEFIS, eSocial, FGTS, DARF, GPS, EFD-Reinf, DCTFWeb, EFD-Contrib, ECF, ECD, DAE, DIRBI), Kanban 4 colunas, alertas de multa, banner reforma tributária.

**4. DAS em Lote (M3)** — falta separar em 2 seções (SN/MEI), progresso real, retry com motivo, log CSV.

**5. NFS-e (M4)** — falta CBS/IBS (0,9% / 0,1%), badges Híbrido / MEI sem CBS, cancelamento <24h, 3 tentativas com delay.

**6. Financeiro (M5)** — falta 3 tabs (Cobranças/Inadimplência/Histórico), régua visual completa, suspensão automática.

**7. WhatsApp (M6)** — falta status ✓/✓✓/lida, distinção visual auto/manual, attach de DAS/NFS-e/boleto.

**8. Dashboard** — hoje é placeholder. PRD pede 4 linhas de KPIs, alertas críticos coloridos, feed de atividade, quick actions.

**9. Configurações (M7)** — ok visualmente, mas usuários precisam virar Supabase Auth real + `user_roles`.

**10. Auth** — `mock-auth` em localStorage. Trocar por Supabase Auth (email/senha + magic link), `onAuthStateChange`, layout `_authenticated` com `beforeLoad` redirect.

---

## Plano em 3 fases

### Fase A — Fechar gaps de UI/regras (sem Supabase, mantém localStorage)
A1. Refatorar `clientes-store` com todos os campos do PRD e tela de detalhes com tabs.
A2. Gerador de obrigações por regime + Kanban + alertas de multa.
A3. Ajustes M3/M4/M5/M6 (badges, status, CBS/IBS, régua, tabs financeiro, status WA).
A4. Dashboard completo (KPIs, alertas, feed, quick actions).

### Fase B — Migração Supabase (substitui localStorage)
B1. **Schema** via migrations (RLS em tudo):
   - `profiles` (id → auth.users, nome, email)
   - `app_role` enum + `user_roles` (admin/fiscal/financeiro/dp) + `has_role()` security definer
   - `empresa_cliente`, `obrigacao`, `nfse`, `das_guia`, `cobranca`, `mensagem_whatsapp`, `conversa_whatsapp`, `contrato`, `audit_log`, `calendario_fiscal` (público leitura), `simulacao_regime`, `template_whatsapp`, `integracao_config`, `escritorio_config`.
   - Trigger `handle_new_user` cria profile.
   - Seed do `calendario_fiscal` (regras 2026 + DIRBI).
B2. **Storage buckets**: `das-pdfs`, `nfse-xml`, `nfse-pdf`, `boletos`, `whatsapp-files` (private + RLS).
B3. **Auth real** (login email/senha + magic link, reset password, `_authenticated` layout, logout).
B4. **Server functions** (`createServerFn` + `requireSupabaseAuth`):
   - `consultaCnpj` (proxy SERPRO/BrasilAPI)
   - `gerarDasSingle` / `gerarDasLote` (SERPRO gateway, salva PDF no Storage)
   - `emitirNfseSingle` / `emitirNfseLote` (NFE.io, salva XML+PDF)
   - `criarCobranca` / `cancelarCobranca` (Asaas)
   - `enviarWhatsapp` (Evolution API)
   - `gerarObrigacoesMes` (job mensal, calculável on-demand)
   - `suspenderInadimplentes` (cron via pg_cron OU rota pública com CRON_SECRET)
   - Todas chamam `audit_log` ao final.
B5. **Server routes públicas** (`src/routes/api/public/*`):
   - `webhook-asaas` (verifica assinatura)
   - `webhook-evolution` (verifica token)
B6. Substituir todos os `*-store.ts` por hooks com `supabase.from(...)` + React Query + realtime (dashboard e WhatsApp).

### Fase C — Secrets e go-live
C1. Cadastrar via `add_secret`: `SERPRO_GATEWAY_TOKEN`, `NFEIO_API_KEY`, `ASAAS_API_KEY`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `ASAAS_WEBHOOK_SECRET`, `EVOLUTION_WEBHOOK_SECRET`, `CRON_SECRET`.
C2. Configurar `escritorio_config` com CNPJ 43.507.838/0001-89.
C3. Criar 1º usuário admin (Daniel) via Supabase Dashboard ou tela de signup interna.
C4. Habilitar `pg_cron` para suspensão automática 45 dias.

---

## Como prosseguir

Como o trabalho é grande, sugiro fechar a **Fase A antes** de tocar no banco (evita ter que mexer no schema duas vezes — PROBLEMA 6 do próprio PRD). Posso fazer A1→A4 em sequência (4 mensagens "ok") e depois rodamos B1 (migration única grande) + B2/B3/B4 nas seguintes.

**Confirme:**
1. Mantemos **TanStack Start + createServerFn** (recomendado) ou reescrevemos para Vite/RR + Edge Functions como o PRD literal?
2. Começamos pela **Fase A1 (Clientes completo)** agora?

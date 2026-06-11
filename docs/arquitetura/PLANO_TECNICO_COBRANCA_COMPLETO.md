# PLANO TÉCNICO — Sistema de Cobrança Completo
**Status:** APROVADO PARA EXECUÇÃO  
**Data:** 2026-05-25  
**Arquiteto:** ARQUITETO APOYA

---

## 1. CONTEXTO E ESTADO ATUAL

### Já existe no sistema:
- `cobrancas` tabela — completa (asaas_id, link_pagamento, pix_copia_cola, boleto_url, regua_stage, dias_atraso)
- `escritorio_config.asaas_api_key` — chave de PRODUÇÃO configurada (`$aact_prod_0...`)
- `escritorio_config.dias_suspensao = 45` / `dia_cobranca = 5`
- `clientes.asaas_customer_id` — campo existe, precisa ser populado
- `use-cobrancas.ts` — hook OK com tipo completo
- Page `/financeiro` — exibe lista mas botões Asaas e WhatsApp são stubs (`toast.info(...)`)
- Régio RegugaStage definida: ok → lembrete → cobranca → negativacao → suspensao

### O que falta (este sprint):
1. **Asaas Client** — integração HTTP real
2. **API routes** — criar cliente, emitir cobrança (PIX/boleto/cartão), webhook de pagamento
3. **Régio de cobrança automática** — lembrete (D-5), cobrança (D+1), negativação (D+15), suspensão (D+45)
4. **WhatsApp messages** — templates por estágio
5. **Checkout page** — `/checkout/[cobrancaId]` pública com PIX, boleto, cartão
6. **Bloqueio/desbloqueio** — atualiza `clientes.status` e notifica
7. **Automação CRON** — roda diariamente às 08h

---

## 2. ARQUITETURA

```
┌─ CRON Diário 08h ─────────────────────────────────────────┐
│  /api/cobranca/regua (POST, mode=cron)                     │
│  → Varre cobrancas vencidas                               │
│  → Aplica estágio correto (D-5, D+1, D+15, D+45)         │
│  → Envia WhatsApp por estágio                             │
│  → Bloqueia cliente em D+45                               │
└────────────────────────────────────────────────────────────┘

┌─ Fluxo de Emissão ────────────────────────────────────────┐
│  Painel /financeiro → "Gerar Cobranças"                   │
│  → /api/cobranca/emitir                                   │
│  → Asaas: criar customer (se não existir)                 │
│  → Asaas: criar payment (PIX + boleto)                    │
│  → Salva link_pagamento, pix_copia_cola, boleto_url       │
│  → Envia WhatsApp com link checkout                       │
└────────────────────────────────────────────────────────────┘

┌─ Webhook Asaas ────────────────────────────────────────────┐
│  POST /api/public/asaas-webhook                           │
│  → Atualiza status da cobrança (paga, vencida, cancelada) │
│  → Se paga: limpa suspensão, manda "obrigado"             │
└────────────────────────────────────────────────────────────┘

┌─ Checkout Público ─────────────────────────────────────────┐
│  /checkout/$cobrancaId (rota pública sem auth)            │
│  → Exibe PIX (QR + copia-e-cola)                         │
│  → Exibe Boleto (link PDF)                               │
│  → Exibe Cartão (Asaas JS SDK embed)                     │
└────────────────────────────────────────────────────────────┘
```

---

## 3. AFFECTED FILES

```
src/
├── integrations/asaas/
│   └── client.server.ts              [CRIAR] — HTTP client Asaas API v3
├── routes/api/cobranca/
│   ├── emitir.ts                     [CRIAR] — gera customer + payment no Asaas
│   ├── regua.ts                      [CRIAR] — roda régua por estágio (cron + manual)
│   └── webhook.ts                    [CRIAR] — recebe eventos do Asaas
├── routes/api/public/
│   └── asaas-webhook.ts              [CRIAR] — endpoint público (sem auth Supabase)
├── routes/
│   └── checkout.$id.tsx              [CRIAR] — página pública de checkout
├── routes/_app.financeiro.tsx        [ATUALIZAR] — botões → API real
└── hooks/
    └── use-cobrancas.ts              [ATUALIZAR] — função emitir + gerarMensal
```

---

## 4. RÉGUA DE COBRANÇA

| Estágio | Trigger | Ação | WhatsApp |
|---------|---------|------|----------|
| `ok` | Emissão | Envia link | "Sua fatura vencerá em D dias" |
| `lembrete` | D-5 | Re-envia | "⚠️ Vence em 5 dias" |
| `cobranca` | D+1 a D+14 | Re-envia | "❗ Fatura vencida há X dias" |
| `negativacao` | D+15 | Marca + Notifica | "🔴 Conta em atraso — risco de suspensão" |
| `suspensao` | D+45 | Bloqueia acesso | "🚫 Conta suspensa — regularize" |

---

## 5. TEMPLATES WHATSAPP

```
LEMBRETE (D-5):
"⚠️ Olá {nome}! Sua mensalidade APOYA de {valor} vence em *{dias} dias* ({vencimento}).
🔗 Pague agora: {link}"

COBRANÇA (D+1):
"❗ {nome}, sua mensalidade APOYA de {valor} *venceu há {dias} dia(s)*.
Evite juros — pague agora: {link}"

NEGATIVAÇÃO (D+15):
"🔴 {nome}, sua conta APOYA está em atraso há *{dias} dias* ({valor}).
⚠️ Risco de suspensão dos serviços em {data_suspensao}.
Regularize: {link}"

SUSPENSÃO (D+45):
"🚫 {nome}, seus serviços APOYA foram *suspensos* por falta de pagamento ({dias} dias).
Para reativar, quite o débito de {valor}: {link}
Dúvidas: (12) 99685-3626"

CONFIRMAÇÃO DE PAGAMENTO:
"✅ {nome}, recebemos seu pagamento de {valor}. Obrigado!
Sua conta APOYA está ativa. 🙏"
```

---

## 6. EXECUTION ORDER

1. `integrations/asaas/client.server.ts` — HTTP client base
2. `routes/api/cobranca/emitir.ts` — emissão (customer + payment)
3. `routes/api/public/asaas-webhook.ts` — webhook público
4. `routes/api/cobranca/regua.ts` — régua automática
5. `routes/checkout.$id.tsx` — página pública
6. `routes/_app.financeiro.tsx` — conectar botões reais
7. `hooks/use-cobrancas.ts` — adicionar fn emitir
8. CRON automation — diário 08h

---

## 7. ACCEPTANCE CRITERIA

- [ ] Clicar "Gerar Cobranças" em /financeiro cria customer no Asaas e retorna link de pagamento
- [ ] PIX copia-e-cola disponível no modal da cobrança
- [ ] Boleto PDF abre em nova aba
- [ ] Checkout `/checkout/[id]` carrega sem login com QR PIX + boleto + cartão
- [ ] Webhook Asaas atualiza status para "paga" em < 5s após confirmação
- [ ] CRON 08h executa régua e envia WhatsApp conforme estágio
- [ ] Cliente suspenso em D+45 aparece com status "suspenso" na listagem
- [ ] Pagamento confirmado → status "ativo" restaurado automaticamente

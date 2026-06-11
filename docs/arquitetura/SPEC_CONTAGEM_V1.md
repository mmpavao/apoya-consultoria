# SPEC TÉCNICO — ContaGem (Banking Module)
**Versão:** 1.0  
**Data:** 2026-05-20  
**Autor:** ARQUITETO  
**Status:** APROVADO PELO MÁRCIO — aguardando chave Asaas para execução  
**Projeto:** GenPro360 — módulo nativo integrado  

---

## 1. VISÃO GERAL

O **ContaGem** é o módulo de banking nativo do GenPro360. Cada empresa cliente possui uma **subconta Asaas** vinculada à conta mãe GenPro360, com saldo próprio, extrato, Pix, transferências, aprovação de pagamentos e gestão financeira integrada aos módulos existentes (contas a pagar, contas a receber).

### Modelo de conta
```
Conta Mãe: GenPro360 (conta raiz Asaas)
  └── Subconta: Empresa A (walletId_A + apiKey_A)
  └── Subconta: Empresa B (walletId_B + apiKey_B)
  └── Subconta: Empresa C (walletId_C + apiKey_C)
```

---

## 2. DECISÕES ARQUITETURAIS

| Decisão | Escolha | Justificativa |
|---|---|---|
| Provedor BaaS | Asaas v3 | Já integrado, subconta nativa, Pix/TED/boleto |
| Modelo de conta | Subconta por `company_id` | Multi-tenant, isolamento total |
| Armazenamento de apiKey | Supabase secrets por company | Nunca exposta ao frontend |
| Aprovação de pagamentos | Fila assíncrona com webhook | Segurança + auditoria |
| Integração financeira | Via `company_bank_accounts` existente | Reutiliza módulo de contas bancárias |
| Autenticação Asaas | `apiKey` da subconta no header | Padrão Asaas v3 |

---

## 3. SCHEMA DO BANCO DE DADOS

### 3.1 Migrations necessárias

#### `20260520_020_contagém_accounts.sql`
```sql
-- Vincula a empresa à subconta Asaas
CREATE TABLE public.contagém_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  asaas_account_id      text NOT NULL,           -- id retornado pelo POST /v3/accounts
  asaas_wallet_id       text NOT NULL,           -- walletId para split/transferência interna
  asaas_api_key_secret  text NOT NULL,           -- nome do secret no Supabase Vault
  status                text NOT NULL DEFAULT 'pending_kyc'
                          CHECK (status IN ('pending_kyc','under_review','active','suspended','blocked')),
  account_type          text NOT NULL DEFAULT 'non_baas'
                          CHECK (account_type IN ('non_baas','baas')),
  balance_cents         bigint NOT NULL DEFAULT 0,
  balance_updated_at    timestamptz,
  onboarding_link       text,                    -- link enviado ao cliente para KYC
  onboarding_expires_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_contagém_accounts_company ON public.contagém_accounts(company_id);

ALTER TABLE public.contagém_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contagém_accounts_company_isolation ON public.contagém_accounts
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.user_companies
      WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_contagém_accounts_updated_at
  BEFORE UPDATE ON public.contagém_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

#### `20260520_021_contagém_transactions.sql`
```sql
-- Espelho local de todas as movimentações da subconta
CREATE TABLE public.contagém_transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asaas_event_id      text UNIQUE,               -- id do evento Asaas (idempotência)
  type                text NOT NULL
                        CHECK (type IN ('pix_in','pix_out','ted_in','ted_out',
                                        'boleto_in','transfer_in','transfer_out',
                                        'fee','refund','chargeback')),
  direction           text NOT NULL CHECK (direction IN ('credit','debit')),
  amount_cents        bigint NOT NULL,
  balance_after_cents bigint,
  description         text,
  counterpart_name    text,
  counterpart_doc     text,
  counterpart_bank    text,
  pix_key             text,
  pix_end_to_end_id   text,
  status              text NOT NULL DEFAULT 'confirmed'
                        CHECK (status IN ('pending','confirmed','failed','reversed')),
  -- Vínculo com módulos financeiros existentes
  accounts_payable_id   uuid REFERENCES public.accounts_payable(id),
  accounts_receivable_id uuid REFERENCES public.accounts_receivable(id),
  payment_approval_id   uuid,                    -- FK para tabela de aprovações
  scheduled_for         timestamptz,
  processed_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contagém_tx_company ON public.contagém_transactions(company_id);
CREATE INDEX idx_contagém_tx_status  ON public.contagém_transactions(company_id, status);
CREATE INDEX idx_contagém_tx_date    ON public.contagém_transactions(company_id, created_at DESC);

ALTER TABLE public.contagém_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY contagém_tx_company_isolation ON public.contagém_transactions
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
    )
  );
```

#### `20260520_022_contagém_payment_approvals.sql`
```sql
-- Fila de aprovações de pagamentos
CREATE TABLE public.contagém_payment_approvals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Vínculo com módulo financeiro
  accounts_payable_id uuid REFERENCES public.accounts_payable(id),
  -- Dados do pagamento
  payment_type        text NOT NULL
                        CHECK (payment_type IN ('pix','ted','boleto','internal_transfer')),
  amount_cents        bigint NOT NULL,
  due_date            date NOT NULL,
  recipient_name      text NOT NULL,
  recipient_doc       text,
  recipient_bank      text,
  recipient_agency    text,
  recipient_account   text,
  pix_key             text,
  pix_key_type        text CHECK (pix_key_type IN ('cpf','cnpj','email','phone','random')),
  barcode             text,                      -- linha digitável boleto
  description         text,
  -- Status de aprovação
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','executed','failed','cancelled')),
  auto_execute        boolean NOT NULL DEFAULT false,  -- executa automaticamente se aprovado + dia vencimento + saldo
  approved_by         uuid REFERENCES auth.users(id),
  approved_at         timestamptz,
  rejected_by         uuid REFERENCES auth.users(id),
  rejected_reason     text,
  executed_at         timestamptz,
  -- Resultado da execução
  asaas_payment_id    text,                      -- id do pagamento no Asaas
  contagém_tx_id      uuid,                      -- FK para contagém_transactions após execução
  error_message       text,
  -- Notificação push
  push_sent_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_approval_company_status ON public.contagém_payment_approvals(company_id, status);
CREATE INDEX idx_approval_due_date       ON public.contagém_payment_approvals(company_id, due_date);
CREATE INDEX idx_approval_auto_execute   ON public.contagém_payment_approvals(company_id, auto_execute, due_date)
  WHERE status = 'approved';

ALTER TABLE public.contagém_payment_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY contagém_approval_company_isolation ON public.contagém_payment_approvals
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_contagém_approvals_updated_at
  BEFORE UPDATE ON public.contagém_payment_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

#### `20260520_023_contagém_scheduled.sql`
```sql
-- Job diário para executar pagamentos aprovados no vencimento
-- Cron: todo dia às 08:00 BRT (11:00 UTC)
SELECT cron.schedule(
  'contagém-execute-approved-payments',
  '0 11 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/contagém-auto-execute',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

---

## 4. EDGE FUNCTIONS

### EF1 — `contagém-onboarding`
**Responsabilidade:** Criar subconta Asaas + salvar credenciais no Vault + enviar link KYC

```
POST /functions/v1/contagém-onboarding
Body: { company_id, name, email, cpfCnpj, mobilePhone, address, ... }

Fluxo:
1. Validar is_super_admin ou admin da empresa
2. POST https://api.asaas.com/v3/accounts (conta mãe apiKey)
3. Salvar asaas_account_id + asaas_wallet_id em contagém_accounts
4. Armazenar apiKey da subconta no Supabase Vault: secret name = "asaas_subkey_{company_id}"
5. POST /v3/myAccount/commercialInfo (dados comerciais KYC)
6. Retornar { onboarding_link, status: 'pending_kyc' }
```

**Campos Asaas POST /v3/accounts:**
```json
{
  "name": "Empresa XYZ",
  "email": "financeiro@empresa.com",
  "loginEmail": "login@empresa.com",
  "cpfCnpj": "12345678000190",
  "birthDate": "1990-01-01",
  "companyType": "LIMITED",
  "phone": "4131231234",
  "mobilePhone": "41999998888",
  "address": "Rua X",
  "addressNumber": "100",
  "province": "Centro",
  "postalCode": "80010000"
}
```

---

### EF2 — `contagém-balance`
**Responsabilidade:** Consultar saldo em tempo real + atualizar cache

```
GET /functions/v1/contagém-balance?company_id=xxx

Fluxo:
1. Buscar apiKey da subconta no Vault
2. GET https://api.asaas.com/v3/finance/balance (apiKey subconta)
3. UPDATE contagém_accounts SET balance_cents, balance_updated_at
4. Retornar { balance, availableForWithdrawal, ... }
```

---

### EF3 — `contagém-pix`
**Responsabilidade:** Enviar Pix para chave externa ou conta Asaas

```
POST /functions/v1/contagém-pix
Body: { company_id, approval_id?, pixKey, pixKeyType, amount, description }

Fluxo:
1. Validar aprovação existente (se approval_id informado)
2. Verificar saldo suficiente
3. POST https://api.asaas.com/v3/transfers (apiKey subconta)
   { value, pixAddressKey, pixAddressKeyType, description }
4. INSERT contagém_transactions (status: pending)
5. Retornar { transfer_id, status }
   (confirmação via webhook TRANSFER_CONFIRMED)
```

---

### EF4 — `contagém-ted`
**Responsabilidade:** Transferência TED para conta bancária externa

```
POST /functions/v1/contagém-ted
Body: { company_id, approval_id, bank, agency, account, accountDigit,
        accountType, cpfCnpj, name, amount, description }

Fluxo:
1. Validar aprovação com status='approved'
2. POST https://api.asaas.com/v3/transfers
   { operationType: 'TED', value, bankAccount: { ... } }
3. INSERT contagém_transactions (status: pending)
4. UPDATE contagém_payment_approvals SET status='executed'
```

---

### EF5 — `contagém-internal-transfer`
**Responsabilidade:** Transferência entre subcontas Asaas (conta cliente ↔ conta mãe ou entre clientes)

```
POST /functions/v1/contagém-internal-transfer
Body: { from_company_id, to_wallet_id, amount, description }

Fluxo:
1. POST https://api.asaas.com/v3/transfers
   { value, walletId: to_wallet_id } (apiKey da from_company)
2. INSERT contagém_transactions para ambas as empresas
```

---

### EF6 — `contagém-webhook`
**Responsabilidade:** Processar eventos Asaas — atualizar transações e disparar aprovações

```
POST /functions/v1/contagém-webhook
(registrado no Asaas: eventos TRANSFER_*, PAYMENT_*, BALANCE_*)

Eventos tratados:
- TRANSFER_CONFIRMED    → UPDATE tx status='confirmed' + atualizar saldo
- TRANSFER_FAILED       → UPDATE tx status='failed' + reverter aprovação
- PAYMENT_RECEIVED      → INSERT credit em contagém_transactions + notif push
- PAYMENT_CONFIRMED     → confirmar entrada de Pix/boleto
- BALANCE_UPDATED       → UPDATE contagém_accounts.balance_cents

Idempotência: verificar asaas_event_id antes de INSERT
```

---

### EF7 — `contagém-auto-execute`
**Responsabilidade:** Job diário — executar pagamentos aprovados com vencimento hoje e saldo suficiente

```
POST /functions/v1/contagém-auto-execute
(chamada pelo cron às 08:00 BRT)

Fluxo:
1. SELECT * FROM contagém_payment_approvals
   WHERE status='approved' AND auto_execute=true AND due_date <= today
2. Para cada aprovação:
   a. Verificar saldo via contagém-balance
   b. Se saldo >= amount: chamar EF3 (Pix) ou EF4 (TED) conforme payment_type
   c. Se saldo insuficiente: notif push ao gestor
3. Logar resultados
```

---

### EF8 — `contagém-approvals`
**Responsabilidade:** CRUD da fila de aprovações + aprovar/rejeitar

```
GET    /functions/v1/contagém-approvals?company_id=&status=pending
POST   /functions/v1/contagém-approvals          → criar aprovação
PATCH  /functions/v1/contagém-approvals/:id/approve → aprovar
PATCH  /functions/v1/contagém-approvals/:id/reject  → rejeitar

Ao APROVAR com auto_execute=true: envia push notification ao gestor confirmando
Ao APROVAR sem auto_execute: executa imediatamente
```

---

## 5. INTEGRAÇÃO COM MÓDULOS EXISTENTES

### 5.1 Contas a Pagar → ContaGem
Quando um lançamento em `accounts_payable` tem `payment_method = 'contagém'`:
1. Sistema cria automaticamente um registro em `contagém_payment_approvals`
2. Financeiro vê a fila de aprovações no módulo ContaGem
3. Gestor aprova via app ou web
4. Pagamento sai no vencimento

### 5.2 Contas a Receber → ContaGem
Pix e boletos emitidos via GenPro360 (já integrado ao Asaas) refletem automaticamente como crédito em `contagém_transactions` via webhook.

### 5.3 Transferência entre contas bancárias
O módulo existente de `company_bank_accounts` ganha um novo tipo `contagém`, representando a subconta digital. Transferências entre contas passam pelo EF5.

---

## 6. FRONTEND — COMPONENTES E TELAS

### 6.1 Estrutura de rotas
```
/financeiro/contagém
  /dashboard         → Saldo + extrato + ações rápidas
  /aprovacoes        → Fila de aprovações pendentes
  /transferencias    → Nova transferência (Pix / TED / interna)
  /extrato           → Histórico completo com filtros
  /configuracoes     → Onboarding KYC + dados da conta
```

### 6.2 Componentes principais

**`ContaGemDashboard.tsx`**
- Card de saldo (atualiza a cada 5 min via polling)
- Resumo: entradas/saídas do mês
- Atalhos: Pix, Aprovações pendentes (badge com contador), Extrato
- Integração: `useContaGemBalance()`, `useContaGemStats()`

**`AprovacoesFila.tsx`** ← CORAÇÃO DO MÓDULO
- Lista de pagamentos pendentes agrupados por data de vencimento
- Para cada item: nome, valor, tipo, vencimento, checkbox auto_execute
- Ações: Aprovar ✅ / Rejeitar ❌ / Aprovar todos do dia
- Badge no menu lateral com contador de pendentes
- Integração: `useContaGemApprovals()`

**`NovaTransferencia.tsx`**
- Step 1: Tipo (Pix / TED / Interna)
- Step 2: Dados do destinatário
- Step 3: Valor + descrição
- Step 4: Confirmação com saldo disponível
- Integração: `useContaGemPix()`, `useContaGemTed()`

**`ExtratoContagem.tsx`**
- Tabela virtual (react-window para performance)
- Filtros: data, tipo, direção (entrada/saída), status
- Exportar CSV
- Integração: `useContaGemTransactions()`

**`ContaGemOnboarding.tsx`**
- Formulário de abertura de conta (dados PJ)
- Upload documentos (CNH, contrato social)
- Status do processo de aprovação Asaas
- Só visível para admin da empresa

### 6.3 Hooks
```typescript
useContaGemAccount(companyId)     // dados da conta + status
useContaGemBalance(companyId)     // saldo em tempo real
useContaGemTransactions(filters)  // extrato paginado
useContaGemApprovals(status)      // fila de aprovações
useContaGemPix()                  // mutation envio Pix
useContaGemTed()                  // mutation envio TED
useContaGemApprove()              // mutation aprovar/rejeitar
```

---

## 7. PUSH NOTIFICATIONS

Eventos que disparam push ao gestor:
| Evento | Mensagem |
|---|---|
| Novo pagamento pendente de aprovação | "💳 3 contas vencem hoje — R$ 12.400 aguardando aprovação" |
| Pagamento executado com sucesso | "✅ Pix enviado para Fornecedor X — R$ 3.200" |
| Falha no pagamento | "❌ Falha ao pagar Fornecedor X — saldo insuficiente" |
| Pix/boleto recebido | "💰 Entrada de R$ 5.000 — Cliente Y" |
| Saldo abaixo do mínimo configurado | "⚠️ Saldo ContaGem abaixo de R$ 1.000" |

Implementação: Supabase Realtime + FCM (Firebase Cloud Messaging) via DEVOPS.

---

## 8. SEGURANÇA

- `apiKey` da subconta **nunca** vai ao frontend — armazenada no Supabase Vault
- Todas as EFs validam `company_id` do usuário autenticado antes de qualquer operação Asaas
- RLS em todas as tabelas `contagém_*`
- Aprovações requerem role `admin` ou `financial_manager`
- Auto-execute só funciona se `approved_by` for diferente do `created_by` (4-eyes principle)
- Webhook Asaas validado por IP whitelist (IPs oficiais Asaas configurados no Supabase)

---

## 9. ORDEM DE EXECUÇÃO

```
Sprint 1 — BACK-END (1 semana):
  T1: migrations 020, 021, 022, 023
  T2: EF1 contagém-onboarding
  T3: EF2 contagém-balance
  T4: EF6 contagém-webhook
  T5: EF8 contagém-approvals (CRUD)

Sprint 2 — BACK-END + FRONT-END paralelo:
  T6: EF3 contagém-pix
  T7: EF4 contagém-ted
  T8: EF5 contagém-internal-transfer
  T9: EF7 contagém-auto-execute (cron)
  F1: ContaGemDashboard + useContaGemBalance
  F2: AprovacoesFila + useContaGemApprovals
  F3: NovaTransferencia (Pix + TED)
  F4: ExtratoContagem

Sprint 3 — Integração + Push:
  T10: Integração accounts_payable → contagém_payment_approvals
  F5: ContaGemOnboarding (KYC)
  F6: Push notifications (FCM)
  QA: smoke tests completos
```

---

## 10. DEPENDÊNCIAS EXTERNAS

| Item | Status | Responsável |
|---|---|---|
| Chave Asaas produção | ⏳ aguardando Márcio | Márcio |
| Aprovação KYC Asaas (período avaliação) | ⚠️ risco regulatório | Márcio + Asaas |
| FCM (Firebase) para push | 🔧 configurar | DEVOPS |
| Supabase Vault ativo | ✅ já configurado | — |

---

## 11. ACCEPTANCE CRITERIA (QA)

- [ ] Subconta criada via onboarding recebe `apiKey` e `walletId` distintos da conta mãe
- [ ] Saldo da subconta reflete em tempo real após Pix recebido
- [ ] Pagamento com `auto_execute=true` aprovado ontem executa hoje às 08h sem intervenção
- [ ] Pagamento com `auto_execute=true` com saldo insuficiente NÃO executa e envia push
- [ ] Aprovação pelo mesmo usuário que criou o lançamento é BLOQUEADA (4-eyes)
- [ ] Webhook duplicado (mesmo `asaas_event_id`) não cria transação duplicada
- [ ] RLS: empresa A não vê dados da empresa B em nenhuma tabela `contagém_*`
- [ ] Extrato exibe todas as movimentações com status correto
- [ ] TED falha graciosamente com mensagem de erro clara ao usuário

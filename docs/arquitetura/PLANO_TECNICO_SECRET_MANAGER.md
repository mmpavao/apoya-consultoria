# PLANO TÉCNICO — secret-manager + ApiKeyManager
**ARQUITETO | 2026-05-20**
**Branch:** `feature/secret-manager`
**Prioridade:** P0 — Super Admin

---

## 1. CONTEXTO E DECISÕES ARQUITETURAIS

### Estado atual confirmado via auditoria:
- `useIntegrationTests` → **stub completo** (retorna sempre erro, não chama nenhuma edge function)
- `IntegrationSecretStatus` → componente visual puro, sem integração real
- `useIntegrationsStatus` → só lê dados de tabelas (emails, billing), não lista secrets reais
- `StripeIntegrationTab` está presente e deve ser **substituído por `AsaasIntegrationTab`**
- `IntegrationsManager.tsx` tem tab "stripe" hardcoded → renomear para "asaas"
- Edge function `api-key-diagnostics` existe mas é diagnóstico de insert em company api_keys, **não** de secrets do Supabase

### Decisão de segurança (CRÍTICA):
- A `secret-manager` edge function precisa de `SUPABASE_ACCESS_TOKEN` — este token é o **personal access token** da Management API do Supabase, com escopo global. **NUNCA expor no frontend.**
- A function valida `is_super_admin = true` na tabela `users` antes de qualquer operação
- `GET /list` → retorna apenas nomes (nunca valores)
- Valores de secrets **nunca** trafegam do servidor para o frontend

### Estrutura de roles confirmada:
- Campo `is_super_admin: boolean` na tabela `users`
- Enum `app_role` tem valor `super_admin` — mas o campo relevante é `is_super_admin`

---

## 2. AFFECTED FILES

### Novos (criar):
```
supabase/functions/secret-manager/index.ts
src/components/admin/integrations/ApiKeyManager.tsx
src/components/admin/integrations/AsaasIntegrationTab.tsx
src/hooks/useSecretManager.ts
```

### Modificar:
```
src/hooks/useIntegrationTests.ts          → implementação real
src/components/admin/IntegrationsManager.tsx  → stripe→asaas
src/components/admin/integrations/index.ts    → exports
```

### Remover (após substituição):
```
src/components/admin/integrations/StripeIntegrationTab.tsx  → substituir por AsaasIntegrationTab
```

---

## 3. EDGE FUNCTION — `secret-manager`

### Interface pública:

```
POST /functions/v1/secret-manager
Headers:
  Authorization: Bearer <user_jwt>
  apikey: <supabase_anon_key>
  Content-Type: application/json

Body (discriminated union por `action`):
  { action: "list" }
  { action: "upsert", name: string, value: string }
  { action: "remove", name: string }
```

### Tipos TypeScript da edge function:

```typescript
// ─── Request shapes ───────────────────────────────────────────────────────
type SecretManagerAction = "list" | "upsert" | "remove";

interface ListRequest {
  action: "list";
}

interface UpsertRequest {
  action: "upsert";
  name: string;   // ex: "RESEND_API_KEY"
  value: string;  // valor real da secret
}

interface RemoveRequest {
  action: "remove";
  name: string;
}

type SecretManagerRequest = ListRequest | UpsertRequest | RemoveRequest;

// ─── Response shapes ──────────────────────────────────────────────────────
interface SecretInfo {
  name: string;
  // value NUNCA retornado
}

interface ListResponse {
  ok: true;
  secrets: SecretInfo[];
}

interface MutationResponse {
  ok: true;
  action: "upsert" | "remove";
  name: string;
}

interface ErrorResponse {
  ok: false;
  error: string;
  code?: string;
}

type SecretManagerResponse = ListResponse | MutationResponse | ErrorResponse;
```

### Lógica da edge function:

```
1. CORS preflight → return 204
2. Extrai JWT do header Authorization
3. Valida JWT → cria supabaseClient com anon_key + JWT do usuário
4. Consulta tabela users: SELECT is_super_admin WHERE id = auth.uid()
   → Se is_super_admin != true → 403 { ok: false, error: "forbidden" }
5. Lê body JSON → valida action
6. Lê SUPABASE_ACCESS_TOKEN do Deno.env (token da Management API)
7. Executa ação:
   - list   → GET  https://api.supabase.com/v1/projects/{PROJECT_ID}/secrets
   - upsert → POST https://api.supabase.com/v1/projects/{PROJECT_ID}/secrets
              body: [{ name, value }]
   - remove → DELETE https://api.supabase.com/v1/projects/{PROJECT_ID}/secrets/{name}
8. Retorna response formatado (list nunca inclui valores)
```

### Variáveis de ambiente necessárias (secrets Supabase):
```
SUPABASE_ACCESS_TOKEN  → Personal Access Token da Management API do Supabase
                         (já existe implicitamente no GENPRO_SUPABASE_ACCESS_TOKEN)
SUPABASE_URL           → já configurado
SUPABASE_ANON_KEY      → já configurado
```

⚠️ **Ação Márcio**: Injetar `SUPABASE_ACCESS_TOKEN` como secret no projeto `huefciqpcorcvguabtcj`.

---

## 4. HOOK — `useSecretManager`

```typescript
// src/hooks/useSecretManager.ts

export interface SecretInfo {
  name: string;
  configured: boolean; // true se está na lista retornada pela API
}

export interface UseSecretManagerReturn {
  secrets: SecretInfo[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  listSecrets: () => Promise<void>;
  upsertSecret: (name: string, value: string) => Promise<boolean>;
  removeSecret: (name: string) => Promise<boolean>;
}

// Internamente:
// - chama supabase.functions.invoke("secret-manager", { body: { action, ... } })
// - gerencia estado local de loading/error
// - após upsert/remove bem-sucedido: re-executa listSecrets() automaticamente
// - usa toast (sonner) para feedback
```

---

## 5. HOOK — `useIntegrationTests` (substituição real)

### Implementação real (substituir stub):

```typescript
// Cada função de teste chama a edge function correspondente via service role
// O resultado é { success: boolean, duration_ms: number, message: string, details? }

export function useIntegrationTests() {
  // fetchSecrets → invoca secret-manager/list
  const fetchSecrets = useCallback(async () => {
    const { data } = await supabase.functions.invoke("secret-manager", {
      body: { action: "list" }
    });
    setSecrets(data?.secrets?.map(s => ({
      name: s.name,
      configured: true
    })) ?? []);
  }, []);

  // testResend → invoca send-transactional-email com payload de teste
  // testNfeio  → invoca nfeio-core/status
  // testAsaas  → invoca nova edge function asaas-core/status (a criar)
  // invoke     → invoca edge function genérica por nome
}
```

---

## 6. COMPONENTE — `ApiKeyManager`

### Props interface:

```typescript
export interface ApiKeyManagerProps {
  /** Nome da secret no Supabase (ex: "RESEND_API_KEY") */
  secretName: string;

  /** Label display para o usuário (ex: "Resend API Key") */
  label: string;

  /** Descrição opcional */
  description?: string;

  /** Placeholder para o input */
  placeholder?: string;

  /** Nome da edge function para teste (ex: "nfeio-core") */
  testFunction?: string;

  /** Payload a enviar para a edge function de teste */
  testPayload?: Record<string, unknown>;

  /** Se a secret está configurada (vem de useSecretManager) */
  isConfigured: boolean;

  /** Loading state do secret manager */
  isLoading?: boolean;

  /** Callback após salvar com sucesso */
  onSaved?: () => void;
}
```

### Comportamento do componente:

```
Estado interno:
  inputValue: string = ""      (nunca exibido após submit)
  isRevealing: boolean = false (botão olho — só mostra o input digitado, nunca busca valor real)
  isSaving: boolean = false
  isTesting: boolean = false
  testResult: TestResult | null

Render:
  [Key icon] [Label]                    [Badge: ✅ Configurado | ❌ Ausente]
  ─────────────────────────────────────────────────────────────
  [Input type=password ●●●●●●●●●●●●]   [👁 Revelar]
  [Descrição opcional]
  ─────────────────────────────────────────────────────────────
  [Botão Salvar]          [Botão Testar]
  [TestResult badge — verde/vermelho + mensagem]

Regras:
  - Input sempre type="password" por padrão
  - Botão "Revelar" só alterna type para "text" localmente (não busca valor do servidor)
  - Botão "Salvar" desabilitado se inputValue.trim() === ""
  - Botão "Testar" sempre disponível (testa a config atual no servidor)
  - Após salvar: inputValue = "", badge muda para ✅ Configurado
  - NUNCA há endpoint de leitura do valor — impossível vazar
```

---

## 7. SUBSTITUIÇÃO STRIPE → ASAAS

### Arquivos a criar/modificar:

**`src/components/admin/integrations/AsaasIntegrationTab.tsx`**
- Mesma estrutura do StripeIntegrationTab
- Secrets: `ASAAS_API_KEY`, `ASAAS_API_URL`
- Testa via edge function `asaas-core/status` (já configurada no banco? verificar)
- Tab label: "Asaas" | ícone: `CreditCard`

**`IntegrationsManager.tsx`**:
```diff
- import { StripeIntegrationTab } from "./integrations"
+ import { AsaasIntegrationTab } from "./integrations"

- { id: "stripe", label: "Stripe", icon: CreditCard },
+ { id: "asaas",  label: "Asaas",  icon: CreditCard },

- <TabsContent value="stripe"><StripeIntegrationTab /></TabsContent>
+ <TabsContent value="asaas"><AsaasIntegrationTab /></TabsContent>
```

---

## 8. ACCEPTANCE CRITERIA

| ID | Critério | Como verificar |
|----|----------|----------------|
| AC-1 | `secret-manager/list` retorna apenas nomes, nunca valores | Inspecionar response JSON |
| AC-2 | `secret-manager/list` retorna 403 para usuário não super_admin | Testar com JWT de user comum |
| AC-3 | `secret-manager/upsert` cria/atualiza secret no Supabase | Verificar via Management API após upsert |
| AC-4 | `secret-manager/remove` deleta secret do Supabase | Verificar via Management API após remove |
| AC-5 | `ApiKeyManager` nunca exibe valor de secret existente | Revisar código — sem GET de valor |
| AC-6 | `ApiKeyManager` status badge reflete estado real (não hardcoded) | Testar com secret ausente e presente |
| AC-7 | `useIntegrationTests.fetchSecrets()` retorna lista real de secrets | Checar retorno no painel |
| AC-8 | Tab Stripe removida e Asaas funcionando | Verificar painel /admin > Integrações |
| AC-9 | `SUPABASE_ACCESS_TOKEN` injetada como secret antes do deploy | Testar chamada real da edge function |

---

## 9. ORDEM DE EXECUÇÃO

```
1. BACK-END DEV: criar supabase/functions/secret-manager/index.ts
2. BACK-END DEV: deploy da edge function (branch feature/secret-manager)
3. Márcio: injetar SUPABASE_ACCESS_TOKEN no Supabase destino
4. FRONT-END DEV: criar src/hooks/useSecretManager.ts
5. FRONT-END DEV: criar src/components/admin/integrations/ApiKeyManager.tsx
6. FRONT-END DEV: refatorar useIntegrationTests.ts (implementação real)
7. FRONT-END DEV: criar AsaasIntegrationTab.tsx (substituir Stripe)
8. FRONT-END DEV: atualizar IntegrationsManager.tsx
9. QA TESTER: smoke tests AC-1 a AC-9
10. ARQUITETO: revisar PR e emitir veredicto
```

---

## 10. RISCO E MITIGAÇÃO

| Risco | Mitigação |
|-------|-----------|
| SUPABASE_ACCESS_TOKEN vazar no frontend | A secret nunca é lida no cliente — apenas a edge function a usa via Deno.env |
| Super admin forjado | Edge function valida JWT + query no banco (is_super_admin) — não confia em claims do JWT |
| Remoção acidental de secret crítica | UI exige confirmação (dialog) antes de `remove` |
| Asaas edge function não existe | Verificar se `asaas-core` está no repo — se não, criar stub de status primeiro |

---

**VEREDICTO ARQUITETO:** PLANO APROVADO ✅
Aguarda implementação pelo BACK-END DEV e FRONT-END DEV.

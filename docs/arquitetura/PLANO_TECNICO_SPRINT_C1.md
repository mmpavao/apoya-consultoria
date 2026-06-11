# PLANO TÉCNICO — SPRINT C1: ASSINATURAS NATIVAS (CUSTOMER-FACING)

```json
{
  "aprovado_por": "ARQUITETO",
  "data_aprovacao": "2026-05-20",
  "versao": "1.1",
  "status": "APROVADO — EXECUÇÃO AUTORIZADA",
  "resolucao_ponto_em_aberto": {
    "funcao_auditada": "get_user_company_ids(_user_id uuid) → SETOF uuid",
    "existe_no_banco": true,
    "existe_nas_migrations_do_repo": false,
    "origem": "schema dump do Lovable aplicado diretamente — igual a is_super_admin, has_company_role e outras utilitárias",
    "decisao": "USE has_company_role() — ver padrão estabelecido abaixo",
    "justificativa": "has_company_role() é a função canônica usada em TODAS as migrations de RLS do projeto (confirmado em 20260503070000, 20260508130000 e outras). get_user_company_ids() existe no banco mas NUNCA foi usada em nenhuma migration — não é o padrão do projeto."
  }
}
```

---

## PADRÃO RLS CANÔNICO DO PROJETO (USE ISTO)

Baseado na leitura de 6 migrations de RLS do repo mmpavao/genpro360-clone:

```sql
-- PADRÃO PARA SELECT (membros da empresa):
USING (public.has_company_role(auth.uid(), company_id, ARRAY['owner','admin','manager','member','viewer']::app_role[]))

-- PADRÃO PARA INSERT/UPDATE/DELETE (apenas admins):
USING (public.has_company_role(auth.uid(), company_id, ARRAY['owner','admin']::app_role[]))

-- PADRÃO PARA SUPER ADMIN:
USING (public.is_super_admin(auth.uid()))
```

**NÃO usar:** `get_user_company_ids()`, `user_belongs_to_company()` em policies de tabelas com `company_id` direto — essas funções são para queries, não policies de RLS.

**Enum `app_role` confirmado:** `owner | admin | manager | member | viewer | super_admin | accountant`

---

## ESCOPO DA SPRINT C1

### Decisão de arquitetura (confirmada):
- Tabela `plans` existente → **NÃO TOCAR** (planos do SaaS GenPro360)
- Tabela `subscriptions` existente → **NÃO TOCAR** (assinatura empresa↔GenPro360)
- Edge functions `asaas-webhook`, `asaas-checkout` → **NÃO TOCAR**
- Sprint C1 cria namespace completamente separado: `customer_*`

---

## AFFECTED FILES

```json
{
  "migrations": [
    "supabase/migrations/20260520_001_customer_plans.sql",
    "supabase/migrations/20260520_002_customer_subscribers.sql",
    "supabase/migrations/20260520_003_subscription_events_log.sql"
  ],
  "edge_functions_criar": [
    "supabase/functions/manage-subscriptions/index.ts",
    "supabase/functions/public-plans/index.ts",
    "supabase/functions/customer-webhook/index.ts"
  ],
  "edge_functions_nao_alterar": [
    "supabase/functions/asaas-webhook/index.ts",
    "supabase/functions/asaas-checkout/index.ts",
    "supabase/functions/asaas-portal/index.ts"
  ],
  "frontend": [
    "src/pages/assinaturas/PlansPage.tsx",
    "src/pages/assinaturas/SubscribersPage.tsx",
    "src/components/assinaturas/PlanFormModal.tsx",
    "src/components/assinaturas/SubscriberFormModal.tsx",
    "src/hooks/useCustomerPlans.ts",
    "src/hooks/useSubscribers.ts",
    "src/routes/assinaturas.routes.tsx",
    "src/App.tsx"
  ]
}
```

---

## EXECUTION ORDER

```
T1: migration 001 customer_plans      ← COMEÇAR AQUI
T2: migration 002 customer_subscribers  (depende de T1)
T3: migration 003 subscription_events_log (depende de T2)
T4: EF public-plans        (depende de T1 apenas — pode ir junto com T2/T3)
T5: EF manage-subscriptions (depende de T1+T2 deployed)
T6: EF customer-webhook    (depende de T2+T3 — DEPLOY ANTES de configurar webhook no Asaas)
T7: FE hooks + pages       (depende de T5 em staging)
```

---

## MIGRATION T1 — `customer_plans`
**Arquivo:** `supabase/migrations/20260520_001_customer_plans.sql`

```sql
BEGIN;

CREATE TABLE public.customer_plans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name                    text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description             text,
  features                jsonb NOT NULL DEFAULT '[]'::jsonb,
  price                   numeric(10,2) NOT NULL CHECK (price >= 0),
  billing_cycle           text NOT NULL DEFAULT 'monthly'
                            CHECK (billing_cycle IN ('monthly','quarterly','semiannual','annual','onetime')),
  currency                text NOT NULL DEFAULT 'BRL',
  trial_days              integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  asaas_plan_id           text,
  is_active               boolean NOT NULL DEFAULT true,
  is_public               boolean NOT NULL DEFAULT true,
  sort_order              integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_customer_plans_company_id
  ON public.customer_plans(company_id);
CREATE INDEX idx_customer_plans_active
  ON public.customer_plans(company_id, is_active);
CREATE UNIQUE INDEX idx_customer_plans_name_company
  ON public.customer_plans(company_id, lower(name));

-- updated_at automático (trigger já existe no projeto)
CREATE TRIGGER trg_customer_plans_updated_at
  BEFORE UPDATE ON public.customer_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_plans ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer membro da empresa
CREATE POLICY "customer_plans_select_members"
  ON public.customer_plans FOR SELECT TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id,
      ARRAY['owner','admin','manager','member','viewer','accountant']::app_role[])
  );

-- ALL: apenas owner/admin
CREATE POLICY "customer_plans_manage_admins"
  ON public.customer_plans FOR ALL TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id,
      ARRAY['owner','admin']::app_role[])
  );

-- SELECT público para widget (sem auth) — planos ativos e públicos
CREATE POLICY "customer_plans_public_widget"
  ON public.customer_plans FOR SELECT TO anon
  USING (is_active = true AND is_public = true);

-- Super admin full access
CREATE POLICY "customer_plans_super_admin"
  ON public.customer_plans FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

COMMENT ON TABLE public.customer_plans IS
  'Planos de assinatura criados pelas empresas para cobrar seus próprios assinantes via Asaas.';

COMMIT;
```

---

## MIGRATION T2 — `customer_subscribers`
**Arquivo:** `supabase/migrations/20260520_002_customer_subscribers.sql`

```sql
BEGIN;

CREATE TABLE public.customer_subscribers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id                 uuid NOT NULL REFERENCES public.customer_plans(id) ON DELETE RESTRICT,

  -- Dados do assinante
  name                    text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 200),
  email                   text NOT NULL CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  cpf_cnpj                text,
  phone                   text,

  -- Status da assinatura
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN (
                              'pending','trialing','active',
                              'past_due','canceled','expired'
                            )),
  billing_cycle           text NOT NULL DEFAULT 'monthly'
                            CHECK (billing_cycle IN (
                              'monthly','quarterly','semiannual','annual','onetime'
                            )),

  -- Datas de período
  trial_start             timestamptz,
  trial_end               timestamptz,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  canceled_at             timestamptz,
  cancellation_reason     text,

  -- Integração Asaas
  asaas_customer_id       text,
  asaas_subscription_id   text,
  asaas_checkout_url      text,
  last_payment_id         text,
  last_payment_value      numeric(10,2),
  last_payment_at         timestamptz,

  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_customer_subscribers_company
  ON public.customer_subscribers(company_id);
CREATE INDEX idx_customer_subscribers_plan
  ON public.customer_subscribers(plan_id);
CREATE INDEX idx_customer_subscribers_status
  ON public.customer_subscribers(company_id, status);
CREATE INDEX idx_customer_subscribers_asaas_sub
  ON public.customer_subscribers(asaas_subscription_id)
  WHERE asaas_subscription_id IS NOT NULL;

-- Email único por empresa (não global)
CREATE UNIQUE INDEX idx_customer_subscribers_email_company
  ON public.customer_subscribers(company_id, lower(email));

CREATE TRIGGER trg_customer_subscribers_updated_at
  BEFORE UPDATE ON public.customer_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_subscribers_select_members"
  ON public.customer_subscribers FOR SELECT TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id,
      ARRAY['owner','admin','manager','member','viewer','accountant']::app_role[])
  );

CREATE POLICY "customer_subscribers_manage_admins"
  ON public.customer_subscribers FOR ALL TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id,
      ARRAY['owner','admin']::app_role[])
  );

CREATE POLICY "customer_subscribers_super_admin"
  ON public.customer_subscribers FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

COMMENT ON TABLE public.customer_subscribers IS
  'Assinantes dos planos customer_plans. Um subscriber é um cliente externo da empresa.';

COMMIT;
```

---

## MIGRATION T3 — `subscription_events_log`
**Arquivo:** `supabase/migrations/20260520_003_subscription_events_log.sql`

```sql
BEGIN;

CREATE TABLE public.subscription_events_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subscriber_id   uuid REFERENCES public.customer_subscribers(id) ON DELETE SET NULL,
  event_type      text NOT NULL,
  asaas_event_id  text,
  raw_payload     jsonb NOT NULL DEFAULT '{}',
  processed       boolean NOT NULL DEFAULT false,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sel_company
  ON public.subscription_events_log(company_id);
CREATE INDEX idx_sel_subscriber
  ON public.subscription_events_log(subscriber_id);
CREATE INDEX idx_sel_type_date
  ON public.subscription_events_log(event_type, created_at DESC);

-- Garante idempotência: mesmo evento não processado duas vezes
CREATE UNIQUE INDEX idx_sel_idempotency
  ON public.subscription_events_log(asaas_event_id, event_type)
  WHERE asaas_event_id IS NOT NULL;

ALTER TABLE public.subscription_events_log ENABLE ROW LEVEL SECURITY;

-- Apenas leitura para membros — escrita apenas via service_role (edge function)
CREATE POLICY "sel_select_members"
  ON public.subscription_events_log FOR SELECT TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id,
      ARRAY['owner','admin','manager']::app_role[])
  );

CREATE POLICY "sel_super_admin"
  ON public.subscription_events_log FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

COMMENT ON TABLE public.subscription_events_log IS
  'Log imutável de webhooks Asaas para assinaturas customer-facing. Escrita apenas via service_role.';

COMMIT;
```

---

## EDGE FUNCTION T4 — `public-plans`
**Arquivo:** `supabase/functions/public-plans/index.ts`
**Auth:** NENHUMA — endpoint público para o widget JS

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "public, max-age=60",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const company_id = url.searchParams.get("company_id");

  // Validar UUID
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!company_id || !UUID_RE.test(company_id)) {
    return new Response(
      JSON.stringify({ error: "company_id is required and must be a valid UUID" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // service_role para bypassar RLS — policy "public_widget" permite anon,
  // mas usar service_role evita exposição da anon key no widget
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verificar empresa existe e está ativa
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .select("id, name, logo_url, trade_name")
    .eq("id", company_id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .single();

  if (companyErr || !company) {
    return new Response(
      JSON.stringify({ error: "company_not_found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Buscar planos públicos e ativos
  const { data: plans, error: plansErr } = await supabase
    .from("customer_plans")
    .select("id, name, description, features, price, billing_cycle, currency, trial_days, sort_order")
    .eq("company_id", company_id)
    .eq("is_active", true)
    .eq("is_public", true)
    .order("sort_order", { ascending: true });

  if (plansErr) {
    console.error("[public-plans] DB error:", plansErr);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      company: {
        name: company.trade_name || company.name,
        logo_url: company.logo_url ?? null,
      },
      plans: plans ?? [],
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

---

## EDGE FUNCTION T5 — `manage-subscriptions`
**Arquivo:** `supabase/functions/manage-subscriptions/index.ts`
**Auth:** Bearer JWT obrigatório

**Contrato de API — actions suportadas:**

| action | quem pode | descrição |
|---|---|---|
| `list_plans` | qualquer membro | lista planos da empresa |
| `create_plan` | owner / admin | cria plano + opcionalmente no Asaas |
| `update_plan` | owner / admin | edita campos não-financeiros |
| `archive_plan` | owner / admin | is_active=false, is_public=false |
| `list_subscribers` | qualquer membro | lista assinantes paginado |
| `create_subscriber` | owner / admin | cria subscriber + Asaas customer + subscription |
| `cancel_subscriber` | owner / admin | cancela no Asaas + atualiza status |

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_URL = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";

// Mapeamento billing_cycle → Asaas cycle
const CYCLE_MAP: Record<string, string> = {
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  semiannual: "SEMIANNUALLY",
  annual: "YEARLY",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { action, company_id } = body;

  if (!action || !company_id) {
    return new Response(JSON.stringify({ error: "action and company_id are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Helper de autorização
  async function isAdmin(): Promise<boolean> {
    const { data } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .in("role", ["owner", "admin"])
      .eq("is_active", true)
      .maybeSingle();
    return !!data;
  }

  async function isMember(): Promise<boolean> {
    const { data } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .eq("is_active", true)
      .maybeSingle();
    return !!data;
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // ─────────────────────────────────────────────
  // ACTION: list_plans
  // ─────────────────────────────────────────────
  if (action === "list_plans") {
    if (!(await isMember())) return json({ error: "Forbidden" }, 403);

    const { data: plans, error } = await supabase
      .from("customer_plans")
      .select(`
        id, name, description, features, price, billing_cycle, currency,
        trial_days, asaas_plan_id, is_active, is_public, sort_order, created_at,
        subscriber_count:customer_subscribers(count)
      `)
      .eq("company_id", company_id)
      .order("sort_order", { ascending: true });

    if (error) return json({ error: error.message }, 500);
    return json({ plans: plans ?? [], total: plans?.length ?? 0 });
  }

  // ─────────────────────────────────────────────
  // ACTION: create_plan
  // ─────────────────────────────────────────────
  if (action === "create_plan") {
    if (!(await isAdmin())) return json({ error: "Forbidden — owner/admin required" }, 403);

    const { name, description, features, price, billing_cycle, trial_days, is_public, sort_order } = body;
    if (!name || price === undefined || !billing_cycle) {
      return json({ error: "name, price, billing_cycle are required" }, 400);
    }

    const { data: plan, error } = await supabase
      .from("customer_plans")
      .insert({
        company_id,
        name,
        description: description ?? null,
        features: features ?? [],
        price,
        billing_cycle,
        trial_days: trial_days ?? 0,
        is_public: is_public ?? true,
        sort_order: sort_order ?? 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") return json({ error: "Plan name already exists for this company" }, 400);
      return json({ error: error.message }, 500);
    }

    return json({ plan, message: "Plano criado com sucesso" }, 201);
  }

  // ─────────────────────────────────────────────
  // ACTION: update_plan
  // ─────────────────────────────────────────────
  if (action === "update_plan") {
    if (!(await isAdmin())) return json({ error: "Forbidden" }, 403);

    const { plan_id, name, description, features, is_active, is_public, sort_order, trial_days } = body;
    if (!plan_id) return json({ error: "plan_id is required" }, 400);

    // Bloquear alteração de price/billing_cycle com assinantes ativos
    if (body.price !== undefined || body.billing_cycle !== undefined) {
      const { count } = await supabase
        .from("customer_subscribers")
        .select("id", { count: "exact", head: true })
        .eq("plan_id", plan_id)
        .in("status", ["active", "trialing", "past_due"]);
      if ((count ?? 0) > 0) {
        return json({
          error: "cannot_change_price_with_active_subscribers",
          active_count: count,
        }, 409);
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (features !== undefined) updates.features = features;
    if (is_active !== undefined) updates.is_active = is_active;
    if (is_public !== undefined) updates.is_public = is_public;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (trial_days !== undefined) updates.trial_days = trial_days;

    const { data: plan, error } = await supabase
      .from("customer_plans")
      .update(updates)
      .eq("id", plan_id)
      .eq("company_id", company_id)
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ plan });
  }

  // ─────────────────────────────────────────────
  // ACTION: archive_plan
  // ─────────────────────────────────────────────
  if (action === "archive_plan") {
    if (!(await isAdmin())) return json({ error: "Forbidden" }, 403);
    const { plan_id } = body;
    if (!plan_id) return json({ error: "plan_id is required" }, 400);

    const { error } = await supabase
      .from("customer_plans")
      .update({ is_active: false, is_public: false })
      .eq("id", plan_id)
      .eq("company_id", company_id);

    if (error) return json({ error: error.message }, 500);
    return json({ archived: true });
  }

  // ─────────────────────────────────────────────
  // ACTION: list_subscribers
  // ─────────────────────────────────────────────
  if (action === "list_subscribers") {
    if (!(await isMember())) return json({ error: "Forbidden" }, 403);

    const { plan_id, status, page = 1, page_size = 50 } = body;
    let query = supabase
      .from("customer_subscribers")
      .select(`*, plan:customer_plans(id, name, price, billing_cycle)`, { count: "exact" })
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })
      .range((page - 1) * page_size, page * page_size - 1);

    if (plan_id) query = query.eq("plan_id", plan_id);
    if (status) query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ subscribers: data ?? [], total: count ?? 0, page, has_more: (count ?? 0) > page * page_size });
  }

  // ─────────────────────────────────────────────
  // ACTION: create_subscriber
  // ─────────────────────────────────────────────
  if (action === "create_subscriber") {
    if (!(await isAdmin())) return json({ error: "Forbidden" }, 403);

    const { plan_id, name, email, cpf_cnpj, phone, billing_cycle = "monthly", send_checkout_link = true } = body;
    if (!plan_id || !name || !email) return json({ error: "plan_id, name, email are required" }, 400);
    if (!ASAAS_KEY) return json({ error: "ASAAS_API_KEY not configured", status: "pending_setup" }, 503);

    // Verificar plano ativo
    const { data: plan, error: planErr } = await supabase
      .from("customer_plans")
      .select("id, name, price, billing_cycle, trial_days, asaas_plan_id")
      .eq("id", plan_id)
      .eq("company_id", company_id)
      .eq("is_active", true)
      .single();
    if (planErr || !plan) return json({ error: "Plan not found or inactive" }, 422);

    // Criar/obter customer Asaas
    let asaas_customer_id: string | null = null;
    try {
      const customerRes = await fetch(`${ASAAS_URL}/customers`, {
        method: "POST",
        headers: { "access_token": ASAAS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, cpfCnpj: cpf_cnpj, phone }),
      });
      const customerData = await customerRes.json();
      asaas_customer_id = customerData.id ?? null;
    } catch (e) {
      console.error("[manage-subscriptions] Asaas customer create error:", e);
    }

    // INSERT subscriber (antes da subscription Asaas para ter o ID)
    const { data: subscriber, error: subErr } = await supabase
      .from("customer_subscribers")
      .insert({
        company_id, plan_id, name, email,
        cpf_cnpj: cpf_cnpj ?? null,
        phone: phone ?? null,
        status: plan.trial_days > 0 ? "trialing" : "pending",
        billing_cycle,
        asaas_customer_id,
        trial_start: plan.trial_days > 0 ? new Date().toISOString() : null,
        trial_end: plan.trial_days > 0
          ? new Date(Date.now() + plan.trial_days * 86400000).toISOString()
          : null,
        created_by: user.id,
      })
      .select()
      .single();

    if (subErr) {
      if (subErr.code === "23505") return json({ error: "Email already subscribed to this company" }, 409);
      return json({ error: subErr.message }, 500);
    }

    // Criar subscription no Asaas
    let asaas_subscription_id: string | null = null;
    let checkout_url: string | null = null;

    if (asaas_customer_id) {
      try {
        const nextDue = new Date();
        nextDue.setDate(nextDue.getDate() + Math.max(plan.trial_days, 1));
        const nextDueDate = nextDue.toISOString().split("T")[0];

        const subRes = await fetch(`${ASAAS_URL}/subscriptions`, {
          method: "POST",
          headers: { "access_token": ASAAS_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: asaas_customer_id,
            billingType: "UNDEFINED",
            value: plan.price,
            nextDueDate,
            cycle: CYCLE_MAP[billing_cycle] ?? "MONTHLY",
            description: plan.name,
            externalReference: `${company_id}:${subscriber.id}:${billing_cycle}`,
            sendPaymentByPostalService: false,
          }),
        });
        const subData = await subRes.json();
        asaas_subscription_id = subData.id ?? null;
        checkout_url = subData.invoiceUrl ?? null;
      } catch (e) {
        console.error("[manage-subscriptions] Asaas subscription create error:", e);
      }

      // Atualizar subscriber com dados Asaas
      if (asaas_subscription_id) {
        await supabase
          .from("customer_subscribers")
          .update({ asaas_subscription_id, asaas_checkout_url: checkout_url })
          .eq("id", subscriber.id);
      }
    }

    return json({
      subscriber: { ...subscriber, asaas_subscription_id, asaas_checkout_url: checkout_url },
      checkout_url,
      message: "Assinante criado com sucesso.",
    }, 201);
  }

  // ─────────────────────────────────────────────
  // ACTION: cancel_subscriber
  // ─────────────────────────────────────────────
  if (action === "cancel_subscriber") {
    if (!(await isAdmin())) return json({ error: "Forbidden" }, 403);

    const { subscriber_id, reason } = body;
    if (!subscriber_id) return json({ error: "subscriber_id is required" }, 400);

    const { data: sub, error: findErr } = await supabase
      .from("customer_subscribers")
      .select("id, asaas_subscription_id, status")
      .eq("id", subscriber_id)
      .eq("company_id", company_id)
      .single();

    if (findErr || !sub) return json({ error: "Subscriber not found" }, 404);

    // Cancelar no Asaas se tiver subscription
    if (sub.asaas_subscription_id && ASAAS_KEY) {
      try {
        await fetch(`${ASAAS_URL}/subscriptions/${sub.asaas_subscription_id}`, {
          method: "DELETE",
          headers: { "access_token": ASAAS_KEY },
        });
      } catch (e) {
        console.error("[manage-subscriptions] Asaas cancel error:", e);
      }
    }

    const { data: updated, error: updErr } = await supabase
      .from("customer_subscribers")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancellation_reason: reason ?? null,
      })
      .eq("id", subscriber_id)
      .select()
      .single();

    if (updErr) return json({ error: updErr.message }, 500);
    return json({ canceled: true, subscriber: updated });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
```

---

## EDGE FUNCTION T6 — `customer-webhook`
**Arquivo:** `supabase/functions/customer-webhook/index.ts`
**Auth:** Header `asaas-access-token` validado contra secret `ASAAS_CUSTOMER_WEBHOOK_TOKEN`

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200 });

  const TOKEN = Deno.env.get("ASAAS_CUSTOMER_WEBHOOK_TOKEN");
  if (TOKEN && req.headers.get("asaas-access-token") !== TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const event = await req.json();
  const eventType: string = event.event ?? "";
  const payment = event.payment ?? {};
  const externalRef: string = payment.externalReference ?? "";
  const asaasEventId: string = payment.id ?? event.subscription?.id ?? "";

  console.log(`[customer-webhook] ${eventType} | ref: ${externalRef} | id: ${asaasEventId}`);

  // Parse externalReference: "{company_id}:{subscriber_id}:{billing_cycle}"
  const parts = externalRef.split(":");
  if (parts.length < 2) {
    // Evento sem referência conhecida — ignorar silenciosamente
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }

  const [company_id, subscriber_id] = parts;

  // Idempotência — tenta inserir; se violar UNIQUE, já foi processado
  const { error: insertErr } = await supabase
    .from("subscription_events_log")
    .insert({
      company_id,
      subscriber_id,
      event_type: eventType,
      asaas_event_id: asaasEventId || null,
      raw_payload: event,
      processed: false,
    });

  if (insertErr && insertErr.code === "23505") {
    // Já processado — retornar 200 idempotente
    console.log(`[customer-webhook] Duplicate event skipped: ${asaasEventId}`);
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  // Processar evento
  try {
    const statusMap: Record<string, string> = {
      PAYMENT_CONFIRMED: "active",
      PAYMENT_RECEIVED: "active",
      PAYMENT_OVERDUE: "past_due",
      PAYMENT_DELETED: "canceled",
      PAYMENT_REFUNDED: "canceled",
      SUBSCRIPTION_DELETED: "canceled",
      SUBSCRIPTION_EXPIRED: "expired",
    };

    const newStatus = statusMap[eventType];
    if (newStatus && subscriber_id) {
      const updates: Record<string, unknown> = { status: newStatus };

      if (newStatus === "active") {
        const now = new Date();
        updates.current_period_start = now.toISOString();
        updates.last_payment_id = payment.id ?? null;
        updates.last_payment_value = payment.value ?? null;
        updates.last_payment_at = now.toISOString();
      }

      if (newStatus === "canceled") {
        updates.canceled_at = new Date().toISOString();
      }

      await supabase
        .from("customer_subscribers")
        .update(updates)
        .eq("id", subscriber_id)
        .eq("company_id", company_id);
    }

    // Marcar evento como processado
    if (asaasEventId) {
      await supabase
        .from("subscription_events_log")
        .update({ processed: true, processed_at: new Date().toISOString() } as never)
        .eq("asaas_event_id", asaasEventId)
        .eq("event_type", eventType);
    }
  } catch (err) {
    console.error("[customer-webhook] Processing error:", err);
    // Registrar erro mas retornar 200 (Asaas não deve retentar em erro de aplicação)
    if (asaasEventId) {
      await supabase
        .from("subscription_events_log")
        .update({ error_message: String(err) } as never)
        .eq("asaas_event_id", asaasEventId)
        .eq("event_type", eventType);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

---

## CRITÉRIOS DE ACEITE — QA TESTER

### AC-1: Migrations
- [ ] 3 tabelas criadas com todos os campos especificados
- [ ] RLS ativo nas 3 tabelas (verificar `pg_tables.rowsecurity = true`)
- [ ] `has_company_role()` usado em todas as policies (não `get_user_company_ids`)
- [ ] Usuário membro sem role `owner/admin` não consegue INSERT em `customer_plans` → 403
- [ ] Usuário da empresa A não vê dados da empresa B
- [ ] UNIQUE index em `(company_id, lower(email))` bloqueia email duplicado por empresa
- [ ] UNIQUE index em `(asaas_event_id, event_type)` bloqueia evento duplicado

### AC-2: manage-subscriptions — Planos
- [ ] `list_plans` retorna apenas planos da empresa do usuário autenticado
- [ ] `create_plan` com campos válidos → 201, plano salvo
- [ ] `create_plan` com nome duplicado na mesma empresa → 400 (viola UNIQUE)
- [ ] `create_plan` por usuário `member` → 403
- [ ] `update_plan` alterando `price` com ≥1 assinante ativo → 409 com `active_count`
- [ ] `archive_plan` → `is_active=false`, `is_public=false`, registro permanece no banco

### AC-3: manage-subscriptions — Assinantes
- [ ] `create_subscriber` → 201, `asaas_customer_id` preenchido (verificar no sandbox Asaas)
- [ ] `create_subscriber` com email duplicado → 409
- [ ] `create_subscriber` com `send_checkout_link: true` → `checkout_url` não nulo
- [ ] `cancel_subscriber` → `status='canceled'`, `canceled_at` preenchido, DELETE enviado ao Asaas
- [ ] `list_subscribers` retorna paginado com `has_more` correto

### AC-4: public-plans
- [ ] `GET /public-plans?company_id={válido}` sem Authorization → 200
- [ ] Response não contém `asaas_plan_id`, `created_by`, `company_id`
- [ ] Plano com `is_public=false` não aparece
- [ ] `company_id` inexistente → 404
- [ ] `company_id` ausente ou inválido → 400
- [ ] Header `Cache-Control: public, max-age=60` presente

### AC-5: customer-webhook
- [ ] `PAYMENT_CONFIRMED` → subscriber `status='active'`, `last_payment_at` preenchido
- [ ] Mesmo evento enviado 2× → 200 na segunda com `duplicate: true`
- [ ] Token errado → 401
- [ ] `externalReference` ausente → 200 sem alterar nenhum subscriber
- [ ] `SUBSCRIPTION_DELETED` → `status='canceled'`, `canceled_at` preenchido

### AC-6: Frontend
- [ ] `/assinaturas/planos` carrega sem erros de console
- [ ] Modal "Novo Plano" valida campos antes de submeter
- [ ] Criar plano → aparece no grid via React Query `invalidateQueries`
- [ ] Arquivar plano → sai do grid de ativos sem reload
- [ ] `/assinaturas/assinantes` lista com paginação e filtro por status
- [ ] Botão "Cancelar" exige confirmação e campo de motivo
- [ ] Usuário `member` vê listas mas não vê botões de criação/cancelamento

---

## SECRETS

| Secret | Status | Ação |
|---|---|---|
| `ASAAS_API_KEY` | ✅ já configurado | — |
| `ASAAS_API_URL` | verificar | `https://sandbox.asaas.com/api/v3` staging / `https://api.asaas.com/v3` prod |
| `ASAAS_CUSTOMER_WEBHOOK_TOKEN` | ❌ criar | `openssl rand -hex 32` → salvar no Supabase + configurar no painel Asaas |

**Configurar webhook no painel Asaas após deploy do T6:**
- URL: `https://huefciqpcorcvguabtcj.supabase.co/functions/v1/customer-webhook`
- Token: valor do `ASAAS_CUSTOMER_WEBHOOK_TOKEN`
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `SUBSCRIPTION_DELETED`

---

## FORA DO ESCOPO C1

- Widget JS embeddable (Sprint C3 — `public-plans` já estará pronto)
- API key Asaas por empresa / BaaS subcontas (Sprint C2)
- Dashboard MRR / churn charts (Sprint C1-S2)
- NF automática por assinatura paga (Sprint C1-S2)

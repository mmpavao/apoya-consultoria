# SPEC TÉCNICA V2 — REBUILD SUPER ADMIN
**ARQUITETO | 2026-05-20 | Decisões aprovadas pelo Márcio**
**Branch:** `feat/super-admin-rebuild` (criado, base: main 5504c5e177)

---

## 1. MAPA DE MUDANÇAS — ARQUIVOS

### 1.1 DELETAR (confirmados existentes no repo)

| Arquivo | SHA atual | Motivo |
|---------|-----------|--------|
| `src/components/admin/integrations/StripeIntegrationTab.tsx` | f3e743da99 | Stripe removido |
| `src/components/admin/integrations/InsuranceIntegrationTab.tsx` | 3148712d06 | Removido pelo Márcio |
| `src/components/admin/integrations/RTCIntegrationTab.tsx` | e34f37e234 | Removido pelo Márcio |
| `src/components/admin/integrations/BaseLinkerIntegrationTab.tsx` | 9153243f7c | Removido pelo Márcio |
| `src/components/admin/integrations/DailyIntegrationTab.tsx` | 5ec00f5b28 | Removido pelo Márcio |
| `src/components/admin/ai-agents/AIAgentsManager.tsx` | 16b30b82d5 | Removido pelo Márcio |
| `src/components/admin/governance/SuperSuperAdminManager.tsx` | 7c2f02e7fb | Removido pelo Márcio |
| `src/pages/admin/PublishHealthPage.tsx` | 25043ee1d5 | Removido pelo Márcio |
| `src/components/admin/integrations/PublicApiTab.tsx` | 88a067b3af | Gambiarra de 4 linhas |
| `src/hooks/useIntegrationTests.ts` | ec1677ea77 | Stub morto |
| `src/pages/admin/SuperAdminPanel.tsx` | 82b1a12cfa | Substituído por AdminOverviewPage |

**ATENÇÃO:** `src/components/admin/ai-agents/index.ts` tem apenas `export { AIAgentsManager }` — deletar também após deletar o AIAgentsManager.

### 1.2 MODIFICAR — limpeza Stripe + double-fetch

**`src/components/admin/IntegrationsManager.tsx`**
- Remover import `StripeIntegrationTab` da linha 21
- Remover `Insurance`, `RTC`, `BaseLinker`, `Daily` do import (todos deletados)
- Remover tabs correspondentes do array `integrationTabs`
- Remover `<TabsContent value="stripe">` e todos os TabsContent dos removidos
- Tabs restantes: overview, resend, nfeio, whatsapp, assinaturas

**`src/components/admin/integrations/IntegrationsOverview.tsx`**
- Remover `stripe` de `integrationIcons` (L27) e `integrationDescriptions` (L39)
- Remover ícones não usados do import lucide (`Shield`, `Calculator`, `ShoppingCart`, `Video`)

**`src/hooks/useIntegrationsStatus.ts`**
- Remover `stripe: ["STRIPE_SECRET_KEY"]` de `INTEGRATION_SECRETS` (L57)
- Remover o objeto `stripe` do array `integrations:` (L263–L269) — substitui por `asaas`
- Na query `billingStats`: renomear `webhookEvents` de `stripe_webhook` para `asaas_webhook`
  - L136: `logs.filter((l) => l.actor_type === "stripe_webhook")` → `"asaas_webhook"`
- Remover stats de `insurance`, `rtc`, `baselinker`, `daily` (não existem mais)

**`src/components/admin/billing/BillingAuditViewer.tsx`**
- L25: remover `stripe_webhook: CreditCard` de `actorIcons`
- L32: remover `stripe_webhook: "Stripe"` de `actorLabels`
- **ATENÇÃO:** `AuditActorType` em `src/types/billing.ts` L32 tem `stripe_webhook` — não alterar o tipo agora (pode quebrar dados históricos), só remover do UI. O tipo será atualizado em sprint separada junto com a migração do schema.

**`src/components/admin/integrations/index.ts`**
- Remover exports de todos os arquivos deletados
- Manter: `IntegrationsOverview`, `IntegrationStatusCard`, `EmailIntegrationTab`, `NFEioIntegrationTab`, `WhatsAppIntegrationTab`, `SignaturesIntegrationTab`, `IntegrationSecretStatus`, `IntegrationTestButton`

**`src/routes/admin.routes.tsx`**
- Remover import e rota `AdminAgentesIAPage` (componente deletado)
- Remover import e rota `PublishHealthPage` (componente deletado)
- Rota `publish-health` removida
- Rota `agentes-ia` removida

**`src/pages/admin/SuperAdminLayout.tsx`** — fix double-fetch
- Remover `useAdminData` e `SuperAdminStats` do Layout (eram usados também no SuperAdminPanel)
- O Layout passa a ser APENAS shell de auth guard + `<Outlet />`
- Após remoção do SuperAdminPanel, `useAdminData` fica exclusivo na `AdminOverviewPage`

### 1.3 CRIAR — Sprint Sidebar (PR #2, após PR #1)

```
src/components/admin/shell/
  AdminShell.tsx          ← novo SuperAdminLayout (auth guard + sidebar + outlet)
  AdminSidebar.tsx        ← sidebar colapsável
  AdminTopBar.tsx         ← header sticky com breadcrumb
  AdminNavItem.tsx        ← item de nav com estado ativo/collapsed
  AdminNavGroup.tsx       ← grupo com label e separador
  index.ts

src/pages/admin/
  AdminOverviewPage.tsx   ← index de /admin (cards KPI + feed recente)
```

---

## 2. SPEC DO AdminSidebar.tsx

### 2.1 Props e Interface

```typescript
interface AdminNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: string | number;   // badge numérico opcional (ex: tickets abertos)
  external?: boolean;
}

interface AdminNavGroup {
  label: string;             // texto uppercase do grupo
  items: AdminNavItem[];
}

interface AdminSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  groups: AdminNavGroup[];
}
```

### 2.2 Grupos de Navegação (dados, não lógica — definir em `AdminShell.tsx`)

```typescript
const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "",                           // sem label no primeiro grupo
    items: [
      { id: "overview",     label: "Visão Geral",     icon: LayoutDashboard,  href: "/admin" },
    ],
  },
  {
    label: "OPERAÇÕES",
    items: [
      { id: "empresas",     label: "Empresas",        icon: Building2,        href: "/admin/empresas" },
      { id: "admins",       label: "Usuários & Admins",icon: Users,            href: "/admin/admins" },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { id: "billing",      label: "Billing",          icon: CreditCard,      href: "/admin/billing" },
      { id: "planos",       label: "Planos",            icon: Layers,          href: "/admin/planos" },
      { id: "modulos",      label: "Módulos",           icon: Box,             href: "/admin/modulos" },
      { id: "contratos",    label: "Contratos",         icon: FileSignature,   href: "/admin/contratos" },
    ],
  },
  {
    label: "INTEGRAÇÕES",
    items: [
      { id: "asaas",        label: "Asaas",             icon: CreditCard,      href: "/admin/integracoes?tab=asaas" },
      { id: "nfeio",        label: "NFe.io",            icon: FileText,        href: "/admin/integracoes?tab=nfeio" },
      { id: "resend",       label: "Email (Resend)",    icon: Mail,            href: "/admin/integracoes?tab=resend" },
      { id: "whatsapp",     label: "WhatsApp",          icon: MessageCircle,   href: "/admin/integracoes?tab=whatsapp" },
      { id: "assinaturas",  label: "Assinaturas",       icon: PenTool,         href: "/admin/integracoes?tab=assinaturas" },
    ],
  },
  {
    label: "EMAIL",
    items: [
      { id: "emails",       label: "Monitoramento",    icon: Mail,            href: "/admin/emails" },
    ],
  },
  {
    label: "COMUNICAÇÃO",
    items: [
      { id: "notificacoes", label: "Notificações",     icon: Bell,            href: "/admin/notificacoes" },
      { id: "anuncios",     label: "Anúncios",         icon: Megaphone,       href: "/admin/anuncios" },
      { id: "tickets",      label: "Tickets",          icon: Ticket,          href: "/admin/tickets" },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { id: "governanca",   label: "Governança",       icon: Database,        href: "/admin/governanca" },
      { id: "armazenamento",label: "Armazenamento",    icon: HardDrive,       href: "/admin/armazenamento" },
      { id: "sistema",      label: "Sistema",          icon: Settings2,       href: "/admin/sistema" },
      { id: "changelog",    label: "Changelog",        icon: GitBranch,       href: "/admin/changelog" },
    ],
  },
];
```

### 2.3 Comportamento Visual

```
Desktop (≥ lg — 1024px):
  expanded:  largura 240px, texto + ícone, label de grupo visível
  collapsed: largura 56px,  só ícone, label de grupo oculto, Tooltip com label no hover

Mobile (< lg):
  Sidebar oculta por padrão
  Botão hamburguer no AdminTopBar abre Sheet (drawer esquerdo shadcn/ui)
  Sheet fecha ao clicar em qualquer item de nav

Estado ativo:
  NavItem com href === pathname atual: bg-primary/10 text-primary rounded-md font-medium
  NavItem inativo: text-muted-foreground hover:bg-accent hover:text-accent-foreground

Collapse state:
  Persistido em localStorage key "admin-sidebar-collapsed"
  Transição: transition-all duration-200
```

### 2.4 AdminShell.tsx — responsabilidades

```typescript
// Substitui SuperAdminLayout.tsx como elemento da rota /admin
export default function AdminShell() {
  // 1. Auth guard: se !isSuperAdmin → redirect para /dashboard
  // 2. Estado de collapse da sidebar (localStorage)
  // 3. Render: flex row → <AdminSidebar /> + <main className={cn("flex-1 min-h-screen", mainClass)}>
  //      <AdminTopBar />
  //      <div className="p-6"><Outlet /></div>
  //    </main>
  // NÃO chama useAdminData — cada página carrega seus próprios dados
}
```

---

## 3. SPEC DO AdminOverviewPage.tsx

### 3.1 Responsabilidades

- Rota: `/admin` (index, substitui AdminGovernancaPage como padrão)
- Única página que chama `useAdminData` — sem duplicidade

### 3.2 Layout

```
<AdminPageHeader title="Visão Geral" />    ← componente reutilizável (spec abaixo)

<SuperAdminStats                           ← componente existente — MANTER
  companiesCount={companies.length}
  usersCount={users.length}
  superAdminsCount={superAdmins.length}
/>

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div className="lg:col-span-2">
    <RecentBillingActivity />              ← reutiliza useBillingAuditLogs (já existe)
  </div>
  <div>
    <IntegrationHealthSummary />           ← mini-grid de status das 5 integrações ativas
  </div>
</div>
```

---

## 4. PADRÃO DE PÁGINA ADMIN (obrigatório em todas as páginas)

### 4.1 AdminPageHeader — componente novo (criar em `src/components/admin/shell/`)

```typescript
interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;     // botões de ação no lado direito
  breadcrumb?: string[];         // ex: ["Integrações", "Asaas"]
}

// Render:
// [título em text-2xl font-bold]    [description em text-sm text-muted-foreground]    [actions]
// Padding bottom: pb-6 border-b mb-6
```

### 4.2 Estrutura padrão de toda página admin

```tsx
export default function AdminXxxPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Nome da Página"
        description="Descrição curta"
        actions={<Button>Ação principal</Button>}
      />
      {/* conteúdo */}
    </div>
  );
}
```

---

## 5. SPEC DE INTEGRAÇÕES — Tab por tab

### 5.1 IntegrationsManager.tsx — tabs após limpeza

```
overview     → IntegrationsOverview (manter)
resend       → EmailIntegrationTab (manter)
asaas        → AsaasIntegrationTab (criar — substitui Stripe)
nfeio        → NFEioIntegrationTab (manter)
whatsapp     → WhatsAppIntegrationTab (manter)
assinaturas  → SignaturesIntegrationTab (manter, renomear id de "signatures" para "assinaturas")
```

### 5.2 AsaasIntegrationTab — spec mínima (criar em Sprint 2)

**Arquivo:** `src/components/admin/integrations/AsaasIntegrationTab.tsx`
**Sub-tabs:** Configuração | Assinaturas | Logs | Testar

**Configuração:**
- `ASAAS_API_KEY` via `ApiKeyField` (de Wilson, corrigir BUG-03)
- `ASAAS_API_URL` via `ApiKeyField`
- `ASAAS_WEBHOOK_TOKEN` via `ApiKeyField`
- Webhook URL exibida (readonly): `https://huefciqpcorcvguabtcj.supabase.co/functions/v1/asaas-webhook`

**Assinaturas:** query na tabela `subscriptions` com joins em `companies`
- Colunas: empresa, status, billing_cycle, trial_end, current_period_end, asaas_subscription_id
- Campos: `status`, `asaas_subscription_id`, `asaas_customer_id` (todos existem no schema)

**Logs:** query em `billing_audit_logs` limit 50, order created_at desc

**Testar:** `supabase.functions.invoke("asaas-checkout", { body: { action: "status" } })`

---

## 6. PLANO DE PRs

### PR #1 — Limpeza (executar AGORA)
**Branch:** `feat/super-admin-rebuild`
**Conteúdo:**
1. Deletar 11 arquivos listados em 1.1 (incluindo `ai-agents/index.ts`)
2. Modificar `IntegrationsManager.tsx` — remover Stripe + removidos
3. Modificar `IntegrationsOverview.tsx` — remover Stripe
4. Modificar `useIntegrationsStatus.ts` — remover Stripe, adicionar Asaas
5. Modificar `BillingAuditViewer.tsx` — remover Stripe do UI
6. Modificar `integrations/index.ts` — remover exports dos deletados
7. Modificar `admin.routes.tsx` — remover rotas/imports de deletados
8. Modificar `SuperAdminLayout.tsx` — remover useAdminData + SuperAdminStats (fix double-fetch)

**AC do PR #1:**
- [ ] Build sem erros (`tsc --noEmit` passa)
- [ ] Nenhuma referência a Stripe em nenhum arquivo do módulo admin
- [ ] Nenhum import quebrado nos arquivos modificados
- [ ] `/admin` renderiza sem crash (SuperAdminLayout vira só auth guard + Outlet)
- [ ] Rotas `agentes-ia` e `publish-health` removidas de admin.routes

### PR #2 — Sidebar + Shell (após PR #1 mergeado)
**Conteúdo:** Criar AdminShell + AdminSidebar + AdminTopBar + AdminOverviewPage
**AC:** sidebar funcional, navegação ativa, collapse, mobile drawer

### PR #3 — AsaasIntegrationTab (após PR #2 mergeado)
**Conteúdo:** Criar AsaasIntegrationTab completo (substituição do Stripe no IntegrationsManager)
**AC:** todas as 4 sub-tabs funcionais, secrets via useSecretManager, dados reais

### PR #4 — Padronização visual (após PR #3)
**Conteúdo:** AdminPageHeader em todas as páginas admin, AdminOverviewPage completo

---

## 7. CORREÇÕES TÉCNICAS HERDADAS (BE-FIX — obrigatórias antes do PR #3)

### BE-FIX-01 — secret-manager handleRemove (formato errado)
```typescript
// ATUAL (quebrado — retorna HTTP 400):
managementRequest("DELETE", ".../secrets", { secrets: [name] })
// CORRETO (confirmado via teste):
managementRequest("DELETE", ".../secrets", [name])
```

### BE-FIX-02 — secret-manager authorize() (campo inexistente)
```typescript
// ATUAL (quebra 100% dos usuários — profiles.role não existe):
supabase.from("profiles").select("role").eq("id", user.id)
// CORRETO:
svcClient.from("users").select("is_super_admin").eq("id", user.id).single()
// NOTA: svcClient deve usar SUPABASE_SERVICE_ROLE_KEY, não o JWT do usuário
```

---

## 8. ACCEPTANCE CRITERIA GLOBAL DO REBUILD

- [ ] Zero referências a Stripe em src/components/admin/** e src/hooks/
- [ ] AdminShell substitui SuperAdminLayout como elemento raiz de /admin
- [ ] Sidebar colapsa/expande com state persistido em localStorage
- [ ] Item ativo destaca corretamente baseado em `useLocation().pathname`
- [ ] Integrações Asaas, NFe.io, Email, WhatsApp e Assinaturas funcionais
- [ ] Secrets gerenciadas via useSecretManager (dados reais, não hardcoded)
- [ ] useAdminData chamado somente em AdminOverviewPage (não no shell)
- [ ] Build TypeScript sem erros em todos os arquivos modificados
- [ ] Mobile: sidebar como Sheet drawer

---
**ARQUITETO — SPEC APROVADA ✅ — PR #1 pode executar imediatamente**

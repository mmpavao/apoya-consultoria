# APOYA Design System V3 — Padrão Oficial
**Fonte:** mmpavao/apoya-consultoria · branch main · commit c992f6d
**Data assimilação:** 2026-05-21

---

## Stack visual

| Item | Valor |
|---|---|
| Fontes | Figtree (body) + Outfit (display/headings) |
| Radius base | `--radius: 1rem` (16px) |
| Tabela | `.ft-table` (não `.ds-table`) |
| Card | `.surface-card` (não `.ds-card`) |
| Badge/pill | `.pill` via `InlineBadge` de `DataTable.tsx` |
| Cor primária | `oklch(0.66 0.195 44)` — laranja institucional APOYA |
| Sidebar | `oklch(0.16 0.018 255)` — quase preto azulado |
| Background | `oklch(0.985 0.006 60)` — off-white quente |

---

## Layout shell

```
.app-shell          → flex, overflow:hidden, position:relative
  ::before / ::after → blobs decorativos laranja no fundo (blur:80px)
  
.app-sidebar        → position:fixed, top/left/bottom:0
  width: var(--sidebar-width)   = 248px
  width collapsed: var(--sidebar-width-collapsed) = 80px
  transition: width 220ms
  
.app-main           → flex-col, height:100dvh, margin-left:248px
  transition: margin-left 220ms
  overflow: hidden
  
.app-content        → flex:1, overflow-y:auto, overflow-x:hidden
.app-content-inner  → max-width:1360px, padding:clamp
```

**Collapsed state:** `data-sidebar-collapsed="true"` no `.app-shell`

---

## Componentes obrigatórios

### `PageHeader` (de PagePlaceholder.tsx)
```tsx
<PageHeader
  eyebrow="opcional"       // texto pequeno acima do título
  title="Nome da Página"
  subtitle="Descrição"
  actions={<Button>...</Button>}
/>
```

### `PageTabs` (de PagePlaceholder.tsx)
```tsx
<PageTabs items={[
  { to: "/fiscal/das",  label: "DAS",   icon: FileText },
  { to: "/fiscal/nfse", label: "NFS-e", icon: Receipt },
]} />
```
Usado no topo de páginas com sub-rotas (Fiscal).

### `KpiGrid` + `KpiCard` (de PagePlaceholder.tsx)
```tsx
<KpiGrid cols={4}>
  <KpiCard icon={FileText} label="Total" value={72} tone="neutral" />
  <KpiCard icon={CheckCircle2} label="Emitidas" value={65} tone="success" hint="90% do mês" />
  <KpiCard icon={AlertTriangle} label="Atrasadas" value={7} tone="danger" />
  <KpiCard icon={Wallet} label="Valor" value="R$ 52.400" tone="primary" />
</KpiGrid>
```
Tones: `neutral | primary | success | warning | danger | info`

### `Pagination` (de PagePlaceholder.tsx)
```tsx
<Pagination
  page={page}
  totalPages={totalPages}
  onChange={setPage}
  pageSize={25}
  total={filtered.length}
/>
```

### `DataTable` + `InlineBadge` + `TableSearch` + `TableFooter` (de DataTable.tsx)
- Tabela usa classe `.ft-table` internamente
- Cards envolvem com `.surface-card overflow-hidden`
- Toolbar fica em `px-5 py-4 border-b border-border/70`

---

## Sidebar (AppSidebar.tsx)

- Logo: quadrado laranja 11x11 com letra "a" → texto "apoya" (Outfit, bold)
- Itens: `rounded-xl h-11`, estado ativo: `bg-primary text-primary-foreground shadow-glow`
- Collapsed: ícone centralizado + tooltip ao hover
- Toggle collapse: botão `ChevronsLeft/Right` no header da sidebar
- Logout: botão no rodapé, hover → `text-destructive`

---

## Header (AppHeader.tsx)

- `sticky top-0 z-30 h-20`
- Fundo: **transparente** (deixa o background da página aparecer)
- Campo de busca: `rounded-full border bg-card shadow-soft`, focus ring laranja
- Sino: `rounded-full border bg-card shadow-soft` com badge vermelho
- User chip: `rounded-full border bg-card pl-4 pr-1.5 py-1.5 shadow-soft`
  - Avatar: `rounded-full bg-gradient-primary` com iniciais

---

## Padrão de página (template)

```tsx
function MinhaPage() {
  return (
    <div className="space-y-6 animate-fade-up">
      
      {/* 1. PageTabs (só se tiver sub-rotas) */}
      <PageTabs items={fiscalTabs} />
      
      {/* 2. Header */}
      <PageHeader
        title="DAS em Lote"
        subtitle="Geração via SERPRO · MEI e Simples Nacional"
        actions={<Button>Ação principal</Button>}
      />
      
      {/* 3. KPIs */}
      <KpiGrid cols={4}>
        <KpiCard icon={FileText} label="Total" value={72} />
        ...
      </KpiGrid>
      
      {/* 4. DataTable com toolbar */}
      <DataTable
        rows={pageRows}
        cols={cols}
        getKey={r => r.id}
        toolbar={<TableSearch ... />}
      />
      
      {/* 5. Footer + Pagination */}
      <div className="flex items-center justify-between">
        <TableFooter total={filtered.length} filtered={pageRows.length} />
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
```

---

## Classes CSS principais

| Classe | Uso |
|---|---|
| `.surface-card` | Card branco com borda + shadow-soft + radius-2xl |
| `.surface-card-dark` | Card escuro (sidebar color) com shadow-elevated |
| `.ft-table` | Tabela leve sem scroll lateral |
| `.ft-table th` | `uppercase, letter-spacing:0.08em, bg oklch(0.97...)` |
| `.ft-table td` | `padding:1rem 1.25rem, border-top` |
| `.pill` | Badge inline (`InlineBadge`) |
| `.shadow-soft` | `var(--shadow-soft)` |
| `.shadow-elevated` | `var(--shadow-elevated)` |
| `.shadow-glow` | `var(--shadow-glow)` — laranja, usado no item ativo |
| `.bg-gradient-primary` | Gradiente laranja (usado no avatar) |
| `.animate-fade-up` | Entrada suave das páginas |
| `.page-title` | Título de página via font-display |
| `.font-display` | Aplica Outfit nos textos |

---

## Tokens de cor utilitários

```css
--shadow-soft:     0 1px 2px oklch(.30 .02 260 / .04), 0 4px 16px -6px oklch(.30 .02 260 / .08)
--shadow-elevated: 0 2px 8px -2px oklch(.20 .02 260 / .06), 0 12px 32px -8px oklch(.20 .02 260 / .12)
--shadow-glow:     0 10px 30px -10px oklch(.66 .195 44 / .45)
--gradient-primary: linear-gradient(135deg, oklch(.66 .195 44), oklch(.74 .190 50))
```

---

## Regras que NÃO posso violar

1. **`ft-table`** para tabelas — nunca `shadcn Table` com scroll lateral
2. **`surface-card`** para cards — nunca `ds-card` (deprecated, só alias)
3. **Sidebar collapsed** via `data-sidebar-collapsed` no `.app-shell` — nunca esconder via display:none
4. **Header transparente** — nunca adicionar background sólido no header
5. **`animate-fade-up`** em toda página — entrada suave obrigatória
6. **`PageHeader`** sempre acima do conteúdo — nunca h1 solto na página
7. **`KpiCard` com `tone`** — nunca colorir o card inteiro, só o ícone
8. **`font-display`** (Outfit) para títulos, `font-sans` (Figtree) para corpo
9. **`space-y-6`** entre seções de página (não 4, não 8)
10. **Paginação** via componente `Pagination` — nunca botões soltos

---

## Arquivos que não posso alterar

- `wrangler.jsonc`
- `src/router.tsx`
- `src/routes/__root.tsx`
- `src/integrations/supabase/` (só leitura)
- `src/lib/utils.ts`

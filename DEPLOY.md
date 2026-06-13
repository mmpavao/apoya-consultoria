# Deploy — APOYA Gestão

## URL de Produção
https://apoya-gestao.talkzzbot.workers.dev

## Deploy Rápido
```bash
npm install
./deploy.sh
```

## O que o deploy.sh faz
1. `npm run build` — gera dist/client (assets estáticos) e dist/server (worker SSR)
2. Corrige o nome do worker e o binding ASSETS no wrangler.json gerado
3. `npx wrangler deploy` — envia para o Cloudflare

## Env vars configuradas no Worker via `wrangler secret`
- `VITE_SUPABASE_URL`
- `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Repositório
https://github.com/mmpavao/apoya-consultoria

---

## 🔐 Rotação de Credenciais — SERPRO_TOKEN (SEC-001)

**Data:** 12/06/2026
**Sprint:** Sprint SEC — Segurança Crítica APOYA
**Executado por:** BACK-END APOYA (backend agent)

### Problema identificado
O token `apoya-mcp-serpro-2026` estava hardcoded em 5 arquivos:
- `src/routes/api/serpro/call.ts`
- `src/routes/api/das/gerar.ts`
- `src/routes/api/serpro/status.ts`
- `src/lib/serpro/tools-catalog.ts`
- `supabase/functions/cnpj-enrich/index.ts`

### Ações executadas
1. Token removido de todos os 5 arquivos
2. Substituído por leitura de `process.env.SERPRO_TOKEN` (workers) / `Deno.env.get("SERPRO_TOKEN")` (Edge Function)
3. Fail-fast: retorna HTTP 503 se token não configurado
4. UI mascarada: `_app.fiscal.index.tsx` exibe `••••••••••••••••` em vez do valor real

### Ação obrigatória — DEVOPS (antes de produção)

**Workers Cloudflare:**
```bash
# Worker apoya-gestao
wrangler secret put SERPRO_TOKEN

# Worker apoya-mcp (se aplicável)
wrangler secret put SERPRO_TOKEN
```

**Edge Function Supabase:**
```bash
supabase secrets set SERPRO_TOKEN=<novo-token-gerado>
```

**Após configurar — revogar token antigo no portal SERPRO/Gateway.**

### Verificação pós-deploy
```bash
# Deve retornar zero resultados
grep -r 'apoya-mcp-serpro' . --include="*.ts" --include="*.tsx" --include="*.js"

# Workers — deve listar SERPRO_TOKEN
wrangler secret list  # apoya-gestao

# Edge Function
supabase secrets list | grep SERPRO_TOKEN
```

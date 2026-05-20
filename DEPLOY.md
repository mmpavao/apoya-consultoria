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

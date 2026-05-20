# Deploy — APOYA Gestão

## Cloudflare Worker (produção)
URL: https://apoya-gestao.talkzzbot.workers.dev

## Como fazer build e deploy manual:
```bash
npm install
npm run build
# Secrets já configurados no Worker via wrangler secret
npx wrangler deploy --config dist/server/wrangler.json
```

## Env vars configuradas no Worker:
- VITE_SUPABASE_URL
- SUPABASE_URL  
- VITE_SUPABASE_PUBLISHABLE_KEY (secret)
- SUPABASE_SERVICE_ROLE_KEY (secret)

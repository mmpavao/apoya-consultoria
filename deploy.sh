#!/bin/bash
# Script de deploy para APOYA Gestão — Cloudflare Workers
set -e

echo "🏗️  APOYA Deploy Script"
echo "======================"

# 1. Build
echo "📦 Building..."
npm run build

# 2. Fix wrangler config
python3 -c "
import json
with open('dist/server/wrangler.json') as f:
    c = json.load(f)
c['name'] = 'apoya-gestao'
c['assets'] = {'directory': '../client', 'binding': 'ASSETS'}
with open('dist/server/wrangler.json', 'w') as f:
    json.dump(c, f, indent=2)
print('✅ wrangler.json configurado')
"

# 3. Deploy
echo "🚀 Deploying to Cloudflare..."
npx wrangler deploy --config dist/server/wrangler.json

echo ""
echo "✅ Deploy concluído!"
echo "   URL: https://apoya-gestao.talkzzbot.workers.dev"

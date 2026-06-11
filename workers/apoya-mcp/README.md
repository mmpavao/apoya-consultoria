# APOYA MCP Worker v3.0

**URL de produção:** https://apoya-mcp.talkzzbot.workers.dev

## Tools disponíveis: 80
Cobre todas as 32 tabelas do Supabase, 8 Edge Functions, e integrações com
Focus NFe, SERPRO, Evolution API (WhatsApp) e Asaas.

## Autenticação
Bearer token via tabela `mcp_api_keys` (hash SHA-256).

## Deploy
```bash
cd workers/apoya-mcp
wrangler deploy
```

## Secrets necessários
```bash
wrangler secret put SUPABASE_URL --name apoya-mcp
wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name apoya-mcp
wrangler secret put FOCUS_NFE_API_TOKEN_2 --name apoya-mcp
wrangler secret put EVOLUTION_API_URL --name apoya-mcp
wrangler secret put EVOLUTION_API_KEY --name apoya-mcp
wrangler secret put ETRANSPARENCIA_TOKEN --name apoya-mcp
```

## Changelog
- v3.0 (2026-06-11): Schema completo 32 tabelas, 80 tools, handlers para todas as entidades
- v2.1 (2026-06-10): 53 tools, campos corrigidos conforme schema real
- v1.0 (2026-05-25): Versão inicial

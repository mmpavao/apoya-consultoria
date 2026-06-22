# APOYA Gestão — Briefing para agentes de código (Cursor/Claude)

Você está entrando num projeto que passou por um pivô estratégico grande. Leia tudo antes de tocar em qualquer arquivo.

## 1. Decisão do dono (Marcio)
O sistema tinha integrações e agentes meio-construídos e com bug. Decisão: zerar tudo de API/automação/agente e deixar o sistema 100% MANUAL e íntegro — operadores humanos fazem o trabalho e atualizam no sistema. As APIs voltam DEPOIS, uma de cada vez, sob coordenação. NÃO reintroduza integração/agente sem pedido explícito do Marcio.

## 2. O que é o APOYA
- Software de contabilidade (escritório, ~8 clientes). Setores: Clientes, Fiscal, Contábil, DP, Financeiro, Societário + Documentos/Kanban/Tarefas.
- Stack: TanStack Start (React 19) em Cloudflare Workers (worker apoya-gestao) + Supabase (Postgres + RLS + Auth + Storage + Edge Functions/Deno), projeto ajaqbdsalxfgrwpjbtbn.
- Repo: github.com/mmpavao/apoya-consultoria. Régua de versão: **v3.43.x** (prod atual: v3.43.0).

## 3. O que foi REMOVIDO no pivô (NÃO recriar)
- Agentes: 8 edge functions agente-* + cron diário + RPC verify_cron_secret + secret no Vault + abas "Automações" + card "Agente Autônomo" do ModuleDashboard + hook use-agente-atividade + rota /api/agentes/atividade. Deletados do repo E do Supabase.
- Integrações externas (código + edge fns + rotas /api + telas religadas no manual): SERPRO (autofill de CNPJ -> digitação manual); NFS-e/Focus/NFE.io; Asaas (emitir cobranca, gateway, execucao de regua); Pluggy/Open Finance; WhatsApp/Evolution (contato virou link wa.me manual); Clicksign (contrato -> status manual em contrato_cliente.status).
- MCP: worker apoya-mcp, job deploy-mcp no CI, lib/worker-env, rotas /api/pipeline/* (eram orfas — o KanbanModulo ja usa Supabase direto), aba "MCP/API" das Configuracoes.
- Edge function viva hoje: SO send-invite (convite interno de usuario).

## 4. Como o sistema funciona AGORA (manual)
- Tudo e CRUD direto no Supabase via hooks use-* (RLS protege). Sem chamadas a servicos externos.
- Cliente: cadastro/edicao manual (CNPJ digitado, sem busca automatica).
- Fiscal: DAS e obrigacoes a mao; documentos manuais.
- Financeiro: cobranca criar/editar/excluir/dar baixa manual; regua so configura.
- DP: folha (tabela folha_linha por funcionario), ferias, rescisao, eSocial manual.
- Kanban: move card via update tarefas.etapa_pipeline direto no Supabase.
- Campos clicksign_* e cobrancas.asaas_id continuam no banco (inertes) — quando a API voltar, religam sem migration.

## 5. Regras de trabalho NESTE repo
- Banco Supabase e UNICO. Migrations sao aplicadas out-of-band pelo agente ARQUITETO (Base44), NAO pelo CI. Nao assuma supabase db push no pipeline.
- Edge functions deployam so em tag de producao e devem ser validadas com deno check (tsc/vite NAO cobrem o diretorio supabase/functions).
- Fluxo de deploy: editar -> npx tsc --noEmit + npm test + npm run build (SEMPRE os 3) -> commit -> push main (= STAGING) -> validar staging -> tag vX.Y.Z (= PRODUCAO). Acompanhar com gh run watch.
- Versao: git tag --sort=-v:refname | head -1 antes de propor nova (repo esta em v3.x; nunca regrida pra v1.x).
- No corpo da PR descreva so o que a PR adiciona (git log origin/main antes); nao re-descreva o que ja esta em main.
- Nada de git destrutivo no working repo (rm/reset/checkout/remote em massa).

## 6. O que voce PODE / NAO PODE agora
- PODE: corrigir bugs de fluxo manual (CRUD, validacao, UI/UX, acessibilidade), testes (Vitest), limpeza de dead code (ex.: imports orfaos de icones que sobraram da remocao das integracoes — cosmetico).
- NAO PODE (sem o Marcio pedir): adicionar/voltar integracao externa, agente, automacao, MCP, cron, webhook.

## 7. Quando as APIs voltarem (futuro, parte a parte)
Cada integracao volta isolada: gate de auth no corpo (requireUser/secret), verify_jwt=false no supabase/config.toml, entrada no loop de deploy de functions do .github/workflows/deploy.yml, validacao deno check + teste ao vivo (curl). Uma de cada vez, staging antes de producao.

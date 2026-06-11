# PRD — meucontador.ai v2.0 Enterprise
**Recebido:** 27/05/2026  
**Autor:** O Contador | COO  
**Status:** LIDO E ARQUIVADO PELO ARQUITETO

---

## RESUMO EXECUTIVO

PRD de produto completo para transformar o APOYA Gestão (painel interno) em uma
plataforma de contabilidade autônoma multi-tenancy atendida por IA via WhatsApp.

**Escopo macro:**
- Multi-tenancy com isolamento RLS por client_id
- 7 agentes especializados (Ana, Sofia, Hugo, Marcos, Carla, Pedro, Rafael)
- Roteamento por intenção (Intent Classifier GPT-4o-mini)
- WhatsApp como única interface do cliente final
- Automações CRON para obrigações fiscais, DP e contabilidade
- Cloudflare Worker como roteador de webhook
- Stack: TanStack + Supabase + Evolution API + OpenAI + SERPRO MCP

---

## DECISÕES ARQUITETURAIS RELEVANTES

1. **Schema da seção 4** — as tabelas `clientes`, `conversas`, `obrigacoes`, `apuracoes`,
   `funcionarios`, `folha_mensal`, `notas_fiscais`, `lancamentos_contabeis`, `plano_contas`,
   `documentos`, `tarefas_agente`, `eventos` e `whatsapp_sessions` são o contrato de dados.

2. **RLS obrigatório** — toda tabela com client_id recebe policy de isolamento.

3. **Worker de roteamento** — `src/server/whatsapp-router.ts` é o entry point do webhook.

4. **Intent Classifier** — GPT-4o-mini, temperatura 0, resposta JSON puro.

5. **Fase 1 prioridade** — Foundation + Ana (onboarding) + Sofia (DAS + alertas).

---

## STATUS DE IMPLEMENTAÇÃO ATUAL (base de partida)

O projeto APOYA já possui:
- ✅ Stack completa (TanStack Start + Cloudflare Workers + Supabase)
- ✅ Evolution API conectada (instância zapmei)
- ✅ SERPRO MCP ativo (https://mcp.zapro.tech)
- ✅ Tabelas: clientes, funcionarios, folha_mensal, ferias, rescisoes
- ✅ Módulo DP completo (commit 18b0a3d)
- ✅ Módulo Societário, Financeiro, Contábil (base)
- ✅ Sistema de workflows/tarefas (tarefas)
- ✅ 10 API Keys de agentes no MCP
- ❌ Tabelas: conversas, whatsapp_sessions, tarefas_agente, eventos, apuracoes (novas)
- ❌ Roteador WhatsApp (worker)
- ❌ Intent Classifier
- ❌ Agent Dispatcher
- ❌ Skills dos agentes

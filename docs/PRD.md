# PRD — APOYA CONTABILIDADE
## Product Requirements Document v1.0
**Data:** 2026-06-12 | **Autor:** DEV APOYA | **Status:** VIVO

---

## 1. VISÃO DO PRODUTO

**APOYA CONTABILIDADE** é um sistema multi-agentes autônomo de gestão completa de escritório contábil.

O sistema elimina trabalho manual repetitivo através de agentes especializados que monitoram, alertam e executam tarefas de forma autônoma — deixando a equipe humana livre para trabalho de alto valor: consultoria, atendimento e decisão.

### Princípio central
> "Cada área do escritório tem seu agente. O agente detecta, alerta e age. A equipe humana aprova e decide."

---

## 2. USUÁRIOS E PAPÉIS

| Papel | Acesso | Quem é |
|-------|--------|--------|
| `admin` | Total — todas as telas e configurações | Sócio/dono do escritório |
| `contador` | Contábil, Fiscal, Clientes, Financeiro | Contador responsável |
| `dp` | DP, Folha, Férias, eSocial | Analista de DP |
| `fiscal` | Fiscal, NFS-e, DAS, Obrigações | Analista fiscal |
| `financeiro` | Financeiro, Cobranças, NFS-e | Financeiro |
| `staff` | Tarefas, Workflows, Documentos | Colaborador geral |

**Isolamento:** cada usuário vê apenas os dados do seu setor. RLS ativa em 100% das tabelas sensíveis.

---

## 3. ARQUITETURA DO SISTEMA

### 3.1 Stack tecnológico

```
Frontend:   React 19 + TypeScript + TanStack Router + Vite + Tailwind v4
Backend:    Supabase PostgreSQL (ajaqbdsalxfgrwpjbtbn)
            ├── 75 tabelas / 151 policies RLS / 23 migrations
            └── 11 Edge Functions (Deno)
Deploy:     Cloudflare Workers → apoyaproject.zapro.tech
Repo:       mmpavao/apoya-consultoria (GitHub)
Agentes:    Supabase Edge Functions (Deno + OpenAI)
```

### 3.2 Edge Functions ativas

| Slug | Propósito |
|------|-----------|
| `agente-fiscal` | Monitora obrigações vencidas, gera alertas |
| `agente-rh` | Monitora folhas, férias, admissões/demissões, eSocial |
| `agente-financeiro` | Monitora cobranças vencidas, NFS-e com erro, honorários |
| `send-invite` | Envio de convites para novos usuários |
| `clicksign-envelope` | Criação de envelopes de assinatura digital |
| `clicksign-webhook` | Processamento de eventos do ClickSign |
| `parse-certificate` | Parse de certificado digital A1 |
| `cnpj-enrich` | Enriquecimento de CNPJ via API pública |
| `sync-nfse-nfeio` | Sincronização de NFS-e via NFe.io |
| `upload-certificate-nfeio` | Upload de certificado para NFe.io |
| `nfse-pos-pagamento` | Emissão automática de NFS-e após pagamento |

### 3.3 Grupos de tabelas por domínio

**Clientes / CRM**
`clientes`, `cliente_socio`, `cliente_servico`, `cliente_certificado`, `cliente_bloqueio`, `contrato_cliente`, `leads_crm`

**Fiscal / NFS-e**
`obrigacoes`, `calendario_fiscal`, `das_guias`, `nfse_emitida`, `nfse_recebida`, `nfse_notas`, `notas_fiscais`, `documentos_fiscais`, `focus_nfse_log`, `nfseio_log`, `serpro_log`, `apuracoes`, `apuracoes_mensais`

**Contabilidade**
`lancamentos_contabeis`, `periodos_contabeis`, `plano_contas`, `extrato_bancario`

**Departamento Pessoal**
`funcionarios`, `folha_mensal`, `ferias`, `rescisoes`

**Financeiro / Cobranças**
`cobrancas`, `regua_cobranca_config`, `servico_pagamento`, `servico_catalogo`, `open_finance_conexoes`, `open_finance_contas`, `open_finance_transacoes`, `open_finance_eventos`

**Workflows / Tarefas**
`tarefas`, `tarefas_agente`, `tarefa_eventos`, `pipeline_config`

**Documentos**
`documentos`, `documento_pasta`, `documento_arquivo`

**Societário**
`processos_societarios`, `processos_historico`

**Agentes / Automações**
`agente_logs`, `automacoes_config`, `automacoes_padrao`

**WhatsApp / Comunicação**
`wa_conversa`, `wa_instance`, `whatsapp_sessions`, `mensagem_whatsapp`, `conversas`

**Infraestrutura**
`profiles`, `user_roles`, `user_setores`, `user_setor_permissoes`, `permissoes`, `setores`, `escritorio_config`, `integracao_config`, `mcp_api_keys`, `audit_log`, `convites`, `eventos`, `clicksign_evento`

---

## 4. MÓDULOS DO SISTEMA

### 4.1 Dashboard (`/`)
**Status:** ✅ Implementado

KPIs em tempo real consolidados dos 3 agentes:
- Obrigações fiscais vencidas (agente-fiscal)
- Cobranças em aberto (agente-financeiro)
- Funcionários ativos / folhas pendentes (agente-rh)
- Alertas críticos da semana

### 4.2 Clientes (`/clientes`)
**Status:** ✅ Implementado

CRUD completo de clientes com:
- Enriquecimento automático via CNPJ (cnpj-enrich)
- Sócios, serviços contratados, certificados digitais
- Abas: Geral, Contábil, DP, Fiscal, Financeiro, Documentos

### 4.3 Fiscal (`/fiscal`)
**Status:** ✅ Implementado

- Obrigações mensais com status e alertas
- NFS-e (emissão, consulta, cancelamento)
- DAS / Simples Nacional
- Integração SERPRO
- **Agente Fiscal** monitorando 57 obrigações (38 vencidas detectadas)

### 4.4 Contabilidade (`/contabil`)
**Status:** ✅ Implementado | ⚠️ Dados vazios

- Lançamentos contábeis por competência
- Plano de contas
- Períodos contábeis (abrir/fechar)
- Extrato bancário e conciliação
- Pipeline de fechamento mensal
- **Pendente:** carga inicial de lançamentos reais

### 4.5 Departamento Pessoal (`/dp`)
**Status:** ✅ Implementado | ⚠️ Dados vazios

- Funcionários por empresa
- Folha mensal
- Férias (controle e alertas)
- Rescisões e demissões
- Pipeline DP
- KPIs conectados ao **Agente RH** (folhas abertas, férias vencendo)
- **Pendente:** carga de funcionários reais

### 4.6 Financeiro (`/financeiro`)
**Status:** ✅ Implementado

- Cobranças (geração, acompanhamento, régua)
- NFS-e automática pós-pagamento
- Integração Asaas (gateway de pagamento)
- Open Finance (conexões, contas, transações)
- **Agente Financeiro** monitorando cobranças vencidas e NFS-e com erro

### 4.7 Workflows (`/workflows`)
**Status:** ✅ Implementado

- Kanban de tarefas do escritório
- 4 visualizações: Kanban, Lista, Timeline, Dashboard
- Filtros por responsável, tipo, status, prioridade, SLA
- 11 tarefas ativas (7 abertas)
- Suporte a tarefas de agentes e humanos

### 4.8 CRM (`/crm`)
**Status:** ✅ Implementado

- Leads e pipeline comercial
- Conversas WhatsApp integradas

### 4.9 Documentos (`/documentos`)
**Status:** ✅ Implementado

- Upload, organização em pastas
- Assinatura digital via ClickSign

### 4.10 Societário (`/societario`)
**Status:** ✅ Implementado

- Processos societários (abertura, alteração, encerramento)
- Histórico de movimentações

### 4.11 Automações (`/automacoes`)
**Status:** ✅ Implementado (config)

- Configuração de automações por tipo
- Gatilhos: evento, agendamento, condição

### 4.12 WhatsApp (`/whatsapp`)
**Status:** ✅ Implementado

- Instâncias WA conectadas
- Conversas e histórico
- Envio automático por agente

---

## 5. AGENTES AUTÔNOMOS

### 5.1 Agente Fiscal
**Endpoint:** `POST /functions/v1/agente-fiscal`
**Frequência recomendada:** diária (08:00)

Responsabilidades:
- Varrer `obrigacoes` e detectar vencidas
- Varrer `calendario_fiscal` por alertas
- Inserir alertas em `agente_logs` (agente=FISCAL)
- Retornar resumo: obrigações vencidas, próximas 7d, sem responsável

### 5.2 Agente RH/DP
**Endpoint:** `POST /functions/v1/agente-rh`
**Frequência recomendada:** diária (08:00)

Responsabilidades:
- Folhas mensais sem processamento (`folha_mensal`)
- Férias vencendo em 30 dias (`ferias`)
- Admissões/demissões sem eSocial (`funcionarios`)
- Inserir alertas em `agente_logs` (agente=RH)

### 5.3 Agente Financeiro
**Endpoint:** `POST /functions/v1/agente-financeiro`
**Frequência recomendada:** diária (09:00)

Responsabilidades:
- Cobranças vencidas (não pagas, não canceladas)
- Cobranças vencendo hoje e em 7 dias
- NFS-e com status `erro`
- Honorários recebidos no mês
- Inserir alertas em `agente_logs` (agente=FINANCEIRO)

### 5.4 Orquestrador Central (🚧 A IMPLEMENTAR)
**Endpoint:** `POST /functions/v1/agente-orquestrador`

Responsabilidades:
- Executar todos os agentes em sequência
- Consolidar alertas por prioridade
- Gerar relatório diário do escritório
- Roteamento inteligente: criar tarefas em `tarefas` para alertas críticos
- Notificar via WhatsApp os responsáveis

---

## 6. INTEGRAÇÕES EXTERNAS

| Sistema | Propósito | Status |
|---------|-----------|--------|
| Asaas | Cobranças, PIX, boleto | ✅ Ativo |
| NFe.io | Emissão NFS-e | ✅ Ativo |
| ClickSign | Assinatura digital | ✅ Ativo |
| SERPRO | Consulta CNPJ/CPF | ✅ Ativo |
| Open Finance | Extratos bancários | ✅ Configurado |
| WhatsApp (Evolution API) | Comunicação com clientes | ✅ Ativo |
| OpenAI | LLM para agentes autônomos | ✅ Configurado |

---

## 7. ROADMAP

### Sprint 1 — Fundação dos Agentes ✅ (concluída 2026-06-12)
- [x] Agente Fiscal MVP
- [x] Agente RH/DP MVP
- [x] Agente Financeiro MVP
- [x] Dashboard métricas reais
- [x] Empty states DP e Contábil

### Sprint 2 — Operacional (próxima)
- [ ] Orquestrador Central (agente-orquestrador)
- [ ] Carga inicial de dados: funcionários + lançamentos
- [ ] Agendamento automático dos 3 agentes (daily cron)
- [ ] Notificações WhatsApp por alertas críticos

### Sprint 3 — Inteligência
- [ ] Agente Societário (monitoramento de processos)
- [ ] Agente CRM (follow-up automático de leads)
- [ ] Relatório mensal automatizado (PDF)
- [ ] Dashboard executivo com IA (análise de tendências)

---

## 8. MÉTRICAS DE SAÚDE DO SISTEMA

| Métrica | Valor atual | Meta |
|---------|-------------|------|
| Clientes ativos | 8 | — |
| Tabelas no banco | 75 | — |
| Policies RLS | 151 | 100% tabelas |
| Migrations versionadas | 23 | — |
| Edge Functions ativas | 11 | — |
| Agentes autônomos | 3 | 6 |
| Obrigações monitoradas | 57 | todas |
| Funcionários cadastrados | 0 | real |
| Lançamentos contábeis | 0 | real |

---

## 9. CONVENÇÕES DE CÓDIGO

- **TypeScript strict** — sem `any` onde evitável
- **Tailwind classes** — sem CSS inline
- **Lucide icons** — monocromáticos, tamanho consistente
- **Inter/Geist** — tipografia via `var(--font-display)`
- **surface-card** — classe utilitária para cards
- **Supabase client** — sempre via `src/integrations/supabase/client.ts`
- **Sem console.log** — usar toast (sonner) para feedback
- **Sem hardcode de IDs** — sempre via variável/env

---

*Documento gerado automaticamente pelo DEV APOYA em 2026-06-12.*
*Próxima revisão: após Sprint 2.*

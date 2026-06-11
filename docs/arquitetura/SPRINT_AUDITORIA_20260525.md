# AUDITORIA TÉCNICA — 25/05/2026
**Executada por:** ARQUITETO APOYA  
**Horário:** 23:09 BRT  
**Escopo:** Todos os commits do dia + estado do banco Supabase

---

## RESUMO EXECUTIVO

| Categoria | Encontrado | Crítico |
|-----------|-----------|---------|
| Bugs de código (campo errado) | 3 | 2 |
| Dados zerados | 2 tabelas | 1 |
| Chaves API expostas em banco | 3 integrações | 1 |
| Segurança (anon key) | OK | 0 |
| Roles duplicados | Corrigido | 0 |
| Tabelas ativas | 42 | — |

---

## BUGS ENCONTRADOS

### 🔴 BUG-1 CRÍTICO: leads_crm — campo 'status' não existe
**Arquivo:** `src/hooks/use-leads-crm.ts`  
**Problema:** Hook filtra por `.eq('status', ...)` mas a tabela tem campo `etapa` (não `status`)  
**Impacto:** CRM inteiro não funciona — todas as queries falham com erro 42703  
**Fix:** Substituir `status` → `etapa` em todo o hook + nos tipos TS  
**Schema real da tabela:**
- `etapa`: 'novo' | 'contato' | 'proposta' | 'negociacao' | 'ganho' | 'perdido'
- `temperatura`: 'frio' | 'morno' | 'quente'
- `origem`: string
- `canal`: 'whatsapp' | 'email' | 'indicacao' | 'site' | etc.
- `telefone`: NOT NULL (obrigatório)

### 🔴 BUG-2 CRÍTICO: wa_instance — campo 'instance_name' não existe
**Arquivo:** hooks que referenciam `wa_instance.instance_name`  
**Problema:** Campo correto é `nome` (não `instance_name`)  
**Impacto:** Qualquer query `.select('instance_name')` falha  
**Fix:** Substituir `instance_name` → `nome` nos hooks de WhatsApp

### 🟡 BUG-3: obrigacoes e contrato_cliente zerados
**Problema:** Tabelas com 0 registros — dados foram perdidos ou nunca migrados  
**Impacto:** Módulos de Obrigações e Contratos aparecem vazios para todos os clientes  
**Fix:** Re-sedar obrigações padrão por cliente + contratos existentes

### 🟡 BUG-4: agente_coo com apenas 1 scope
**Arquivo:** `mcp_api_keys` — agent_name: agente_coo  
**Problema:** Tem scopes=1 (quase sem permissão) — provavelmente foi criado com configuração incompleta  

### 🔵 OBSERVAÇÃO: integracao_config com API keys em campo config (JSONB)
**Tabelas afetadas:** nfeio, asaas, clicksign  
**Problema:** Chaves de API armazenadas em texto plano no JSONB da tabela  
**Risco:** Qualquer user autenticado com acesso à tabela vê as chaves  
**Recomendação:** Mover para escritorio_config (campos dedicados com RLS) ou Supabase Vault  
**Nota:** escritorio_config JÁ tem os campos `nfeio_api_key` e `asaas_api_key` — integracao_config é duplicidade

---

## O QUE ESTÁ CORRETO

- ✅ escritorio_config: 1 registro correto (APOYA AUDITORIA)
- ✅ mcp_api_keys: 11 keys, 10 ativas — estrutura OK
- ✅ profiles: 10 usuários, todos com role único
- ✅ user_roles: sem duplicatas
- ✅ clientes: 8 registros, todos com CNPJ + regime
- ✅ wa_instance: zapmei connected + dados corretos
- ✅ clicksign em integracao_config: ativa com api_key e base_url
- ✅ RLS: tabelas não expostas via anon key
- ✅ integracao_config: 5 integrações (serpro, evolution, nfeio, asaas, clicksign)

---

## ESTADO DO BANCO

| Tabela | Registros | Status |
|--------|-----------|--------|
| clientes | 8 | ✅ |
| escritorio_config | 1 | ✅ |
| integracao_config | 5 | ✅ |
| mcp_api_keys | 11 | ✅ |
| profiles | 10 | ✅ |
| user_roles | 10 | ✅ |
| wa_instance | 1 | ✅ |
| wa_conversa | 3 | ✅ |
| leads_crm | 0 | ⚠️ vazia |
| tarefas | 0 | ⚠️ vazia |
| obrigacoes | 0 | 🔴 esperado ter dados |
| contrato_cliente | 0 | 🔴 esperado ter dados |
| cobrancas | 0 | ok (gerado on-demand) |
| nfse_emitida | 0 | ok (produção) |
| das_guias | 0 | ok (gerado on-demand) |

---

## PLANO DE CORREÇÃO

1. **BUG-1** Fix `use-leads-crm.ts`: `status` → `etapa`
2. **BUG-2** Fix hooks WA: `instance_name` → `nome`
3. **BUG-3** Re-seed obrigações + contratos
4. **BUG-4** Revisar scopes do agente_coo

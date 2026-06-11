# CHECKLIST — Implementação Bugs P1 #3, #4, #8
**Data:** 2026-05-22 | **Status:** PRONTO PARA IMPLEMENTAÇÃO | **Dev Responsável:** BACK-END DEV + FRONT-END DEV

---

## 📋 INSTRUÇÕES

Este checklist guia a implementação dos 3 bugs P1 de forma sequencial.

**Documentos de referência:**
- `PLANO_TECNICO_BUGS_03_04_08.md` — Arquitetura técnica completa
- `IMPLEMENTACAO_BUG03_USE_NFSE.ts` — Código pronto para copiar
- `IMPLEMENTACAO_BUG04_USE_WA_INSTANCES.ts` — Código pronto para copiar
- `IMPLEMENTACAO_BUG08_USE_CONTRATOS_CLIENTE.ts` — Código pronto para copiar
- `MIGRATION_007_WA_INSTANCES.sql` — Schema Supabase
- `MIGRATION_008_CONTRATOS_CLIENTES.sql` — Schema Supabase
- `SEED_WA_INSTANCES.sql` — Dados de teste
- `SEED_CONTRATOS_CLIENTES.sql` — Dados de teste

---

## 🔴 FASE 1: Supabase Schema (DEVOPS / ARQUITETO)
**Tempo estimado:** 10 minutos

### Pré-requisito
- [ ] Ter acesso ao Supabase dashboard: https://supabase.com/dashboard/project/ajaqbdsalxfgrwpjbtbn
- [ ] Service role key disponível: `sbp_<SUPABASE_ACCESS_TOKEN_REDACTED>`

### Executar

- [ ] **Migration 007 — wa_instances**
  - Ir a: SQL Editor > New Query
  - Copiar conteúdo de `MIGRATION_007_WA_INSTANCES.sql`
  - Executar
  - Validar: Tabela `wa_instances` criada com RLS ✓
  
  ```sql
  -- Validação
  SELECT * FROM information_schema.tables WHERE table_name = 'wa_instances';
  SELECT * FROM wa_instances LIMIT 0; -- Schema check
  ```

- [ ] **Migration 008 — contratos_clientes**
  - Ir a: SQL Editor > New Query
  - Copiar conteúdo de `MIGRATION_008_CONTRATOS_CLIENTES.sql`
  - Executar
  - Validar: Tabela `contratos_clientes` criada com RLS ✓

  ```sql
  -- Validação
  SELECT * FROM information_schema.tables WHERE table_name = 'contratos_clientes';
  ```

- [ ] **Seed — wa_instances**
  - Ir a: SQL Editor > New Query
  - Copiar conteúdo de `SEED_WA_INSTANCES.sql`
  - Executar
  - Validar: 3 instâncias criadas ✓

  ```sql
  -- Validação
  SELECT COUNT(*) FROM wa_instances; -- Deve retornar 3
  ```

- [ ] **Seed — contratos_clientes**
  - Ir a: SQL Editor > New Query
  - Copiar conteúdo de `SEED_CONTRATOS_CLIENTES.sql`
  - Executar
  - Validar: 5 contratos criados ✓

  ```sql
  -- Validação
  SELECT COUNT(*) FROM contratos_clientes; -- Deve retornar 5+
  ```

---

## 🟡 FASE 2: Hooks TypeScript (BACK-END DEV)
**Tempo estimado:** 20 minutos

### BUG-03: useNfse com authHeader robusto

- [ ] Localizar arquivo: `src/hooks/use-nfse.ts` no repositório
- [ ] Backup do arquivo original
- [ ] Copiar conteúdo de `IMPLEMENTACAO_BUG03_USE_NFSE.ts`
- [ ] Colar em `src/hooks/use-nfse.ts`
- [ ] Verificar imports:
  ```typescript
  import { useState, useCallback } from 'react';
  import { toast } from 'sonner'; // ✓ Deve existir
  ```
- [ ] Salvar arquivo
- [ ] Teste unitário (no seu IDE):
  ```typescript
  // Sem token
  const { error } = useNfse();
  // Esperado: erro "NFEIO_API_KEY não configurada"
  ```

### BUG-04: useWaInstances com Supabase realtime

- [ ] Localizar arquivo: `src/hooks/use-wa-instances.ts` no repositório
- [ ] Backup do arquivo original
- [ ] Copiar conteúdo de `IMPLEMENTACAO_BUG04_USE_WA_INSTANCES.ts`
- [ ] Colar em `src/hooks/use-wa-instances.ts`
- [ ] Verificar imports:
  ```typescript
  import { useEffect, useState, useCallback } from 'react';
  import { supabase } from '@/lib/supabase'; // ✓ Deve existir
  import { toast } from 'sonner'; // ✓ Deve existir
  ```
- [ ] Salvar arquivo
- [ ] Type check (TypeScript):
  ```bash
  npx tsc --noEmit src/hooks/use-wa-instances.ts
  # Deve compilar sem erros
  ```

### BUG-08: useContratosCliente com parsing de datas

- [ ] Localizar arquivo: `src/hooks/use-contratos-cliente.ts` no repositório
- [ ] Backup do arquivo original
- [ ] Copiar conteúdo de `IMPLEMENTACAO_BUG08_USE_CONTRATOS_CLIENTE.ts`
- [ ] Colar em `src/hooks/use-contratos-cliente.ts`
- [ ] Verificar imports:
  ```typescript
  import { useEffect, useState, useCallback } from 'react';
  import { supabase } from '@/lib/supabase'; // ✓ Deve existir
  import { toast } from 'sonner'; // ✓ Deve existir
  ```
- [ ] Validar função `formatarDataPtBr`:
  ```typescript
  // Teste manual
  formatarDataPtBr('2024-01-15'); // Esperado: "15/01/2024"
  formatarDataPtBr('2025-12-25'); // Esperado: "25/12/2025"
  formatarDataPtBr(null); // Esperado: "—"
  ```
- [ ] Salvar arquivo

---

## 🟢 FASE 3: Build & Type Check (BACK-END DEV)
**Tempo estimado:** 5 minutos

- [ ] Executar build local:
  ```bash
  npm run build 2>&1 | grep -E "error|Error" | head -20
  ```
  - **Esperado:** Zero erros TypeScript
  - Se houver erro, corrigir imports/tipos antes de continuar

- [ ] Type check específico:
  ```bash
  npx tsc --noEmit src/hooks/use-nfse.ts src/hooks/use-wa-instances.ts src/hooks/use-contratos-cliente.ts
  ```
  - **Esperado:** Sem output (sucesso)

---

## 🔵 FASE 4: Componentes (FRONT-END DEV)
**Tempo estimado:** 10 minutos

### BUG-04: Atualizar componente WhatsApp

- [ ] Localizar arquivo: `src/routes/_app.whatsapp.tsx`
- [ ] Encontrar onde é usado `useWaInstances()` (ou criar novo uso)
- [ ] Atualizar para passar `escritorioId`:
  ```typescript
  const { user } = useAuth();
  const { instances, loading, createInstance, updateInstance, deleteInstance } = 
    useWaInstances(user.escritorio_id);
  ```
- [ ] Atualizar template para exibir `instances` real-time:
  ```typescript
  {instances.map(inst => (
    <div key={inst.id}>
      <h3>{inst.instance_name}</h3>
      <p>{inst.whatsapp_number}</p>
      <span className={`status-${inst.status}`}>{inst.status}</span>
      <button onClick={() => deleteInstance(inst.id)}>Deletar</button>
    </div>
  ))}
  ```
- [ ] Salvar arquivo

### BUG-08: Verificar componente de Contratos

- [ ] Localizar aba/componente que exibe contratos do cliente
- [ ] Atualizar para usar novo hook:
  ```typescript
  const { contratos, loading } = useContratosCliente(cliente.id);
  
  // Exibir data formatada:
  <td>{c.data_contrato_formatada}</td> {/* DD/MM/YYYY */}
  ```
- [ ] Remover qualquer formatação manual de data (evitar duplicação)
- [ ] Salvar arquivo

---

## 🟣 FASE 5: Build & Deploy (DEVOPS)
**Tempo estimado:** 10 minutos

### Build

- [ ] Executar build completo:
  ```bash
  npm run build
  ```
  - **Esperado:** `✓ built in XXs`
  - **Warnings OK**, mas **zero erros**

### Deploy

- [ ] Executar deploy:
  ```bash
  ./deploy.sh
  ```
  - **Esperado:** 
    - ```
      ✓ Successfully published your Worker to https://apoya-gestao.talkzzbot.workers.dev
      ```

- [ ] Validar URLs:
  - [ ] https://apoyaproject.zapro.tech/ — carrega sem 404 ✓
  - [ ] https://apoya-gestao.talkzzbot.workers.dev — carrega ✓

---

## ✅ FASE 6: Testes Funcionais (WILSON / QA)
**Tempo estimado:** 15 minutos

### BUG-03 Tests

- [ ] **Token não configurado**
  - Acessar /fiscal/nfse
  - Tentar emitir NFS-e
  - **Esperado:** Toast error "NFEIO_API_KEY não configurada"
  - **❌ Falha se:** erro silencioso ou 401 genérico

- [ ] **Token válido**
  - Configurar chave NFE.io real nas integrações
  - Emitir NFS-e teste
  - **Esperado:** Resposta bem-sucedida ou erro específico da API
  - **❌ Falha se:** Header "Bearer null"

### BUG-04 Tests

- [ ] **Listar instâncias**
  - Acessar /whatsapp
  - **Esperado:** Exibir 3 instâncias teste (Comercial, Suporte, Notificações)
  - **❌ Falha se:** lista vazia ou carregamento infinito

- [ ] **Criar instância**
  - Clicar "Nova Instância"
  - Preencher form: nome + número + API key
  - Submeter
  - **Esperado:** Instância aparece em lista realtime
  - **❌ Falha se:** erro de criação ou não aparece

- [ ] **Atualizar instância**
  - Clicar "Editar" em uma instância
  - Mudar status para "connected"
  - Salvar
  - **Esperado:** Status atualiza em realtime
  - **❌ Falha se:** status não muda ou erro

- [ ] **Deletar instância**
  - Clicar "Deletar" em uma instância
  - **Esperado:** Desaparece da lista
  - **❌ Falha se:** ainda aparece após delete

- [ ] **Persistência (reload)**
  - Criar uma instância nova
  - Reload page (F5)
  - **Esperado:** Instância still there
  - **❌ Falha se:** desaparece (estava em localStorage)

### BUG-08 Tests

- [ ] **Acessar contratos do cliente**
  - Ir a /clientes/{id}
  - Clicar aba "Contratos"
  - **Esperado:** Exibir 5 contratos com datas `DD/MM/YYYY`
  - Exemplos:
    - "15/01/2024" ✓
    - "20/03/2024" ✓
    - "01/02/2025" ✓
  - **❌ Falha se:** datas aparecem como `2024-01-15` (não formatadas)

- [ ] **Validar ordem**
  - Contratos devem estar ordenados por data (mais recentes primeiro)
  - **Esperado:** "01/02/2025", "20/03/2024", "15/01/2024"

- [ ] **Criar novo contrato**
  - Clicar "Novo Contrato"
  - Preencher com data (ex: 10/05/2025)
  - Salvar
  - **Esperado:** Data exibida formatada como `10/05/2025`

---

## 🔄 Acceptance Criteria (ARQUITETO)

Todas as caixas abaixo devem estar ✅ antes de marcar como CONCLUÍDO:

### BUG-03
- [ ] Token é validado ao iniciar `useNfse()`
- [ ] Se token não existe → erro claro (não silencioso)
- [ ] Se request falha com 401 → erro capturado e logged
- [ ] Toast de erro sempre visível ao usuário

### BUG-04
- [ ] Tabela `wa_instances` criada com RLS ✓
- [ ] useWaInstances() busca dados realtime do Supabase ✓
- [ ] CRUD completo funciona: create, read, update, delete ✓
- [ ] Dados persistem entre reloads ✓
- [ ] Realtime funciona (mudanças aparecem sem reload) ✓

### BUG-08
- [ ] Tabela `contratos_clientes` tem coluna `data_contrato` como DATE ✓
- [ ] Datas são parseadas: `YYYY-MM-DD` → `DD/MM/YYYY` ✓
- [ ] Formatação respeita timezone pt-BR ✓
- [ ] Contratos ordenados por data (DESC) ✓

---

## 📊 Timeline

| Fase | Atividade | Tempo | Responsável |
|------|-----------|-------|-------------|
| 1 | Schema Supabase (2 migrations + 2 seeds) | 10 min | DEVOPS |
| 2 | Hooks TypeScript (3 arquivos) | 20 min | BACK-END DEV |
| 3 | Build & Type Check | 5 min | BACK-END DEV |
| 4 | Componentes React | 10 min | FRONT-END DEV |
| 5 | Build & Deploy | 10 min | DEVOPS |
| 6 | Testes Funcionais | 15 min | WILSON |
| **Total** | — | **70 min** | — |

---

## 🚨 Troubleshooting

### "NFEIO_API_KEY not found"
- Verificar se está em `wrangler.toml` ou injetada durante deploy
- Se não estiver: adicionar em Cloudflare env vars

### "wa_instances RLS deny all inserts"
- Confirmar que `escritorio_config.user_id` existe
- RLS policy verifica se escritório pertence ao usuário autenticado
- Se user_id é NULL, RLS bloqueia — corrigir dados seed

### "contratos_clientes data_contrato é text"
- Verificar tipo: `\d contratos_clientes` no psql
- Se for `text`, corrigir com: `ALTER TABLE contratos_clientes ALTER COLUMN data_contrato TYPE date USING data_contrato::date;`

### Deploy quebra com "Worker error"
- Validar build: `npm run build` deve passar
- Verificar imports nos hooks: `from '@/lib/supabase'`
- Se Supabase lib não existe, criar arquivo stub em `src/lib/supabase.ts`

---

## 📝 Notas Finais

- Cada fase depende da anterior — não pular etapas
- Wilson testa APÓS deploy bem-sucedido
- Se algum teste falhar, reportar blocke para ARQUITETO
- Após todos os testes ✅, fazer commit em branch separada (ex: `fix/bugs-03-04-08`)
- Merge para `main` apenas após aprovação final

---

**Status:** ⏳ AGUARDANDO IMPLEMENTAÇÃO
**Próximo passo:** Fase 1 (Supabase schema)

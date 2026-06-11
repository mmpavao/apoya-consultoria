# HANDOFF — Bugs P1 #3, #4, #8
**De:** ARQUITETO | **Para:** Time de Desenvolvimento | **Data:** 2026-05-22 19:47 | **Status:** PRONTO PARA EXECUÇÃO

---

## 📌 RESUMO

Projeto APOYA estava inativo por 43 horas. Ciclos 1-6 da Sprint Auditoria foram deployados (BUG-01-07), mas 3 bugs P1 ficaram em backlog:

- **BUG-03:** useNfse authHeader robusto
- **BUG-04:** useWaInstances migrar para Supabase (de localStorage)
- **BUG-08:** useContratosCliente datas corretas (parsing YYYY-MM-DD → DD/MM/YYYY)

**ARQUITETO** acaba de estruturar 100% da solução. Agora é com o time.

---

## 📦 ENTREGÁVEIS

Todos os arquivos estão em `/app/` (workspace ARQUITETO):

### Documentação
1. **`PLANO_TECNICO_BUGS_03_04_08.md`**
   - Arquitetura técnica completa
   - Acceptance criteria
   - Fluxos de dados
   - Estimativas

2. **`CHECKLIST_IMPLEMENTACAO_BUGS_03_04_08.md`**
   - Passo-a-passo sequencial
   - Instruções para cada dev
   - Validações por fase
   - Testes funcionais

### Código Pronto
3. **`IMPLEMENTACAO_BUG03_USE_NFSE.ts`**
   - Hook completo com error handling
   - 3 métodos: emitir, consultar, cancelar
   - Copiar direto para `src/hooks/use-nfse.ts`

4. **`IMPLEMENTACAO_BUG04_USE_WA_INSTANCES.ts`**
   - Hook realtime (Postgres Changes)
   - CRUD completo
   - RLS integrado
   - Copiar direto para `src/hooks/use-wa-instances.ts`

5. **`IMPLEMENTACAO_BUG08_USE_CONTRATOS_CLIENTE.ts`**
   - Hook com Supabase + parsing de datas
   - Formatação pt-BR automática
   - Realtime listener
   - Copiar direto para `src/hooks/use-contratos-cliente.ts`

### Schemas Supabase
6. **`MIGRATION_007_WA_INSTANCES.sql`**
   - Tabela wa_instances
   - RLS com 4 políticas
   - Índices + triggers
   - Realtime publications

7. **`MIGRATION_008_CONTRATOS_CLIENTES.sql`**
   - Tabela contratos_clientes
   - Coluna `data_contrato` como DATE (crítico para BUG-08)
   - RLS + índices
   - Validation checks

### Dados de Teste
8. **`SEED_WA_INSTANCES.sql`**
   - 3 instâncias WhatsApp de exemplo
   - Rodar APÓS migration 007

9. **`SEED_CONTRATOS_CLIENTES.sql`**
   - 5 contratos com datas variadas
   - Rodar APÓS migration 008

---

## 🚀 FLUXO DE EXECUÇÃO

### Fase 1: Supabase (DEVOPS)
```bash
# 1. Ir a: https://supabase.com/dashboard/project/ajaqbdsalxfgrwpjbtbn/sql
# 2. Executar 4 queries em sequência:
#    - MIGRATION_007_WA_INSTANCES.sql
#    - MIGRATION_008_CONTRATOS_CLIENTES.sql
#    - SEED_WA_INSTANCES.sql
#    - SEED_CONTRATOS_CLIENTES.sql
# 3. Validar com: SELECT COUNT(*) FROM wa_instances; -- 3
#                 SELECT COUNT(*) FROM contratos_clientes; -- 5+
```

**Tempo:** 10 minutos

### Fase 2: Hooks (BACK-END DEV)
```bash
# 1. Clone do repo (ou já tem?)
cd mmpavao/apoya-consultoria

# 2. Copiar 3 arquivos de implementação:
cp /app/IMPLEMENTACAO_BUG03_USE_NFSE.ts src/hooks/use-nfse.ts
cp /app/IMPLEMENTACAO_BUG04_USE_WA_INSTANCES.ts src/hooks/use-wa-instances.ts
cp /app/IMPLEMENTACAO_BUG08_USE_CONTRATOS_CLIENTE.ts src/hooks/use-contratos-cliente.ts

# 3. Type check:
npx tsc --noEmit src/hooks/use-*.ts

# 4. Build:
npm run build
```

**Tempo:** 20 minutos

### Fase 3: Componentes (FRONT-END DEV)
```bash
# 1. Atualizar _app.whatsapp.tsx para usar novo hook
#    - Passar escritorioId ao useWaInstances()
#    - Render instances realtime

# 2. Atualizar componente de contratos
#    - Usar data_contrato_formatada (já vem formatado do hook)
#    - Remover qualquer parsing manual

# 3. Build local para validar:
npm run build
```

**Tempo:** 10 minutos

### Fase 4: Deploy (DEVOPS)
```bash
# 1. Build final:
npm run build

# 2. Deploy:
./deploy.sh

# 3. Validar URLs:
# - https://apoyaproject.zapro.tech/
# - https://apoya-gestao.talkzzbot.workers.dev/
```

**Tempo:** 10 minutos

### Fase 5: Testes (WILSON)
```bash
# Checklist em: CHECKLIST_IMPLEMENTACAO_BUGS_03_04_08.md
# Seção: FASE 6 — Testes Funcionais

# BUG-03: Testar NFS-e sem token + com token
# BUG-04: Testar CRUD de instâncias + realtime
# BUG-08: Testar data formatada DD/MM/YYYY + ordem cronológica
```

**Tempo:** 15 minutos

---

## ✅ Acceptance Criteria

Cada bug tem critérios específicos em `CHECKLIST_IMPLEMENTACAO_BUGS_03_04_08.md`.

**Resumo:**
- **BUG-03:** Token validado, erro claro se não existe
- **BUG-04:** Realtime funciona, dados persistem entre reloads
- **BUG-08:** Datas formatadas `DD/MM/YYYY`, ordenação correta

---

## 🔑 Credenciais & Links

```
Supabase Project: ajaqbdsalxfgrwpjbtbn
Service Role Key: sbp_<SUPABASE_ACCESS_TOKEN_REDACTED>
Dashboard: https://supabase.com/dashboard/project/ajaqbdsalxfgrwpjbtbn

GitHub Repo: mmpavao/apoya-consultoria
Branch: main

Deploy URLs:
- https://apoyaproject.zapro.tech/
- https://apoya-gestao.talkzzbot.workers.dev
```

---

## ⚠️ Pontos Críticos

1. **BUG-04 RLS:** Garantir que `escritorio_config.user_id` está populado
   - Se não estiver, RLS nega todas as queries
   - Validar seed com: `SELECT user_id FROM escritorio_config LIMIT 1;`

2. **BUG-08 Data Type:** Coluna `data_contrato` DEVE ser `DATE`, não `TEXT`
   - Migration já cria como DATE
   - Se existing table, migrar com: `ALTER TABLE ... ALTER COLUMN ... TYPE date USING ...::date;`

3. **BUG-03 NFEIO_API_KEY:** Precisa estar em Cloudflare env (wrangler.toml ou UI)
   - Hook lê de `import.meta.env.VITE_NFEIO_API_KEY`
   - Se não estiver injetado, erro "não configurada"
   - Confirmar com DEVOPS

4. **Deploy Pipeline:** Usar `./deploy.sh` (script raiz)
   - Build → wrangler deploy com token correto
   - Validar 200 OK em ambas as URLs

---

## 📞 Suporte

Se algo quebrar durante implementação:

| Problema | Solução |
|----------|---------|
| Erro TypeScript | Verificar imports de `@/lib/supabase` |
| RLS deny | Validar `escritorio_id` e `user_id` no seed |
| Data parsed wrong | Confirmar coluna é DATE (não TEXT) |
| Deploy falha | Rodar `npm run build` localmente + checar output |
| Realtime não funciona | Validar publicações em Supabase dashboard |

---

## 📅 Timeline Total

| Fase | Tempo |
|------|-------|
| Supabase | 10 min |
| Hooks | 20 min |
| Componentes | 10 min |
| Build & Deploy | 10 min |
| Testes | 15 min |
| **Total** | **65 minutos** |

**Esperado:** Completed by 21:00 BRT (2026-05-22)

---

## 🎯 Próximos Passos

1. DEVOPS: Executar migrations + seeds Supabase
2. BACK-END DEV: Copiar hooks + validar build
3. FRONT-END DEV: Atualizar componentes
4. DEVOPS: Build final + deploy
5. WILSON: Testar + aprovar
6. ARQUITETO: Marcar como CONCLUÍDO

---

**Status:** ✅ ESTRUTURA COMPLETA — AGUARDANDO EXECUÇÃO

Qualquer dúvida, consulte os documentos ou chame ARQUITETO.

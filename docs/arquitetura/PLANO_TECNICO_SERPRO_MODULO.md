# 🏗️ PLANO TÉCNICO — Módulo SERPRO + Certificado Digital + Procuração
**Data:** 2026-05-22  
**Status:** RASCUNHO — Aguarda validação do ARQUITETO

---

## 1. CONTEXTO E REGRAS DE NEGÓCIO

### Regra crítica de habilitação por regime:
| Regime | Certificado Digital | Procuração eCAC | Tools disponíveis |
|--------|--------------------|-----------------|--------------------|
| MEI | ❌ Não precisa | ❌ Não precisa | TODAS as tools MEI |
| Simples Nacional | ✅ OBRIGATÓRIO | ✅ OBRIGATÓRIO | Todas exceto MEI-only |
| Lucro Presumido | ✅ OBRIGATÓRIO | ✅ OBRIGATÓRIO | Todas (produção RFB) |
| Lucro Real | ✅ OBRIGATÓRIO | ✅ OBRIGATÓRIO | Todas (produção RFB) |

### Regra de bloqueio:
- Se `regime != MEI` e `cliente.tem_certificado == false` → **bloquear consulta** com msg clara
- Se `regime != MEI` e `cliente.tem_procuracao == false` → **bloquear consulta** com msg clara
- `serpro_parcmei_pedidos` exige procuração MESMO sendo MEI

---

## 2. BANCO DE DADOS — Migrations necessárias

### 2.1 Tabela `cliente_certificado`
```sql
CREATE TABLE cliente_certificado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES cliente(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('A1', 'A3')),
  -- Armazenamento criptografado (AES-256-GCM via Supabase Vault ou pgcrypto)
  pfx_encrypted BYTEA,           -- Certificado .pfx criptografado
  pfx_senha_encrypted TEXT,      -- Senha do .pfx criptografada
  pfx_validade DATE,             -- Data de validade (plaintext, para alertas)
  pfx_nome_razao TEXT,           -- Razão social no cert (plaintext)
  pfx_cnpj TEXT,                 -- CNPJ do certificado (plaintext)
  has_procuracao BOOLEAN DEFAULT FALSE,  -- Procuração outorgada no eCAC?
  procuracao_validade DATE,      -- Validade da procuração (plaintext)
  procuracao_verificada_em TIMESTAMPTZ,  -- Última verificação via serpro_procuracoes
  nfseio_cert_id TEXT,           -- ID do certificado no NFE.io (após upload)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id)
);

-- RLS: apenas admins e o próprio cliente podem ver
ALTER TABLE cliente_certificado ENABLE ROW LEVEL SECURITY;
```

### 2.2 Coluna adicional em `cliente`
```sql
-- Adicionar em migration existente ou nova
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS regime TEXT 
  CHECK (regime IN ('MEI', 'SIMPLES', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'ISENTO'));
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS tem_certificado BOOLEAN DEFAULT FALSE;
ALTER TABLE cliente ADD COLUMN IF NOT EXISTS tem_procuracao BOOLEAN DEFAULT FALSE;
```

---

## 3. FRONTEND — Nova aba no cadastro de clientes

### 3.1 Estrutura de abas em `/clientes/:id`
```
[ Dados Gerais ] [ Fiscal ] [ Financeiro ] [ Certificado & Procuração ] ← NOVA
```

### 3.2 Componente `CertificadoTab.tsx`
**Seção A — Certificado Digital:**
- Upload de arquivo `.pfx` (client-side encryption ANTES do upload)
- Campo senha do certificado (input type=password, criptografado)
- Exibição: validade, CNPJ, razão social (extraídos no servidor)
- Badge: `ATIVO` / `EXPIRANDO (< 30 dias)` / `VENCIDO`
- Botão: "Sincronizar com NFE.io" → faz upload do cert no NFE.io e salva `nfseio_cert_id`

**Seção B — Procuração eCAC:**
- Toggle: "Possui procuração outorgada no eCAC?"
- Campo: data de validade (manual)
- Botão: "Verificar via SERPRO" → chama `serpro_procuracoes` e atualiza automaticamente
- Badge: `ATIVA` / `VENCIDA` / `NÃO VERIFICADA`

---

## 4. MCP SERPRO — Catálogo completo de Tools

### Gateway: `POST https://mcp.zapro.tech/mcp`
### Auth: `Authorization: Bearer <SERPRO_MCP_TOKEN>`

---

### 4.1 MEI — CCMEI e Cadastro
| Tool | Descrição | Parâmetros | Regime | Cert? | Proc? |
|------|-----------|-----------|--------|-------|-------|
| `serpro_ccmei_emitir` | Emite PDF do CCMEI | `cnpj` | MEI | ❌ | ❌ |
| `serpro_ccmei_dados` | Dados cadastrais completos | `cnpj` | MEI | ❌ | ❌ |
| `serpro_ccmei_situacao` | Situação cadastral pelo CPF | `cpf` | MEI | ❌ | ❌ |

### 4.2 DAS MEI — Boletos e Dívidas
| Tool | Descrição | Parâmetros | Regime | Cert? | Proc? |
|------|-----------|-----------|--------|-------|-------|
| `serpro_pgmei_das` | Gera código de barras DAS MEI | `cnpj`, `periodo` (YYYYMM) | MEI | ❌ | ❌ |
| `serpro_pgmei_das_pdf` | PDF do DAS MEI (base64) | `cnpj`, `periodo` | MEI | ❌ | ❌ |
| `serpro_pgmei_divida` | Consulta dívida ativa MEI | `cnpj` | MEI | ❌ | ❌ |

### 4.3 Simples Nacional — PGDAS
| Tool | Descrição | Parâmetros | Regime | Cert? | Proc? |
|------|-----------|-----------|--------|-------|-------|
| `serpro_pgdas_ultima` | Última declaração PGDAS-D | `cnpj` | SN | ✅ | ✅ |
| `serpro_pgdas_ano` | Todas PGDAS-D de um ano | `cnpj`, `ano` | SN | ✅ | ✅ |
| `serpro_das_gerar` | Gera DAS Simples Nacional | `cnpj`, `periodo` | SN | ✅ | ✅ |
| `serpro_regime` | Regime de apuração | `cnpj`, `ano` | Todos | ✅ | ✅ |
| `serpro_regime_anos` | Anos com opção de regime | `cnpj` | Todos | ✅ | ✅ |

### 4.4 Declarações
| Tool | Descrição | Parâmetros | Regime | Cert? | Proc? |
|------|-----------|-----------|--------|-------|-------|
| `serpro_defis_consultar` | Lista todas as DEFIS | `cnpj` | SN | ✅ | ✅ |
| `serpro_dctfweb` | DCTFWeb por período | `cnpj`, `periodo` (YYYYMM) | Todos | ✅ | ✅ |
| `serpro_mit_apuracoes` | Apurações MIT de um ano | `cnpj`, `ano` | SN | ✅ | ✅ |

### 4.5 eCAC — Domicílio e Caixa Postal
| Tool | Descrição | Parâmetros | Regime | Cert? | Proc? |
|------|-----------|-----------|--------|-------|-------|
| `serpro_dte` | Situação DTE | `cnpj` | Todos | ✅ | ✅ |
| `serpro_caixapostal_indicador` | Novas mensagens eCAC | `cnpj` | Todos | ✅ | ✅ |
| `serpro_caixapostal_mensagens` | Lista mensagens eCAC | `cnpj` | Todos | ✅ | ✅ |

### 4.6 Situação Fiscal e Parcelamentos
| Tool | Descrição | Parâmetros | Regime | Cert? | Proc? |
|------|-----------|-----------|--------|-------|-------|
| `serpro_sitfis` | Situação fiscal PGFN+RFB (pesada) | `cnpj` | Todos | ✅ | ✅ |
| `serpro_parcsn_pedidos` | Parcelamentos Simples Nacional | `cnpj` | SN | ✅ | ✅ |
| `serpro_parcmei_pedidos` | Parcelamentos MEI | `cnpj` | MEI | ❌ | ✅ |

### 4.7 Outros / Utilitários
| Tool | Descrição | Parâmetros | Regime | Cert? | Proc? |
|------|-----------|-----------|--------|-------|-------|
| `serpro_procuracoes` | Procurações outorgadas no eCAC | `cnpj` | Todos | ✅ | — |
| `serpro_redesim_vinculos` | Vínculos do contabilista Redesim | — | — | — | — |
| `serpro_status` | Status do gateway + autenticação | — | — | — | — |

---

## 5. PÁGINA SERPRO (`/fiscal/serpro`)

### 5.1 Layout da página
```
[ PageHeader: "Consultas SERPRO" ]
[ KpiGrid: Total clientes MEI | Com certificado | Com procuração | Alertas ]
[ PageTabs: MEI | Simples Nacional | Declarações | eCAC | Situação Fiscal ]
```

### 5.2 Lógica de habilitação por cliente
```typescript
function canUseTool(cliente: Cliente, tool: SerproTool): ToolStatus {
  if (tool.requiresCert && !cliente.tem_certificado) 
    return { enabled: false, reason: "Certificado digital não cadastrado" };
  if (tool.requiresProc && !cliente.tem_procuracao)
    return { enabled: false, reason: "Procuração eCAC não verificada" };
  return { enabled: true };
}
```

### 5.3 Componente de consulta
- Seletor de cliente (filtrado por regime compatível com a tab ativa)
- Botão de ação → chama API route `/api/serpro/{tool}` → chama MCP
- Resultado exibido em painel expansível (JSON formatado ou PDF viewer para base64)
- Histórico de consultas salvo em tabela `serpro_log`

---

## 6. API ROUTES NECESSÁRIAS

```
POST /api/serpro/call         → proxy para o MCP (valida cert/proc antes)
GET  /api/serpro/status       → chama serpro_status
GET  /api/serpro/procuracoes  → atualiza has_procuracao do cliente
```

---

## 7. TABELA DE LOG

```sql
CREATE TABLE serpro_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES cliente(id),
  tool TEXT NOT NULL,
  parametros JSONB,
  resultado_resumo TEXT,       -- Apenas resumo (não salvar dados sensíveis inteiros)
  status TEXT CHECK (status IN ('ok', 'erro', 'bloqueado')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 8. FLUXO DE IMPLEMENTAÇÃO (ordem de execução)

1. **Migration 004** — tabela `cliente_certificado` + colunas em `cliente`
2. **Aba Certificado** no cadastro de clientes (upload + criptografia)
3. **API route `/api/serpro/call`** — proxy MCP com validação de habilitação
4. **Página `/fiscal/serpro`** — tabs por categoria + componentes de consulta
5. **Log de consultas** — `serpro_log` + histórico na UI

---

## 9. ARQUIVOS AFETADOS (Sprint SERPRO)

```
affected_files:
  # Banco
  - supabase/migrations/004_certificado_digital.sql

  # Backend
  - src/routes/api/serpro/call.ts         (proxy MCP)
  - src/routes/api/serpro/status.ts       (health check)
  - src/lib/serpro/tools-catalog.ts       (catálogo completo das tools)
  - src/lib/serpro/eligibility.ts         (regras cert/proc por tool)

  # Frontend
  - src/routes/_app.fiscal.serpro.tsx     (página principal)
  - src/components/serpro/SerproQuery.tsx  (componente de consulta)
  - src/components/serpro/ResultPanel.tsx  (exibição JSON/PDF)
  - src/components/clientes/CertificadoTab.tsx  (aba no cadastro)
  - src/hooks/use-serpro.ts               (hook de chamadas)

  # Modificados
  - src/routes/_app.clientes_.$id.tsx     (adiciona aba Certificado)
  - src/lib/serpro/tools-catalog.ts       (catálogo com flags de elegibilidade)
```

---

## 10. ACCEPTANCE CRITERIA

- [ ] MEI com CNPJ válido → `serpro_ccmei_dados` retorna dados sem exigir cert/proc
- [ ] SN sem certificado → consulta bloqueada com mensagem clara na UI
- [ ] SN com certificado → `serpro_pgdas_ultima` executa via MCP e retorna resultado
- [ ] Upload de `.pfx` → criptografado antes de sair do browser, salvo no Supabase
- [ ] Botão "Verificar procuração" → atualiza `has_procuracao` automaticamente
- [ ] Log de todas as consultas em `serpro_log`
- [ ] PDF base64 (`serpro_ccmei_emitir`, `serpro_pgmei_das_pdf`) → exibe viewer inline

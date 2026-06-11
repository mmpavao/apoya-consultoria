# APOYA Gestão — Escopo Técnico V3 (Definitivo)
**Preparado por:** ARQUITETO  
**Data:** 2026-05-20  
**Status:** DEFINITIVO — baseado em pesquisa de mercado, normas 2026, Reforma Tributária e visão do Daniel  
**Fontes:** Wilson APOYA + Daniel Araújo + Marcio Pavão + pesquisa de concorrência + fontes oficiais Receita Federal

---

## 1. A VISÃO — O QUE A APOYA VAI SER

> **"O primeiro sistema contábil brasileiro feito para eliminar a agenda humana."**

Enquanto Domínio, Questor e Alterdata são ferramentas para contadores trabalharem, a APOYA vai ser a ferramenta que trabalha no lugar do contador nos processos repetitivos — liberando Daniel para trabalho estratégico.

### O que nenhum concorrente entrega hoje
| Funcionalidade | Domínio | Omie | Questor | Alterdata | **APOYA** |
|---|---|---|---|---|---|
| WhatsApp nativo (envio automático de documentos) | ❌ | ❌ | ❌ | ❌ | ✅ |
| NFS-e em lote (honorários do escritório) | ❌ | ❌ | ❌ | ❌ | ✅ |
| DAS em lote para 75 clientes | Parcial | ❌ | Parcial | Parcial | ✅ |
| Onboarding 100% digital (CNPJ → contrato → cobrança) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Simulador de regime tributário (Reforma) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Mobile-first para o contador | ❌ | ❌ | ❌ | ❌ | ✅ |
| Dashboard ao vivo (quem pagou, quem não pagou) | Parcial | ❌ | Parcial | Parcial | ✅ |
| Alerta proativo de vencimento via WhatsApp | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 2. STACK DEFINITIVA

```
Frontend:       React + Vite + TypeScript + Tailwind + shadcn/ui (PWA mobile-first)
Auth:           Supabase Auth (magic link + senha)
Backend:        Supabase Edge Functions (Deno/TypeScript)
Database:       Supabase PostgreSQL + RLS por escritório (multi-tenant futuro)
Storage:        Supabase Storage (PDFs, XMLs, certificados, contratos)
Jobs/CRON:      Supabase pg_cron
Deploy front:   Cloudflare Pages
Domínio:        apoya.com.br (Hostinger — cPanel) ⚠️ RENOVAR URGENTE (13 dias)
Email:          Hostinger cPanel SMTP (nao-responder@apoya.com.br)
WhatsApp:       Evolution API — self-hosted na VPS DigitalOcean (porta 8080)
NFS-e:          NFE.io (conta existente) — ~R$0,50/nota, suporta CBS/IBS 2026
Pagamentos:     Asaas (conta APOYA AUDITORIA — CNPJ 43.507.838/0001-89)
Contratos:      Clicksign (conta existente — produção)
SERPRO:         Gateway VPS mantido (apoya-serpro v3.0.0 — porta 4010)
Repo:           GitHub (nova org APOYA — repo limpo)
Design:         #F97316 laranja + rounded-2xl + shadow-sm + PWA manifest
```

---

## 3. REGRAS DE NEGÓCIO — DEFINITIVAS

### 3.1 Calendário Fiscal Completo 2026 (verificado nas fontes oficiais)

#### Obrigações mensais por regime

| Regime | Obrigação | Vencimento | Via | Observação |
|---|---|---|---|---|
| **MEI** | DASMEI | Dia 20 | SERPRO | Guia diferente do DAS |
| **MEI** | DASN-SIMEI | 31/maio do ano seguinte | Manual | Declaração anual |
| **MEI** | RAIS Negativa | Conforme calendário | Manual | Quando aplicável |
| **Simples Nacional** | PGDAS-D | Dia 20 | SERPRO | Apuração antes do DAS |
| **Simples Nacional** | DAS | Dia 20 | SERPRO | Pagamento |
| **Simples Nacional** | DEFIS | 31/março | SERPRO | Anual |
| **Simples Nacional** | Folha/FGTS | Dia 7 | Manual | Se tiver empregados |
| **Simples Nacional** | eSocial | Dia 15 | eSocial | Se tiver empregados |
| **Lucro Presumido** | DARF IRPJ+CSLL | Último dia útil mês seguinte | Manual | Trimestral |
| **Lucro Presumido** | DARF PIS/COFINS | Dia 25 mês seguinte | Manual | — |
| **Lucro Presumido** | GPS (INSS) | Dia 20 | Manual | — |
| **Lucro Presumido** | FGTS | Dia 7 | Manual | — |
| **Lucro Presumido** | EFD-Reinf | Dia 15 | SPED | — |
| **Lucro Presumido** | DCTFWeb | Último dia útil | SPED | Substituiu DCTF Mensal |
| **Lucro Presumido** | EFD-Contribuições | 10º dia útil do 2º mês seguinte | SPED | — |
| **Lucro Presumido** | ECF | 31/julho | SPED | Anual |
| **Lucro Presumido** | ECD | 29/maio | SPED | Anual |
| **Lucro Real** | (igual LP + LALUR) | Mensal | Interno | — |
| **Doméstica** | DAE | Dia 7 | eSocial | INSS + FGTS + IR doméstico |

#### Multas por atraso (mostrar no sistema)

| Obrigação | Multa |
|---|---|
| DCTFWeb | R$200/mês ou 2% ao mês s/ tributos (máx. 20%) |
| EFD-Contribuições LP | R$500/mês de atraso |
| EFD-Contribuições LR | R$1.500/mês de atraso |
| ECD / ECF | 0,25% lucro líquido/mês (máx. 10%) |
| DAS (SN) | Multa automática SERPRO |

### 3.2 NFS-e — Código de serviço
- Configurável por cliente, segue tabela nacional LC 116/2003
- **NOVO 2026:** destaque obrigatório de CBS (0,9%) e IBS (0,1%) — fase de testes informativa
- MEI: isento do destaque CBS/IBS em 2026
- NFE.io já suporta os campos da Reforma — validar na integração

### 3.3 Inadimplência
- **7 dias:** primeiro alerta WhatsApp ao cliente
- **15 dias:** segundo alerta WhatsApp + notificação interna para Daniel
- **30 dias:** alerta crítico + flag no dashboard
- **45 dias:** suspensão automática do serviço + notificação ao cliente
- Reativação: automática via webhook Asaas após confirmação de pagamento

### 3.4 Reforma Tributária — impacto operacional 2026
- Clientes SN têm 2 opções: DAS unificado ou regime híbrido (CBS/IBS separados)
- Janelas de escolha do regime híbrido: **abril e setembro** de cada ano
- Sistema deve alertar 30 dias antes das janelas para clientes que podem se beneficiar
- **Critério regime híbrido:** clientes que compram >40% de fornecedores fora do SN

### 3.5 Tiers de serviço (a confirmar valores com Daniel)

| Tier | Regime | Serviços inclusos |
|---|---|---|
| **MEI** | MEI | DASMEI + DASN anual + WhatsApp |
| **Simples** | Simples Nacional | DAS + PGDAS + DEFIS + NFS-e honorários + cobranças + WhatsApp |
| **Empresarial** | LP / LR | Contabilidade completa + folha + DCTFWeb + ECF + ECD + relatórios |
| **Doméstica** | Empregador doméstico | DAE mensal + orientação trabalhista |

---

## 4. MODELO DE DADOS — ENTIDADES SUPABASE (V3)

### Entidade 1: `empresa_cliente`
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
created_at              timestamptz DEFAULT now()
updated_at              timestamptz DEFAULT now()

-- Identificação
razao_social            text NOT NULL
nome_fantasia           text
cnpj                    text NOT NULL UNIQUE
regime_tributario       text NOT NULL CHECK (regime IN ('mei','simples_nacional','lucro_presumido','lucro_real','domestica'))
status                  text DEFAULT 'ativo' CHECK (status IN ('ativo','inadimplente','suspenso','inativo','em_analise'))
tier_servico            text CHECK (tier IN ('mei','simples','empresarial','domestica'))
data_abertura           date

-- Fiscal
inscricao_municipal     text
cod_municipio_ibge      text
codigo_servico_nfse     text           -- LC 116/2003
atividade_principal     text           -- CNAE
optante_simples         boolean DEFAULT false
data_opcao_simples      date
regime_hibrido          boolean DEFAULT false  -- NOVO: Reforma Tributária 2026
data_opcao_hibrido      date
proxima_revisao_regime  date           -- próxima janela de revisão (abril/setembro)

-- Contato
responsavel             text
telefone                text
whatsapp                text NOT NULL  -- número para envio automático (+55...)
email                   text

-- Cobrança
dia_vencimento          integer CHECK (dia_vencimento BETWEEN 1 AND 28)
valor_honorario         numeric(10,2)
forma_pagamento         text CHECK (forma IN ('pix','boleto','debito_automatico'))
asaas_customer_id       text

-- Inadimplência
data_ultimo_pagamento   date
status_financeiro       text DEFAULT 'regular' CHECK (status_fin IN ('regular','atrasado','suspenso'))
data_suspensao          date
dias_atraso             integer        -- calculado: CURRENT_DATE - data_ultimo_pagamento

-- Responsável interno
usuario_responsavel_id  uuid REFERENCES auth.users

-- Metadados
observacoes             text
tags                    text[]         -- ex: ['vip','alto_risco','tributacao_especial']
```

### Entidade 2: `obrigacao`
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
empresa_id              uuid REFERENCES empresa_cliente NOT NULL
tipo                    text NOT NULL
-- Valores: 'DAS','DASMEI','PGDAS','DEFIS','DASN_SIMEI','DCTFWeb','EFD_Reinf',
--          'EFD_Contribuicoes','ECF','ECD','DAE','FGTS','GPS','RAIS','eSocial','DIRBI'
mes_referencia          text NOT NULL       -- 'YYYY-MM'
data_vencimento         date NOT NULL
status                  text DEFAULT 'pendente'
-- 'pendente','em_andamento','enviado_cliente','pago','vencido','nao_aplicavel'
data_conclusao          date
arquivo_pdf_url         text
valor_multa_estimado    numeric(10,2)       -- calculado se vencida
usuario_responsavel_id  uuid REFERENCES auth.users
observacoes             text
created_at              timestamptz DEFAULT now()
```

### Entidade 3: `nfse`
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
empresa_id              uuid REFERENCES empresa_cliente NOT NULL
mes_referencia          text NOT NULL   -- 'YYYY-MM'
numero_nfse             text
codigo_verificacao      text
status                  text DEFAULT 'pendente'
-- 'pendente','emitida','cancelada','erro','enviada_cliente'
valor_servico           numeric(10,2)
codigo_servico          text
descricao_servico       text
cbs_aliquota            numeric(5,2) DEFAULT 0.9   -- Reforma Tributária 2026
ibs_aliquota            numeric(5,2) DEFAULT 0.1   -- Reforma Tributária 2026
destaque_reforma        boolean DEFAULT true        -- obrigatório 2026 (exceto MEI)
xml_url                 text
pdf_url                 text
erro_motivo             text
data_emissao            timestamptz
data_envio_whatsapp     timestamptz
nfeio_id                text
created_at              timestamptz DEFAULT now()
```

### Entidade 4: `cobranca`
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
empresa_id              uuid REFERENCES empresa_cliente NOT NULL
mes_referencia          text NOT NULL
valor                   numeric(10,2) NOT NULL
data_vencimento         date NOT NULL
status                  text DEFAULT 'pendente'
-- 'pendente','enviada','paga','vencida','cancelada'
forma_pagamento         text
asaas_payment_id        text
asaas_invoice_url       text
pix_copia_cola          text
data_pagamento          date
data_envio_whatsapp     timestamptz
webhook_confirmado      boolean DEFAULT false
created_at              timestamptz DEFAULT now()
```

### Entidade 5: `mensagem_whatsapp`
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
empresa_id              uuid REFERENCES empresa_cliente
numero_destino          text NOT NULL
tipo                    text NOT NULL
-- 'das_disponivel','dasmei_disponivel','nfse_emitida','boleto_gerado',
-- 'lembrete_7d','lembrete_15d','lembrete_30d','suspensao','reativacao',
-- 'boas_vindas','revisao_regime','recibo','aviso_geral'
conteudo                text
status                  text DEFAULT 'enviada'
-- 'enviada','entregue','lida','erro','pendente'
evolution_message_id    text
arquivo_url             text           -- PDF anexado
direcao                 text DEFAULT 'saida' CHECK (dir IN ('entrada','saida'))
data_entrega            timestamptz
data_leitura            timestamptz
created_at              timestamptz DEFAULT now()
```

### Entidade 6: `contrato`
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
empresa_id              uuid REFERENCES empresa_cliente NOT NULL
status                  text DEFAULT 'pendente'
-- 'pendente','enviado','assinado','cancelado','expirado'
template_id             text
clicksign_document_id   text
clicksign_url           text
data_envio              timestamptz
data_assinatura         timestamptz
data_vencimento         date
pdf_url                 text
valor_mensal            numeric(10,2)
created_at              timestamptz DEFAULT now()
```

### Entidade 7: `audit_log`
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
usuario_id              uuid REFERENCES auth.users
empresa_id              uuid REFERENCES empresa_cliente
acao                    text NOT NULL
-- ex: 'nfse.emitir', 'das.gerar', 'cliente.suspender', 'regime.alterar'
descricao               text
dados_anteriores        jsonb
dados_novos             jsonb
ip_address              inet
created_at              timestamptz DEFAULT now()
```

### Entidade 8: `calendario_fiscal` (tabela de configuração — seed único)
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
regime                  text NOT NULL
tipo_obrigacao          text NOT NULL
frequencia              text NOT NULL  -- 'mensal','anual','trimestral'
dia_vencimento          integer        -- dia do mês (mensal)
mes_vencimento          integer        -- mês (anual)
descricao               text
multa_valor_fixo        numeric(10,2)  -- multa por atraso se fixa
multa_percentual        numeric(5,2)   -- % se calculada sobre tributos
ativa                   boolean DEFAULT true
```

### Entidade 9: `simulacao_regime` (nova — Reforma Tributária)
```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
empresa_id              uuid REFERENCES empresa_cliente NOT NULL
mes_referencia          text NOT NULL
faturamento_anual       numeric(12,2)
percentual_compras_fora_sn numeric(5,2)
resultado_das_atual     numeric(10,2)
resultado_hibrido_estimado numeric(10,2)
economia_estimada       numeric(10,2)  -- calculado
recomendacao            text           -- 'manter_simples' ou 'regime_hibrido'
pdf_url                 text           -- relatório para envio ao cliente
enviado_cliente         boolean DEFAULT false
created_at              timestamptz DEFAULT now()
```

---

## 5. EDGE FUNCTIONS — 35 EFs DEFINITIVAS

### Grupo 1 — NFS-e / NFE.io (6 EFs)
| EF | Função |
|---|---|
| `nfse-emit-single` | Emite NFS-e individual com CBS/IBS 2026 |
| `nfse-emit-batch` | Emite NFS-e em lote para todos os clientes ativos do mês |
| `nfse-cancel` | Cancela NFS-e emitida |
| `nfse-status` | Consulta status na NFE.io |
| `nfse-send-whatsapp` | Envia PDF da nota via WhatsApp após emissão |
| `nfse-retry-failed` | Retenta emissões com erro (pg_cron — 3 tentativas) |

### Grupo 2 — DAS / SERPRO (5 EFs)
| EF | Função |
|---|---|
| `das-generate-single` | Gera DAS de um cliente via SERPRO |
| `das-generate-batch` | Gera DAS em lote (Simples Nacional) |
| `dasmei-generate-batch` | Gera DASMEI em lote (MEI) |
| `das-send-whatsapp` | Envia PDF da guia via WhatsApp |
| `obrigacoes-create-monthly` | Cria cards de obrigação do mês para todos os clientes |

### Grupo 3 — Financeiro / Asaas (5 EFs)
| EF | Função |
|---|---|
| `cobranca-generate-batch` | Gera cobranças mensais para todos os clientes |
| `asaas-webhook` | Recebe pagamento confirmado → atualiza status → envia recibo |
| `cobranca-send-whatsapp` | Envia boleto/PIX via WhatsApp |
| `inadimplencia-check` | Verifica clientes com atraso e aplica escalada (7/15/30/45 dias) |
| `cliente-reativar` | Reativa cliente após pagamento confirmado |

### Grupo 4 — WhatsApp / Evolution API (4 EFs)
| EF | Função |
|---|---|
| `whatsapp-send` | Envia mensagem/arquivo via Evolution API |
| `whatsapp-webhook` | Recebe mensagens dos clientes → armazena → categoriza |
| `whatsapp-template` | Renderiza template por tipo (DAS, NFS-e, boleto, lembrete...) |
| `whatsapp-status-sync` | Sincroniza status de entrega/leitura das mensagens |

### Grupo 5 — SERPRO (proxy VPS) (4 EFs)
| EF | Função |
|---|---|
| `serpro-pgdas` | Consulta e entrega PGDAS |
| `serpro-situacao-fiscal` | Situação fiscal do CNPJ |
| `serpro-defis` | DEFIS do cliente |
| `serpro-caixa-postal` | Notificações da Receita Federal do cliente |

### Grupo 6 — CRON / Automações (6 EFs)
| EF | Função | Horário |
|---|---|---|
| `cron-obrigacoes-mensais` | Cria cards de obrigações do mês | Dia 1, 06:00 |
| `cron-cobrancas-mensais` | Gera cobranças de todos os clientes | Dia 1, 07:00 |
| `cron-nfse-batch` | Emite NFS-e em lote | Dia 5, 08:00 |
| `cron-das-batch` | Gera DAS em lote | Dia 15, 08:00 |
| `cron-lembretes-vencimento` | Envia lembretes de vencimento próximo | Diário, 09:00 |
| `cron-inadimplencia` | Verifica e escala inadimplentes | Diário, 10:00 |

### Grupo 7 — Clientes e Ferramentas (5 EFs)
| EF | Função |
|---|---|
| `cliente-onboarding` | CNPJ → auto-preenchimento → Asaas → Clicksign |
| `cnpj-busca` | Consulta dados do CNPJ na Receita Federal |
| `calendario-gerar` | Gera calendário fiscal anual por regime |
| `simulacao-regime` | Simula DAS atual vs. regime híbrido (Reforma Tributária) |
| `audit-log` | Registra toda ação crítica no sistema |

---

## 6. MÓDULOS MVP — SEQUÊNCIA DEFINITIVA

### Fase 1 — MVP Core (Lovable → aprovação → desenvolvimento)

| # | Módulo | Por que é crítico | Diferencial vs. concorrente |
|---|---|---|---|
| **M1** | Cadastro de Clientes | Base de tudo — CNPJ auto-fill + campos fiscais completos | Onboarding com regime híbrido já mapeado |
| **M2** | Calendário de Obrigações | Elimina a "agenda humana" — gera cards automaticamente | Calendário 2026 com DCTFWeb + Reforma |
| **M3** | DAS + DASMEI em Lote | 75x manual → 1 clique no dia 15 | Integração SERPRO real via VPS |
| **M4** | NFS-e em Lote | A maior dor não resolvida em anos | NFE.io com CBS/IBS 2026 |
| **M5** | Financeiro Automatizado | Cobrança + inadimplência sem toque humano | Escalada 7/15/30/45 dias + reativação automática |
| **M6** | WhatsApp Central | Canal nativo, não feature adicional | Evolution API sem custo por mensagem |
| **M7** | Dashboard Executivo | "Preciso ir atrás" → proativo | Tempo real: quem pagou, quem não pagou, o que vence |

### Fase 2 — Expansão (após MVP estável)

| # | Módulo | Integrações |
|---|---|---|
| M8 | Onboarding completo (Clicksign) | Clicksign, Asaas |
| M9 | Simulador de Regime Tributário | Cálculo interno + PDF + WhatsApp |
| M10 | SERPRO Avançado (caixa postal, certidões) | VPS gateway |
| M11 | Kanban da Equipe | Calendário fiscal |
| M12 | Depto. Pessoal (DP básico) | eSocial, folha |
| M13 | Conciliação Contábil | SPED, extrato bancário |
| M14 | Portal do Cliente (mini) | Supabase RLS por empresa |

---

## 7. ARQUITETURA VPS — CONFIGURAÇÃO FINAL

```
VPS DigitalOcean ~R$100/mês — 2 vCPU / 2GB RAM / 60GB SSD
│
├── nginx (80/443 — proxy reverso + SSL Certbot)
│   ├── serpro.apoya.com.br   → :4010  (SERPRO — OBRIGATÓRIO, mTLS)
│   └── whatsapp.apoya.com.br → :8080  (Evolution API — NOVO)
│
├── apoya-serpro v3.0.0 (Node/Express — :4010)
│   └── REUTILIZAR SEM MUDANÇA — 13 rotas funcionando
│
└── Evolution API (Docker — :8080)
    ├── Conectar número +5511995779034
    ├── Webhook → Supabase EF whatsapp-webhook
    └── Meta Cloud API oficial (sem risco de ban)
```

---

## 8. URGÊNCIAS — ORDEM DE EXECUÇÃO

| Prioridade | Ação | Responsável | Prazo |
|---|---|---|---|
| 🚨🚨 | Renovar apoya.com.br (Hostinger) — 13 dias para cair | Daniel | **HOJE** |
| 🚨 | Remover debug functions Google Auth de produção | Wilson | Esta semana |
| 1 | Criar projeto Supabase — org APOYA | Wilson | Após aprovação |
| 2 | Aplicar schema SQL (9 entidades) | Wilson | Após #1 |
| 3 | Instalar Evolution API na VPS | Wilson | Após aprovação |
| 4 | Validar NFE.io — teste emissão CBS/IBS 2026 | Wilson | Após aprovação |
| 5 | ARQUITETO monta PRD para Lovable | ARQUITETO | Após aprovação deste doc |
| 6 | Lovable gera protótipo visual (M1-M7) | Lovable + Wilson | Após PRD |
| 7 | Daniel aprova protótipo | Wilson apresenta | Após Lovable |
| 8 | Início desenvolvimento real (EFs + frontend) | Time completo | Após aprovação |

---

## 9. PROJEÇÃO DE IMPACTO — O QUE MUDA PARA DANIEL

### Hoje (situação atual)
- ~8 horas/mês gerando DAS manualmente (75 × ~6 min cada)
- ~8 horas/mês emitindo NFS-e no portal da prefeitura (75 × ~6 min cada)
- ~3 horas/mês gerando cobranças e controlando inadimplência
- ~5 horas/mês em WhatsApp pessoal enviando documentos e respondendo dúvidas
- **Total: ~24 horas/mês em trabalho repetitivo puro**

### Com o sistema APOYA
- DAS: 0 horas (pg_cron → SERPRO → PDF → WhatsApp — tudo automático)
- NFS-e: 0 horas (pg_cron → NFE.io → PDF → WhatsApp — tudo automático)
- Cobranças: 0 horas (pg_cron → Asaas → webhook → reativação automática)
- WhatsApp: 0 horas para envio, < 1 hora para responder questões complexas
- **Total: ~1 hora/mês em exceções que precisam de olho humano**

**Resultado: Daniel recupera ~23 horas/mês para trabalho estratégico (consultas, novos clientes, planejamento tributário, expansão do escritório).**

---

*Versão 3.0 — DEFINITIVO — baseado em pesquisa de mercado + normas 2026 + visão do negócio.*  
*Preparado por ARQUITETO — pronto para gerar o PRD do Lovable na próxima etapa.*

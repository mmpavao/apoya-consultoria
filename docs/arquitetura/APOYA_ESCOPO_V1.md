# APOYA Gestão — Escopo Técnico Completo V1
**Preparado por:** ARQUITETO  
**Data:** 2026-05-20  
**Para aprovação de:** Marcio Pavão → depois Daniel Araújo  
**Fonte:** análise de negócio via Wilson APOYA + arqueologia do sistema existente

---

## 1. O NEGÓCIO E A DOR CENTRAL

**APOYA Contabilidade e Auditoria** — escritório com ~75 empresas clientes.  
**Gestor:** Daniel Araújo — contador, expert em fiscal/direito, não técnico.  
**Equipe:** operadores internos com permissões por módulo. Clientes **não acessam** o sistema.

### A dor em uma frase
> "Tudo que é repetitivo ainda é feito na mão por alguém da equipe."

O escritório tem hoje uma **"agenda humana"** — uma pessoa que lembra o que vence, acessa o SERPRO cliente por cliente, gera PDF, manda no WhatsApp, verifica quem pagou, emite nota manualmente. Toda semana, todo mês, com 75 clientes.

**O sistema que Daniel quer é o substituto digital dessa pessoa.**

---

## 2. OS 5 FLUXOS CENTRAIS — O QUE O SISTEMA PRECISA FAZER

### FLUXO 1 — Entrada de novo cliente
```
Hoje (manual):    cadastro → Word → email → espera assinar → configura Asaas → alguém lembra de cada etapa
Sistema novo:     CNPJ → auto-preenchimento Receita Federal
                  → contrato gerado automaticamente → Clicksign no celular do cliente
                  → assinado → obrigações do mês seguinte criadas automaticamente no Kanban
                  → cobrança mensal ativada → tudo sem coordenação manual
```

### FLUXO 2 — Obrigações mensais (coração do sistema)
```
Hoje (manual):    alguém acessa SERPRO um por um, verifica vencimento, gera guia, manda no WhatsApp — 75x/mês
Sistema novo:     calendário fiscal automático por cliente (regime × obrigação × data)
                  → cards gerados no Kanban sem digitação
                  → 1 clique: gera DAS de todos os Simples Nacional em lote
                  → PDF enviado via WhatsApp automaticamente para cada cliente
                  → sistema registra: gerada / enviada / confirmada leitura / paga
```

### FLUXO 3 — NFS-e (maior dor não resolvida)
```
Hoje (manual):    ~75 notas por mês emitidas uma por uma no portal da prefeitura — fora do sistema
Sistema novo:     todo mês no dia configurado:
                  → emite NFS-e da APOYA para todos os clientes ativos em lote
                  → XML e PDF armazenados por cliente/mês
                  → nota enviada via WhatsApp automaticamente
                  → status: emitida / cancelada / erro (com motivo)
```

### FLUXO 4 — Financeiro automatizado
```
Hoje (parcial):   Asaas funciona mas geração mensal ainda é manual
Sistema novo:     dia 1 do mês → sistema gera cobrança para todos os clientes ativos
                  → PIX/boleto enviado via WhatsApp
                  → cliente paga → webhook → lança no contábil → envia recibo
                  → dashboard: quem pagou / quem não pagou / inadimplente — tempo real
                  → zero intervenção humana no fluxo padrão
```

### FLUXO 5 — Comunicação com clientes
```
Hoje (manual):    WhatsApp pessoal de alguém da equipe, sem histórico centralizado
Sistema novo:     sistema como canal único:
                  → DAS disponível → WhatsApp automático com PDF
                  → NFS-e emitida → WhatsApp automático com nota
                  → boleto gerado → WhatsApp automático com PIX/link
                  → vencimento chegando → lembrete automático
                  → histórico completo de tudo enviado por cliente
```

---

## 3. ARQUEOLOGIA DAS INTEGRAÇÕES — O QUE DANIEL TENTOU E A INTENÇÃO

| # | Integração | Provedor | Intenção do Daniel | Status | VPS? |
|---|---|---|---|---|---|
| 1 | **Asaas** | Asaas fintech | Cobrar clientes via PIX/boleto, automatizar faturamento mensal, receber confirmação e lançar no contábil | ✅ Produção | Não |
| 2 | **Clicksign** | Clicksign | Clientes assinam contratos pelo celular sem ir ao escritório | ✅ Produção | Não |
| 3 | **SERPRO Integra Contador** | SERPRO/Gov | Consultar PGDAS, gerar DAS, verificar situação fiscal, DEFIS, SICALC, DCTFWeb — tudo via e-CNPJ + procurações eletrônicas | ✅ Via VPS | ✅ Porta 4010 |
| 4 | **Twilio WhatsApp Business** | Twilio / Meta | Canal oficial com clientes — DAS, boletos, contratos, lembretes, receber mensagens | ⚠️ Parcial | ✅ Porta 4000 |
| 5 | **ADN / Cidade Fiscal** | ADN | Importar NFS-e recebidas pelos clientes sem acessar cada prefeitura | 🔴 Pausado | Não |
| 6 | **NFE.io** | NFE.io | Emitir NFS-e da APOYA para 75 clientes em lote — a maior dor | 🔴 Nunca funcionou | Não |
| 7 | **Focus NFe** | Focus NFe | Alternativa ao NFE.io para NFS-e | 🔴 Descartado | Não |
| 8 | **Google Calendar** | Google OAuth | Sincronizar prazos e obrigações com calendário da equipe | ⚠️ Parcial | Não |
| 9 | **Google Drive** | Google OAuth | Arquivar documentos por cliente (NFS-e, contratos, DAS) | ⚠️ Configurado | Não |
| 10 | **SPED / EFD** | Receita Federal | Importar arquivos SPED para conciliação fiscal e contábil | ⚠️ Parcial | Não |
| 11 | **NFS-e Municipal Direta** | Prefeitura Caçapava | Emitir NFS-e diretamente na prefeitura via SOAP + certificado A1 | 🔴 Incompleto | ✅ nfse.apoya.com.br |

### Serviços cogitados mas nunca implementados
| Serviço | Por que não foi | Observação |
|---|---|---|
| Z-API | Daniel optou pelo canal oficial Meta/Twilio | Popular no Brasil mas risco de ban |
| WPPConnect / Baileys | Risco de ban de número | Open source, QR Code |
| Evolution API | Nunca considerado explicitamente | Mais moderno que WPPConnect |
| Pluggy / Open Finance | Não há evidência | Natural para conciliação bancária — oportunidade |
| Nuvemfiscal | NFE.io foi a escolha | Alternativa para NFS-e |
| SendGrid / Brevo | Daniel priorizou WhatsApp sobre email | Oportunidade futura |

---

## 4. MAPA COMPLETO DE PÁGINAS — INTENÇÃO POR MÓDULO

### CORE / NAVEGAÇÃO
| Página | Intenção | Status |
|---|---|---|
| Dashboard | Visão executiva: KPIs financeiros, obrigações vencendo, clientes em pendência, produtividade da equipe | ⚠️ Parcial — alguns cards estáticos |
| Configuracoes | Configurar escritório: dados, certificado A1, SERPRO, Google Drive, modelos, perfis | ✅ Funcional |
| ConfiguracoesIA | Configurar agente IA interno do sistema | ⚠️ Existe |
| ReleaseNotes | Histórico de versões para a equipe | ✅ Estático |
| GoogleCallback | Retorno OAuth Google (técnica) | ✅ Funcional |

### CLIENTES / DOCUMENTOS
| Página | Intenção | Status |
|---|---|---|
| Auditoria | Gestão de documentos dos clientes — upload, aprovação, compliance (página principal) | ✅ Funcional |
| AuditoriaInteligente | IA para detectar inconsistências e riscos em documentos sem revisão manual | ⚠️ Interface existe |
| HistoricoAuditoria | Log completo — quem fez o quê e quando | ✅ Funcional |

### PROCESSOS / OBRIGAÇÕES
| Página | Intenção | Status |
|---|---|---|
| ControleProcessos | Kanban de processos societários/administrativos por cliente | ✅ Funcional |
| Obrigacoes | Kanban de obrigações fiscais mensais (DAS, DEFIS, folha, SPED) | ⚠️ Funciona mas obrigações são criadas manualmente |
| LicencasVencimentos | Controle de alvarás, licenças e certidões com alertas de vencimento | ⚠️ Existe, não auditado |

### FISCAL
| Página | Intenção | Status |
|---|---|---|
| SetorFiscal | Hub central do Depto. Fiscal — acesso a todos os sub-módulos | ✅ Funcional (dados reais SERPRO) |
| SerproDashboard | Painel SERPRO por CNPJ — PGDAS anual, DEFIS, situação fiscal, PDFs | ✅ Funcional via VPS |
| SerproConsultas | Consultas avulsas SERPRO — CNPJ, situação, certidões | ✅ Funcional |
| SerproCatalogo | Catálogo de serviços disponíveis no Integra Contador | ⚠️ Pode ser estático |
| AdministrativoFiscal | Painel fiscal administrativo — alertas, vencimentos, status por cliente | ⚠️ Parcial |
| ModuloFiscal | Módulo fiscal por cliente — NFS-e, retenções, análise tributária, ADN | ⚠️ Parcial (ADN pausado) |
| NFSe | Emissão de NFS-e da APOYA + consulta de emitidas | 🔴 STANDBY — nunca funcionou |
| ADNDiagnostico | Diagnóstico técnico da integração ADN — status, logs, credenciais | 🔴 Inativo (ADN pausado) |
| ConciliacaoFiscal | Cruzar NFS-e recebidas vs. lançamentos — detectar divergências | ⚠️ Parcial |
| SpedConciliacao | Conciliação de arquivos SPED dos clientes | ⚠️ Existe |
| DeptoAuditoria | Importar e analisar SPED EFD — relatórios de inconsistência | ⚠️ Parcial |

### FINANCEIRO / CONTRATOS
| Página | Intenção | Status |
|---|---|---|
| SetorFinanceiro | Hub financeiro — dashboard, cobranças, contratos, plano de contas, extrato | ✅ Funcional (Asaas integrado) |
| AnalisadorExtratos | Upload extrato bancário + classificação automática + conciliação | ⚠️ Parcial |
| GerarContrato | Gerar contrato para novo cliente + enviar via Clicksign | ✅ Funcional |
| ModelosContrato | Biblioteca de modelos de contrato editáveis | ✅ Funcional |
| ModelosContratoClicksign | Importar e gerenciar modelos diretamente da Clicksign | ✅ Funcional |
| AgenteModelosContrato | IA para redigir e adaptar modelos de contrato | ⚠️ Existe |

### CONTABILIDADE
| Página | Intenção | Status |
|---|---|---|
| DepartamentoContabil | Lançamentos contábeis, plano de contas, regras automáticas, conciliação bancária | ⚠️ Parcial |
| AtivoImobilizado | Controle de bens dos clientes — depreciação, baixas, laudos | ⚠️ Existe — nunca foi tema com Daniel |

### RH / PESSOAL
| Página | Intenção | Status |
|---|---|---|
| DepartamentoPessoal | Funcionários dos clientes — admissão, demissão, férias, contratos, Kanban de DP | ⚠️ Parcial — estrutura existe |

### COMUNICAÇÃO
| Página | Intenção | Status |
|---|---|---|
| CentralWhatsApp | Central de atendimento — conversas com clientes, histórico, handoff humano/IA | ⚠️ Parcial — webhook recebimento não confirmado |

### ADMINISTRAÇÃO
| Página | Intenção | Status |
|---|---|---|
| PerfisAcesso | Criar e configurar perfis de permissão reutilizáveis | ✅ Funcional |
| Usuarios | Gestão de usuários — convidar, editar permissões, remover | ✅ Funcional |
| DocumentosPadrao | Banco de templates do escritório — procurações, declarações | ✅ Funcional |

---

## 5. ANÁLISE DE INFRAESTRUTURA — VPS vs. EDGE FUNCTION vs. SERVIÇO GERENCIADO

### O que PRECISA ficar na VPS (limitação técnica real, não escolha)
| Serviço | Motivo técnico | Alternativa possível |
|---|---|---|
| **SERPRO Integra Contador** | mTLS obrigatório com certificado A1 ICP-Brasil. Deno não suporta client certificates. Sem VPS = sem SERPRO. | Apenas se SERPRO criar API REST pública (não previsto) |
| **NFS-e Municipal Direta** | SOAP + mTLS + certificado A1. Mesmo problema do SERPRO. | NFE.io/Nuvemfiscal como intermediário (eles cuidam do mTLS) |
| **ADN / Cidade Fiscal** | mTLS para autenticação nos webservices municipais | Reativar via proxy VPS ou usar NFE.io |
| **nginx** | Proxy reverso para expor os gateways com HTTPS + domínio próprio | Cloudflare Tunnel como alternativa (sem VPS) |

### O que PODE sair da VPS e virar Edge Function
| Serviço | Situação atual | Ação |
|---|---|---|
| Envio WhatsApp (Twilio) | Passa pela VPS desnecessariamente | Chamar API REST Twilio direto da EF |
| Webhook recebimento WhatsApp | VPS como endpoint estável | Migrar endpoint para Supabase EF (URL pública estável) |
| Consultas simples (CNPJ, CEP) | Podem passar pela VPS | Chamar APIs públicas direto da EF |
| CRON jobs (cobranças, DAS em lote) | Não existe ainda | Supabase pg_cron nativo |

### VPS — custo e situação atual
```
Droplet DigitalOcean: ~US$18/mês (~R$100/mês) — 2 vCPU / 2GB RAM / 60GB SSD
SSL: Let's Encrypt via Certbot — expira 17/08/2026 ⚠️ (renovar antes)
Domínio Hostinger: expira 02/06/2026 ⚠️⚠️ URGENTE — 13 dias
Custo total infra: ~R$100-110/mês
```
> **🚨 AÇÃO URGENTE:** domínio `apoya.com.br` expira em **13 dias** (02/06/2026). Se expirar, todos os gateways caem (SERPRO, WhatsApp, NFS-e). Wilson precisa alertar Daniel HOJE.

---

## 6. DECISÕES TÉCNICAS DO SISTEMA NOVO

### O que vamos usar e por quê

**WhatsApp — qual provedor?**
- Daniel já pagou Twilio e tem número oficial. Twilio é caro e tem latência.
- Opções a avaliar: **Evolution API** (open source, self-hosted na VPS, suporte Meta Cloud API) ou manter Twilio.
- Decisão: **levantar custo Twilio vs. Evolution API antes de decidir**. Evolution API na VPS elimina custo por mensagem.

**NFS-e — qual provedor?**
- NFE.io: escolha do Daniel, mas sem credencial configurada ainda. ~R$0,50-1,00/nota.
- **Nuvemfiscal**: alternativa moderna, API REST clara, suporte NFS-e nacional.
- Decisão: **avaliar NFE.io vs. Nuvemfiscal** antes de construir. Ambos eliminam necessidade de VPS para NFS-e.

**SERPRO — manter VPS?**
- Sim, obrigatoriamente. Certificado A1 + mTLS = VPS inevitável enquanto o SERPRO não mudar.
- O gateway atual (apoya-serpro v3.0.0) está funcional. **Reutilizar**.

**Stack do sistema novo:**
```
Prototipagem:  Lovable (MVP visual para aprovação Daniel)
Frontend:      React + Vite + TypeScript + Tailwind + shadcn/ui
Auth:          Supabase Auth (magic link + senha)
Backend:       Supabase Edge Functions (Deno/TypeScript)
Database:      Supabase PostgreSQL com RLS por empresa (multi-tenant)
Storage:       Supabase Storage (PDFs, XMLs, contratos, certificados)
Jobs/CRON:     Supabase pg_cron
Deploy front:  Cloudflare Pages
Deploy back:   Supabase (Edge Functions)
VPS:           Manter DigitalOcean — SERPRO gateway (obrigatório) + avaliar WhatsApp
Repo:          GitHub (nova org APOYA — repo limpo)
Design:        #F97316 laranja + rounded-2xl + shadow-sm — padrão APOYA 2026
```

---

## 7. MÓDULOS DO SISTEMA NOVO — PRIORIDADE

### MVP (fase Lovable → aprovação Daniel → desenvolvimento)
| # | Módulo | Resolve qual dor | Integrações |
|---|---|---|---|
| M1 | Gestão de Clientes | Base de tudo | Receita Federal (CNPJ auto-fill) |
| M2 | Calendário de Obrigações | Agenda humana → automático | SERPRO, pg_cron |
| M3 | DAS em Lote | 75x manual → 1 clique | SERPRO via VPS, WhatsApp |
| M4 | NFS-e em Lote | Maior dor não resolvida | NFE.io ou Nuvemfiscal |
| M5 | Financeiro Automatizado | Cobrança manual → automático | Asaas webhooks, pg_cron |
| M6 | WhatsApp Central | WhatsApp pessoal → sistema | Twilio ou Evolution API |
| M7 | Dashboard Executivo | "Preciso ir atrás" → proativo | Todos os módulos |

### Fase 2
| # | Módulo | Integrações |
|---|---|---|
| M8 | Onboarding de Cliente | Clicksign, Asaas |
| M9 | Kanban da Equipe | Calendário fiscal |
| M10 | Contratos | Clicksign |
| M11 | Depto. Pessoal | Interno |
| M12 | Conciliação Contábil | SPED, extrato bancário |
| M13 | Auditoria / SPED | SPED EFD |

---

## 8. PRÓXIMOS PASSOS

| # | Ação | Responsável | Prazo |
|---|---|---|---|
| 🚨 | Renovar domínio apoya.com.br (expira 02/06) | Wilson alertar Daniel HOJE | Urgente |
| 1 | Marcio aprova este escopo | Marcio | Agora |
| 2 | Marcio fornece referência visual de UI | Marcio | Após aprovação |
| 3 | Decidir WhatsApp: Twilio vs. Evolution API | ARQUITETO + Marcio | Antes do PRD |
| 4 | Decidir NFS-e: NFE.io vs. Nuvemfiscal | ARQUITETO + Marcio | Antes do PRD |
| 5 | Daniel aprova escopo (linguagem de negócio) | Wilson apresentar para Daniel | Após Marcio |
| 6 | ARQUITETO monta PRD para Lovable | ARQUITETO | Após aprovações |
| 7 | Lovable gera protótipo dos 7 módulos MVP | Lovable + Wilson | Após PRD |
| 8 | Daniel aprova protótipo | Wilson apresentar | Após Lovable |
| 9 | Início do desenvolvimento real | Time completo | Após aprovação |

---

*Versão 1.0 — aguardando aprovação de Marcio Pavão.*  
*Preparado por ARQUITETO com base em análise profunda de negócio, integrações e infraestrutura via Wilson APOYA.*

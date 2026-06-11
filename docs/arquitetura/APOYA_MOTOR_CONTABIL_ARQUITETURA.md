# APOYA — Arquitetura do Motor Contábil
**Autor:** ARQUITETO · Data: 2026-05-22
**Objetivo:** Definir a estrutura completa do motor contábil do sistema APOYA —
do cadastro do cliente até o fechamento fiscal automatizado com agente IA.

---

# VISÃO GERAL DO MOTOR

```
CNPJ DIGITADO
     ↓
[1] ONBOARDING INTELIGENTE
    Consulta SERPRO + RFB → preenche tudo automaticamente
     ↓
[2] MOTOR DE DOCUMENTOS
    Captura NF-e (SEFAZ) + NFS-e (NFE.io/prefeitura) + Extrato bancário
     ↓
[3] CLASSIFICAÇÃO FISCAL
    CFOP + NCM + CST/CSOSN → categoriza cada nota automaticamente
     ↓
[4] LANÇAMENTO CONTÁBIL
    Partidas dobradas → Plano de contas → Livros fiscais
     ↓
[5] APURAÇÃO DE IMPOSTOS
    ICMS / ISS / PIS / COFINS / IRPJ / CSLL por regime
     ↓
[6] GERAÇÃO DE OBRIGAÇÕES
    DAS / PGDAS-D / DCTFWeb / DARF → PDF → Envio ao cliente
     ↓
[7] SPED
    EFD-ICMS/IPI + EFD-Contribuições + ECD + ECF → XML → Transmissão
     ↓
[8] FECHAMENTO MENSAL / ANUAL
    Balancete → DRE → Balanço → Demonstrações
     ↓
[9] AGENTE IA
    Monitora, executa, lança, notifica — opera o motor de forma autônoma
```

---

# BLOCO 1 — CADASTRO DO CLIENTE + ONBOARDING INTELIGENTE

## O que acontece quando o CNPJ é digitado

### Passo 1 — Consulta automática via SERPRO + RFB
Ao digitar o CNPJ e pressionar Enter (ou sair do campo), o sistema dispara:

```
GET /serpro/ccmei/dados?cnpj=XXXXXXXXXXXXXX  → se for MEI
GET /serpro/situacao-fiscal?cnpj=...          → situação geral
GET /receita-federal/cnpj?cnpj=...            → dados cadastrais RFB
GET /serpro/regime?cnpj=...&ano=2026          → regime tributário atual
GET /serpro/pgdas/ultima?cnpj=...             → última declaração (histórico)
```

### Passo 2 — Campos preenchidos automaticamente

**Aba "Identificação"**
| Campo | Fonte | Editável |
|---|---|---|
| Razão Social | RFB | Sim |
| Nome Fantasia | RFB | Sim |
| CNPJ | Digitado | Não (chave) |
| Data de abertura | RFB | Sim |
| Situação cadastral | SERPRO | Não (automático) |
| CNAE Principal | RFB | Sim |
| CNAE(s) Secundário(s) | RFB | Sim |
| Endereço completo | RFB | Sim |
| Natureza jurídica | RFB | Não |

**Aba "Fiscal"**
| Campo | Fonte | Editável |
|---|---|---|
| Regime tributário | SERPRO | Sim (override manual) |
| Optante Simples Nacional | SERPRO | Não |
| Data opção Simples | SERPRO | Não |
| Último PGDAS transmitido | SERPRO | Não |
| Situação fiscal (RFB+PGFN) | SERPRO sitfis | Não |
| Dívida ativa | SERPRO pgmei_divida | Não |
| Parcelamentos ativos | SERPRO parcsn | Não |

**Aba "Obrigações geradas automaticamente"**
Ao salvar, o sistema gera automaticamente as obrigações dos próximos 12 meses
baseado no regime detectado:
- MEI → 12× DASMEI + 1× DASN-SIMEI
- Simples → 12× PGDAS-D + 1× DEFIS + (se CLT) 12× eSocial + 12× FGTS
- LP → calendário completo: eSocial, EFD-Reinf, DCTFWeb, EFD-Contribuições, SPED Fiscal, DARF trimestral, ECD, ECF
- LR → tudo do LP + LALUR + IRPJ mensal

**Aba "Configuração do escritório para este cliente"**
| Campo | Descrição |
|---|---|
| Responsável interno | usuário do escritório que cuida do cliente |
| Tier de serviço | MEI / Simples / Empresarial |
| Honorário mensal | valor da mensalidade |
| Dia de vencimento | 1 a 28 |
| Canal de entrega | WhatsApp / e-mail / ambos |
| Código de serviço NFS-e | LC 116/2003 (para emissão da NFS-e de honorários) |
| Certificado digital A1 | arquivo vinculado + data validade |
| Procuração e-CAC | status (ativa/expirada) + data |

---

# BLOCO 2 — MOTOR DE DOCUMENTOS

## 2.1 Notas Fiscais de Saída (o que o cliente emite para os seus clientes)

### Fonte 1 — NFE.io (NFS-e emitidas pelo sistema APOYA)
Todas as NFS-e emitidas via NFE.io ficam diretamente no banco.
Webhook do NFE.io → Edge Function `nfse-webhook` → insere em `documentos_fiscais`.

### Fonte 2 — SEFAZ Estadual (NF-e de saída — modelo 55)
```
GET SEFAZ via certificado A1 → download XML de notas emitidas
→ Edge Function analisa e insere em `documentos_fiscais`
```

### Fonte 3 — Portal da Prefeitura (NFS-e emitidas fora do sistema)
Via scraping autenticado ou API da prefeitura (onde disponível).
Cidades com API aberta: São Paulo, Campinas, Belo Horizonte, Curitiba, Porto Alegre.

---

## 2.2 Notas Fiscais de Entrada (o que o cliente recebe de fornecedores)

### Fonte principal — SEFAZ (XML de NF-e autorizadas contra o CNPJ)
```
A cada NF-e emitida contra o CNPJ do cliente, o SEFAZ disponibiliza o XML.
O sistema faz polling diário ou responde ao evento:
GET /sefaz/manifestacao?cnpj=...&dtInicio=...&dtFim=...
→ baixa todos os XMLs de notas recebidas
→ insere em `documentos_fiscais` com tipo='entrada'
→ analisa CFOP, NCM, CST automaticamente
```

### Fonte secundária — Upload manual
O cliente (ou o contador) pode fazer upload direto do XML ou PDF da nota.
O sistema extrai os dados do XML automaticamente.

---

## 2.3 Extrato Bancário

### Como funciona
O extrato bancário é a base da **conciliação bancária**.
Sem ele, não fecha o mês contábil.

**Fluxo:**
```
1. Contador faz upload do OFX/CSV do extrato no sistema
   OU
   Integração futura via Open Finance (autorização do cliente)

2. Edge Function `processar-extrato`:
   → lê cada linha do extrato
   → tenta conciliar automaticamente com lançamentos existentes
   → linhas não conciliadas ficam em fila de revisão

3. Contador revisa as pendências e classifica manualmente
   (ou o agente IA classifica com base em histórico)

4. Ao conciliar 100%: competência liberada para fechamento
```

**Entidade `extrato_bancario_linha`:**
```
id, empresa_id, data, historico, valor, tipo (credito/debito),
status (pendente/conciliado/ignorado), lancamento_contabil_id (FK)
```

---

# BLOCO 3 — CLASSIFICAÇÃO FISCAL AUTOMÁTICA

## O que o sistema faz com cada nota recebida

```
NF-e XML carregada
        ↓
PARSER → extrai campos:
  CNPJ emitente, destinatário, data, valor total
  Por item:
    - descrição do produto/serviço
    - NCM (8 dígitos)
    - CFOP (4 dígitos)
    - CST ou CSOSN (3 dígitos)
    - alíquota ICMS, valor ICMS
    - alíquota IPI, valor IPI
    - alíquota PIS/COFINS, valor PIS/COFINS
    - CEST (se substituição tributária)
        ↓
CLASSIFICAÇÃO AUTOMÁTICA por regra:
  CFOP 1.102 ou 2.102 → compra para revenda → gera crédito ICMS
  CFOP 1.556 → material de uso e consumo → sem crédito ICMS
  CFOP 1.551 → ativo imobilizado → crédito ICMS em 1/48 avos
  CFOP 5.xxx → saída → gera débito ICMS
  CST 60 → ICMS-ST já pago → sem débito/crédito próprio
  CSOSN 500 → Simples → sem crédito para o comprador
        ↓
RESULTADO:
  - natureza_operacao: 'compra_revenda' | 'uso_consumo' | 'ativo' | 'venda' | 'servico'
  - gera_credito_icms: boolean + valor
  - gera_credito_pis_cofins: boolean + valor (só LR não-cumulativo)
  - conta_contabil_sugerida: baseado no CFOP + NCM + histórico
  - confianca: 'automatico' | 'revisao_necessaria'
        ↓
STATUS: 'classificado_auto' → contador revisa → 'classificado_confirmado'
```

## Tabela de regras CFOP → Conta Contábil

| CFOP | Natureza | Conta Contábil Sugerida | ICMS |
|---|---|---|---|
| 1.102 / 2.102 | Compra p/ revenda | 1.1.7 Estoques | Crédito ✅ |
| 1.556 / 2.556 | Material uso/consumo | 6.1.x Despesa adequada | Sem crédito ❌ |
| 1.551 / 2.551 | Ativo imobilizado | 1.2.2.x Imobilizado | Crédito 1/48 ⚠️ |
| 1.101 / 2.101 | Compra matéria-prima | 5.1.x Custo produção | Crédito ✅ |
| 5.102 / 6.102 | Venda mercadoria | 4.1 Receita Vendas | Débito ✅ |
| 5.405 | Venda com ICMS-ST | 4.1 Receita Vendas | ST (sem débito próprio) |
| 1.201 | Devolução venda | 4.3 Devoluções | Estorno débito |
| 5.201 | Devolução compra | 1.1.7 Estoques (–) | Estorno crédito |

---

# BLOCO 4 — LANÇAMENTO CONTÁBIL

## Como funciona no sistema

Cada documento fiscal classificado gera **lançamentos contábeis automáticos**.

### Exemplo — NF-e de compra R$ 10.000 (CFOP 1.102, ICMS 12%)

```
Sistema gera automaticamente 2 lançamentos:

Lançamento 1 — Entrada de mercadoria
D: 1.1.7 Estoques                          R$ 8.800  (valor sem ICMS recuperável)
D: 1.1.8 ICMS a Recuperar                 R$ 1.200  (crédito de ICMS)
C: 2.1.1 Fornecedores                     R$ 10.000 (obrigação criada)

Lançamento 2 — Pagamento ao fornecedor (quando pago)
D: 2.1.1 Fornecedores                     R$ 10.000
C: 1.1.2 Banco Conta Corrente             R$ 10.000
```

### Exemplo — NF-e de venda R$ 15.000 (CFOP 5.102, ICMS 12%, CMV R$ 8.800)

```
Lançamento 1 — Reconhecimento da receita
D: 1.1.5 Clientes (A Receber)             R$ 15.000
C: 4.1 Receita Bruta de Vendas            R$ 15.000

Lançamento 2 — Impostos sobre vendas
D: 4.4 ICMS sobre Vendas (dedução)        R$ 1.800  (12% de 15.000)
C: 2.1.6 ICMS a Recolher                  R$ 1.800

Lançamento 3 — Baixa do estoque (CMV)
D: 5.1 Custo Mercadoria Vendida           R$ 8.800
C: 1.1.7 Estoques                         R$ 8.800

Lançamento 4 — Recebimento do cliente
D: 1.1.2 Banco Conta Corrente             R$ 15.000
C: 1.1.5 Clientes (A Receber)             R$ 15.000
```

## Entidade `lancamento_contabil`

```sql
id                uuid PK
empresa_id        uuid FK empresa_cliente
documento_id      uuid FK documentos_fiscais (opcional — pode ser lançamento manual)
data_lancamento   date
data_competencia  date          -- regime de competência ≠ data pagamento
historico         text          -- "Compra mercadoria NF 1234 / Fornecedor X"
conta_debito      text          -- código do plano de contas (ex: '1.1.7')
conta_credito     text          -- código do plano de contas (ex: '2.1.1')
valor             numeric(15,4)
tipo_lancamento   text          -- 'automatico' | 'manual' | 'provisao' | 'depreciacao'
status            text          -- 'rascunho' | 'confirmado' | 'estornado'
usuario_id        uuid FK       -- quem lançou (humano ou agente_ia)
periodo_fechado   boolean       -- se true, não pode editar sem reversão
created_at        timestamptz
```

---

# BLOCO 5 — APURAÇÃO DE IMPOSTOS

## Por regime — o que o sistema calcula

### MEI
```
DAS = tabela fixa mensal
Comércio/Indústria: R$ 71,60  (INSS R$ 66,00 + ISS R$ 5,00 ou ICMS R$ 1,00)
Serviços: R$ 75,60           (INSS R$ 66,00 + ISS R$ 5,00)
Ambas: R$ 76,60

Verificação: se faturamento > R$ 81.000/ano → alerta de desenquadramento
```

### Simples Nacional
```
Apuração mensal via PGDAS-D:

1. Somar receita bruta do mês por tipo de atividade (comércio / serviço / indústria)
2. Calcular RBT12 (receita bruta dos últimos 12 meses) → define a faixa da tabela
3. Aplicar alíquota do Anexo correspondente (I a V)
4. Subtrair a parcela a deduzir da faixa
5. Resultado = DAS do mês

Fórmula:
  Alíquota efetiva = (RBT12 × Alíquota nominal – Parcela a deduzir) / RBT12
  DAS = Receita do mês × Alíquota efetiva

O sistema calcula isso automaticamente a partir das notas escrituradas.
```

### Lucro Presumido — Apuração Trimestral IRPJ/CSLL
```
Trimestre encerrado:

Receita Bruta do trimestre
× % de presunção do lucro:
  - Comércio/Indústria: 8%
  - Prestação de serviços em geral: 32%
  - Serviços hospitalares: 8%
  - Transportes: 8% (cargas) / 16% (passageiros)
= Lucro Presumido

IRPJ = Lucro Presumido × 15%
       + (Lucro Presumido - R$ 60.000) × 10%  (se > R$ 60k no trimestre)

CSLL = Lucro Presumido × 9%  (base: 12% serviços / 32% serviços específicos)

PIS = Receita Bruta × 0,65%   (cumulativo)
COFINS = Receita Bruta × 3%   (cumulativo)

ICMS = Débito notas saída – Crédito notas entrada (por estado)
ISS = Receita serviços × alíquota municipal (2% a 5%)
```

### Lucro Real — Apuração Mensal
```
Receita Bruta
(–) Deduções (devoluções, descontos)
= Receita Líquida
(–) CMV / CPV / CSV
= Lucro Bruto
(–) Despesas Operacionais
= EBIT
(+/–) Resultado Financeiro
= Lucro antes do IR (LAIR)
(+) Adições ao LALUR (despesas não dedutíveis: multas, brindes, etc.)
(–) Exclusões do LALUR (receitas não tributáveis, JCP, etc.)
(–) Compensação de prejuízo fiscal (máx 30% do LAIR)
= Base de Cálculo do IRPJ/CSLL (Lucro Real)

IRPJ = Lucro Real × 15% + adicional 10% (se > R$ 20k/mês)
CSLL = Lucro Real × 9%

PIS = Receita × 1,65% – Créditos de PIS sobre entradas
COFINS = Receita × 7,6% – Créditos de COFINS sobre entradas
```

---

# BLOCO 6 — GERAÇÃO DE OBRIGAÇÕES E GUIAS

## DAS / DASMEI (Simples e MEI)

```
Fluxo:
1. Apuração concluída → sistema calcula valor do DAS
2. Chama SERPRO: POST /serpro/das/gerar { cnpj, periodo }
3. SERPRO retorna código de barras + linha digitável + vencimento
4. Sistema gera PDF com identidade APOYA (cabeçalho + rodapé navy, miolo branco)
5. Salva em Storage Supabase: /das/{empresa_id}/{YYYY-MM}/DAS_202605.pdf
6. Registra em tabela `obrigacoes` com status 'gerado' + url do PDF
7. Marca como 'enviado_cliente' quando WhatsApp confirmar entrega
8. Webhook Asaas confirma pagamento → status 'pago' + data
```

## DARF (LP / LR — IRPJ, CSLL, PIS, COFINS)

```
Sistema calcula o valor
→ Gera PDF do DARF com código de receita correto:
  IRPJ LP: 2089
  CSLL LP: 2372
  PIS: 8109
  COFINS: 2172
  IRPJ LR estimativa: 2362
→ Salva + envia ao cliente
→ Contador confirma pagamento
```

## DCTFWeb (LP / LR)

```
1. eSocial fechado (S-1299 transmitido)
2. EFD-Reinf transmitida
3. Sistema consolida os tributos: INSS, IRRF, CSLL s/ serviços, PIS/COFINS retidos
4. Gera MIT (Módulo de Inclusão de Tributos) via API SERPRO
5. Transmite DCTFWeb
6. Guarda número do recibo
```

---

# BLOCO 7 — GERAÇÃO DE SPED

## EFD-ICMS/IPI (SPED Fiscal)

```
Dados necessários:
- Todos os lançamentos fiscais do mês (entradas + saídas)
- Apuração de ICMS (crédito, débito, saldo)
- Dados do estabelecimento

Blocos gerados:
  0 — Abertura e identificação
  A — Documentos fiscais (NFS-e serviços)
  B — Escrituração e apuração ISS
  C — Notas fiscais modelos 1, 1A, 55 (NF-e)
  D — Notas fiscais de serviço de transporte
  E — Apuração do ICMS e IPI
  G — Controle do crédito de ICMS do ativo permanente (CIAP)
  H — Inventário físico
  K — Controle da produção (indústria)
  1 — Informações extras
  9 — Encerramento

→ Arquivo TXT gerado → validado pelo PVA (Programa Validador)
→ Transmitido via certificado A1
```

## EFD-Contribuições (SPED PIS/COFINS)

```
Blocos:
  0 — Abertura
  A — NFS-e (serviços)
  C — NF-e (mercadorias)
  D — Transporte
  F — Demais documentos e operações
  I — Operações das IES (se aplicável)
  M — Apuração de PIS e COFINS
  P — Apuração da Contribuição Previdenciária (se aplicável)
  1 — Informações complementares
  9 — Encerramento

→ Calcula créditos de PIS/COFINS (LR não-cumulativo)
→ Apura saldo a pagar ou a compensar
→ Gera DARF do saldo
→ Transmite arquivo
```

## ECD — SPED Contábil (anual)

```
Fonte: todos os lançamentos contábeis do exercício
Blocos:
  0 — Abertura
  I — Lançamentos e plano de contas
  J — Demonstrações contábeis (BP, DRE, DMPL, DFC)
  K — Conglomerados (se aplicável)
  9 — Encerramento

→ Assinado pelo contador (CRC) + representante legal (certificado A1)
→ Transmitido ao SPED
→ Recibo HASH guardado
```

---

# BLOCO 8 — FECHAMENTO MENSAL E ANUAL

## Fechamento mensal — condições para liberar

```
Checklist automático de fechamento:
□ 1. Todas as NF-e de entrada escrituradas e classificadas
□ 2. Todas as NF-e de saída escrituradas e classificadas
□ 3. Folha de pagamento lançada (se CLT)
□ 4. Conciliação bancária: saldo contábil = saldo extrato
□ 5. Provisões lançadas (férias, 13º, INSS sobre provisões)
□ 6. Depreciação lançada
□ 7. Ajustes de competência verificados
□ 8. PGDAS-D / DAS gerado e enviado ao cliente
□ 9. Balancete gerado e equilíbrio verificado (D = C)
□ 10. DRE mensal gerada

→ Se tudo ✅ → período BLOQUEADO para novos lançamentos
→ Contador pode reverter o fechamento se necessário (gera log auditável)
```

## Fechamento anual — sequência obrigatória

```
DEZEMBRO — últimas competências
  → Depreciação final do exercício
  → Provisões de IRPJ e CSLL (LP) ou cálculo real (LR)
  → Ajustes de inventário (se comércio/indústria)
  → Lançamento do resultado do exercício → PL

JANEIRO/FEVEREIRO
  → Informes de rendimentos dos sócios
    (pro-labore tributável + distribuição de lucros isenta + IRRF retido)

ATÉ 31/03
  → DEFIS (Simples Nacional)

ATÉ 29/05
  → ECD — SPED Contábil
  → Balanço Patrimonial fechado e assinado

ATÉ 31/07
  → ECF — usando dados da ECD como base
  → Bloco E (IRPJ), Bloco P (CSLL), Bloco Y (informações econômicas)
```

---

# BLOCO 9 — O AGENTE IA COMO OPERADOR DO MOTOR

## Papel do agente no sistema

O sistema foi desenhado para ser operado por **dois tipos de usuário**:
1. **Humano (contador / assistente)** — valida, aprova, resolve exceções
2. **Agente IA** — executa tarefas repetitivas, monitora prazos, faz lançamentos automáticos

O agente IA acessa o sistema via **API REST** do Supabase.
Ele tem um usuário próprio (`agente_ia@apoya.com.br`) com role `agent`.
Todas as ações do agente ficam rastreadas (campo `usuario_id` em todos os lançamentos).

## Rotina autônoma do agente — ciclo mensal

```
TODO MÊS, DIA 1:
→ Para cada cliente ativo:
   1. Verificar se há notas novas no SEFAZ (via certificado A1)
   2. Verificar NFS-e emitidas no período (NFE.io API)
   3. Baixar XMLs, parsear, classificar por CFOP/CST/NCM
   4. Lançar automaticamente no plano de contas
   5. Atualizar status das obrigações do mês

TODO MÊS, DIA 18 (2 dias antes do prazo):
→ Para cada cliente Simples/MEI:
   1. Verificar se há NF-e não escrituradas (flag 'revisao_necessaria')
   2. Calcular receita bruta do mês (soma das notas classificadas)
   3. Pré-preencher PGDAS-D com os valores calculados
   4. Notificar contador: "PGDAS do cliente X pronto para revisão"

TODO MÊS, DIA 20 (após confirmação do contador):
→ Transmitir PGDAS-D via SERPRO
→ Gerar DAS (código de barras)
→ Gerar PDF padrão APOYA
→ Enviar ao cliente via WhatsApp (Evolution API)
→ Atualizar status: 'enviado_cliente'

MONITORAMENTO CONTÍNUO:
→ Verificar pagamentos confirmados (webhook Asaas)
→ Atualizar status das obrigações: 'pago'
→ Verificar certidões vencendo (SERPRO)
→ Verificar NF-e rejeitadas ou com problema
→ Alertar para obrigações com prazo < 5 dias sem conclusão
```

## O que o agente NÃO faz (exige humano)

```
❌ Alterar regime tributário do cliente
❌ Aprovar lançamentos marcados como 'revisao_necessaria'
❌ Transmitir ECD ou ECF (assinatura do CRC é obrigatória)
❌ Resolver divergências na conciliação bancária
❌ Emitir NFS-e de honorários (aprovação do sócio)
❌ Ajustar alíquotas manualmente
❌ Encerrar períodos com pendência aberta
```

---

# ESTRUTURA DE DADOS — ENTIDADES NECESSÁRIAS

## Novas entidades para o motor contábil

```sql
-- Documentos fiscais (NF-e entrada e saída, NFS-e, CT-e)
documentos_fiscais (
  id, empresa_id, tipo, -- 'nfe_entrada'|'nfe_saida'|'nfse'|'cte'
  numero, serie, chave_acesso,
  data_emissao, data_lancamento,
  emitente_cnpj, emitente_razao,
  destinatario_cnpj,
  valor_total, valor_icms, valor_ipi, valor_pis, valor_cofins,
  status, -- 'recebido'|'classificado_auto'|'classificado_confirmado'|'lancado'
  natureza_operacao, -- 'compra_revenda'|'uso_consumo'|'ativo'|'venda'|'servico'
  gera_credito_icms, valor_credito_icms,
  gera_credito_pis_cofins, valor_credito_pis_cofins,
  xml_url, pdf_url, mes_referencia,
  classificado_por -- 'automatico'|'humano'|'agente_ia'
)

-- Lançamentos contábeis
lancamentos_contabeis (
  id, empresa_id, documento_id (FK, nullable),
  data_lancamento, data_competencia, historico,
  conta_debito, conta_credito, valor,
  tipo, -- 'automatico'|'manual'|'provisao'|'depreciacao'|'estorno'
  status, -- 'rascunho'|'confirmado'|'estornado'
  periodo_fechado, usuario_id, mes_referencia
)

-- Apuração de impostos mensal
apuracoes_mensais (
  id, empresa_id, mes_referencia, regime,
  receita_bruta, receita_bruta_comercio, receita_bruta_servico,
  rbt12, aliquota_efetiva,
  icms_debito, icms_credito, icms_a_pagar, icms_saldo_credor,
  iss_a_pagar,
  pis_debito, pis_credito, pis_a_pagar,
  cofins_debito, cofins_credito, cofins_a_pagar,
  irpj_base, irpj_valor, csll_base, csll_valor,
  das_valor, das_codigo_barras, das_linha_digitavel, das_vencimento,
  status, -- 'em_andamento'|'apurado'|'transmitido'|'pago'
  data_transmissao, data_pagamento
)

-- Extrato bancário
extrato_bancario (
  id, empresa_id, data_linha, historico_banco,
  valor, tipo, -- 'credito'|'debito'
  status, -- 'pendente'|'conciliado'|'ignorado'
  lancamento_id (FK lancamentos_contabeis, nullable),
  mes_referencia
)

-- Plano de contas (por empresa ou padrão do escritório)
plano_contas (
  id, empresa_id (nullable — se null, é plano padrão do escritório),
  codigo, descricao, tipo, -- 'ativo'|'passivo'|'pl'|'receita'|'despesa'|'custo'
  natureza, -- 'devedora'|'credora'
  nivel, -- 1=grupo, 2=subgrupo, 3=conta, 4=subconta
  ativo
)

-- Períodos contábeis (controle de fechamento)
periodos_contabeis (
  id, empresa_id, mes_referencia,
  status, -- 'aberto'|'em_fechamento'|'fechado'
  checklist_status jsonb, -- { nfe_entrada: true, nfe_saida: true, conciliacao: false, ... }
  fechado_por, fechado_em,
  reaberto_por, reaberto_em, motivo_reabertura
)
```

---

# BUGS CONHECIDOS — PARA CORRIGIR EM SEGUIDA

## BUG CRÍTICO: Botões na aba Fiscal voltam para o Dashboard

**Problema:** Ao clicar em botões de ação (Nota, DAS, etc.) na página do cliente,
a navegação redireciona para o Dashboard em vez de abrir o submenu correto.

**Causa provável:** handlers de click sem `e.preventDefault()` ou `Link` envolvendo
um botão dentro de uma `<tr>` clicável, causando bubble do evento para o row-click.

**Correção:**
```tsx
// Errado — o click no botão propaga para o row
<tr onClick={() => navigate('/dashboard')}>
  <td><Button onClick={handleDAS}>DAS</Button></td>
</tr>

// Correto — parar propagação no botão
<Button onClick={(e) => { e.stopPropagation(); handleDAS(); }}>DAS</Button>
```

Todos os botões dentro de linhas de tabela ou cards clicáveis precisam de
`e.stopPropagation()` + `e.preventDefault()` onde necessário.

---

# ROADMAP DE IMPLEMENTAÇÃO

## Sprint 1 — Fundação (1-2 semanas)
1. ✅ Criar entidades no Supabase: `documentos_fiscais`, `lancamentos_contabeis`, `apuracoes_mensais`, `extrato_bancario`, `plano_contas`, `periodos_contabeis`
2. ✅ Tela de cadastro com auto-fill via CNPJ (SERPRO + RFB)
3. ✅ Parser de XML de NF-e (extrai todos os campos fiscais)
4. ✅ Tabela de regras CFOP → classificação automática
5. ✅ Correção dos bugs de navegação (botões voltando ao Dashboard)

## Sprint 2 — Motor Fiscal (2-3 semanas)
6. Geração automática de lançamentos contábeis a partir de NF-e
7. Apuração automática de ICMS (crédito × débito)
8. Apuração automática de DAS Simples Nacional (PGDAS-D)
9. Integração SERPRO → geração de DAS com código de barras
10. Geração de PDF DAS com identidade APOYA

## Sprint 3 — Contabilidade e Fechamento (2-3 semanas)
11. Conciliação bancária (upload extrato OFX/CSV + engine de matching)
12. Checklist de fechamento mensal com validações automáticas
13. Geração de balancete e DRE automatizados
14. Provisões automáticas (férias, 13º, IRPJ, CSLL)

## Sprint 4 — SPED e Obrigações Acessórias (3-4 semanas)
15. Gerador EFD-ICMS/IPI (blocos C, E, 0, 9)
16. Gerador EFD-Contribuições (blocos M, C, A, 9)
17. Gerador ECD (blocos I, J, 0, 9)
18. Transmissão automática via certificado A1

## Sprint 5 — Agente IA Operador (paralelo)
19. Rotina autônoma do agente (ciclo mensal)
20. Notificações proativas via WhatsApp
21. Dashboard de auditoria do agente (o que foi feito, o que precisa de humano)

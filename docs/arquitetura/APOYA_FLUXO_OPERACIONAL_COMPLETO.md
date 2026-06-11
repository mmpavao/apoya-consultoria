# APOYA — Fluxo Operacional Completo por Regime Tributário
**Autor:** ARQUITETO · Data: 2026-05-22
**Escopo:** Do lead até o fechamento fiscal anual — o que é obrigatório, boa prática e diferencial

---

## LEGENDA
- 🔴 **OBRIGATÓRIO POR LEI** — se não fizer, multa ou crime
- 🟡 **BOA PRÁTICA** — não é lei, mas todo escritório sério faz
- 🟢 **DIFERENCIAL** — o que separa um escritório medíocre de um de alto valor

---

# FASE 0 — CHEGADA DO LEAD (igual para todos os regimes)

## 0.1 Prospecção e qualificação
- 🟡 Entender o porte: MEI / ME / EPP / Ltda
- 🟡 Entender a atividade (CNAE): comércio, serviço, indústria, misto
- 🟡 Verificar regime atual e se é o mais adequado
- 🟢 **Simulação de regime:** calcular quanto o cliente paga hoje vs quanto pagaria em cada regime
- 🟢 Diagnóstico fiscal gratuito via SERPRO (situação na Receita Federal)

## 0.2 Proposta e contrato
- 🟡 Proposta comercial com escopo claro (o que está e o que NÃO está incluído)
- 🔴 **Contrato de prestação de serviços contábeis** assinado (obrigação do CRC)
- 🔴 Procuração para representar o cliente no **e-CAC** (Receita Federal)
- 🟡 Definir canais de comunicação e SLA de resposta

## 0.3 Onboarding — coleta de dados
- 🔴 CNPJ + contrato social (ou requerimento MEI) atualizado
- 🔴 Regime tributário atual e data de início das atividades
- 🔴 CNAE(s) principal e secundários
- 🔴 Certificado Digital A1 (para emissão de NF e transmissão SPED)
- 🔴 Acesso ao portal da prefeitura (para NFS-e)
- 🔴 Acesso ao e-CAC via procuração eletrônica
- 🟡 Dados bancários (para conciliação)
- 🟡 Histórico das últimas declarações (últimos 2 anos)
- 🟡 Lista de funcionários, contratos, salários (se tiver CLT)
- 🟡 Fornecedores fixos e clientes recorrentes
- 🟢 Acesso ao ERP/sistema da empresa para captura automática de NF-e
- 🟢 Configuração de automação de download de XML via SEFAZ/prefeitura

---

# REGIME 1 — MEI (Microempreendedor Individual)

**Perfil:** fatura até R$ 81k/ano, 1 funcionário CLT no máximo, atividade permitida

---

## CICLO MENSAL DO MEI

### Semana 1 (até dia 5)
| # | Tarefa | Tipo |
|---|---|---|
| 1 | Verificar se o cliente registrou receitas do mês anterior | 🟡 |
| 2 | Conferir se emitiu notas para clientes PJ (obrigatório por lei) | 🔴 |
| 3 | Verificar movimentação bancária (extrato conta PJ) | 🟡 |

### Semana 2 (até dia 15)
| # | Tarefa | Tipo |
|---|---|---|
| 4 | Conferir faturamento acumulado no ano (alerta se > R$ 60k — risco de estouro MEI) | 🟢 |
| 5 | Orientar sobre obrigações se tiver 1 funcionário CLT (folha, INSS, FGTS) | 🔴 |

### Até dia 20 — DAS MEI (DASMEI)
| # | Tarefa | Tipo |
|---|---|---|
| 6 | **Gerar DAS via PGMEI** (portal Receita Federal ou SERPRO) | 🔴 |
| 7 | Enviar boleto/código de barras ao cliente (WhatsApp/e-mail) | 🟡 |
| 8 | Confirmar pagamento e registrar na plataforma | 🟡 |
| 9 | Emitir alerta se não pagar até o dia 20 (multa + juros automáticos) | 🟢 |

---

## CICLO ANUAL DO MEI

### Janeiro
| # | Tarefa | Tipo |
|---|---|---|
| 10 | Verificar faturamento do ano anterior — se estourou R$ 81k, iniciar processo de desenquadramento MEI | 🔴 |
| 11 | Informar ao cliente sobre a DASN-SIMEI que vence em 31/05 | 🟡 |

### Até 31/05 — DASN-SIMEI (Declaração Anual)
| # | Tarefa | Tipo |
|---|---|---|
| 12 | **Preencher e transmitir DASN-SIMEI** com total de receitas brutas do ano anterior | 🔴 |
| 13 | Separar receita de comércio/indústria e receita de serviço (alíquotas diferentes) | 🔴 |
| 14 | Guardar recibo de transmissão | 🔴 |

### A qualquer momento
| # | Tarefa | Tipo |
|---|---|---|
| 15 | Emitir CCMEI (Certificado de Condição de MEI) quando solicitado | 🟡 |
| 16 | Consultar situação fiscal via SERPRO | 🟢 |
| 17 | Alerta de vencimento do certificado digital (se tiver) | 🟡 |
| 18 | **Relatório DRE simples** com receitas vs despesas mensais | 🟢 |

### Ao desenquadrar do MEI
| # | Tarefa | Tipo |
|---|---|---|
| 19 | Migrar para Simples Nacional (gerar nova IE, IM, PGDAS) | 🔴 |
| 20 | Transferir obrigações: começa PGDAS-D mensal, DEFIS anual | 🔴 |

---

# REGIME 2 — SIMPLES NACIONAL

**Perfil:** fatura até R$ 4,8M/ano, pagamento unificado via DAS

---

## CICLO MENSAL DO SIMPLES NACIONAL

### Semana 1 (1 a 7 do mês seguinte)
| # | Tarefa | Tipo |
|---|---|---|
| 1 | **Download automático de NF-e de entradas** via SEFAZ (XML autorizado) | 🟢 |
| 2 | Solicitar ao cliente: NFS-e emitidas, notas de compra não capturadas, despesas do mês | 🟡 |
| 3 | **Escrituração das notas de entrada:** classificar por CFOP, NCM, fornecedor | 🔴 |
| 4 | **Escrituração das notas de saída:** verificar autorização, chave de acesso, XML | 🔴 |
| 5 | Conferir se há NF-e canceladas ou com erro | 🔴 |
| 6 | Se tiver funcionários: fechar eSocial (S-1200/1210/1299) até dia 7 | 🔴 |

### Semana 2 (8 a 15)
| # | Tarefa | Tipo |
|---|---|---|
| 7 | Apurar faturamento bruto do mês | 🔴 |
| 8 | Calcular receita por anexo (I comércio / II indústria / III-V serviço) | 🔴 |
| 9 | Verificar sublimite estadual (se aplica redução de ICMS/ISS) | 🔴 |
| 10 | Se tiver retenções de terceiros: EFD-Reinf até dia 15 | 🔴 |
| 11 | Apurar folha de pagamento (se tiver CLT): INSS, IRRF, FGTS | 🔴 |

### Até dia 20 — PGDAS-D e DAS
| # | Tarefa | Tipo |
|---|---|---|
| 12 | **Preencher PGDAS-D** no portal do Simples Nacional (Receita Federal) | 🔴 |
| 13 | Informar receita bruta por tipo de atividade | 🔴 |
| 14 | Verificar se há fração de exportação (alíquota zerada) | 🟡 |
| 15 | **Gerar DAS** com o valor calculado (IRPJ+CSLL+PIS+COFINS+CPP+ICMS/ISS) | 🔴 |
| 16 | Enviar DAS ao cliente para pagamento | 🟡 |
| 17 | Confirmar pagamento e arquivar comprovante | 🟡 |
| 18 | Se tiver CLT: pagar INSS patronal e FGTS Digital até dia 20 | 🔴 |

### Final do mês — Contabilidade
| # | Tarefa | Tipo |
|---|---|---|
| 19 | **Lançamentos contábeis:** receitas, custos, despesas, salários | 🔴 |
| 20 | Conciliação bancária: extrato vs livros contábeis | 🟡 |
| 21 | Provisão de férias e 13º (se tiver CLT) | 🟡 |
| 22 | **Balancete mensal** (Ativo = Passivo + PL) | 🟡 |
| 23 | **DRE mensal** (Receita → Custos → Despesas → Resultado) | 🟡 |
| 24 | Enviar relatório gerencial ao cliente | 🟢 |
| 25 | Alertar sobre faturamento acumulado (aviso se > 80% do limite) | 🟢 |

---

## CICLO ANUAL DO SIMPLES NACIONAL

### Janeiro — Planejamento
| # | Tarefa | Tipo |
|---|---|---|
| 26 | **Revisão do regime:** simular se Simples continua sendo o melhor para o ano | 🟢 |
| 27 | Verificar se a empresa se enquadra em alguma vedação ao Simples | 🔴 |
| 28 | Enviar agenda fiscal do ano ao cliente | 🟢 |

### Até 31/03 — DEFIS
| # | Tarefa | Tipo |
|---|---|---|
| 29 | **Transmitir DEFIS** (Declaração de Informações Socioeconômicas e Fiscais) | 🔴 |
| 30 | Preencher: faturamento por faixa, empregados, exportação, operações com PF | 🔴 |
| 31 | Guardar recibo de transmissão | 🔴 |

### Abril/Maio — IRPF dos sócios
| # | Tarefa | Tipo |
|---|---|---|
| 32 | Preparar **informe de rendimentos dos sócios** (pro-labore + distribuição de lucros) | 🔴 |
| 33 | Entregar ao sócio para declaração de IRPF | 🔴 |
| 34 | Verificar se o escritório oferece IRPF como serviço adicional | 🟢 |

### Setembro — Decisão de regime para o próximo ano
| # | Tarefa | Tipo |
|---|---|---|
| 35 | Simular regime tributário para o próximo ano (Simples vs LP vs LR) | 🟢 |
| 36 | Se optar por sair do Simples: formalizar solicitação de exclusão | 🔴 |

### Dezembro — Fechamento do exercício
| # | Tarefa | Tipo |
|---|---|---|
| 37 | Lançamentos de encerramento: depreciação, provisões, ajustes | 🔴 |
| 38 | **Balanço Patrimonial** do ano | 🟡 |
| 39 | **DRE anual** — resultado do exercício | 🟡 |
| 40 | Ata de distribuição de lucros (se houver) | 🟡 |
| 41 | **Relatório anual de desempenho** para o cliente | 🟢 |

---

# REGIME 3 — LUCRO PRESUMIDO (LP)

**Perfil:** fatura até R$ 78M/ano, alíquota presumida de lucro, mais obrigações que o Simples

---

## CICLO MENSAL DO LUCRO PRESUMIDO

### Até dia 7
| # | Tarefa | Tipo |
|---|---|---|
| 1 | **eSocial — fechar competência:** transmitir S-1299 (fechamento mensal) | 🔴 |
| 2 | Verificar eventos pendentes: S-2200 (admissão), S-2210 (CAT), S-2230 (afastamento) | 🔴 |

### Até dia 15
| # | Tarefa | Tipo |
|---|---|---|
| 3 | **EFD-Reinf:** declarar retenções de INSS, IRRF, CSLL, PIS, COFINS sobre serviços tomados | 🔴 |
| 4 | Cruzar com eSocial (a DCTFWeb depende dos dois) | 🔴 |

### Semana 1-2 (rotina fiscal)
| # | Tarefa | Tipo |
|---|---|---|
| 5 | Download e escrituração de NF-e de entradas (XML via SEFAZ) | 🔴 |
| 6 | Escrituração de NF-e de saídas | 🔴 |
| 7 | Classificação por CFOP, CST, NCM, alíquota | 🔴 |
| 8 | **Apuração de ICMS** (crédito × débito) — Livro Registro Apuração ICMS | 🔴 |
| 9 | **Apuração de ISS** (se prestação de serviços) | 🔴 |
| 10 | **Apuração de PIS/COFINS cumulativo** (0,65% + 3% sobre receita) | 🔴 |
| 11 | Apurar retenções na fonte recebidas (IRRF, CSLL, PIS, COFINS) | 🔴 |

### Até dia 20
| # | Tarefa | Tipo |
|---|---|---|
| 12 | Pagar **ICMS** (DARE estadual) | 🔴 |
| 13 | Pagar **ISS** (guia municipal) | 🔴 |
| 14 | Pagar **INSS patronal** | 🔴 |
| 15 | **DIRBI** (se tiver benefícios fiscais: PERSE, PAT, etc.) | 🔴 |
| 16 | **FGTS Digital** — guias individualizadas por funcionário | 🔴 |

### Até último dia útil do mês seguinte
| # | Tarefa | Tipo |
|---|---|---|
| 17 | **DCTFWeb:** declarar e pagar INSS, IRRF, CSLL s/ serviços, PIS/COFINS retidos | 🔴 |

### Até 10º dia útil do 2º mês seguinte
| # | Tarefa | Tipo |
|---|---|---|
| 18 | **EFD-Contribuições (SPED PIS/COFINS):** escrituração detalhada de PIS e COFINS | 🔴 |

### Prazo estadual (em geral até dia 20)
| # | Tarefa | Tipo |
|---|---|---|
| 19 | **EFD-ICMS/IPI (SPED Fiscal):** escrituração digital do ICMS e IPI | 🔴 |

### Trimestral — IRPJ e CSLL
| # | Tarefa | Tipo |
|---|---|---|
| 20 | **Apurar IRPJ trimestral:** base presumida × 8% (comércio) ou 32% (serviço) × 15% | 🔴 |
| 21 | Adicional IRPJ 10% sobre lucro que exceder R$ 60k/trimestre | 🔴 |
| 22 | **Apurar CSLL trimestral:** base presumida × 12% ou 32% × 9% | 🔴 |
| 23 | Gerar DARF IRPJ e DARF CSLL — pagar até último dia útil do mês seguinte ao trimestre | 🔴 |

### Final do mês — Contabilidade
| # | Tarefa | Tipo |
|---|---|---|
| 24 | **Lançamentos contábeis completos** (partidas dobradas, plano de contas) | 🔴 |
| 25 | Conciliação bancária obrigatória (base para ECD) | 🔴 |
| 26 | Provisão de IRPJ e CSLL | 🔴 |
| 27 | Provisão de férias, 13º, INSS sobre provisões | 🔴 |
| 28 | Depreciação de ativos imobilizados | 🔴 |
| 29 | **Balancete mensal** — confirmar que Débito = Crédito | 🔴 |
| 30 | **DRE mensal** | 🟡 |
| 31 | **Relatório gerencial** com indicadores: margem bruta, EBITDA, ciclo financeiro | 🟢 |
| 32 | Conciliação de contas a receber e contas a pagar | 🟡 |

---

## CICLO ANUAL DO LUCRO PRESUMIDO

### Janeiro — Abertura do exercício
| # | Tarefa | Tipo |
|---|---|---|
| 33 | Abertura de novo exercício contábil | 🔴 |
| 34 | Revisão do regime — simulação LP vs LR para o ano | 🟢 |
| 35 | Enviar calendário fiscal do ano ao cliente | 🟢 |

### Até 29/05 — ECD (SPED Contábil)
| # | Tarefa | Tipo |
|---|---|---|
| 36 | **Fechar a escrituração contábil do ano anterior** | 🔴 |
| 37 | Revisar todos os lançamentos, conciliações e provisões | 🔴 |
| 38 | Gerar os livros: Diário, Razão, Balancete | 🔴 |
| 39 | **Transmitir ECD** ao SPED com assinatura do contador e do responsável legal | 🔴 |
| 40 | Guardar recibo de transmissão (HASH) | 🔴 |

### Até 31/07 — ECF (Escrituração Contábil Fiscal)
| # | Tarefa | Tipo |
|---|---|---|
| 41 | Importar dados da ECD para o PGE da ECF | 🔴 |
| 42 | **Preencher ECF:** apuração de IRPJ e CSLL, regime de tributação, participações societárias | 🔴 |
| 43 | Preencher Blocos A, C, E, J, K, M, P, T, X, Y | 🔴 |
| 44 | Transmitir ECF ao SPED | 🔴 |
| 45 | Guardar recibo | 🔴 |

### Até maio — IRPF dos sócios
| # | Tarefa | Tipo |
|---|---|---|
| 46 | **Emitir informe de rendimentos dos sócios:** pro-labore (rendimento tributável), distribuição de lucros (isenta) | 🔴 |
| 47 | Informar retenções de IRRF sobre pro-labore | 🔴 |
| 48 | Declarar IRPF do sócio (se o escritório oferece esse serviço) | 🟢 |

### Dezembro — Fechamento do exercício
| # | Tarefa | Tipo |
|---|---|---|
| 49 | Lançamentos de encerramento: depreciação total, provisões finais, ajustes de competência | 🔴 |
| 50 | **Balanço Patrimonial** final do exercício | 🔴 |
| 51 | **DRE anual** | 🔴 |
| 52 | **DMPL** (Demonstração das Mutações do Patrimônio Líquido) | 🔴 |
| 53 | **DFC** (Demonstração de Fluxo de Caixa) | 🔴 |
| 54 | Ata da assembleia / deliberação de sócios sobre destinação do lucro | 🟡 |
| 55 | **Relatório anual de desempenho + planejamento tributário do próximo ano** | 🟢 |

---

# REGIME 4 — LUCRO REAL (LR)

**Perfil:** faturamento > R$ 78M (obrigatório) ou optante — maior rigor e mais obrigações

> **Lucro Real = Lucro Presumido + mais tudo abaixo**

---

## O QUE TEM A MAIS NO LUCRO REAL (além de tudo do LP)

### Mensalmente
| # | Tarefa | Tipo |
|---|---|---|
| 1 | **Apuração mensal de IRPJ e CSLL** (não trimestral — sobre o lucro real do mês) | 🔴 |
| 2 | DARF IRPJ e CSLL mensais (estimativa ou lucro real mensal) | 🔴 |
| 3 | **EFD-ICMS/IPI obrigatório** (não opcional como no LP de alguns estados) | 🔴 |
| 4 | **Controle de créditos de PIS/COFINS não-cumulativos** (1,65% + 7,6%) | 🔴 |
| 5 | Apuração de créditos de entradas (matéria-prima, energia, aluguel, etc.) | 🔴 |
| 6 | Controle de adições e exclusões ao LALUR (Livro de Apuração do Lucro Real) | 🔴 |
| 7 | Conciliação LALUR vs DRE — diferenças temporárias e permanentes | 🔴 |

### Anualmente — a mais que LP
| # | Tarefa | Tipo |
|---|---|---|
| 8 | **Encerramento do LALUR** (Livro de Apuração do Lucro Real e Social) | 🔴 |
| 9 | Controle de **prejuízo fiscal** para compensação futura (máximo 30% do lucro do período) | 🔴 |
| 10 | Apuração do **JCP** (Juros sobre Capital Próprio) — dedutível do IRPJ/CSLL | 🟢 |
| 11 | Controle de **incentivos fiscais:** PAT, ROUANET, Lei do Esporte, Lei do Bem | 🔴 |

### Diferencial crítico do LR
| # | Tarefa | Tipo |
|---|---|---|
| 12 | **Planejamento de créditos PIS/COFINS:** montar matriz de crédito por tipo de entrada | 🟢 |
| 13 | Distribuição de lucros otimizada: calcular isenção vs pro-labore | 🟢 |
| 14 | Análise de **holding patrimonial** para segregação de ativos | 🟢 |

---

# FLUXO MACRO UNIFICADO — DO LEAD AO IRPF

```
FASE 1: COMERCIAL
Lead entra → Qualificação → Diagnóstico fiscal gratuito → Simulação de regime
→ Proposta com escopo → Contrato assinado → Procuração e-CAC

FASE 2: ONBOARDING
Coleta de documentos → Configuração de acesso → Procuração eletrônica
→ Certificado Digital → Acesso prefeitura (NFS-e) → Configuração automação
→ Cadastro no ERP contábil → Revisão do histórico fiscal

FASE 3: OPERAÇÃO MENSAL (repete todo mês)
├── Fiscal: captura NF-e/NFS-e → escrituração → apuração de impostos → guias
├── DP (se tiver CLT): eSocial → folha → INSS → FGTS Digital → DCTFWeb
├── Contábil: lançamentos → conciliação bancária → balancete
└── Entrega: DAS ou DARF → comprovante → relatório gerencial ao cliente

FASE 4: FECHAMENTO ANUAL
├── DEFIS (Simples — até 31/03)
├── Informes de rendimentos dos sócios (fevereiro/março)
├── ECD — SPED Contábil (LP e LR — até 29/05)
├── ECF — SPED Fiscal-Contábil (LP e LR — até 31/07)
├── IRPF dos sócios (março a maio — se o escritório oferece)
└── Relatório anual + simulação do próximo regime

FASE 5: PLANEJAMENTO (diferencial)
└── Simulação comparativa de regimes → Recomendação → Holding?
    → Distribuição de lucros → JCP → Incentivos fiscais → Próximo exercício
```

---

# O QUE FAZER QUANDO O CLIENTE NÃO ENTREGA NADA

> Esse é o cenário mais comum. O cliente não manda nota, não responde, some.

## Protocolo de cobrança escalonada

| Dia | Ação | Canal |
|---|---|---|
| D-10 (antes do vencimento) | Aviso preventivo: "precisamos das notas até X" | WhatsApp |
| D-5 | Lembrete com lista do que falta | WhatsApp + e-mail |
| D-2 | Urgente: "se não receber, vou fazer com o que tenho" | WhatsApp |
| D-0 | Apurar com o que está disponível (NF-e capturadas automaticamente) | Sistema |
| D+1 | Notificar que a entrega foi feita SEM as informações do cliente | E-mail formal |
| D+5 | Registrar pendência formal + aditar contrato se reincidente | Documento |

## O que o contador pode fazer sozinho (sem o cliente)
- ✅ Baixar NF-e de entrada via SEFAZ (XML disponível automaticamente)
- ✅ Consultar situação fiscal via SERPRO (DAS em aberto, certidões, PGDAS)
- ✅ Baixar extrato bancário (se tiver acesso open banking ou API)
- ✅ Verificar NFS-e emitidas no portal da prefeitura
- ❌ **Não pode** declarar valores que não têm base documental
- ❌ **Não pode** inventar receitas ou despesas
- ⚠️ Se declarar PGDAS-D com valor errado por falta de info do cliente → responsabilidade é do cliente (precisa ter em contrato)

---

# RESUMO COMPARATIVO — CARGA DE TRABALHO POR REGIME

| Regime | Obrigações mensais | Obrigações anuais | Complexidade | Valor da hora |
|---|---|---|---|---|
| MEI | DAS (1 guia) | DASN-SIMEI | ⭐ Baixa | R$ 50-150/mês |
| Simples Nacional | PGDAS-D + DAS | DEFIS + ECD (opcional) + IRPF sócios | ⭐⭐ Média | R$ 200-800/mês |
| Lucro Presumido | DCTFWeb + EFD-Reinf + SPED Fiscal + DARF trimestral | ECD + ECF + IRPF sócios | ⭐⭐⭐ Alta | R$ 800-3.000/mês |
| Lucro Real | Tudo do LP + LALUR + IRPJ mensal + EFD obrigatório | Tudo do LP + LALUR anual | ⭐⭐⭐⭐ Muito alta | R$ 2.000-10.000/mês |

---

# SERVIÇOS ADICIONAIS (DIFERENCIAL COMPETITIVO)

| Serviço | O que é | Para quem |
|---|---|---|
| IRPF dos sócios | Declaração de imposto de renda da pessoa física | Todos os sócios |
| BPO Financeiro | DRE gerencial, fluxo de caixa, conciliação avançada | Empresas com mov. > 50k/mês |
| Planejamento tributário | Simulação de regimes, holding, JCP | Lucro > R$ 30k/mês |
| Abertura de empresa | REDESIM, CNPJ, IE, IM, Alvará | Novos empreendedores |
| Encerramento de empresa | Baixa no CNPJ, certidões, JUCESP | Empresas encerrando |
| Due diligence fiscal | Auditoria do passivo fiscal antes de M&A | Investidores/compradores |
| Diagnóstico fiscal gratuito | Consulta SERPRO + análise de regime | Prospecção de leads |
| Certificado Digital | Emissão e renovação A1/A3 | Todos os clientes |

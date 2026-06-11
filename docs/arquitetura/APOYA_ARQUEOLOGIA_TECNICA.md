# APOYA — Inteligência Competitiva e Contexto de Mercado
**Preparado por:** ARQUITETO  
**Data:** 2026-05-20  
**Objetivo:** Embasar o escopo V3 com visão real do mercado, concorrência, normas e tendências

---

## 1. PANORAMA DO MERCADO DE SISTEMAS CONTÁBEIS NO BRASIL 2026

### Os grandes players que a APOYA vai competir (indiretamente)

| Sistema | Foco | Pontos fortes | Fraqueza crítica |
|---|---|---|---|
| **Domínio (Thomson Reuters)** | Escritórios de todos os portes | Integração total fiscal + folha + contábil; referência nacional; automação de guias | Caro, interface legada, não é SaaS nativo, depende de instalação local/servidor |
| **Omie ERP** | PMEs + escritório contábil como parceiro | ERP completo na nuvem, parceria com contadores, marketplace de apps | É ERP da empresa-cliente, não do escritório contábil. Contador usa como portal |
| **Questor** | Escritórios contábeis | Nuvem nativa, integração fiscal + DP + contábil, foco em automação | Menos conhecido, suporte regional limitado |
| **Alterdata** | Escritórios de todos os portes | Flexível, customizável, multi-regime, RPA integrado | Interface antiga, curva de aprendizado alta |
| **SCI Sistemas** | Escritórios médios/grandes | Integração eSocial + DCTFWeb, backups automáticos, bom suporte | Complexo para escritórios pequenos |
| **Sage** | Escritórios que querem padronização | Financeiro + fiscal + conciliação bancária; visual limpo | Custo mensal alto, menos presença no interior do Brasil |
| **Contabilizei** | Contador online (B2C) | Totalmente automatizado, foco em MEI e SN, preço baixo | Não é sistema para escritório — é concorrente do escritório |
| **Conube / Agilize** | Contador online (B2C) | Automação fiscal para MEI e SN simples | Mesmo modelo do Contabilizei — compete com o escritório, não serve para ele |

### O que NENHUM deles faz bem
- **Comunicação automática com clientes via WhatsApp** — todos exigem exportar PDF e mandar manualmente
- **NFS-e de honorários em lote** — todos tratam como processo manual um por um
- **Dashboard em tempo real para o sócio** — a maioria tem relatórios, não visão ao vivo
- **Onboarding 100% digital** (CNPJ → contrato → cobrança sem toque humano)
- **Mobile-first** — nenhum grande player tem app mobile para o contador
- **IA integrada na rotina** — alguns anunciam, nenhum entrega de verdade no Brasil em 2026

### A janela de oportunidade da APOYA
O mercado está fragmentado entre:
- Sistemas legados (Domínio, Alterdata) — poderosos mas pesados
- ERPs das empresas (Omie, Bling) — servem ao cliente, não ao escritório
- Contadores online (Contabilizei) — competem com o escritório

**Não existe ainda um sistema SaaS moderno, mobile-first, com WhatsApp nativo e automação total, construído especificamente para escritórios contábeis de médio porte.** Essa é a janela da APOYA.

---

## 2. CALENDÁRIO FISCAL COMPLETO 2026 — VERIFICADO NAS FONTES OFICIAIS

### Obrigações mensais recorrentes

| Obrigação | Prazo | Quem entrega | Observação |
|---|---|---|---|
| **GFIP/SEFIP** | Dia 7 | Empresas com empregados | Competência mês anterior |
| **eSocial (eventos periódicos)** | Dia 15 | Todos com empregados | Competência mês anterior |
| **EFD-Reinf** | Dia 15 | LP, LR e SN com retenções | Competência mês anterior |
| **EFD-Contribuições** | 10º dia útil do 2º mês subsequente | LP e LR | 2 meses de defasagem |
| **PGDAS-D** | Dia 20 | Simples Nacional | Competência mês anterior |
| **DAS (pagamento)** | Dia 20 | Simples Nacional + MEI | Mesmo prazo do PGDAS |
| **DASMEI** | Dia 20 | MEI | Guia diferente do DAS comum |
| **DIRBI** | Dia 20 | Beneficiários de incentivos fiscais | Novidade 2024 mantida em 2026 |
| **DCTFWeb** | Último dia útil | Todos (exceto SN/MEI) | Unificou DCTF mensal (extinta) |
| **INSS (contrib. individuais)** | Dia 15 | Contribuintes individuais | — |

### Obrigações anuais 2026

| Obrigação | Prazo | Quem entrega |
|---|---|---|
| **DEFIS** | 31/03/2026 | Simples Nacional |
| **ECD** | 29/05/2026 | LP (que distribuem lucros acima da presunção) + LR |
| **ECF** | 31/07/2026 | LP + LR |
| **DASN-SIMEI** | 31/05 do ano seguinte | MEI (declaração anual) |
| **IRPF** | Março a Maio | Pessoas físicas (sócios) |
| **RAIS Negativa** | Conforme calendário | MEI sem empregados |

### Novidades críticas 2026 — Reforma Tributária na prática

**1. NFS-e com destaque de CBS e IBS — OBRIGATÓRIO A PARTIR DE JAN/2026**
> A partir de 1º de janeiro de 2026, qualquer NF-e, NFC-e, NFS-e e CT-e deve destacar CBS e IBS nas notas fiscais eletrônicas. Em 2026, é fase de testes — destaque informativo, sem cobrança. Mas é OBRIGATÓRIO tecnicamente.
> **Impacto APOYA:** O sistema de emissão de NFS-e (NFE.io) precisa suportar o campo CBS/IBS desde o dia 1.

**2. DCTFWeb Unificada — DCTF Mensal extinta**
> A DCTF Mensal (PGD) foi definitivamente extinta. Todos os tributos federais vão para a DCTFWeb, que cruza dados com eSocial e EFD-Reinf via MIT (Módulo de Inclusão de Tributos).
> **Impacto APOYA:** O Kanban de obrigações precisa refletir DCTFWeb como obrigação-padrão do LP/LR.

**3. Simples Nacional — duas opções em 2026**
> Empresas do Simples podem:
> (a) Continuar com DAS unificado — CBS e IBS inclusos no DAS
> (b) Aderir ao regime híbrido — recolher CBS e IBS separadamente para aproveitar créditos
> Escolha tem validade de 6 meses, revisável em abril e setembro.
> **Impacto APOYA:** Campo `regime_hibrido` na entidade `empresa_cliente`. Sistema deve alertar bimestralmente para revisar a opção.

**4. MEI — sem CBS/IBS em 2026**
> MEI e Simples Nacional (opção DAS) estão **dispensados** de informar CBS e IBS nas notas em 2026.
> **Impacto APOYA:** Para clientes MEI, a NFS-e não precisa destacar CBS/IBS neste ano.

---

## 3. SERPRO INTEGRA CONTADOR — CAPACIDADES REAIS DA API

### O que o SERPRO entrega via Integra Contador

| Serviço | Descrição | Relevância APOYA |
|---|---|---|
| **PGDAS-D** | Entrega e consulta da declaração do Simples Nacional | ⭐ CRÍTICO — DAS em lote |
| **DAS** | Geração do Documento de Arrecadação do SN | ⭐ CRÍTICO — envio automático |
| **DEFIS** | Declaração anual do Simples Nacional | Alto — 1x/ano por cliente |
| **Situação Fiscal** | Consulta situação do contribuinte (ativo, suspenso, excluído) | Alto — onboarding e monitoramento |
| **PGDAS Histórico** | Histórico de apurações do cliente | Médio — dashboard executivo |
| **Caixa Postal** | Acesso a notificações da Receita Federal do cliente | Alto — alerta automático |
| **Parcelamentos** | Consulta de parcelamentos ativos | Médio — gestão de inadimplência fiscal |
| **SICALC** | Cálculo de juros e multas de tributos | Médio — negociação com cliente |
| **DCTFWeb** | Entrega de DCTFWeb (LP/LR) | Médio-alto — obrigação LP |
| **e-CNPJ com Procuração** | Agir em nome do cliente com procuração eletrônica | ⭐ CRÍTICO — sem isso nada funciona |
| **CNPJ** | Consulta dados cadastrais da empresa | Alto — onboarding |
| **Certidões** | Emissão de certidões negativas | Médio — gerado a pedido |

**Requisito técnico obrigatório:** mTLS com certificado A1 ICP-Brasil do contador. Por isso a VPS é inevitável. Sem VPS, zero acesso ao SERPRO.

**13 rotas já implementadas no gateway** `apoya-serpro v3.0.0` — reutilizar tudo.

---

## 4. TENDÊNCIAS DE MERCADO — O QUE OS MELHORES ESCRITÓRIOS FAZEM EM 2026

### O que virou commodity (todo escritório moderno já tem)
- Emissão de NFS-e eletrônica
- Folha de pagamento digital
- Cobranças via PIX/boleto

### O que está emergindo (vantagem competitiva em 2026)
- **WhatsApp como canal primário** — 78% dos clientes preferem WhatsApp a email
- **Dashboard ao vivo para o sócio** — "Ver minha situação agora" sem ligar para o contador
- **Onboarding digital** — contrato assinado em 5 minutos no celular
- **Alertas proativos** — o sistema avisa antes do cliente precisar perguntar
- **IA para análise fiscal** — simular troca de regime, detectar anomalias, sugerir planejamento

### O que vai ser obrigatório em 2027-2028
- **CBS/IBS com apuração e créditos** — reforma tributária em plena implementação
- **NF-e com split payment** — pagamento automático de impostos na transação
- **eSocial completo** — todos os eventos sem exceção
- **Nota Fiscal eletrônica para todos** — inclusive MEI (pressão regulatória crescente)

### Insight de Daniel — validado pelo mercado
> "O escritório que não automatizar vai virar commodity. O escritório que automatizar vai poder cobrar pelo valor estratégico, não pelo trabalho repetitivo."

Isso é exatamente o que os grandes escritórios americanos e europeus já fizeram na última década. O Brasil chega agora.

---

## 5. DIFERENCIAIS COMPETITIVOS — O QUE O SISTEMA APOYA PODE SER

### Diferencial 1: WhatsApp como espinha dorsal (não feature)
Nenhum sistema brasileiro trata o WhatsApp como canal nativo. A APOYA seria a primeira a ter:
- Todos os documentos entregues automaticamente pelo WhatsApp
- Histórico completo de cada cliente em um feed centralizado
- Respostas automáticas para perguntas frequentes (quando vence o DAS? já paguei o boleto?)
- Handoff humano-IA quando a pergunta for complexa

### Diferencial 2: Zero intervenção humana no fluxo mensal padrão
O objetivo é que no dia 20 de cada mês, sem ninguém fazer nada:
- DAS de todos os clientes gerado via SERPRO
- PDF enviado via WhatsApp para cada cliente
- Cobrança de honorários gerada no Asaas
- NFS-e emitida no NFE.io
- Status atualizado no dashboard

### Diferencial 3: Consultor, não operador
Com a Reforma Tributária, todo cliente Simples Nacional vai precisar analisar se vale optar pelo regime híbrido. Isso é trabalho de contador, não de sistema. Mas o sistema pode:
- Calcular automaticamente se o cliente tem perfil para regime híbrido
- Gerar relatório de simulação em 1 clique
- Enviar recomendação pelo WhatsApp para o cliente antes da janela de escolha (abril/setembro)

### Diferencial 4: Mobile-first para o contador
Daniel quer poder gerir seus 75 clientes do celular. Nenhum sistema legado oferece isso de verdade. O sistema APOYA vai ser PWA (funciona no celular como app) desde o início.

### Diferencial 5: Transparência total com o cliente (portal futuro)
Na fase 2, o cliente pode ter acesso a um mini-portal para ver: DAS do mês, NFS-e, contratos, vencimentos. Isso elimina 90% das ligações e WhatsApps recebidos.

---

## 6. IMPACTO DA REFORMA TRIBUTÁRIA NO SISTEMA — O QUE PRECISA ESTAR PRONTO

### Em 2026 (já)
- [ ] NFS-e com campos CBS/IBS (NFE.io já suporta — validar)
- [ ] Campo `regime_hibrido` na empresa cliente
- [ ] Alerta bimestral (abril/setembro) para revisão do regime dos clientes SN
- [ ] DCTFWeb no calendário de obrigações para LP/LR

### Em 2027-2028 (planejar agora, implementar depois)
- [ ] Apuração de créditos IBS/CBS para clientes em regime híbrido
- [ ] Integração com plataforma IBS (quando regulamentada pelos municípios)
- [ ] Relatório de planejamento tributário: "Sair do Simples vale a pena?"
- [ ] Split payment (quando implementado pelo governo)

---

## 7. RESUMO EXECUTIVO — O QUE ISSO MUDA NO ESCOPO APOYA

### Adições ao modelo de dados (vs. V2)
```
empresa_cliente:
  + regime_hibrido        boolean DEFAULT false
  + data_opcao_hibrido    date
  + proxima_revisao_regime date  -- calculado: abril ou setembro

obrigacao:
  + tipo: adicionar 'DCTFWeb', 'EFD_Reinf', 'DIRBI'
  + alertas de multa por tipo de obrigação (valor calculado automaticamente)

nfse:
  + cbs_aliquota          numeric  -- 0.9% em 2026
  + ibs_aliquota          numeric  -- 0.1% em 2026  
  + destaque_reforma      boolean DEFAULT true (obrigatório 2026)
```

### Adições ao calendário fiscal (vs. V2)
- EFD-Reinf dia 15 (LP/LR com retenções)
- DIRBI dia 20 (beneficiários de incentivos fiscais)
- DCTFWeb último dia útil (substituiu DCTF Mensal)
- Alertas de multa automáticos por atraso (valores por obrigação)
- Revisão de regime híbrido: alertas em março e agosto para janelas de abril/setembro

### Funcionalidade nova sugerida: "Simulador de Regime"
- Input: faturamento anual, % de compras de fornecedores fora do SN, município
- Output: comparativo SN tradicional vs. regime híbrido com IBS/CBS
- Entrega: relatório PDF + WhatsApp para o cliente com recomendação do escritório
- **Diferencial absurdo** — nenhum sistema faz isso hoje

---

*Documento de inteligência competitiva — base para Escopo V3 e PRD.*  
*Preparado por ARQUITETO com base em pesquisa de mercado, fontes oficiais e análise de concorrência.*

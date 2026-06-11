# Arsenal APOYA — Documentação Completa de Ferramentas
**Versão:** 2.1.0 | **Data:** 22/05/2026 | **CNPJ:** 43.507.838/0001-89

---

## Como Conectar — Configuração MCP

```json
{
  "mcpServers": {
    "serpro": {
      "url": "https://mcp.zapro.tech/mcp",
      "headers": {
        "Authorization": "Bearer <SERPRO_MCP_TOKEN>"
      }
    }
  }
}
```

---

## 1. SERPRO Integra Contador — 61 Tools via MCP

**Endpoint:** https://mcp.zapro.tech/mcp  
**Auth:** Bearer <SERPRO_MCP_TOKEN>  
**SSL:** válido até 20/08/2026

### 1.1 Status & Diagnóstico
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_status` | Verifica autenticação e status do gateway | — |

### 1.2 MEI — CCMEI
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_ccmei_emitir` | Emite PDF do CCMEI — retorna base64 | cnpj |
| `serpro_ccmei_dados` | Dados cadastrais completos do MEI | cnpj |
| `serpro_ccmei_situacao` | Situação cadastral do MEI | cpf (titular) |

### 1.3 MEI — DAS (PGMEI)
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_pgmei_das` | Código de barras do DAS MEI | cnpj, periodo (YYYYMM) |
| `serpro_pgmei_das_pdf` | PDF do DAS MEI | cnpj, periodo |
| `serpro_pgmei_divida` | Dívida ativa do MEI | cnpj |
| `serpro_pgmei_atualizar_beneficio` | Atualiza dados complementares do MEI | cnpj, dados |

### 1.4 Simples Nacional — PGDAS-D
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_pgdas_ultima` | Última declaração PGDAS-D disponível | cnpj |
| `serpro_pgdas_ano` | Todas as declarações de um ano | cnpj, ano |
| `serpro_pgdas_periodo` | Declaração de um período específico | cnpj, periodo |
| `serpro_pgdas_extrato` | Extrato detalhado do PGDAS-D | cnpj, periodo |
| `serpro_pgdas_transmitir` | Transmite declaração PGDAS-D via XML | cnpj, xml_declaracao |

### 1.5 Simples Nacional — DAS (boletos)
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_das_gerar` | Gera DAS do período | cnpj, periodo |
| `serpro_das_cobranca` | DAS de cobrança | cnpj, dados |
| `serpro_das_processo` | DAS de processo administrativo | cnpj, dados |
| `serpro_das_avulso` | DAS avulso | cnpj, dados |

### 1.6 Regime de Apuração
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_regime` | Regime do contribuinte em um ano (SN/LP/LR) | cnpj, ano |
| `serpro_regime_anos` | Todos os anos com opção de regime | cnpj |
| `serpro_regime_resolucao` | Pendências e impedimentos de regime | cnpj |

### 1.7 DEFIS
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_defis_consultar` | Lista todas as DEFIS entregues | cnpj |
| `serpro_defis_ultima` | Última DEFIS entregue | cnpj |
| `serpro_defis_periodo` | DEFIS de um período específico | cnpj, periodo |

### 1.8 DCTFWeb
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_dctfweb` | Declaração DCTFWeb completa por período | cnpj, periodo |
| `serpro_dctfweb_gerar_guia` | Gera guia de pagamento | cnpj, dados |
| `serpro_dctfweb_recibo` | Consulta recibo de transmissão | cnpj, dados |
| `serpro_dctfweb_xml` | Obtém XML da declaração | cnpj, dados |
| `serpro_dctfweb_transmitir` | Transmite declaração DCTFWeb | cnpj, dados |
| `serpro_dctfweb_guia_andamento` | Verifica andamento da guia | cnpj, dados |

### 1.9 MIT (Monitoramento Informações Tributárias)
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_mit_apuracoes` | Lista apurações de um ano | cnpj, ano |
| `serpro_mit_consultar` | Detalhes de uma apuração | cnpj, dados |
| `serpro_mit_encerrar` | Encerra apuração MIT | cnpj, dados |
| `serpro_mit_situacao_encerramento` | Status do encerramento | cnpj, dados |

### 1.10 eCAC — Domicílio e Caixa Postal
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_dte` | Situação do DTE (Domicílio Tributário Eletrônico) | cnpj |
| `serpro_caixapostal_indicador` | Há novas mensagens no eCAC? | cnpj |
| `serpro_caixapostal_mensagens` | Lista mensagens da caixa postal | cnpj |
| `serpro_caixapostal_detalhe` | Detalhe de uma mensagem específica | cnpj, dados |

### 1.11 Situação Fiscal Completa
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_sitfis` | Relatório completo RFB + PGFN (solicita protocolo e emite) ⚠️ 10–20s | cnpj |

### 1.12 Parcelamentos — Simples Nacional
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_parcsn_pedidos` | Lista pedidos de parcelamento SN | cnpj |
| `serpro_parcsn_parcelas` | Parcelas de um parcelamento SN | cnpj, dados |
| `serpro_parcsn_das` | Gera DAS de parcela SN | cnpj, dados |

### 1.13 Parcelamentos — MEI ⚠️ requer procuração no eCAC
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_parcmei_pedidos` | Lista pedidos de parcelamento MEI | cnpj |
| `serpro_parcmei_parcelas` | Parcelas de um parcelamento MEI | cnpj, dados |
| `serpro_parcmei_das` | Gera DAS de parcela MEI | cnpj, dados |

### 1.14 Procurações e Redesim
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_procuracoes` | Procurações outorgadas no eCAC | cnpj |
| `serpro_redesim_vinculos` | Vínculos do contabilista no Redesim | — |
| `serpro_redesim_renuncia_solicitar` | Solicita renúncia de vínculo | cnpj, dados |
| `serpro_redesim_renuncia_consultar` | Status da renúncia | cnpj |
| `serpro_redesim_renuncia_comprovante` | Comprovante de renúncia | cnpj, dados |

### 1.15 eProcesso
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_eprocesso` | Processos fiscais eletrônicos do contribuinte no eCAC | cnpj |

### 1.16 PagtoWeb — Histórico de Pagamentos
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_pagtoweb_pagamentos` | Lista pagamentos DARF/DAS/etc realizados | cnpj, data_inicio, data_fim |
| `serpro_pagtoweb_comprovante` | Comprovante de um pagamento específico | cnpj, numero_documento |
| `serpro_pagtoweb_conta_consolidada` | Conta consolidada de todos os pagamentos | cnpj |

### 1.17 SiCalc — DARF (tributos fora do Simples)
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_sicalc_apoio` | Tabelas e taxas SELIC para cálculo | cnpj, dados |
| `serpro_sicalc_darf` | Gera DARF (IRPJ, CSLL, PIS, COFINS...) | cnpj, dados |
| `serpro_sicalc_darf_codbarra` | Código de barras do DARF | cnpj, dados |

> **Dados mínimos sicalc_darf:** codigo_receita, periodo_apuracao (YYYY-MM-DD), valor_principal

### 1.18 Eventos Receita Federal (dados cadastrais PJ/PF)
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_eventos_pj_solicitar` | Solicita dados cadastrais PJ (retorna protocolo) | cnpj, evento |
| `serpro_eventos_pj_obter` | Obtém resultado PJ via protocolo | protocolo, evento |
| `serpro_eventos_pf_solicitar` | Solicita dados cadastrais PF (retorna protocolo) | cpf, evento |
| `serpro_eventos_pf_obter` | Obtém resultado PF via protocolo | protocolo, evento |

> ⚠️ Aguardar alguns segundos entre _solicitar e _obter

### 1.19 Gerenciador de Declarações
| Tool | Descrição | Params |
|------|-----------|--------|
| `serpro_gerenciador_xml` | Envia XML para o Gerenciador de Declarações da RFB | cnpj, dados |

---

## 2. NF-e / SEFAZ — Módulo com Certificado Digital

Integração direta com web services da RFB e SEFAZes estaduais.  
Usa o certificado A1 da APOYA — **válido apenas para CNPJ 43.507.838/0001-89 como destinatário.**  
Estados cobertos: SP, MG, RS, PR, BA, GO, AM, PE, MT, MS + SVRS/SVAN nacional.

**Como usar:** `skill apoya-serpro` ou módulo `nfe_sefaz.py`

| Tool | Descrição | Params |
|------|-----------|--------|
| `distribuicao_dfe_ultima_nsu` | Baixa NF-es recebidas a partir de um NSU (NSU=0 = todas) | ult_nsu |
| `distribuicao_dfe_por_chave` | Consulta NF-e específica pela chave de acesso (44 dígitos) | chave_nfe |
| `baixar_todos_xmls` | Baixa TODOS os XMLs de forma paginada | diretorio, nsu_inicial |
| `manifestar` | Registra manifestação do destinatário | chave_nfe, tipo, uf_emitente |
| `consultar_chave` | Consulta resumida de NF-e por chave | chave_nfe |
| `parse_xml_nfe` | Extrai campos estruturados de um XML de NF-e | xml_str |

**Tipos de Manifestação:**
| Tipo | Código | Quando usar |
|------|--------|-------------|
| ciencia | 210210 | Tomou ciência, mas ainda não confirmou o recebimento |
| confirmacao | 210200 | Confirma que a operação ocorreu conforme a NF-e |
| desconhecimento | 210220 | Não reconhece a operação — possível fraude ou erro |
| recusa | 210240 | Operação não realizada — requer motivo obrigatório |

---

## 3. Dossiê de Empresa — Inteligência Corporativa

Cruza dados de 10+ fontes. Custo: ~R$ 0,98 por dossiê completo.  
**Como usar:** `run_skill('dossie-empresa', 'CNPJ --mode full')`

| Modo | O que consulta | Custo |
|------|----------------|-------|
| full | Todas as fontes | ~R$ 0,98 |
| quick | Só cache local | R$ 0,00 |
| fiscal | RFB + PGFN + certidões | ~R$ 0,48 |
| sanctions | Sanções + listas negras internacionais | ~R$ 0,24 |
| comex | Comércio exterior (RADAR + MDIC) | ~R$ 0,48 |

**Fontes:**
| Fonte | O que retorna |
|-------|---------------|
| Receita Federal (Infosimples) | CNPJ completo, sócios, situação, CNAE, capital social |
| PGFN (Infosimples) | Inscrições em dívida ativa federal |
| SINTEGRA/SP (Infosimples) | Inscrição estadual SP e situação |
| CNDT (Infosimples) | Certidão de Débitos Trabalhistas |
| RADAR Siscomex (Infosimples) | Habilitação para comércio exterior e modalidade |
| CNPJ.WS | QSA completo, filiais, inscrições estaduais |
| DataJud CNJ | Processos judiciais públicos (todas as instâncias) |
| ComexStat MDIC | Histórico de importação/exportação por ano |
| OpenSanctions | Listas negras internacionais (OFAC, ONU, UE, etc.) |
| Portal Transparência | Contratos com o governo federal |
| BCB SFN | Registro no Sistema Financeiro Nacional |

---

## 4. Consulta CNPJ — Gratuita

**Como usar:** `run_skill('consulta-cnpj', '12.345.678/0001-90')`  
API publica.cnpj.ws — gratuita, sem autenticação, sem limite.  
Retorna: razão social, situação, endereço, CNAE, sócios, QSA, telefone, e-mail, capital social.

---

## 5. Gov-Contabil — Portais Governamentais com Certificado Digital

**Como usar:** `run_skill('gov-contabil', 'modulo CNPJ')`

| Tool | Descrição | Params |
|------|-----------|--------|
| cnpj | Dados cadastrais (3 fontes com fallback automático) | cnpj |
| simples | Situação no Simples Nacional / MEI | cnpj |
| certidao | Certidão Negativa de Débitos RF + PGFN | cnpj |
| das | Situação DAS + links de emissão | cnpj |
| fiscal | Relatório fiscal completo (tudo junto) | cnpj |
| ecac_sync | Sync autenticado eCAC ⚠️ janela 00h–08h BRT | — |

---

## 6. Busca de Processos Jurídicos

**Como usar:** `run_skill('busca-processos', 'CNPJ_ou_CPF')`  
Fontes: DataJud/CNJ, TJSP, TRTs. Monitora processos e notifica movimentações novas.

---

## ⚠️ Notas Importantes

- Tools de parcelamento MEI (`parcmei_*`) exigem procuração outorgada no eCAC pelo cliente
- `serpro_sitfis` é a tool mais pesada — pode levar **10–20 segundos**
- NF-e SEFAZ usa certificado A1 da APOYA — válido apenas para CNPJ 43.507.838/0001-89 como **destinatário**
- `ecac_sync` da gov-contabil só funciona entre **00h–08h BRT** (janela de autenticação do eCAC)
- Todos os PDFs retornam em **base64** — decodificar antes de salvar/exibir
- `serpro_eventos_pj/pf_solicitar`: aguardar alguns segundos antes de chamar `_obter`
- `serpro_sicalc_darf`: dados mínimos = `codigo_receita`, `periodo_apuracao` (YYYY-MM-DD), `valor_principal`

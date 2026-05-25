/**
 * Catálogo completo das 61 tools do MCP SERPRO.
 * Gateway: POST https://mcp.zapro.tech/mcp
 * Auth: Bearer apoya-mcp-serpro-2026
 *
 * Flags:
 *   requiresCert: exige certificado digital A1/A3 do cliente
 *   requiresProc: exige procuração digital outorgada no eCAC
 *   returnsPdf:   retorna base64 de PDF (precisa de viewer)
 *   isHeavy:      operação pesada / assíncrona (solicita protocolo)
 *   regimes:      regimes fiscais que podem usar esta tool
 */

export type FiscalRegime = "MEI" | "SIMPLES" | "LUCRO_PRESUMIDO" | "LUCRO_REAL" | "ISENTO" | "ALL";

export type SerproToolDef = {
  name: string;
  description: string;
  category: string;
  params: string[];
  requiresCert: boolean;
  requiresProc: boolean;
  returnsPdf?: boolean;
  isHeavy?: boolean;
  regimes: FiscalRegime[];
};

export const SERPRO_TOOLS: SerproToolDef[] = [
  // ── UTILITÁRIOS ────────────────────────────────────────────────────────
  {
    name: "serpro_status",
    description: "Status do gateway + autenticação SERPRO",
    category: "util",
    params: [],
    requiresCert: false,
    requiresProc: false,
    regimes: ["ALL"],
  },


  // ── NF-e CASCATA — busca automática multi-fonte ────────────────────────
  {
    name: "nfe_buscar_cascata",
    description: "Busca NF-e emitidas/recebidas do cliente com cascata automática de fontes (SEFAZ → SERPRO → Infosimples → NFE.io). Retorna camada_usada (1-4) e log_cascata.",
    category: "nfe",
    params: ["cnpj_cliente", "tipo"],
    requiresCert: false,
    requiresProc: false,
    regimes: ["ALL"],
  },
  // ── MEI — CCMEI e Cadastro ─────────────────────────────────────────────
  {
    name: "serpro_ccmei_emitir",
    description: "Emite CCMEI (PDF) do MEI",
    category: "mei",
    params: ["cnpj"],
    requiresCert: false,
    requiresProc: false,
    returnsPdf: true,
    regimes: ["MEI"],
  },
  {
    name: "serpro_ccmei_dados",
    description: "Dados cadastrais completos do MEI",
    category: "mei",
    params: ["cnpj"],
    requiresCert: false,
    requiresProc: false,
    regimes: ["MEI"],
  },
  {
    name: "serpro_ccmei_situacao",
    description: "Situação cadastral pelo CPF do titular",
    category: "mei",
    params: ["cpf"],
    requiresCert: false,
    requiresProc: false,
    regimes: ["MEI"],
  },

  // ── DAS MEI — Boletos e Dívidas ────────────────────────────────────────
  {
    name: "serpro_pgmei_das",
    description: "Gera código de barras do DAS MEI",
    category: "das_mei",
    params: ["cnpj", "periodo"],
    requiresCert: false,
    requiresProc: false,
    regimes: ["MEI"],
  },
  {
    name: "serpro_pgmei_das_pdf",
    description: "PDF do DAS MEI (base64)",
    category: "das_mei",
    params: ["cnpj", "periodo"],
    requiresCert: false,
    requiresProc: false,
    returnsPdf: true,
    regimes: ["MEI"],
  },
  {
    name: "serpro_pgmei_divida",
    description: "Consulta dívida ativa do MEI",
    category: "das_mei",
    params: ["cnpj"],
    requiresCert: false,
    requiresProc: false,
    regimes: ["MEI"],
  },
  {
    name: "serpro_pgmei_atualizar_beneficio",
    description: "Atualiza dados de benefício do MEI",
    category: "das_mei",
    params: ["cnpj", "dados"],
    requiresCert: false,
    requiresProc: true,
    regimes: ["MEI"],
  },

  // ── Simples Nacional — PGDAS ──────────────────────────────────────────
  {
    name: "serpro_pgdas_ultima",
    description: "Última declaração PGDAS-D disponível",
    category: "pgdas",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_pgdas_ano",
    description: "Todas as declarações PGDAS-D de um ano",
    category: "pgdas",
    params: ["cnpj", "ano"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_pgdas_periodo",
    description: "PGDAS-D de um período específico",
    category: "pgdas",
    params: ["cnpj", "periodo"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_pgdas_extrato",
    description: "Extrato PGDAS-D de um período",
    category: "pgdas",
    params: ["cnpj", "periodo"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_das_gerar",
    description: "Gera DAS do Simples Nacional",
    category: "pgdas",
    params: ["cnpj", "periodo"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_das_cobranca",
    description: "DAS de cobrança",
    category: "pgdas",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_das_processo",
    description: "DAS de processo administrativo",
    category: "pgdas",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_das_avulso",
    description: "DAS avulso",
    category: "pgdas",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_pgdas_transmitir",
    description: "Transmite declaração PGDAS-D via XML",
    category: "pgdas",
    params: ["cnpj", "xml_declaracao"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },

  // ── Regime de Apuração ────────────────────────────────────────────────
  {
    name: "serpro_regime",
    description: "Regime de apuração (Simples/Lucro Real/etc)",
    category: "regime",
    params: ["cnpj", "ano"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_regime_anos",
    description: "Lista todos os anos com opção de regime",
    category: "regime",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_regime_resolucao",
    description: "Resolução do regime de apuração",
    category: "regime",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },

  // ── Declarações — DEFIS ───────────────────────────────────────────────
  {
    name: "serpro_defis_consultar",
    description: "Lista todas as DEFIS do contribuinte",
    category: "declaracoes",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_defis_ultima",
    description: "Última DEFIS transmitida",
    category: "declaracoes",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_defis_periodo",
    description: "DEFIS de um período específico",
    category: "declaracoes",
    params: ["cnpj", "periodo"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },

  // ── DCTFWeb ───────────────────────────────────────────────────────────
  {
    name: "serpro_dctfweb",
    description: "Declaração DCTFWeb por período",
    category: "declaracoes",
    params: ["cnpj", "periodo"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES", "LUCRO_PRESUMIDO", "LUCRO_REAL"],
  },
  {
    name: "serpro_dctfweb_gerar_guia",
    description: "Gera guia de pagamento DCTFWeb",
    category: "declaracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES", "LUCRO_PRESUMIDO", "LUCRO_REAL"],
  },
  {
    name: "serpro_dctfweb_recibo",
    description: "Recibo de transmissão DCTFWeb",
    category: "declaracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES", "LUCRO_PRESUMIDO", "LUCRO_REAL"],
  },
  {
    name: "serpro_dctfweb_xml",
    description: "XML da DCTFWeb",
    category: "declaracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES", "LUCRO_PRESUMIDO", "LUCRO_REAL"],
  },
  {
    name: "serpro_dctfweb_transmitir",
    description: "Transmite DCTFWeb",
    category: "declaracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES", "LUCRO_PRESUMIDO", "LUCRO_REAL"],
  },
  {
    name: "serpro_dctfweb_guia_andamento",
    description: "Situação da guia DCTFWeb em andamento",
    category: "declaracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES", "LUCRO_PRESUMIDO", "LUCRO_REAL"],
  },

  // ── MIT ───────────────────────────────────────────────────────────────
  {
    name: "serpro_mit_apuracoes",
    description: "Apurações MIT de um ano",
    category: "declaracoes",
    params: ["cnpj", "ano"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_mit_consultar",
    description: "Consulta MIT específico",
    category: "declaracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_mit_encerrar",
    description: "Encerra MIT",
    category: "declaracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_mit_situacao_encerramento",
    description: "Situação do encerramento MIT",
    category: "declaracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },

  // ── eCAC — Domicílio e Caixa Postal ──────────────────────────────────
  {
    name: "serpro_dte",
    description: "Situação do DTE (Domicílio Tributário Eletrônico)",
    category: "ecac",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_caixapostal_indicador",
    description: "Indica se há novas mensagens no eCAC",
    category: "ecac",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_caixapostal_mensagens",
    description: "Lista mensagens da caixa postal eCAC",
    category: "ecac",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_caixapostal_detalhe",
    description: "Detalhe de uma mensagem eCAC",
    category: "ecac",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },

  // ── Situação Fiscal ───────────────────────────────────────────────────
  {
    name: "serpro_sitfis",
    description: "Situação fiscal completa PGFN + RFB (pesada — solicita protocolo)",
    category: "fiscal",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    isHeavy: true,
    regimes: ["ALL"],
  },

  // ── Parcelamentos ─────────────────────────────────────────────────────
  {
    name: "serpro_parcsn_pedidos",
    description: "Parcelamentos do Simples Nacional",
    category: "parcelamentos",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_parcsn_parcelas",
    description: "Parcelas de um parcelamento SN",
    category: "parcelamentos",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_parcsn_das",
    description: "DAS de parcelamento Simples Nacional",
    category: "parcelamentos",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["SIMPLES"],
  },
  {
    name: "serpro_parcmei_pedidos",
    description: "Parcelamentos MEI (exige procuração)",
    category: "parcelamentos",
    params: ["cnpj"],
    requiresCert: false,
    requiresProc: true,
    regimes: ["MEI"],
  },
  {
    name: "serpro_parcmei_parcelas",
    description: "Parcelas de um parcelamento MEI",
    category: "parcelamentos",
    params: ["cnpj", "dados"],
    requiresCert: false,
    requiresProc: true,
    regimes: ["MEI"],
  },
  {
    name: "serpro_parcmei_das",
    description: "DAS de parcelamento MEI",
    category: "parcelamentos",
    params: ["cnpj", "dados"],
    requiresCert: false,
    requiresProc: true,
    regimes: ["MEI"],
  },

  // ── Procurações e Redesim ─────────────────────────────────────────────
  {
    name: "serpro_procuracoes",
    description: "Procurações outorgadas no eCAC",
    category: "procuracoes",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: false,
    regimes: ["ALL"],
  },
  {
    name: "serpro_redesim_vinculos",
    description: "Vínculos do contabilista no Redesim",
    category: "procuracoes",
    params: [],
    requiresCert: false,
    requiresProc: false,
    regimes: ["ALL"],
  },
  {
    name: "serpro_redesim_renuncia_solicitar",
    description: "Solicita renúncia no Redesim",
    category: "procuracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: false,
    regimes: ["ALL"],
  },
  {
    name: "serpro_redesim_renuncia_consultar",
    description: "Consulta situação de renúncia",
    category: "procuracoes",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: false,
    regimes: ["ALL"],
  },
  {
    name: "serpro_redesim_renuncia_comprovante",
    description: "Comprovante de renúncia Redesim (PDF)",
    category: "procuracoes",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: false,
    returnsPdf: true,
    regimes: ["ALL"],
  },

  // ── e-Processo ────────────────────────────────────────────────────────
  {
    name: "serpro_eprocesso",
    description: "Processos administrativos do contribuinte",
    category: "processos",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },

  // ── PagtoWeb ──────────────────────────────────────────────────────────
  {
    name: "serpro_pagtoweb_pagamentos",
    description: "Histórico de pagamentos (DARFs, GNREs, etc.)",
    category: "pagamentos",
    params: ["cnpj", "data_inicio", "data_fim"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_pagtoweb_comprovante",
    description: "Comprovante de pagamento específico",
    category: "pagamentos",
    params: ["cnpj", "numero_documento"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_pagtoweb_conta_consolidada",
    description: "Conta consolidada de pagamentos",
    category: "pagamentos",
    params: ["cnpj"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },

  // ── Sicalc — DARF ─────────────────────────────────────────────────────
  {
    name: "serpro_sicalc_apoio",
    description: "Cálculo de acréscimos legais (Sicalc)",
    category: "darf",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_sicalc_darf",
    description: "Gera DARF via Sicalc",
    category: "darf",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_sicalc_darf_codbarra",
    description: "DARF com código de barras",
    category: "darf",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },

  // ── Eventos PJ/PF ─────────────────────────────────────────────────────
  {
    name: "serpro_eventos_pj_solicitar",
    description: "Solicita evento para PJ (assíncrono)",
    category: "eventos",
    params: ["cnpj", "evento"],
    requiresCert: true,
    requiresProc: true,
    isHeavy: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_eventos_pj_obter",
    description: "Obtém resultado de evento PJ por protocolo",
    category: "eventos",
    params: ["protocolo", "evento"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_eventos_pf_solicitar",
    description: "Solicita evento para PF (assíncrono)",
    category: "eventos",
    params: ["cpf", "evento"],
    requiresCert: true,
    requiresProc: true,
    isHeavy: true,
    regimes: ["ALL"],
  },
  {
    name: "serpro_eventos_pf_obter",
    description: "Obtém resultado de evento PF por protocolo",
    category: "eventos",
    params: ["protocolo", "evento"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },

  // ── Gerenciador XML ───────────────────────────────────────────────────
  {
    name: "serpro_gerenciador_xml",
    description: "Gerenciador de XMLs fiscais",
    category: "xml",
    params: ["cnpj", "dados"],
    requiresCert: true,
    requiresProc: true,
    regimes: ["ALL"],
  },
];

// ─── helpers de elegibilidade ──────────────────────────────────────────────

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

export function checkEligibility(
  toolName: string,
  cliente: {
    regime?: string | null;
    tem_certificado?: boolean;
    tem_procuracao?: boolean;
  },
): EligibilityResult {
  const tool = SERPRO_TOOLS.find((t) => t.name === toolName);
  if (!tool) return { eligible: false, reason: "Tool não encontrada no catálogo" };

  // Verificar regime
  if (!tool.regimes.includes("ALL")) {
    const regime = (cliente.regime ?? "").toUpperCase() as FiscalRegime;
    if (!tool.regimes.includes(regime)) {
      return {
        eligible: false,
        reason: `Esta consulta é exclusiva para ${tool.regimes.join(" / ")}. Cliente está no regime ${regime || "não informado"}.`,
      };
    }
  }

  // Verificar certificado
  if (tool.requiresCert && !cliente.tem_certificado) {
    return {
      eligible: false,
      reason: "Certificado digital (A1/A3) não cadastrado para este cliente. Acesse a aba 'Certificado & Procuração' no cadastro do cliente.",
    };
  }

  // Verificar procuração
  if (tool.requiresProc && !cliente.tem_procuracao) {
    return {
      eligible: false,
      reason: "Procuração eCAC não verificada para este cliente. O cliente precisa outorgar procuração no portal eCAC e você deve verificar na aba 'Certificado & Procuração'.",
    };
  }

  return { eligible: true };
}

// Agrupamento por categoria para a UI
export const SERPRO_CATEGORIES: Record<string, string> = {
  util: "Utilitários",
  mei: "MEI — CCMEI e Cadastro",
  das_mei: "DAS MEI — Boletos e Dívidas",
  pgdas: "Simples Nacional — PGDAS",
  regime: "Regime de Apuração",
  declaracoes: "Declarações (DEFIS / DCTFWeb / MIT)",
  ecac: "eCAC — Domicílio e Caixa Postal",
  fiscal: "Situação Fiscal",
  parcelamentos: "Parcelamentos",
  procuracoes: "Procurações e Redesim",
  processos: "e-Processo",
  nfe: "NF-e — Busca Multi-fonte",
  pagamentos: "PagtoWeb — Pagamentos",
  darf: "Sicalc — DARF",
  eventos: "Eventos PJ/PF",
  xml: "Gerenciador XML",
};

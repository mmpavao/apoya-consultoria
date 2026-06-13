/**
 * Catálogo completo das 61 tools do MCP SERPRO.
 * Gateway: POST https://mcp.zapro.tech/mcp
 * Auth: Bearer ${SERPRO_TOKEN}  ← lido de variável de ambiente
 *
 * SEGURANÇA: Nunca insira o valor do token neste arquivo.
 * Configurar via: wrangler secret put SERPRO_TOKEN (workers: apoya-gestao, apoya-mcp)
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
    description: "Busca NF-e emitidas/recebidas do cliente via SERPRO/SEFAZ. Para NFS-e, use a Focus NF-e via /api/nfse.",
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
];

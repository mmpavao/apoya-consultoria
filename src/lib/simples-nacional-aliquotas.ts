/**
 * simples-nacional-aliquotas.ts
 * Tabela oficial do Simples Nacional — Anexos I a V (LC 123/2006, atualizada 2018+)
 * Mapeamento CNAE → Anexo → código de serviço NFS-e + alíquota ISS por faixa
 *
 * Faixas de receita bruta acumulada (12 meses):
 *  1: até R$ 180.000,00
 *  2: R$ 180.000,01 a R$ 360.000,00
 *  3: R$ 360.000,01 a R$ 720.000,00
 *  4: R$ 720.000,01 a R$ 1.800.000,00
 *  5: R$ 1.800.000,01 a R$ 3.600.000,00
 *  6: R$ 3.600.000,01 a R$ 4.800.000,00
 */

export type AnexoSN = "I" | "II" | "III" | "IV" | "V" | "MEI";

// ─────────────────────────────────────────────────────────────────────────────
// Alíquotas efetivas nominais por Anexo e Faixa (%)
// Fonte: RFB — tabelas vigentes 2018+
// ─────────────────────────────────────────────────────────────────────────────
export const TABELA_SN: Record<AnexoSN, { faixaMax: number; aliquota: number; deducao: number }[]> = {
  MEI: [
    { faixaMax: 81_000,    aliquota: 0,   deducao: 0 }, // MEI: paga DAS fixo, não % receita
  ],
  I: [ // Comércio
    { faixaMax:   180_000, aliquota: 4.00,  deducao: 0 },
    { faixaMax:   360_000, aliquota: 7.30,  deducao: 5_940 },
    { faixaMax:   720_000, aliquota: 9.50,  deducao: 13_860 },
    { faixaMax: 1_800_000, aliquota: 10.70, deducao: 22_500 },
    { faixaMax: 3_600_000, aliquota: 14.30, deducao: 87_300 },
    { faixaMax: 4_800_000, aliquota: 19.00, deducao: 378_000 },
  ],
  II: [ // Indústria
    { faixaMax:   180_000, aliquota: 4.50,  deducao: 0 },
    { faixaMax:   360_000, aliquota: 7.80,  deducao: 5_940 },
    { faixaMax:   720_000, aliquota: 10.00, deducao: 13_860 },
    { faixaMax: 1_800_000, aliquota: 11.20, deducao: 22_500 },
    { faixaMax: 3_600_000, aliquota: 14.70, deducao: 85_500 },
    { faixaMax: 4_800_000, aliquota: 30.00, deducao: 720_000 },
  ],
  III: [ // Serviços I (baixa tributação ISS)
    { faixaMax:   180_000, aliquota: 6.00,  deducao: 0 },
    { faixaMax:   360_000, aliquota: 11.20, deducao: 9_360 },
    { faixaMax:   720_000, aliquota: 13.50, deducao: 17_640 },
    { faixaMax: 1_800_000, aliquota: 16.00, deducao: 35_640 },
    { faixaMax: 3_600_000, aliquota: 21.00, deducao: 125_640 },
    { faixaMax: 4_800_000, aliquota: 33.00, deducao: 648_000 },
  ],
  IV: [ // Serviços II (sem CPP — tributação maior)
    { faixaMax:   180_000, aliquota: 4.50,  deducao: 0 },
    { faixaMax:   360_000, aliquota: 9.00,  deducao: 8_100 },
    { faixaMax:   720_000, aliquota: 10.20, deducao: 12_420 },
    { faixaMax: 1_800_000, aliquota: 14.00, deducao: 39_780 },
    { faixaMax: 3_600_000, aliquota: 22.00, deducao: 183_780 },
    { faixaMax: 4_800_000, aliquota: 33.00, deducao: 828_000 },
  ],
  V: [ // Serviços III (profissionais liberais com fator r)
    { faixaMax:   180_000, aliquota: 15.50, deducao: 0 },
    { faixaMax:   360_000, aliquota: 18.00, deducao: 4_500 },
    { faixaMax:   720_000, aliquota: 19.50, deducao: 9_900 },
    { faixaMax: 1_800_000, aliquota: 20.50, deducao: 17_100 },
    { faixaMax: 3_600_000, aliquota: 23.00, deducao: 62_100 },
    { faixaMax: 4_800_000, aliquota: 30.50, deducao: 540_000 },
  ],
};

// Participação do ISS na alíquota por Anexo e Faixa (%)
// Fonte: partilha oficial RFB 2018+
const ISS_PARTICIPACAO: Record<AnexoSN, number[]> = {
  MEI:  [0],
  I:    [0, 0, 0, 0, 0, 0],
  II:   [0, 0, 0, 0, 0, 0],
  III:  [2.00, 2.00, 2.00, 2.00, 2.00, 2.00],
  IV:   [2.00, 2.00, 2.00, 2.00, 2.00, 2.00],
  V:    [2.00, 2.00, 2.50, 3.00, 3.50, 3.50],
};

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento CNAE (primeiros 4 dígitos) → Anexo + código de serviço LC 116
// ─────────────────────────────────────────────────────────────────────────────
export interface CnaeMapping {
  anexo: AnexoSN;
  codigoServico?: string;  // Código LC 116/2003
  descricaoServico?: string;
  issFixo?: number;        // ISS fixo municipal (quando aplicável, %)
}

// Mapeamento por CNAE completo (7 dígitos) ou prefixo (4 dígitos)
const CNAE_MAP: Record<string, CnaeMapping> = {
  // ── Advocacia ──────────────────────────────────────────────────────────────
  "6911": { anexo: "IV", codigoServico: "17.20", descricaoServico: "Serviços advocatícios" },
  "6911701": { anexo: "IV", codigoServico: "17.20", descricaoServico: "Serviços advocatícios" },
  "6911702": { anexo: "IV", codigoServico: "17.20", descricaoServico: "Atividades auxiliares da Justiça" },

  // ── Contabilidade ──────────────────────────────────────────────────────────
  "6920": { anexo: "III", codigoServico: "17.19", descricaoServico: "Contabilidade, assessoria tributária" },
  "6920601": { anexo: "III", codigoServico: "17.19", descricaoServico: "Atividades de contabilidade" },
  "6920602": { anexo: "III", codigoServico: "17.19", descricaoServico: "Auditoria e consultoria contábil/tributária" },

  // ── TI / Software / SaaS ───────────────────────────────────────────────────
  "6201": { anexo: "III", codigoServico: "01.07", descricaoServico: "Desenvolvimento de software" },
  "6202": { anexo: "III", codigoServico: "01.07", descricaoServico: "Desenvolvimento e licenciamento de software" },
  "6203": { anexo: "III", codigoServico: "01.07", descricaoServico: "Desenvolvimento e licenciamento de software" },
  "6209": { anexo: "III", codigoServico: "01.07", descricaoServico: "Suporte técnico em TI" },
  "6201500": { anexo: "III", codigoServico: "01.07", descricaoServico: "Desenvolvimento de programas de computador" },
  "6202300": { anexo: "III", codigoServico: "01.07", descricaoServico: "Desenvolvimento e licenciamento customizável" },
  "6203100": { anexo: "III", codigoServico: "01.07", descricaoServico: "Desenvolvimento de software sob encomenda" },
  "6209100": { anexo: "III", codigoServico: "01.07", descricaoServico: "Suporte técnico em tecnologia" },

  // ── Consultoria / Gestão ───────────────────────────────────────────────────
  "7020": { anexo: "III", codigoServico: "17.01", descricaoServico: "Assessoria e consultoria empresarial" },
  "7020400": { anexo: "III", codigoServico: "17.01", descricaoServico: "Consultoria em gestão empresarial" },

  // ── Medicina / Saúde ───────────────────────────────────────────────────────
  "8630": { anexo: "V", codigoServico: "04.01", descricaoServico: "Medicina e demais profissionais de saúde" },
  "8621": { anexo: "V", codigoServico: "04.01", descricaoServico: "UTI Móvel" },
  "8630301": { anexo: "V", codigoServico: "04.01", descricaoServico: "Atividade médica ambulatorial" },
  "8630302": { anexo: "V", codigoServico: "04.01", descricaoServico: "Atividade odontológica" },
  "8650": { anexo: "V", codigoServico: "04.02", descricaoServico: "Atividades de profissionais da saúde" },
  "8650001": { anexo: "V", codigoServico: "04.02", descricaoServico: "Enfermagem" },
  "8650002": { anexo: "V", codigoServico: "04.02", descricaoServico: "Fisioterapia" },
  "8650003": { anexo: "V", codigoServico: "04.02", descricaoServico: "Atividade de nutricionista" },
  "8650004": { anexo: "V", codigoServico: "04.02", descricaoServico: "Podologia" },
  "8650005": { anexo: "V", codigoServico: "04.02", descricaoServico: "Fonoaudiologia" },
  "8650006": { anexo: "V", codigoServico: "04.02", descricaoServico: "Terapia Ocupacional" },
  "8650099": { anexo: "V", codigoServico: "04.02", descricaoServico: "Atividades de profissionais de saúde" },
  "8660": { anexo: "V", codigoServico: "04.02", descricaoServico: "Atividades de apoio à gestão de saúde" },

  // ── Engenharia / Arquitetura ───────────────────────────────────────────────
  "7110": { anexo: "V", codigoServico: "07.01", descricaoServico: "Serviços de arquitetura e engenharia" },
  "7111": { anexo: "V", codigoServico: "07.01", descricaoServico: "Serviços de arquitetura" },
  "7112": { anexo: "V", codigoServico: "07.01", descricaoServico: "Serviços de engenharia" },
  "7119": { anexo: "V", codigoServico: "07.01", descricaoServico: "Atividades técnicas" },

  // ── Educação / Cursos ──────────────────────────────────────────────────────
  "8511": { anexo: "III", codigoServico: "08.01", descricaoServico: "Ensino fundamental" },
  "8512": { anexo: "III", codigoServico: "08.01", descricaoServico: "Ensino médio" },
  "8513": { anexo: "III", codigoServico: "08.01", descricaoServico: "Educação superior" },
  "8550": { anexo: "III", codigoServico: "08.01", descricaoServico: "Atividades de apoio à educação" },
  "8599": { anexo: "III", codigoServico: "08.01", descricaoServico: "Outras atividades de ensino" },

  // ── Publicidade / Marketing ────────────────────────────────────────────────
  "7311": { anexo: "III", codigoServico: "17.06", descricaoServico: "Agências de publicidade" },
  "7312": { anexo: "III", codigoServico: "17.06", descricaoServico: "Agenciamento de espaços em publicidade" },
  "7319": { anexo: "III", codigoServico: "17.06", descricaoServico: "Outras atividades de publicidade" },

  // ── Transporte / Logística ─────────────────────────────────────────────────
  "4921": { anexo: "III", codigoServico: "16.01", descricaoServico: "Transporte rodoviário de passageiros" },
  "4922": { anexo: "III", codigoServico: "16.01", descricaoServico: "Transporte rodoviário coletivo" },
  "4930": { anexo: "III", codigoServico: "16.01", descricaoServico: "Transporte rodoviário de carga" },

  // ── Comércio varejista ─────────────────────────────────────────────────────
  "4711": { anexo: "I", descricaoServico: "Comércio varejista" },
  "4712": { anexo: "I", descricaoServico: "Comércio varejista de mercadorias" },
  "4713": { anexo: "I", descricaoServico: "Lojas de departamentos" },

  // ── Construção civil ───────────────────────────────────────────────────────
  "4110": { anexo: "IV", codigoServico: "07.02", descricaoServico: "Incorporação de empreendimentos imobiliários" },
  "4120": { anexo: "IV", codigoServico: "07.02", descricaoServico: "Construção de edifícios" },
  "4321": { anexo: "IV", codigoServico: "07.05", descricaoServico: "Instalação elétrica" },

  // ── Serviços domésticos / outros ───────────────────────────────────────────
  "9700": { anexo: "III", codigoServico: "14.01", descricaoServico: "Serviços domésticos" },
  "8121": { anexo: "III", codigoServico: "25.01", descricaoServico: "Limpeza em prédios e domicílios" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Funções públicas
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna o Anexo do Simples Nacional para um CNAE */
export function getAnexoByCnae(cnae: string | number): CnaeMapping | null {
  const c = String(cnae).replace(/\D/g, "");
  // Tenta match exato (7 dígitos)
  if (CNAE_MAP[c]) return CNAE_MAP[c];
  // Tenta prefixo 4 dígitos
  const prefix4 = c.substring(0, 4);
  if (CNAE_MAP[prefix4]) return CNAE_MAP[prefix4];
  return null;
}

/**
 * Calcula alíquota efetiva do Simples Nacional.
 * @param anexo  Anexo I-V
 * @param receitaBruta12m  Receita bruta acumulada dos últimos 12 meses (R$)
 * @returns  { aliquotaNominal, aliquotaEfetiva, aliquotaISS, faixa }
 */
export function calcularAliquotaSN(
  anexo: AnexoSN,
  receitaBruta12m: number = 0
): {
  aliquotaNominal: number;
  aliquotaEfetiva: number;
  aliquotaISS: number;
  faixa: number;
  descricaoFaixa: string;
} {
  if (anexo === "MEI") {
    return { aliquotaNominal: 0, aliquotaEfetiva: 0, aliquotaISS: 0, faixa: 1, descricaoFaixa: "MEI — DAS fixo mensal" };
  }

  const tabela = TABELA_SN[anexo];
  let faixa = 0;
  for (let i = 0; i < tabela.length; i++) {
    if (receitaBruta12m <= tabela[i].faixaMax) { faixa = i; break; }
    if (i === tabela.length - 1)               { faixa = i; }
  }

  const { aliquota, deducao } = tabela[faixa];
  const rb = receitaBruta12m || 1;
  const aliquotaEfetiva = receitaBruta12m > 0
    ? ((rb * (aliquota / 100)) - deducao) / rb * 100
    : aliquota; // usa nominal se não tem receita

  const aliquotaISS = ISS_PARTICIPACAO[anexo][faixa] ?? 2.0;

  const LABELS = [
    "Faixa 1 (até R$ 180 mil)",
    "Faixa 2 (R$ 180 mil a R$ 360 mil)",
    "Faixa 3 (R$ 360 mil a R$ 720 mil)",
    "Faixa 4 (R$ 720 mil a R$ 1,8 mi)",
    "Faixa 5 (R$ 1,8 mi a R$ 3,6 mi)",
    "Faixa 6 (R$ 3,6 mi a R$ 4,8 mi)",
  ];

  return {
    aliquotaNominal: aliquota,
    aliquotaEfetiva: Math.round(aliquotaEfetiva * 100) / 100,
    aliquotaISS,
    faixa: faixa + 1,
    descricaoFaixa: LABELS[faixa] ?? `Faixa ${faixa + 1}`,
  };
}

/**
 * Auto-fill completo para o formulário de cadastro.
 * Recebe CNAE + regime + receita bruta e retorna os campos a preencher.
 */
export function autoFillFiscal(params: {
  cnae: string | number;
  regime: string;
  receitaBruta12m?: number;
}): {
  codigoServicoNfse?: string;
  aliquotaIss?: number;
  anexo?: AnexoSN;
  descricaoServico?: string;
  aliquotaEfetiva?: number;
  descricaoFaixa?: string;
} {
  const { cnae, regime, receitaBruta12m = 0 } = params;

  // Só aplica para Simples Nacional e MEI
  const regimeLow = regime.toLowerCase();
  if (!regimeLow.includes("simples") && !regimeLow.includes("mei")) {
    return {};
  }

  if (regimeLow.includes("mei")) {
    return { aliquotaIss: 5, descricaoFaixa: "MEI — ISS fixo" };
  }

  const mapping = getAnexoByCnae(cnae);
  if (!mapping) return {};

  const calculo = calcularAliquotaSN(mapping.anexo, receitaBruta12m);

  return {
    codigoServicoNfse: mapping.codigoServico,
    aliquotaIss:       Math.round(calculo.aliquotaISS * 100) / 100,
    anexo:             mapping.anexo,
    descricaoServico:  mapping.descricaoServico,
    aliquotaEfetiva:   calculo.aliquotaEfetiva,
    descricaoFaixa:    calculo.descricaoFaixa,
  };
}

/**
 * folha-calc — cálculo de folha de pagamento (CLT).
 *
 * ⚠️ AS ALÍQUOTAS/FAIXAS MUDAM TODO ANO. As tabelas abaixo são 2024/2025 e
 * DEVEM ser confirmadas com o Marcio para a vigência atual. O motor (lógica
 * progressiva) é coberto por testes; as CONSTANTES é que precisam de validação.
 *
 * Escopo v1: salário base + INSS (empregado) + IRRF + FGTS + INSS patronal.
 * Ainda NÃO trata: horas extras, adicionais (insalubridade/periculosidade),
 * vale-transporte/refeição, faltas, 13º. (próximas iterações)
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// INSS empregado — faixas progressivas (teto contribuição ≈ R$ 951,63)
export const INSS_FAIXAS = [
  { ate: 1518.00, aliq: 0.075 },
  { ate: 2793.88, aliq: 0.09 },
  { ate: 4190.83, aliq: 0.12 },
  { ate: 8157.41, aliq: 0.14 },
];

export function calcINSS(bruto: number): number {
  let inss = 0, anterior = 0;
  for (const f of INSS_FAIXAS) {
    if (bruto > f.ate) { inss += (f.ate - anterior) * f.aliq; anterior = f.ate; }
    else { inss += (bruto - anterior) * f.aliq; return round2(inss); }
  }
  return round2(inss); // acima do teto → contribuição máxima
}

// IRRF — base = bruto − INSS − (dependentes × dedução)
export const IRRF_DEDUCAO_DEPENDENTE = 189.59;
export const IRRF_FAIXAS = [
  { ate: 2259.20,   aliq: 0,     ded: 0 },
  { ate: 2826.65,   aliq: 0.075, ded: 169.44 },
  { ate: 3751.05,   aliq: 0.15,  ded: 381.44 },
  { ate: 4664.68,   aliq: 0.225, ded: 662.77 },
  { ate: Infinity,  aliq: 0.275, ded: 896.00 },
];

export function calcIRRF(bruto: number, inss: number, dependentes = 0): number {
  const base = bruto - inss - dependentes * IRRF_DEDUCAO_DEPENDENTE;
  const faixa = IRRF_FAIXAS.find(f => base <= f.ate) ?? IRRF_FAIXAS[IRRF_FAIXAS.length - 1];
  return round2(Math.max(0, base * faixa.aliq - faixa.ded));
}

export const FGTS_ALIQUOTA = 0.08;
export const INSS_PATRONAL_ALIQUOTA = 0.20; // patronal base (sem RAT/terceiros)

export interface FolhaFuncionario {
  bruto: number; inss: number; irrf: number;
  fgts: number; inssEmpresa: number;
  descontos: number; liquido: number;
}

export function calcFolhaFuncionario(salarioBase: number, dependentes = 0): FolhaFuncionario {
  const bruto = round2(salarioBase || 0);
  const inss = calcINSS(bruto);
  const irrf = calcIRRF(bruto, inss, dependentes);
  const fgts = round2(bruto * FGTS_ALIQUOTA);
  const inssEmpresa = round2(bruto * INSS_PATRONAL_ALIQUOTA);
  const descontos = round2(inss + irrf);
  const liquido = round2(bruto - descontos);
  return { bruto, inss, irrf, fgts, inssEmpresa, descontos, liquido };
}

export interface FolhaTotais {
  total_funcionarios: number;
  total_proventos: number;
  total_descontos: number;
  total_liquido: number;
  total_fgts: number;
  total_inss_empresa: number;
}

/** Agrega a folha de uma lista de funcionários (salario_base + dependentes). */
export function calcFolhaTotais(
  funcionarios: { salario_base: number; dependentes?: number | null }[],
): FolhaTotais {
  const acc: FolhaTotais = {
    total_funcionarios: funcionarios.length,
    total_proventos: 0, total_descontos: 0, total_liquido: 0,
    total_fgts: 0, total_inss_empresa: 0,
  };
  for (const f of funcionarios) {
    const r = calcFolhaFuncionario(f.salario_base, f.dependentes ?? 0);
    acc.total_proventos += r.bruto;
    acc.total_descontos += r.descontos;
    acc.total_liquido += r.liquido;
    acc.total_fgts += r.fgts;
    acc.total_inss_empresa += r.inssEmpresa;
  }
  acc.total_proventos    = round2(acc.total_proventos);
  acc.total_descontos    = round2(acc.total_descontos);
  acc.total_liquido      = round2(acc.total_liquido);
  acc.total_fgts         = round2(acc.total_fgts);
  acc.total_inss_empresa = round2(acc.total_inss_empresa);
  return acc;
}

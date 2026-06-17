/**
 * folha-calc — cálculo de folha de pagamento (CLT).
 *
 * TABELAS: VIGÊNCIA 2026 (verificadas em jun/2026). As alíquotas/faixas mudam
 * por ato do governo ~1×/ano — quando mudar, é trocar os números aqui (o agente
 * agente-tabelas-tributarias monitora e propõe a atualização com gate humano).
 * O motor (lógica progressiva + redutor) é coberto por testes.
 * Fontes: salário mínimo 2026 R$ 1.621; teto INSS R$ 8.475,55; IRRF Lei 15.270/2025.
 *
 * Escopo: salário base + INSS (empregado) + IRRF + FGTS + INSS patronal.
 * NÃO trata: horas extras, adicionais, VT/VR, faltas, 13º mensal.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const TABELA_COMPETENCIA = "2026";

// INSS empregado 2026 — faixas progressivas (teto contribuição R$ 988,09)
export const INSS_FAIXAS = [
  { ate: 1621.00, aliq: 0.075 },
  { ate: 2902.84, aliq: 0.09 },
  { ate: 4354.27, aliq: 0.12 },
  { ate: 8475.55, aliq: 0.14 },
];

export function calcINSS(bruto: number): number {
  let inss = 0, anterior = 0;
  for (const f of INSS_FAIXAS) {
    if (bruto > f.ate) { inss += (f.ate - anterior) * f.aliq; anterior = f.ate; }
    else { inss += (bruto - anterior) * f.aliq; return round2(inss); }
  }
  return round2(inss); // acima do teto → contribuição máxima
}

// IRRF 2026 — tabela base (mensal) + dedução por dependente
export const IRRF_DEDUCAO_DEPENDENTE = 189.59;
export const IRRF_FAIXAS = [
  { ate: 2428.80,   aliq: 0,     ded: 0 },
  { ate: 2826.65,   aliq: 0.075, ded: 182.16 },
  { ate: 3751.05,   aliq: 0.15,  ded: 394.16 },
  { ate: 4664.68,   aliq: 0.225, ded: 675.49 },
  { ate: Infinity,  aliq: 0.275, ded: 908.73 },
];

// Reforma 2026 (Lei 15.270/2025): isenção total até R$ 5.000; redução parcial
// decrescente de R$ 5.000,01 a R$ 7.350 (redutor = 978,62 − 0,133145 × bruto).
export const IRRF_ISENCAO_ATE = 5000;
export const IRRF_REDUTOR_TETO = 7350;

export function calcIRRF(bruto: number, inss: number, dependentes = 0): number {
  const base = bruto - inss - dependentes * IRRF_DEDUCAO_DEPENDENTE;
  const faixa = IRRF_FAIXAS.find(f => base <= f.ate) ?? IRRF_FAIXAS[IRRF_FAIXAS.length - 1];
  let imposto = Math.max(0, base * faixa.aliq - faixa.ded);
  if (bruto <= IRRF_ISENCAO_ATE) {
    imposto = 0;                                              // isento até 5.000
  } else if (bruto <= IRRF_REDUTOR_TETO) {
    imposto = Math.max(0, imposto - (978.62 - 0.133145 * bruto)); // redução parcial
  }
  return round2(imposto);
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

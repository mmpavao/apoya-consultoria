/**
 * rescisao-calc — cálculo de verbas rescisórias (CLT).
 *
 * ⚠️ ESTIMATIVA — confira sempre com a tabela/legislação vigente e o caso real.
 * Reusa as tabelas de INSS/IRRF de folha-calc (que precisam de validação anual).
 *
 * Cobre os tipos mais comuns. Simplificações documentadas:
 * - Saldo de salário: proporcional aos dias trabalhados no mês da demissão.
 * - 13º proporcional: meses trabalhados no ano (mês conta com ≥15 dias).
 * - Férias proporcionais + 1/3: meses do período aquisitivo em curso.
 * - Férias vencidas: 0 por padrão (não há registro de período aquisitivo
 *   completo não gozado no banco; pode ser informado).
 * - FGTS: se o saldo não for informado, ESTIMA 8% × salário × meses trabalhados
 *   (aproximação — o saldo real vem do extrato da Caixa).
 * - Multa FGTS 40%: só em dispensa sem justa causa.
 * - Aviso prévio: NÃO incluído (não há coluna no schema); tratar à parte.
 * - INSS/IRRF: incidência simplificada sobre saldo de salário + 13º.
 */
import { calcINSS, calcIRRF } from "./folha-calc";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// inclui os valores usados pela UI (DemissaoDialog) e variações
export type TipoRescisao =
  | "sem_justa_causa" | "pedido_demissao"
  | "justa_causa" | "com_justa_causa" | "termino_contrato";

/** Meses completos entre duas datas (conta o mês quando há ≥15 dias). */
export function mesesTrabalhados(ini: string, fim: string): number {
  const a = new Date(ini + "T12:00:00");
  const b = new Date(fim + "T12:00:00");
  if (b < a) return 0;
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() - a.getDate() >= 15) meses += 1;      // fração ≥15 dias = +1 mês
  return Math.max(0, meses);
}

export interface RescisaoInput {
  salarioBase: number;
  dependentes?: number;
  dataAdmissao: string;   // 'YYYY-MM-DD'
  dataDemissao: string;   // 'YYYY-MM-DD'
  tipo: TipoRescisao;
  feriasVencidas?: number;  // valor já apurado, se houver
  fgtsSaldo?: number;       // saldo real (extrato Caixa); senão estima
}

export interface RescisaoResultado {
  saldo_salario: number;
  decimo_proporcional: number;
  ferias_proporcionais: number;
  ferias_vencidas: number;
  fgts_saldo: number;
  multa_fgts: number;
  inss_desconto: number;
  irrf_desconto: number;
  total_bruto: number;
  total_liquido: number;
}

export function calcRescisao(input: RescisaoInput): RescisaoResultado {
  const salario = input.salarioBase || 0;
  const dep = input.dependentes ?? 0;
  const dem = new Date(input.dataDemissao + "T12:00:00");
  const semJusta = input.tipo === "sem_justa_causa";
  const justaCausa = input.tipo === "justa_causa" || input.tipo === "com_justa_causa";

  // Saldo de salário — dias trabalhados no mês da demissão
  const saldoSalario = round2((salario / 30) * dem.getDate());

  // 13º proporcional — meses no ano corrente (a partir da admissão se no mesmo ano)
  const inicioAno = `${dem.getFullYear()}-01-01`;
  const baseDecimo = input.dataAdmissao > inicioAno ? input.dataAdmissao : inicioAno;
  const mesesDecimo = Math.min(12, mesesTrabalhados(baseDecimo, input.dataDemissao));
  const decimoProporcional = justaCausa ? 0 : round2((salario / 12) * mesesDecimo);

  // Férias proporcionais + 1/3 — meses do período aquisitivo em curso (total % 12)
  const mesesTotais = mesesTrabalhados(input.dataAdmissao, input.dataDemissao);
  const mesesAquisitivo = mesesTotais % 12;
  const feriasProporcionais = justaCausa ? 0 : round2((salario / 12) * mesesAquisitivo * (4 / 3));

  const feriasVencidas = round2(input.feriasVencidas ?? 0);

  // FGTS: usa o saldo informado, senão estima 8% × salário × meses
  const fgtsSaldo = round2(input.fgtsSaldo ?? salario * 0.08 * mesesTotais);
  const multaFgts = semJusta ? round2(fgtsSaldo * 0.40) : 0;

  // Descontos — incidência simplificada sobre saldo + 13º
  const baseInss = saldoSalario + decimoProporcional;
  const inss = calcINSS(baseInss);
  const irrf = calcIRRF(baseInss, inss, dep);

  const totalBruto = round2(saldoSalario + decimoProporcional + feriasProporcionais + feriasVencidas + multaFgts);
  const totalLiquido = round2(totalBruto - inss - irrf);

  return {
    saldo_salario: saldoSalario,
    decimo_proporcional: decimoProporcional,
    ferias_proporcionais: feriasProporcionais,
    ferias_vencidas: feriasVencidas,
    fgts_saldo: fgtsSaldo,
    multa_fgts: multaFgts,
    inss_desconto: inss,
    irrf_desconto: irrf,
    total_bruto: totalBruto,
    total_liquido: totalLiquido,
  };
}

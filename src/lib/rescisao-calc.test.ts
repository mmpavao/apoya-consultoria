import { describe, it, expect } from "vitest";
import { mesesTrabalhados, calcRescisao } from "@/lib/rescisao-calc";
import { calcINSS, calcIRRF } from "@/lib/folha-calc";

describe("mesesTrabalhados", () => {
  it("conta meses completos", () => {
    expect(mesesTrabalhados("2025-01-10", "2025-07-10")).toBe(6);
  });
  it("fração ≥15 dias conta +1 mês", () => {
    expect(mesesTrabalhados("2025-01-01", "2025-03-20")).toBe(3); // 2 meses + 19 dias
  });
  it("fração <15 dias não conta", () => {
    expect(mesesTrabalhados("2025-01-01", "2025-03-10")).toBe(2);
  });
  it("fim antes do início → 0", () => {
    expect(mesesTrabalhados("2025-05-01", "2025-01-01")).toBe(0);
  });
});

describe("calcRescisao — sem justa causa", () => {
  const base = calcRescisao({
    salarioBase: 3000, dependentes: 0,
    dataAdmissao: "2024-01-15", dataDemissao: "2025-06-30",
    tipo: "sem_justa_causa",
  });
  it("saldo de salário proporcional aos dias", () => {
    expect(base.saldo_salario).toBeCloseTo(3000 / 30 * 30, 2); // dia 30
  });
  it("13º proporcional (6 meses no ano)", () => {
    expect(base.decimo_proporcional).toBeCloseTo(3000 / 12 * 6, 1);
  });
  it("férias proporcionais incluem 1/3", () => {
    expect(base.ferias_proporcionais).toBeGreaterThan(0);
  });
  it("multa FGTS 40% sobre o saldo (estimado)", () => {
    expect(base.multa_fgts).toBeCloseTo(base.fgts_saldo * 0.4, 2);
  });
  it("líquido = bruto - INSS - IRRF", () => {
    expect(base.total_liquido).toBeCloseTo(base.total_bruto - base.inss_desconto - base.irrf_desconto, 2);
  });
  it("13º tem tributação separada do saldo (bases distintas, não somadas)", () => {
    // INSS/IRRF do saldo e do 13º calculados em bases separadas (exclusiva na fonte)
    const inssSaldo  = calcINSS(base.saldo_salario);
    const inssDecimo = calcINSS(base.decimo_proporcional);
    const esperadoInss = Math.round((inssSaldo + inssDecimo + Number.EPSILON) * 100) / 100;
    expect(base.inss_desconto).toBeCloseTo(esperadoInss, 2);
    // e é MENOR que a base única (que empurraria a faixa)
    expect(base.inss_desconto).toBeLessThanOrEqual(calcINSS(base.saldo_salario + base.decimo_proporcional) + 0.01);
    const irrfSaldo  = calcIRRF(base.saldo_salario, inssSaldo, 0);
    const irrfDecimo = calcIRRF(base.decimo_proporcional, inssDecimo, 0);
    const esperadoIrrf = Math.round((irrfSaldo + irrfDecimo + Number.EPSILON) * 100) / 100;
    expect(base.irrf_desconto).toBeCloseTo(esperadoIrrf, 2);
  });
});

describe("calcRescisao — variações por tipo", () => {
  const args = { salarioBase: 3000, dataAdmissao: "2024-01-15", dataDemissao: "2025-06-30" } as const;
  it("pedido de demissão: SEM multa FGTS", () => {
    expect(calcRescisao({ ...args, tipo: "pedido_demissao" }).multa_fgts).toBe(0);
  });
  it("justa causa: sem 13º e sem férias proporcionais e sem multa", () => {
    const r = calcRescisao({ ...args, tipo: "justa_causa" });
    expect(r.decimo_proporcional).toBe(0);
    expect(r.ferias_proporcionais).toBe(0);
    expect(r.multa_fgts).toBe(0);
  });
  it("usa o saldo FGTS informado quando houver", () => {
    const r = calcRescisao({ ...args, tipo: "sem_justa_causa", fgtsSaldo: 1000 });
    expect(r.fgts_saldo).toBe(1000);
    expect(r.multa_fgts).toBeCloseTo(400, 2);
  });
});

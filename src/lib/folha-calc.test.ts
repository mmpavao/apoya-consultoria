import { describe, it, expect } from "vitest";
import { calcINSS, calcIRRF, calcFolhaFuncionario, calcFolhaTotais } from "@/lib/folha-calc";

describe("calcINSS (progressivo)", () => {
  it("1ª faixa (7,5%)", () => {
    expect(calcINSS(1500)).toBeCloseTo(112.5, 2);
  });
  it("faixas combinadas — salário 3000", () => {
    // 1518*0.075 + (2793.88-1518)*0.09 + (3000-2793.88)*0.12
    expect(calcINSS(3000)).toBeCloseTo(253.41, 2);
  });
  it("acima do teto → contribuição máxima ≈ 951,63", () => {
    expect(calcINSS(10000)).toBeCloseTo(951.63, 2);
    expect(calcINSS(8157.41)).toBeCloseTo(951.63, 2);
  });
});

describe("calcIRRF", () => {
  it("isento quando base ≤ 1ª faixa", () => {
    expect(calcIRRF(2000, calcINSS(2000), 0)).toBe(0);
  });
  it("salário 3000, 0 dependentes → ~36,55", () => {
    // base = 3000 - 253.41 = 2746.59 → 7,5% - 169,44
    expect(calcIRRF(3000, calcINSS(3000), 0)).toBeCloseTo(36.55, 2);
  });
  it("dependentes reduzem a base/imposto", () => {
    const semDep = calcIRRF(3000, calcINSS(3000), 0);
    const comDep = calcIRRF(3000, calcINSS(3000), 2);
    expect(comDep).toBeLessThan(semDep);
  });
  it("nunca negativo", () => {
    expect(calcIRRF(1000, calcINSS(1000), 5)).toBe(0);
  });
});

describe("calcFolhaFuncionario", () => {
  it("salário 3000 sem dependentes", () => {
    const r = calcFolhaFuncionario(3000, 0);
    expect(r.bruto).toBe(3000);
    expect(r.inss).toBeCloseTo(253.41, 2);
    expect(r.irrf).toBeCloseTo(36.55, 2);
    expect(r.fgts).toBeCloseTo(240, 2);          // 8%
    expect(r.inssEmpresa).toBeCloseTo(600, 2);   // 20%
    expect(r.liquido).toBeCloseTo(3000 - 253.41 - 36.55, 2);
  });
  it("salário 0 não quebra", () => {
    const r = calcFolhaFuncionario(0, 0);
    expect(r.liquido).toBe(0);
  });
});

describe("calcFolhaTotais", () => {
  it("agrega vários funcionários", () => {
    const t = calcFolhaTotais([
      { salario_base: 3000, dependentes: 0 },
      { salario_base: 1500, dependentes: 0 },
    ]);
    expect(t.total_funcionarios).toBe(2);
    expect(t.total_proventos).toBeCloseTo(4500, 2);
    expect(t.total_liquido).toBeLessThan(t.total_proventos);
    expect(t.total_fgts).toBeCloseTo(round2(4500 * 0.08), 2);
  });
  it("lista vazia → zeros", () => {
    const t = calcFolhaTotais([]);
    expect(t.total_funcionarios).toBe(0);
    expect(t.total_proventos).toBe(0);
  });
});

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

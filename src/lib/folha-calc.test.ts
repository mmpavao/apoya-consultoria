import { describe, it, expect } from "vitest";
import { calcINSS, calcIRRF, calcFolhaFuncionario, calcFolhaTotais } from "@/lib/folha-calc";

// Tabelas VIGÊNCIA 2026.

describe("calcINSS 2026 (progressivo)", () => {
  it("1ª faixa (7,5%)", () => {
    expect(calcINSS(1500)).toBeCloseTo(112.5, 2);
  });
  it("faixas combinadas — salário 3000", () => {
    // 1621*0.075 + (2902.84-1621)*0.09 + (3000-2902.84)*0.12
    expect(calcINSS(3000)).toBeCloseTo(248.60, 2);
  });
  it("acima do teto → contribuição máxima R$ 988,09", () => {
    expect(calcINSS(10000)).toBeCloseTo(988.09, 2);
    expect(calcINSS(8475.55)).toBeCloseTo(988.09, 2);
  });
});

describe("calcIRRF 2026 (com redutor da reforma)", () => {
  it("isento até R$ 5.000 (reforma Lei 15.270/2025)", () => {
    expect(calcIRRF(3000, calcINSS(3000), 0)).toBe(0);
    expect(calcIRRF(5000, calcINSS(5000), 0)).toBe(0);
  });
  it("redução parcial entre 5.000 e 7.350 — salário 6000", () => {
    // base 5358.49 → 27,5% - 908,73 = 564,85; redutor 978,62 - 0,133145*6000 = 179,75
    expect(calcIRRF(6000, calcINSS(6000), 0)).toBeCloseTo(385.10, 1);
  });
  it("acima de 7.350 → tributação cheia (sem redutor)", () => {
    // salário 8000: imposto base ~1037,85, sem redutor
    expect(calcIRRF(8000, calcINSS(8000), 0)).toBeCloseTo(1037.85, 1);
  });
  it("dependentes reduzem o imposto (faixa tributável)", () => {
    const semDep = calcIRRF(8000, calcINSS(8000), 0);
    const comDep = calcIRRF(8000, calcINSS(8000), 3);
    expect(comDep).toBeLessThan(semDep);
  });
  it("nunca negativo", () => {
    expect(calcIRRF(1000, calcINSS(1000), 5)).toBe(0);
  });
});

describe("calcFolhaFuncionario 2026", () => {
  it("salário 3000 sem dependentes (isento de IRRF)", () => {
    const r = calcFolhaFuncionario(3000, 0);
    expect(r.bruto).toBe(3000);
    expect(r.inss).toBeCloseTo(248.60, 2);
    expect(r.irrf).toBe(0);
    expect(r.fgts).toBeCloseTo(240, 2);          // 8%
    expect(r.inssEmpresa).toBeCloseTo(600, 2);   // 20%
    expect(r.liquido).toBeCloseTo(3000 - 248.60, 2);
  });
  it("salário 0 não quebra", () => {
    expect(calcFolhaFuncionario(0, 0).liquido).toBe(0);
  });
});

describe("calcFolhaTotais 2026", () => {
  it("agrega vários funcionários", () => {
    const t = calcFolhaTotais([
      { salario_base: 3000, dependentes: 0 },
      { salario_base: 1500, dependentes: 0 },
    ]);
    expect(t.total_funcionarios).toBe(2);
    expect(t.total_proventos).toBeCloseTo(4500, 2);
    expect(t.total_fgts).toBeCloseTo(360, 2);     // 8% de 4500
    expect(t.total_liquido).toBeLessThan(t.total_proventos);
  });
  it("lista vazia → zeros", () => {
    const t = calcFolhaTotais([]);
    expect(t.total_funcionarios).toBe(0);
    expect(t.total_proventos).toBe(0);
  });
});

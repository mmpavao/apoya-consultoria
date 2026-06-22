import { describe, it, expect } from "vitest";
import { substituirPlaceholders } from "./contrato-placeholders";

describe("substituirPlaceholders", () => {
  it("substitui placeholders do template de prestação de serviços", () => {
    const html =
      "<p>CONTRATANTE: [RAZÃO SOCIAL CLIENTE], CNPJ [CNPJ/CPF CLIENTE], honorários R$ [VALOR], dia [DIA VENCIMENTO]</p>";
    const result = substituirPlaceholders(html, {
      cliente: {
        razaoSocial: "Empresa Teste LTDA",
        cnpj: "12.345.678/0001-90",
        valorHonorario: 450,
        diaVencimento: 15,
      },
      escritorio: { razaoSocial: "APOYA Contábil", cnpj: "98.765.432/0001-11", diaCobranca: 10 },
      dataInicio: "2026-01-15",
    });
    expect(result).toContain("Empresa Teste LTDA");
    expect(result).toContain("12.345.678/0001-90");
    expect(result).toContain("450,00");
    expect(result).toContain("15");
    expect(result).not.toContain("[VALOR]");
  });
});

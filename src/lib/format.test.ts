import { describe, it, expect } from "vitest";
import { fmtBRL, fmtDate, fmtDateTime } from "@/lib/format";

describe("fmtBRL", () => {
  it("formata valor em BRL", () => {
    expect(fmtBRL(1234.5)).toMatch(/R\$\s?1\.234,50/);
  });
  it("formata zero", () => {
    expect(fmtBRL(0)).toMatch(/R\$\s?0,00/);
  });
  it("retorna — para null/undefined/NaN", () => {
    expect(fmtBRL(null)).toBe("—");
    expect(fmtBRL(undefined)).toBe("—");
    expect(fmtBRL(NaN)).toBe("—");
  });
});

describe("fmtDate", () => {
  it("formata 'YYYY-MM-DD' sem voltar 1 dia por fuso", () => {
    expect(fmtDate("2026-06-15")).toBe("15/06/2026");
  });
  it("aceita ISO completo", () => {
    expect(fmtDate("2026-06-15T03:00:00Z")).toMatch(/\d{2}\/\d{2}\/2026/);
  });
  it("retorna — para vazio/inválido", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate("")).toBe("—");
    expect(fmtDate("nao-e-data")).toBe("—");
  });
});

describe("fmtDateTime", () => {
  it("retorna — para vazio/inválido", () => {
    expect(fmtDateTime(null)).toBe("—");
    expect(fmtDateTime("")).toBe("—");
  });
  it("formata uma data válida", () => {
    expect(fmtDateTime("2026-06-15T13:30:00")).toMatch(/15\/06\/2026/);
  });
});

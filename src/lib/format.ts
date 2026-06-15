/**
 * Formatadores compartilhados — FONTE ÚNICA.
 * Antes duplicados (com pequenas variações) em ~30 arquivos; consolidados aqui.
 */

const BRL = { style: "currency", currency: "BRL" } as const;

/** Valor monetário em BRL. null/undefined/NaN → "—". */
export function fmtBRL(v?: number | null): string {
  return v != null && !Number.isNaN(v) ? v.toLocaleString("pt-BR", BRL) : "—";
}

/**
 * Data (sem hora). Aceita 'YYYY-MM-DD' (ancora ao meio-dia local p/ não voltar
 * 1 dia por fuso) ou ISO completo. Falsy/ inválida → "—".
 */
export function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00` : d;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
}

/** Data + hora. Falsy/ inválida → "—". */
export function fmtDateTime(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR");
}

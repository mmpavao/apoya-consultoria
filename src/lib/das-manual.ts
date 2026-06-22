/**
 * Operações manuais de DAS — CRUD direto no Supabase (sem SERPRO/API).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "@/hooks/use-clientes";

function vencimentoPadrao(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  return new Date(y, m, 20).toISOString().split("T")[0];
}

export async function criarGuiasDoMes(
  competencia: string,
  clientes: Cliente[],
  guiasExistentes: { clienteId: string; competencia: string }[],
): Promise<{ criadas: number; error?: string }> {
  const elegiveis = clientes.filter(
    c => c.regime && ["MEI", "Simples"].includes(c.regime) && c.status === "ativo",
  );
  const existentes = new Set(
    guiasExistentes
      .filter(g => g.competencia === competencia)
      .map(g => g.clienteId),
  );
  const novos = elegiveis.filter(c => !existentes.has(c.id));
  if (!novos.length) return { criadas: 0 };

  const venc = vencimentoPadrao(competencia);
  const rows = novos.map(c => ({
    cliente_id:   c.id,
    cliente_nome: c.razaoSocial,
    cnpj:         c.cnpj ?? "",
    regime:       c.regime ?? "—",
    tipo:         c.regime === "MEI" ? "DASMEI" : "DAS",
    competencia,
    vencimento:   venc,
    valor:        0,
    status:       "pendente",
  }));

  const { error } = await supabase.from("das_guias").insert(rows);
  if (error) return { criadas: 0, error: error.message };
  window.dispatchEvent(new Event("apoya:das:changed"));
  return { criadas: rows.length };
}

export async function marcarDasComoGerada(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("das_guias")
    .update({ status: "gerada" })
    .eq("id", id);
  if (!error) window.dispatchEvent(new Event("apoya:das:changed"));
  return !error;
}

export async function marcarDasLoteComoGeradas(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { error } = await supabase
    .from("das_guias")
    .update({ status: "gerada" })
    .in("id", ids);
  if (!error) window.dispatchEvent(new Event("apoya:das:changed"));
  return error ? 0 : ids.length;
}

/**
 * Hook: useSocios
 * Gerencia o quadro societário de um cliente (tabela cliente_socio).
 * Cadastro 100% manual.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Socio {
  id: string;
  clienteId: string;
  nome: string;
  cpf?: string;
  cnpjCpfSocio?: string;
  tipoSocio: "pf" | "pj";
  qualificacao?: string;
  codigoQualificacao?: number;
  percentual?: number;
  capitalSubscrito?: number;
  capitalIntegralizado?: number;
  dataEntrada?: string;
  dataSaida?: string;
  nomeRepresentante?: string;
  cpfRepresentante?: string;
  qualificacaoRepresentante?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  isAdministrador: boolean;
  isAtivo: boolean;
  createdAt: string;
}

function fromDb(row: Record<string, unknown>): Socio {
  return {
    id:                       row.id as string,
    clienteId:                row.cliente_id as string,
    nome:                     row.nome as string,
    cpf:                      row.cpf as string | undefined,
    cnpjCpfSocio:             row.cnpj_cpf_socio as string | undefined,
    tipoSocio:                (row.tipo_socio as string ?? "pf") as "pf" | "pj",
    qualificacao:             row.qualificacao as string | undefined,
    codigoQualificacao:       row.codigo_qualificacao as number | undefined,
    percentual:               row.percentual !== null ? Number(row.percentual) : undefined,
    capitalSubscrito:         row.capital_subscrito !== null ? Number(row.capital_subscrito) : undefined,
    capitalIntegralizado:     row.capital_integralizado !== null ? Number(row.capital_integralizado) : undefined,
    dataEntrada:              row.data_entrada as string | undefined,
    dataSaida:                row.data_saida as string | undefined,
    nomeRepresentante:        row.nome_representante as string | undefined,
    cpfRepresentante:         row.cpf_representante as string | undefined,
    qualificacaoRepresentante: row.qualificacao_representante as string | undefined,
    email:                    row.email as string | undefined,
    telefone:                 row.telefone as string | undefined,
    whatsapp:                 row.whatsapp as string | undefined,
    isAdministrador:          row.is_administrador as boolean,
    isAtivo:                  row.is_ativo as boolean,
    createdAt:                row.created_at as string,
  };
}

// ── Hook principal ──────────────────────────────────────────────────
export function useSocios(clienteId: string | null) {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("cliente_socio")
        .select("*")
        .eq("cliente_id", clienteId)
        .eq("is_ativo", true)
        .order("percentual", { ascending: false });

      if (error) throw error;
      setSocios((data ?? []).map(fromDb));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar sócios";
      setError(msg);
      console.error("useSocios load:", e);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  const upsert = useCallback(async (data: Partial<Socio> & { clienteId: string }) => {
    const row = {
      cliente_id:               data.clienteId,
      nome:                     data.nome,
      cpf:                      data.cpf,
      cnpj_cpf_socio:           data.cnpjCpfSocio,
      tipo_socio:               data.tipoSocio ?? "pf",
      qualificacao:             data.qualificacao,
      codigo_qualificacao:      data.codigoQualificacao,
      percentual:               data.percentual,
      capital_subscrito:        data.capitalSubscrito,
      capital_integralizado:    data.capitalIntegralizado,
      data_entrada:             data.dataEntrada,
      nome_representante:       data.nomeRepresentante,
      cpf_representante:        data.cpfRepresentante,
      qualificacao_representante: data.qualificacaoRepresentante,
      email:                    data.email,
      telefone:                 data.telefone,
      whatsapp:                 data.whatsapp,
      is_administrador:         data.isAdministrador ?? false,
      is_ativo:                 true,
    };

    if (data.id) {
      const { error } = await (supabase as any)
        .from("cliente_socio")
        .update(row)
        .eq("id", data.id);
      if (error) { toast.error("Erro ao atualizar sócio"); return false; }
    } else {
      const { error } = await (supabase as any)
        .from("cliente_socio")
        .insert(row);
      if (error) { toast.error("Erro ao adicionar sócio"); return false; }
    }
    await load();
    return true;
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("cliente_socio")
      .update({ is_ativo: false })
      .eq("id", id);
    if (error) { toast.error("Erro ao remover sócio"); return; }
    await load();
  }, [load]);

  return { socios, loading, error, load, upsert, remove };
}

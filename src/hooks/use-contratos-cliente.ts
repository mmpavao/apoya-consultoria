/**
 * use-contratos-cliente — Contratos de prestação de serviços
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ContratoCliente = {
  id: string;
  cliente_id: string;
  numero?: string;
  titulo: string;
  tipo: "mensalidade" | "avulso" | "anual";
  status: "rascunho" | "aguardando_assinatura" | "ativo" | "encerrado" | "cancelado";
  valor_total: number;
  data_inicio: string;
  data_fim?: string;
  corpo_html?: string;
  clausulas: object[];
  servicos_ids: string[];
  clicksign_key?: string;
  clicksign_status?: string;
  clicksign_url?: string;
  assinado_em?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
};

export function useContratosCliente(clienteId: string) {
  const [contratos, setContratos] = useState<ContratoCliente[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("contrato_cliente")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar contratos"); setLoading(false); return; }
    setContratos((data ?? []) as ContratoCliente[]);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  const criar = useCallback(async (payload: Partial<ContratoCliente>) => {
    const { data, error } = await supabase
      .from("contrato_cliente")
      .insert({ ...payload, cliente_id: clienteId })
      .select()
      .single();
    if (error) { toast.error("Erro ao criar contrato"); throw error; }
    toast.success("Contrato criado!");
    await load();
    return data as ContratoCliente;
  }, [clienteId, load]);

  const atualizar = useCallback(async (id: string, payload: Partial<ContratoCliente>) => {
    const { error } = await supabase
      .from("contrato_cliente")
      .update(payload)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar contrato"); throw error; }
    toast.success("Contrato atualizado!");
    await load();
  }, [load]);

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("contrato_cliente")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Erro ao excluir contrato"); throw error; }
    toast.success("Contrato excluído.");
    await load();
  }, [load]);

  const atualizarStatus = useCallback(async (id: string, status: ContratoCliente["status"]) => {
    await atualizar(id, { status });
  }, [atualizar]);

  return { contratos, loading, reload: load, criar, atualizar, excluir, atualizarStatus };
}

/**
 * use-servicos — Catálogo global de serviços + serviços contratados por cliente
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Tipos ──────────────────────────────────────────────────────────────────

export type ServicoCatalogo = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  categoria: "mensal" | "avulso" | "anual" | "eventual";
  tipo: "servico" | "imposto" | "taxa";
  valor_padrao: number;
  unidade: "mensal" | "anual" | "avulso" | "hora";
  requer_contrato: boolean;
  requer_nota: boolean;
  ativo: boolean;
  ordem: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ClienteServico = {
  id: string;
  cliente_id: string;
  catalogo_id: string;
  nome_servico: string;
  valor_contratado: number;
  desconto: number;
  valor_final: number;
  periodicidade: "mensal" | "anual" | "avulso";
  data_inicio: string;
  data_fim?: string;
  status: "ativo" | "suspenso" | "encerrado" | "cancelado";
  observacoes?: string;
  created_at: string;
  // join
  catalogo?: ServicoCatalogo;
};

export type ServicoPagamento = {
  id: string;
  cliente_servico_id: string;
  cliente_id: string;
  competencia: string;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  forma_pagamento?: string;
  observacoes?: string;
  created_at: string;
  // join
  cliente_servico?: ClienteServico;
};

// ── Hook: Catálogo global ─────────────────────────────────────────────────

export function useServicoCatalogo() {
  const [servicos, setServicos] = useState<ServicoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("servico_catalogo")
      .select("*")
      .order("ordem", { ascending: true });
    if (error) { toast.error("Erro ao carregar catálogo"); setLoading(false); return; }
    setServicos(data as ServicoCatalogo[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const criar = useCallback(async (payload: Partial<ServicoCatalogo>) => {
    const { data, error } = await (supabase as any)
      .from("servico_catalogo")
      .insert(payload)
      .select()
      .single();
    if (error) { toast.error("Erro ao criar serviço"); throw error; }
    toast.success("Serviço criado!");
    await load();
    return data as ServicoCatalogo;
  }, [load]);

  const atualizar = useCallback(async (id: string, payload: Partial<ServicoCatalogo>) => {
    const { error } = await supabase
      .from("servico_catalogo")
      .update(payload)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar serviço"); throw error; }
    toast.success("Serviço atualizado!");
    await load();
  }, [load]);

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase
      .from("servico_catalogo")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Não foi possível excluir. Verifique se há contratos vinculados."); throw error; }
    toast.success("Serviço removido.");
    await load();
  }, [load]);

  const toggleAtivo = useCallback(async (id: string, ativo: boolean) => {
    await atualizar(id, { ativo });
  }, [atualizar]);

  return { servicos, loading, reload: load, criar, atualizar, excluir, toggleAtivo };
}

// ── Hook: Serviços de um cliente ──────────────────────────────────────────

export function useClienteServicos(clienteId: string) {
  const [servicos, setServicos] = useState<ClienteServico[]>([]);
  const [pagamentos, setPagamentos] = useState<ServicoPagamento[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    const [{ data: sv }, { data: pg }] = await Promise.all([
      supabase
        .from("cliente_servico")
        .select("*, catalogo:catalogo_id(*)")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false }),
      supabase
        .from("servico_pagamento")
        .select("*, cliente_servico:cliente_servico_id(nome_servico, periodicidade)")
        .eq("cliente_id", clienteId)
        .order("data_vencimento", { ascending: false }),
    ]);
    setServicos((sv ?? []) as ClienteServico[]);
    setPagamentos((pg ?? []) as unknown as ServicoPagamento[]);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  const contratar = useCallback(async (payload: {
    catalogo_id: string;
    nome_servico: string;
    valor_contratado: number;
    desconto?: number;
    periodicidade: "mensal" | "anual" | "avulso";
    data_inicio: string;
    data_fim?: string;
    observacoes?: string;
  }) => {
    const { data, error } = await supabase
      .from("cliente_servico")
      .insert({ ...payload, cliente_id: clienteId, desconto: payload.desconto ?? 0, valor_final: (payload.valor_contratado - (payload.desconto ?? 0)), status: "ativo" })
      .select()
      .single();
    if (error) { toast.error("Erro ao contratar serviço"); throw error; }
    toast.success("Serviço contratado!");
    await load();
    return data as ClienteServico;
  }, [clienteId, load]);

  const encerrarServico = useCallback(async (id: string, status: ClienteServico["status"]) => {
    const { error } = await supabase
      .from("cliente_servico")
      .update({ status })
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar serviço"); throw error; }
    toast.success("Serviço atualizado!");
    await load();
  }, [load]);

  const registrarPagamento = useCallback(async (payload: {
    cliente_servico_id: string;
    competencia: string;
    valor: number;
    data_vencimento: string;
    data_pagamento?: string;
    status: ServicoPagamento["status"];
    forma_pagamento?: string;
    observacoes?: string;
  }) => {
    const { error } = await supabase
      .from("servico_pagamento")
      .insert({ ...payload, cliente_id: clienteId });
    if (error) { toast.error("Erro ao registrar pagamento"); throw error; }
    toast.success("Pagamento registrado!");
    await load();
  }, [clienteId, load]);

  const atualizarPagamento = useCallback(async (id: string, payload: Partial<ServicoPagamento>) => {
    const { error } = await (supabase as any)
      .from("servico_pagamento")
      .update(payload)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar pagamento"); throw error; }
    toast.success("Pagamento atualizado!");
    await load();
  }, [load]);

  return {
    servicos, pagamentos, loading, reload: load,
    contratar, encerrarServico, registrarPagamento, atualizarPagamento,
  };
}

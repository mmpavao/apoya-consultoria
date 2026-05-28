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
  cliente_servico?: ClienteServico;
};

// ── Helper: pega token da sessão atual ────────────────────────────────────

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

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
      .from("servico_catalogo").insert(payload).select().single();
    if (error) { toast.error("Erro ao criar serviço"); throw error; }
    toast.success("Serviço criado!");
    await load();
    return data as ServicoCatalogo;
  }, [load]);

  const atualizar = useCallback(async (id: string, payload: Partial<ServicoCatalogo>) => {
    const { error } = await supabase.from("servico_catalogo").update(payload).eq("id", id);
    if (error) { toast.error("Erro ao atualizar serviço"); throw error; }
    toast.success("Serviço atualizado!");
    await load();
  }, [load]);

  const excluir = useCallback(async (id: string) => {
    const { error } = await supabase.from("servico_catalogo").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir serviço"); throw error; }
    toast.success("Serviço excluído!");
    await load();
  }, [load]);

  return { servicos, loading, criar, atualizar, excluir, reload: load };
}

// ── Hook: Serviços de um cliente ──────────────────────────────────────────

export function useClienteServicos(clienteId: string) {
  const [servicos, setServicos] = useState<ClienteServico[]>([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("cliente_servico")
      .select("*, catalogo:catalogo_id(*)")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) { toast.error("Erro ao carregar serviços"); setLoading(false); return; }
    setServicos(data as ClienteServico[]);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  /** Contrata um serviço — usa rota de servidor para bypassar RLS */
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
    const token = await getToken();
    const res = await fetch("/api/cobranca/contratar-servico", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ cliente_id: clienteId, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error("Erro ao contratar: " + (data.error ?? res.statusText)); throw new Error(data.error); }
    toast.success("Serviço contratado!");
    await load();
    return data.cliente_servico as ClienteServico;
  }, [clienteId, load]);

  const encerrarServico = useCallback(async (id: string, status: ClienteServico["status"]) => {
    const { error } = await supabase.from("cliente_servico").update({ status }).eq("id", id);
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
    const { error } = await (supabase as any)
      .from("servico_pagamento")
      .insert({ ...payload, cliente_id: clienteId });
    if (error) { toast.error("Erro ao registrar pagamento"); throw error; }
    toast.success("Pagamento registrado!");
    await load();
  }, [clienteId, load]);

  // Pagamentos dos serviços
  const [pagamentos, setPagamentos] = useState<ServicoPagamento[]>([]);
  const loadPagamentos = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("servico_pagamento")
      .select("*, cliente_servico:cliente_servico_id(*)")
      .eq("cliente_id", clienteId)
      .order("data_vencimento", { ascending: false });
    setPagamentos(data ?? []);
  }, [clienteId]);
  useEffect(() => { loadPagamentos(); }, [loadPagamentos]);

  return { servicos, pagamentos, loading, contratar, encerrarServico, registrarPagamento, reload: load };
}

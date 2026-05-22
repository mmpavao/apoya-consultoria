/**
 * Hook dedicado para buscar um único cliente por ID
 * Independente do useClientes() global — não usa realtime
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "./use-clientes";

// Re-exportar fromDb do use-clientes
function fromDb(r: Record<string, unknown>): Cliente {
  return {
    id:                  r.id as string,
    razaoSocial:         r.razao_social as string,
    nomeFantasia:        r.nome_fantasia as string | undefined,
    cnpj:                r.cnpj as string,
    regime:              r.regime as any,
    status:              r.status as any,
    responsavel:         r.responsavel as string | undefined,
    email:               r.email as string | undefined,
    telefone:            r.telefone as string | undefined,
    whatsapp:            r.whatsapp as string | undefined,
    valorHonorario:      Number(r.valor_honorario ?? 0),
    formaPagamento:      r.forma_pagamento as any,
    diaVencimento:       r.dia_vencimento as number | undefined,
    temEmpregados:       Boolean(r.tem_empregados),
    temIncentivoFiscal:  Boolean(r.tem_incentivo_fiscal),
    regimeHibrido:       Boolean(r.regime_hibrido),
    inscricaoMunicipal:  r.inscricao_municipal as string | undefined,
    inscricaoEstadual:   r.inscricao_estadual as string | undefined,
    codigoServicoNfse:   r.codigo_servico_nfse as string | undefined,
    atividadePrincipal:  r.atividade_principal as string | undefined,
    observacoes:         r.observacoes as string | undefined,
    municipio:           r.municipio as string | undefined,
    uf:                  r.uf as string | undefined,
    endereco:            r.endereco as any,
    asaasId:             r.asaas_id as string | undefined,
    createdAt:           r.created_at as string,
    updatedAt:           r.updated_at as string | undefined,
  };
}

export function useClienteById(id: string) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();
      if (err) {
        if (err.code === "PGRST116") setCliente(null); // not found
        else throw err;
      } else {
        setCliente(data ? fromDb(data as Record<string, unknown>) : null);
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar cliente");
      setCliente(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const update = useCallback(async (patch: Partial<Cliente>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.razaoSocial        !== undefined) dbPatch.razao_social         = patch.razaoSocial;
    if (patch.nomeFantasia        !== undefined) dbPatch.nome_fantasia         = patch.nomeFantasia;
    if (patch.cnpj                !== undefined) dbPatch.cnpj                  = patch.cnpj;
    if (patch.regime              !== undefined) dbPatch.regime                 = patch.regime;
    if (patch.status              !== undefined) dbPatch.status                 = patch.status;
    if (patch.responsavel         !== undefined) dbPatch.responsavel            = patch.responsavel;
    if (patch.email               !== undefined) dbPatch.email                  = patch.email;
    if (patch.telefone            !== undefined) dbPatch.telefone               = patch.telefone;
    if (patch.whatsapp            !== undefined) dbPatch.whatsapp               = patch.whatsapp;
    if (patch.valorHonorario      !== undefined) dbPatch.valor_honorario        = patch.valorHonorario;
    if (patch.formaPagamento      !== undefined) dbPatch.forma_pagamento        = patch.formaPagamento;
    if (patch.diaVencimento       !== undefined) dbPatch.dia_vencimento         = patch.diaVencimento;
    if (patch.temEmpregados       !== undefined) dbPatch.tem_empregados         = patch.temEmpregados;
    if (patch.temIncentivoFiscal  !== undefined) dbPatch.tem_incentivo_fiscal   = patch.temIncentivoFiscal;
    if (patch.regimeHibrido       !== undefined) dbPatch.regime_hibrido         = patch.regimeHibrido;
    if (patch.inscricaoMunicipal  !== undefined) dbPatch.inscricao_municipal    = patch.inscricaoMunicipal;
    if (patch.inscricaoEstadual   !== undefined) dbPatch.inscricao_estadual     = patch.inscricaoEstadual;
    if (patch.codigoServicoNfse   !== undefined) dbPatch.codigo_servico_nfse   = patch.codigoServicoNfse;
    if (patch.atividadePrincipal  !== undefined) dbPatch.atividade_principal    = patch.atividadePrincipal;
    if (patch.observacoes         !== undefined) dbPatch.observacoes            = patch.observacoes;
    if (patch.municipio           !== undefined) dbPatch.municipio              = patch.municipio;
    if (patch.uf                  !== undefined) dbPatch.uf                     = patch.uf;
    if (patch.endereco            !== undefined) dbPatch.endereco               = patch.endereco;

    const { error: err } = await supabase
      .from("clientes")
      .update(dbPatch)
      .eq("id", id);

    if (err) throw err;
    setCliente(prev => prev ? { ...prev, ...patch } : prev);
  }, [id]);

  return { cliente, loading, error, refetch: fetch, update };
}

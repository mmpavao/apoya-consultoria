/**
 * Hook dedicado para buscar um único cliente por ID.
 * fromDb sincronizado com use-clientes.ts — todos os campos mapeados.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Cliente } from "./use-clientes";

function fromDb(row: Record<string, unknown>): Cliente {
  return {
    id:                  row.id as string,
    razaoSocial:         row.razao_social as string,
    nomeFantasia:        row.nome_fantasia as string | undefined,
    cnpj:                row.cnpj as string,
    regime:              row.regime
      ? (String(row.regime).replace("Simples Nacional", "Simples") as any)
      : undefined,
    regimeHibrido:       Boolean(row.regime_hibrido),
    tier:                row.tier as any,
    status:              (row.status as any) ?? "ativo",
    responsavel:         (row.responsavel as string) ?? "",
    email:               row.email as string | undefined,
    telefone:            row.telefone as string | undefined,
    whatsapp:            row.whatsapp as string | undefined,
    inscricaoMunicipal:  row.inscricao_municipal as string | undefined,
    inscricaoEstadual:   row.inscricao_estadual as string | undefined,
    codigoServicoNfse:   row.codigo_servico_nfse as string | undefined,
    diaVencimento:       row.dia_vencimento as number | undefined,
    valorHonorario:      row.valor_honorario != null ? Number(row.valor_honorario) : undefined,
    formaPagamento:      row.forma_pagamento as any,
    temEmpregados:       Boolean(row.tem_empregados),
    temIncentivoFiscal:  Boolean(row.tem_incentivo_fiscal),
    municipio:           row.municipio as string | undefined,
    uf:                  row.uf as string | undefined,
    endereco: {
      municipio:    row.municipio as string | undefined,
      uf:           row.uf as string | undefined,
      cep:          row.cep as string | undefined,
      logradouro:   row.logradouro as string | undefined,
      numero:       row.numero as string | undefined,
      bairro:       row.bairro as string | undefined,
      complemento:  row.complemento as string | undefined,
    },
    atividadePrincipal:   row.atividade_principal as string | undefined,
    observacoes:          row.observacoes as string | undefined,
    aliquotaIss:          row.aliquota_iss != null ? Number(row.aliquota_iss) : undefined,
    cpf:                  row.cpf as string | undefined,
    codigoMunicipioIbge:  row.codigo_municipio_ibge as string | undefined,
    // campos extras retornados mas não no tipo base — acessados via (cliente as any)
    ...(row.asaas_customer_id != null  ? { asaasId:         row.asaas_customer_id as string }  : {}),
    ...(row.tem_certificado    != null  ? { tem_certificado: Boolean(row.tem_certificado) }      : {}),
    ...(row.tem_procuracao     != null  ? { tem_procuracao:  Boolean(row.tem_procuracao) }       : {}),
    ...(row.data_inadimplencia != null  ? { data_inadimplencia: row.data_inadimplencia as string } : {}),
    ...(row.data_suspensao     != null  ? { data_suspensao:     row.data_suspensao as string }     : {}),
    ...(row.motivo_suspensao   != null  ? { motivo_suspensao:   row.motivo_suspensao as string }   : {}),
    createdAt:   row.created_at as string,
  };
}

export function useClienteById(id: string) {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", id)
        .single();
      if (err) {
        if (err.code === "PGRST116") setCliente(null);
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

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (patch: Partial<Cliente>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.razaoSocial        !== undefined) dbPatch.razao_social          = patch.razaoSocial;
    if (patch.nomeFantasia        !== undefined) dbPatch.nome_fantasia          = patch.nomeFantasia;
    if (patch.cnpj                !== undefined) dbPatch.cnpj                   = patch.cnpj;
    if (patch.regime              !== undefined) dbPatch.regime                  = patch.regime;
    if (patch.status              !== undefined) dbPatch.status                  = patch.status;
    if (patch.responsavel         !== undefined) dbPatch.responsavel             = patch.responsavel;
    if (patch.email               !== undefined) dbPatch.email                   = patch.email;
    if (patch.telefone            !== undefined) dbPatch.telefone                = patch.telefone;
    if (patch.whatsapp            !== undefined) dbPatch.whatsapp                = patch.whatsapp;
    if (patch.valorHonorario      !== undefined) dbPatch.valor_honorario         = patch.valorHonorario;
    if (patch.formaPagamento      !== undefined) dbPatch.forma_pagamento         = patch.formaPagamento;
    if (patch.diaVencimento       !== undefined) dbPatch.dia_vencimento          = patch.diaVencimento;
    if (patch.temEmpregados       !== undefined) dbPatch.tem_empregados          = patch.temEmpregados;
    if (patch.temIncentivoFiscal  !== undefined) dbPatch.tem_incentivo_fiscal    = patch.temIncentivoFiscal;
    if (patch.regimeHibrido       !== undefined) dbPatch.regime_hibrido          = patch.regimeHibrido;
    if (patch.inscricaoMunicipal  !== undefined) dbPatch.inscricao_municipal     = patch.inscricaoMunicipal;
    if (patch.inscricaoEstadual   !== undefined) dbPatch.inscricao_estadual      = patch.inscricaoEstadual;
    if (patch.codigoServicoNfse   !== undefined) dbPatch.codigo_servico_nfse    = patch.codigoServicoNfse;
    if (patch.atividadePrincipal  !== undefined) dbPatch.atividade_principal     = patch.atividadePrincipal;
    if (patch.observacoes         !== undefined) dbPatch.observacoes             = patch.observacoes;
    if (patch.municipio           !== undefined) dbPatch.municipio               = patch.municipio;
    if (patch.uf                  !== undefined) dbPatch.uf                      = patch.uf;
    if (patch.endereco            !== undefined) {
      if (patch.endereco.cep        !== undefined) dbPatch.cep         = patch.endereco.cep;
      if (patch.endereco.logradouro !== undefined) dbPatch.logradouro  = patch.endereco.logradouro;
      if (patch.endereco.numero     !== undefined) dbPatch.numero      = patch.endereco.numero;
      if (patch.endereco.bairro     !== undefined) dbPatch.bairro      = patch.endereco.bairro;
      if (patch.endereco.complemento!== undefined) dbPatch.complemento = patch.endereco.complemento;
      if (patch.endereco.municipio  !== undefined) dbPatch.municipio   = patch.endereco.municipio;
      if (patch.endereco.uf         !== undefined) dbPatch.uf          = patch.endereco.uf;
    }
    if (patch.aliquotaIss         !== undefined) dbPatch.aliquota_iss            = patch.aliquotaIss;
    if (patch.cpf                 !== undefined) dbPatch.cpf                     = patch.cpf;
    // nfseio_emitente_id NÃO existe na tabela clientes — removido (gravá-lo quebraria o UPDATE)
    if (patch.codigoMunicipioIbge !== undefined) dbPatch.codigo_municipio_ibge   = patch.codigoMunicipioIbge;
    if ((patch as any).tem_certificado !== undefined) dbPatch.tem_certificado = (patch as any).tem_certificado;
    if ((patch as any).tem_procuracao  !== undefined) dbPatch.tem_procuracao  = (patch as any).tem_procuracao;

    const { error: err } = await (supabase as any)
      .from("clientes")
      .update(dbPatch)
      .eq("id", id);

    if (err) throw err;
    await load(); // Re-fetch para garantir consistência
  }, [id, load]);

  return { cliente, loading, error, refetch: load, update };
}

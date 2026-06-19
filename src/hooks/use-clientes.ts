/**
 * Hook: useClientes
 * Substitui clientes-store.ts (localStorage) pelo Supabase real.
 */
import { useEffect, useState, useCallback } from "react";
import { useRealtimeTable } from "@/lib/realtime-singleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Regime = "MEI" | "Simples" | "Lucro Presumido" | "Lucro Real" | "Doméstica";
export type Status = "ativo" | "inadimplente" | "suspenso" | "inativo" | "em_analise";
export type TierServico = "MEI" | "Simples" | "Empresarial" | "Doméstica";
export type FormaPagamento = "PIX" | "Boleto" | "Débito automático";

export interface Cliente {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  regime: Regime;
  regimeHibrido?: boolean;
  tier?: TierServico;
  status: Status;
  responsavel: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  inscricaoMunicipal?: string;
  inscricaoEstadual?: string;
  codigoServicoNfse?: string;
  diaVencimento?: number;
  valorHonorario?: number;
  formaPagamento?: FormaPagamento;
  // SLA por cliente (override do escritório)
  diaCobrancaProprio?: number | null;
  diasSuspensaoProprio?: number | null;
  formaPagamentoPadrao?: string | null;
  temEmpregados?: boolean;
  temIncentivoFiscal?: boolean;
  municipio?: string;
  uf?: string;
  endereco?: { municipio?: string; uf?: string; cep?: string; logradouro?: string; numero?: string; bairro?: string; complemento?: string };
  atividadePrincipal?: string;
  observacoes?: string;
  aliquotaIss?: number;
  cpf?: string;
  codigoMunicipioIbge?: string;
  nfseioEmitenteId?: string;
  createdAt: string;
}

// Mapear snake_case do Supabase → camelCase local
function fromDb(row: Record<string, unknown>): Cliente {
  return {
    id:                row.id as string,
    razaoSocial:       row.razao_social as string,
    nomeFantasia:      row.nome_fantasia as string | undefined,
    cnpj:              row.cnpj as string,
    regime:            ((row.regime as string) ?? "Simples").replace("Simples Nacional", "Simples") as Regime,
    regimeHibrido:     row.regime_hibrido as boolean,
    tier:              row.tier as TierServico | undefined,
    status:            row.status as Status,
    responsavel:       row.responsavel as string,
    email:             row.email as string | undefined,
    telefone:          row.telefone as string | undefined,
    whatsapp:          row.whatsapp as string | undefined,
    inscricaoMunicipal:row.inscricao_municipal as string | undefined,
    inscricaoEstadual: row.inscricao_estadual as string | undefined,
    codigoServicoNfse: row.codigo_servico_nfse as string | undefined,
    diaVencimento:     row.dia_vencimento as number | undefined,
    valorHonorario:    row.valor_honorario ? Number(row.valor_honorario) : undefined,
    formaPagamento:    row.forma_pagamento as FormaPagamento | undefined,
    diaCobrancaProprio:   row.dia_cobranca_proprio  != null ? Number(row.dia_cobranca_proprio)  : null,
    diasSuspensaoProprio: row.dias_suspensao_proprio != null ? Number(row.dias_suspensao_proprio) : null,
    formaPagamentoPadrao: row.forma_pagamento_padrao as string | null ?? null,
    temEmpregados:     row.tem_empregados as boolean,
    temIncentivoFiscal:row.tem_incentivo_fiscal as boolean,
    municipio:         row.municipio as string | undefined,
    uf:                row.uf as string | undefined,
    endereco: {
      municipio: row.municipio as string | undefined,
      uf:        row.uf as string | undefined,
      cep:       row.cep as string | undefined,
      logradouro:row.logradouro as string | undefined,
      numero:    row.numero as string | undefined,
      bairro:    row.bairro as string | undefined,
      complemento: (row as any).complemento as string | undefined,
    },
    atividadePrincipal:row.atividade_principal as string | undefined,
    observacoes:       row.observacoes as string | undefined,
    aliquotaIss:       row.aliquota_iss != null ? Number(row.aliquota_iss) : undefined,
    cpf:               row.cpf as string | undefined,
    codigoMunicipioIbge: row.codigo_municipio_ibge as string | undefined,
    createdAt:         row.created_at as string,
    // campos SERPRO — mantidos como any para evitar breaking change no tipo Cliente
    ...((row.tem_certificado !== undefined) ? { tem_certificado: row.tem_certificado as boolean } : {}),
    ...((row.tem_procuracao  !== undefined) ? { tem_procuracao:  row.tem_procuracao  as boolean } : {}),
  };
}

// camelCase local → snake_case Supabase
function toDb(c: Partial<Cliente>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (c.razaoSocial       !== undefined) out.razao_social        = c.razaoSocial;
  if (c.nomeFantasia      !== undefined) out.nome_fantasia       = c.nomeFantasia;
  if (c.cnpj              !== undefined) out.cnpj                = c.cnpj;
  if (c.regime            !== undefined) out.regime              = c.regime === "Simples" ? "Simples" : c.regime;
  if (c.regimeHibrido     !== undefined) out.regime_hibrido      = c.regimeHibrido;
  if (c.tier              !== undefined) out.tier                = c.tier;
  if (c.status            !== undefined) out.status              = c.status;
  if (c.responsavel       !== undefined) out.responsavel         = c.responsavel;
  if (c.email             !== undefined) out.email               = c.email;
  if (c.telefone          !== undefined) out.telefone            = c.telefone;
  if (c.whatsapp          !== undefined) out.whatsapp            = c.whatsapp;
  if (c.inscricaoMunicipal!==undefined)  out.inscricao_municipal = c.inscricaoMunicipal;
  if (c.inscricaoEstadual !== undefined) out.inscricao_estadual  = c.inscricaoEstadual;
  if (c.codigoServicoNfse !== undefined) out.codigo_servico_nfse = c.codigoServicoNfse;
  if (c.diaVencimento     !== undefined) out.dia_vencimento      = c.diaVencimento;
  if (c.valorHonorario    !== undefined) out.valor_honorario     = c.valorHonorario;
  if (c.formaPagamento    !== undefined) out.forma_pagamento     = c.formaPagamento;
  if (c.diaCobrancaProprio   !== undefined) out.dia_cobranca_proprio   = c.diaCobrancaProprio;
  if (c.diasSuspensaoProprio !== undefined) out.dias_suspensao_proprio = c.diasSuspensaoProprio;
  if (c.formaPagamentoPadrao !== undefined) out.forma_pagamento_padrao = c.formaPagamentoPadrao;
  if (c.temEmpregados     !== undefined) out.tem_empregados      = c.temEmpregados;
  if (c.temIncentivoFiscal!==undefined)  out.tem_incentivo_fiscal= c.temIncentivoFiscal;
  if (c.atividadePrincipal!==undefined)  out.atividade_principal = c.atividadePrincipal;
  if (c.observacoes       !== undefined) out.observacoes           = c.observacoes;
  if (c.aliquotaIss       !== undefined) out.aliquota_iss          = c.aliquotaIss;
  if (c.cpf               !== undefined) out.cpf                   = c.cpf;
  if (c.codigoMunicipioIbge !== undefined) out.codigo_municipio_ibge = c.codigoMunicipioIbge;
  if ((c as any).tem_certificado !== undefined) out.tem_certificado = (c as any).tem_certificado;
  if ((c as any).tem_procuracao  !== undefined) out.tem_procuracao  = (c as any).tem_procuracao;
  if (c.endereco) {
    if (c.endereco.municipio !== undefined) out.municipio  = c.endereco.municipio;
    if (c.endereco.uf        !== undefined) out.uf         = c.endereco.uf;
    if (c.endereco.cep       !== undefined) out.cep        = c.endereco.cep;
    if (c.endereco.logradouro!==undefined)  out.logradouro = c.endereco.logradouro;
    if (c.endereco.numero    !== undefined) out.numero     = c.endereco.numero;
    if (c.endereco.bairro    !== undefined) out.bairro     = c.endereco.bairro;
    if (c.endereco.complemento !== undefined) out.complemento = c.endereco.complemento;
  }
  return out;
}

export function useClientes() {
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const { data, error: err } = await supabase
        .from("clientes")
        .select("*")
        .order("razao_social");
      if (err) {
        console.error("[useClientes] PostgrestError:", JSON.stringify(err));
        throw new Error(err.message ?? err.code ?? JSON.stringify(err));
      }
      setClientes((data ?? []).map(fromDb));
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? e.message
        : (e as any)?.message ?? JSON.stringify(e) ?? "Erro ao carregar clientes";
      setError(msg);
      console.error("[useClientes] erro real:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime via singleton centralizado (evita múltiplos channels com mesmo nome)
  useRealtimeTable("clientes", fetch);

  const createCliente = useCallback(async (c: Omit<Cliente, "id" | "createdAt">) => {
    const { data, error: err } = await supabase.from("clientes").insert(toDb(c) as any).select().single();
    if (err) { toast.error("Erro ao criar cliente: " + err.message); return null; }
    toast.success(`${c.razaoSocial} cadastrado!`);
    return fromDb(data);
  }, []);

  const updateCliente = useCallback(async (id: string, patch: Partial<Cliente>) => {
    const { error: err } = await supabase.from("clientes").update(toDb(patch) as any).eq("id", id);
    if (err) { toast.error("Erro ao atualizar: " + err.message); return false; }
    toast.success("Cliente atualizado");
    return true;
  }, []);

  const deleteCliente = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("clientes").delete().eq("id", id);
    if (err) {
      // 23503 = foreign_key_violation — cliente tem registros vinculados
      const fk = (err as { code?: string }).code === "23503" || /foreign key|viola/i.test(err.message);
      toast.error(fk
        ? "Não dá pra excluir: este cliente tem registros vinculados (cobranças, contratos, documentos…). Remova-os ou inative o cliente."
        : "Erro ao excluir: " + err.message);
      return false;
    }
    return true;
  }, []);

  return { clientes, loading, error, refetch: fetch, createCliente, updateCliente, deleteCliente };
}

export const REGIME_LABEL: Record<Regime, string> = {
  MEI: "MEI",
  Simples: "Simples Nacional",
  "Lucro Presumido": "Lucro Presumido",
  "Lucro Real": "Lucro Real",
  Doméstica: "Doméstica",
};

export const STATUS_LABEL: Record<Status, string> = {
  ativo:        "Ativo",
  inadimplente: "Inadimplente",
  suspenso:     "Suspenso",
  inativo:      "Inativo",
  em_analise:   "Em análise",
};

export const RESPONSAVEIS = ["Ana Souza", "Carlos Lima", "Marcos Pinto"];

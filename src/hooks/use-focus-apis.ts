/**
 * use-focus-apis.ts
 * Hook para as APIs Acessórias da Focus NF-e
 *
 * Disponíveis:
 *   useBuscarCep(cep)          — busca endereço por CEP
 *   useBuscarCnpj(cnpj)        — consulta cadastral da empresa
 *   useBuscarCnaes(query)      — busca CNAE por código ou descrição
 *   useBuscarCnae(codigo)      — CNAE específico
 *   useBuscarNcms(query)       — NCM por código ou descrição
 *   useBuscarNcm(codigo)       — NCM específico
 *   useBuscarCfops(query)      — CFOP por código ou descrição
 *   useBuscarMunicipio(ibge)   — município por código IBGE
 *   useBuscarMunicipios(query) — municípios por nome/UF
 *   useBuscarItemServico(ibge, codigo) — item da lista de serviço do município
 *
 * Todos retornam: { data, loading, error }
 * Busca debounced de 400ms para evitar spam de chamadas.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Configuração ──────────────────────────────────────────────────────────────
const FOCUS_BASE_HOMO = "https://homologacao.focusnfe.com.br/v2";
const FOCUS_BASE_PROD = "https://api.focusnfe.com.br/v2";

// A rota do servidor que proxia as chamadas (para não expor o token no client)
const SERVER_PROXY = "/api/focus/proxy";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FocusCep {
  cep: string;
  tipo: string;
  nome?: string;
  uf: string;
  nome_localidade: string;
  codigo_ibge: string;
  tipo_logradouro?: string;
  nome_logradouro?: string;
  bairro?: string;
  descricao: string;
}

export interface FocusCnpj {
  razao_social: string;
  cnpj: string;
  situacao_cadastral: "ativa" | "inapta" | "baixada" | "suspensa" | string;
  cnae_principal: string;
  optante_simples_nacional: boolean;
  optante_mei: boolean;
  endereco: {
    codigo_municipio: string;
    codigo_siafi: string;
    codigo_ibge: string;
    nome_municipio: string;
    logradouro: string;
    complemento?: string;
    numero?: string;
    bairro: string;
    cep: string;
    uf: string;
  };
}

export interface FocusCnae {
  codigo: string;
  descricao: string;
  secao?: string;
  descricao_secao?: string;
  divisao?: string;
  descricao_divisao?: string;
  grupo?: string;
  descricao_grupo?: string;
  classe?: string;
  descricao_classe?: string;
  subclasse?: string;
  descricao_subclasse?: string;
}

export interface FocusNcm {
  codigo: string;
  descricao?: string;
  descricao_completa?: string;
}

export interface FocusCfop {
  codigo: string;
  descricao: string;
  aplicacao?: string;
}

export interface FocusMunicipio {
  codigo_municipio: string;
  nome_municipio: string;
  sigla_uf: string;
  nome_uf: string;
  nfse_habilitada: boolean;
  requer_certificado_nfse: boolean;
  possui_ambiente_homologacao_nfse: boolean;
  possui_cancelamento_nfse: boolean;
  provedor_nfse: string;
  status_nfse: string;
  item_lista_servico_obrigatorio_nfse?: boolean;
  codigo_cnae_obrigatorio_nfse?: boolean;
}

export interface FocusItemServico {
  codigo: string;
  descricao: string;
  aliquota_iss?: number;
}

// ── Core: fetch via proxy do servidor ────────────────────────────────────────

async function focusFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${SERVER_PROXY}?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ mensagem: `HTTP ${res.status}` }));
    throw new Error(err.mensagem ?? `Focus API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Hook factory ─────────────────────────────────────────────────────────────

function useFocusQuery<T>(
  pathFn: () => string | null,
  deps: unknown[],
  debounceMs = 400
) {
  const [data, setData]     = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const path = pathFn();
    if (!path) {
      setData(null);
      setError(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await focusFetch<T>(path);
        setData(result);
      } catch (e: any) {
        setError(e.message);
        setData(null);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// ── Hooks públicos ────────────────────────────────────────────────────────────

/** Busca um CEP específico (8 dígitos) */
export function useBuscarCep(cep: string | null | undefined) {
  const limpo = cep?.replace(/\D/g, "").slice(0, 8) ?? "";
  return useFocusQuery<FocusCep>(
    () => (limpo.length === 8 ? `/ceps/${limpo}` : null),
    [limpo]
  );
}

/** Consulta cadastral de CNPJ */
export function useBuscarCnpj(cnpj: string | null | undefined) {
  const limpo = cnpj?.replace(/\D/g, "") ?? "";
  return useFocusQuery<FocusCnpj>(
    () => (limpo.length === 14 ? `/cnpjs/${limpo}` : null),
    [limpo]
  );
}

/** Lista CNAEs por código ou descrição (debounced) */
export function useBuscarCnaes(query: string, campo: "codigo" | "descricao" = "descricao") {
  const q = query.trim();
  return useFocusQuery<FocusCnae[]>(
    () => (q.length >= 2 ? `/codigos_cnae?${campo}=${encodeURIComponent(q)}` : null),
    [q, campo]
  );
}

/** CNAE específico por código exato */
export function useBuscarCnae(codigo: string | null | undefined) {
  const c = codigo?.trim() ?? "";
  return useFocusQuery<FocusCnae>(
    () => (c.length >= 4 ? `/codigos_cnae/${c}` : null),
    [c]
  );
}

/** Lista NCMs por código ou descrição */
export function useBuscarNcms(query: string, campo: "codigo" | "descricao" = "descricao") {
  const q = query.trim();
  return useFocusQuery<FocusNcm[]>(
    () => (q.length >= 2 ? `/ncms?${campo}=${encodeURIComponent(q)}` : null),
    [q, campo]
  );
}

/** NCM específico por código exato */
export function useBuscarNcm(codigo: string | null | undefined) {
  const c = codigo?.trim() ?? "";
  return useFocusQuery<FocusNcm>(
    () => (c.length >= 4 ? `/ncms/${c}` : null),
    [c]
  );
}

/** Lista CFOPs por código ou descrição */
export function useBuscarCfops(query: string, campo: "codigo" | "descricao" = "descricao") {
  const q = query.trim();
  return useFocusQuery<FocusCfop[]>(
    () => (q.length >= 2 ? `/cfops?${campo}=${encodeURIComponent(q)}` : null),
    [q, campo]
  );
}

/** Município por código IBGE (7 dígitos) */
export function useBuscarMunicipio(codigoIbge: string | null | undefined) {
  const c = codigoIbge?.trim() ?? "";
  return useFocusQuery<FocusMunicipio>(
    () => (c.length === 7 ? `/municipios/${c}` : null),
    [c]
  );
}

/** Lista municípios por nome e/ou UF */
export function useBuscarMunicipios(nome: string, uf?: string) {
  const n = nome.trim();
  return useFocusQuery<FocusMunicipio[]>(
    () => {
      if (n.length < 2) return null;
      const params = new URLSearchParams({ nome: n });
      if (uf) params.set("uf", uf.toUpperCase());
      return `/municipios?${params}`;
    },
    [n, uf ?? ""]
  );
}

/** Item da lista de serviço de um município */
export function useBuscarItemServico(codigoIbge: string | null, codigoItem: string | null) {
  return useFocusQuery<FocusItemServico>(
    () =>
      codigoIbge && codigoItem
        ? `/municipios/${codigoIbge}/lista_servicos/${codigoItem}`
        : null,
    [codigoIbge, codigoItem]
  );
}

/** Lista itens da lista de serviço de um município */
export function useListarItensServico(codigoIbge: string | null, filtro?: string) {
  return useFocusQuery<FocusItemServico[]>(
    () => {
      if (!codigoIbge) return null;
      const params = filtro
        ? `?descricao=${encodeURIComponent(filtro)}`
        : "";
      return `/municipios/${codigoIbge}/lista_servicos${params}`;
    },
    [codigoIbge, filtro ?? ""]
  );
}

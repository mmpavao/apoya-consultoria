/**
 * useCnpjLookup — busca dados cadastrais de CNPJ via BrasilAPI (gratuita, sem auth)
 * Fallback: ReceitaWS
 */
import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface CnpjDados {
  razaoSocial: string;
  nomeFantasia?: string;
  atividadePrincipal?: string;
  cnaePrincipal?: string;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  codigoMunicipioIbge?: string;
  inscricaoEstadual?: string;
  situacaoCadastral?: string;
  dataAbertura?: string;
  naturezaJuridica?: string;
  capitalSocial?: number;
  optanteSimplesNacional?: boolean;
  optanteMei?: boolean;
}

export function useCnpjLookup() {
  const [loading, setLoading] = useState(false);

  const buscar = useCallback(async (cnpj: string): Promise<CnpjDados | null> => {
    const digits = cnpj.replace(/\D/g, "");
    if (digits.length !== 14) { toast.error("CNPJ deve ter 14 dígitos"); return null; }

    setLoading(true);
    try {
      // Fonte 1: BrasilAPI
      const r1 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      if (r1?.ok) {
        const d = await r1.json().catch(() => null);
        if (d) {
          const tel = d.ddd_telefone_1
            ? `(${d.ddd_telefone_1}) ${d.telefone_1 ?? ""}`.trim()
            : undefined;
          return {
            razaoSocial:         d.razao_social ?? "",
            nomeFantasia:        d.nome_fantasia || undefined,
            atividadePrincipal:  d.cnae_fiscal_descricao || undefined,
            cnaePrincipal:       d.cnae_fiscal ? String(d.cnae_fiscal) : undefined,
            email:               d.email || undefined,
            telefone:            tel || undefined,
            cep:                 d.cep ? d.cep.replace(/\D/g,"").replace(/(\d{5})(\d{3})/, "$1-$2") : undefined,
            logradouro:          d.logradouro || undefined,
            numero:              d.numero || undefined,
            complemento:         d.complemento || undefined,
            bairro:              d.bairro || undefined,
            municipio:           d.municipio || undefined,
            uf:                  d.uf || undefined,
            codigoMunicipioIbge: d.codigo_municipio_ibge ? String(d.codigo_municipio_ibge) : undefined,
            situacaoCadastral:   d.descricao_situacao_cadastral || undefined,
            dataAbertura:        d.data_inicio_atividade || undefined,
            naturezaJuridica:    d.natureza_juridica || undefined,
            capitalSocial:       d.capital_social ? Number(d.capital_social) : undefined,
            optanteSimplesNacional: d.opcao_pelo_simples ?? undefined,
            optanteMei:          d.opcao_pelo_mei ?? undefined,
          };
        }
      }

      // Fonte 2: ReceitaWS (fallback)
      const r2 = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      }).catch(() => null);

      if (r2?.ok) {
        const d = await r2.json().catch(() => null);
        if (d && d.status !== "ERROR") {
          return {
            razaoSocial:        d.nome ?? "",
            nomeFantasia:       d.fantasia || undefined,
            atividadePrincipal: d.atividade_principal?.[0]?.text || undefined,
            cnaePrincipal:      d.atividade_principal?.[0]?.code || undefined,
            email:              d.email || undefined,
            telefone:           d.telefone || undefined,
            cep:                d.cep?.replace(/\D/g,"") || undefined,
            logradouro:         d.logradouro || undefined,
            numero:             d.numero || undefined,
            complemento:        d.complemento || undefined,
            bairro:             d.bairro || undefined,
            municipio:          d.municipio || undefined,
            uf:                 d.uf || undefined,
            situacaoCadastral:  d.situacao || undefined,
            dataAbertura:       d.abertura || undefined,
            naturezaJuridica:   d.natureza_juridica || undefined,
          };
        }
      }

      toast.error("CNPJ não encontrado nas fontes públicas");
      return null;
    } catch (err: any) {
      toast.error("Erro ao consultar CNPJ: " + (err?.message ?? "timeout"));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { buscar, loading };
}

/**
 * Hook: useSocios
 * Gerencia o quadro societário de um cliente (tabela cliente_socio).
 * Também expõe consultaCNPJ para auto-fill no cadastro.
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

export interface DadosCNPJ {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  situacaoCadastral: string;
  dataAbertura?: string;
  atividadePrincipal?: string;
  cnae?: string;
  naturezaJuridica?: string;
  optanteSimples: boolean;
  optanteMei: boolean;
  porte?: string;
  capitalSocial?: number;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  codigoMunicipioIbge?: number;
  socios: Array<{
    nome: string;
    cnpjCpf: string;
    qualificacao: string;
    codigoQualificacao: number;
    faixaEtaria?: string;
    dataEntrada?: string;
    nomeRepresentante?: string;
    cpfRepresentante?: string;
    qualificacaoRepresentante?: string;
  }>;
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

// ── Consulta pública do CNPJ via BrasilAPI ──────────────────────────
export async function consultaCNPJ(cnpj: string): Promise<DadosCNPJ | null> {
  const limpo = cnpj.replace(/\D/g, "");
  if (limpo.length !== 14) return null;

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`);
    if (!res.ok) return null;
    const d = await res.json();

    return {
      cnpj:              d.cnpj ?? limpo,
      razaoSocial:       d.razao_social ?? "",
      nomeFantasia:      d.nome_fantasia ?? undefined,
      situacaoCadastral: d.descricao_situacao_cadastral ?? "DESCONHECIDA",
      dataAbertura:      d.data_inicio_atividade ?? undefined,
      atividadePrincipal: d.cnae_fiscal_descricao ?? undefined,
      cnae:              d.cnae_fiscal ? String(d.cnae_fiscal) : undefined,
      naturezaJuridica:  d.natureza_juridica ?? undefined,
      optanteSimples:    d.opcao_pelo_simples ?? false,
      optanteMei:        d.opcao_pelo_mei ?? false,
      porte:             d.porte ?? undefined,
      capitalSocial:     d.capital_social ? Number(d.capital_social) : undefined,
      email:             d.email ?? undefined,
      telefone:          d.ddd_telefone_1 ? d.ddd_telefone_1.replace(/\D/g, "") : undefined,
      logradouro:        d.logradouro ? `${d.descricao_tipo_de_logradouro ?? ""} ${d.logradouro}`.trim() : undefined,
      numero:            d.numero ?? undefined,
      complemento:       d.complemento ?? undefined,
      bairro:            d.bairro ?? undefined,
      municipio:         d.municipio ?? undefined,
      uf:                d.uf ?? undefined,
      cep:               d.cep ? d.cep.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") : undefined,
      codigoMunicipioIbge: d.codigo_municipio_ibge ? Number(d.codigo_municipio_ibge) : undefined,
      socios:            (d.qsa ?? []).map((s: Record<string, unknown>) => ({
        nome:                     s.nome_socio ?? "",
        cnpjCpf:                  s.cnpj_cpf_do_socio ?? "",
        qualificacao:             s.qualificacao_socio ?? "",
        codigoQualificacao:       Number(s.codigo_qualificacao_socio ?? 0),
        faixaEtaria:              s.faixa_etaria ?? undefined,
        dataEntrada:              s.data_entrada_sociedade ?? undefined,
        nomeRepresentante:        s.nome_representante_legal ?? undefined,
        cpfRepresentante:         s.cpf_representante_legal ?? undefined,
        qualificacaoRepresentante: s.qualificacao_representante_legal ?? undefined,
      })),
    };
  } catch {
    return null;
  }
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

  // Importar sócios em lote (pós-consulta CNPJ)
  // Estratégia: DELETE sócios antigos (origem=cnpj) + INSERT novos.
  // Evita problemas com upsert e índice parcial.
  const importarDosCNPJ = useCallback(async (
    clienteIdTarget: string,
    sociosCNPJ: DadosCNPJ["socios"]
  ) => {
    if (!sociosCNPJ.length) return;

    // Remover sócios importados anteriormente para este cliente
    await (supabase as any)
      .from("cliente_socio")
      .delete()
      .eq("cliente_id", clienteIdTarget);

    const rows = sociosCNPJ.map(s => {
      const cpfDigits = (s.cnpjCpf ?? "").replace(/\D/g, "");
      const tipo_socio = cpfDigits.length === 14 ? "pj" : "pf";
      return {
        cliente_id:                 clienteIdTarget,
        nome:                       s.nome,
        cnpj_cpf_socio:             s.cnpjCpf || null,
        tipo_socio,
        qualificacao:               s.qualificacao || null,
        codigo_qualificacao:        s.codigoQualificacao || null,
        data_entrada:               s.dataEntrada || null,
        nome_representante:         s.nomeRepresentante || null,
        cpf_representante:          s.cpfRepresentante || null,
        qualificacao_representante: s.qualificacaoRepresentante || null,
        is_administrador:           !!(s.qualificacao?.toLowerCase().includes("administrador")),
        is_ativo:                   true,
      };
    });

    const { error } = await (supabase as any)
      .from("cliente_socio")
      .insert(rows);

    if (error) {
      console.error("importarDosCNPJ error:", error);
      toast.error("Erro ao importar sócios: " + error.message);
    } else {
      await load();
    }
  }, [load]);

  return { socios, loading, error, load, upsert, remove, importarDosCNPJ };
}

/**
 * Hook: useEscritorioConfig
 * Lê e atualiza configurações do escritório (escritorio_config) via Supabase.
 * Substitui o mock de localStorage do config-store.ts.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface EscritorioConfig {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  crc: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  logotipo_url: string | null;
  dia_cobranca: number;
  dias_suspensao: number;
  // Integrações (apenas exibe se estão configuradas — nunca retorna o valor da chave)
  asaas_configurado: boolean;
  nfeio_configurado: boolean;
  evolution_configurado: boolean;
  // NFE.io
  nfseio_emitente_id: string | null;
  nfseio_ambiente: string | null;
  // Templates WhatsApp
  template_wa_cobranca: string | null;
  template_wa_das: string | null;
  template_wa_nfse: string | null;
}

export interface UpdateEscritorioPayload {
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  crc?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  dia_cobranca?: number;
  dias_suspensao?: number;
  // Chaves de API (só atualizadas quando fornecidas — não retornadas)
  asaas_api_key?: string;
  nfeio_api_key?: string;
  evolution_api_key?: string;
  evolution_api_url?: string;
  nfseio_emitente_id?: string;
  nfseio_ambiente?: string;
  template_wa_cobranca?: string;
  template_wa_das?: string;
  template_wa_nfse?: string;
}

export function useEscritorioConfig() {
  const [config, setConfig] = useState<EscritorioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("escritorio_config")
        .select("*")
        .limit(1)
        .single();

      if (err) throw err;

      setConfig({
        id: data.id,
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        cnpj: data.cnpj,
        crc: data.crc,
        email: data.email,
        telefone: data.telefone,
        whatsapp: data.whatsapp,
        logotipo_url: data.logotipo_url,
        dia_cobranca: data.dia_cobranca ?? 5,
        dias_suspensao: data.dias_suspensao ?? 45,
        // Mostra apenas se as chaves estão preenchidas
        asaas_configurado: !!data.asaas_api_key,
        nfeio_configurado: !!data.nfeio_api_key,
        evolution_configurado: !!data.evolution_api_key,
        nfseio_emitente_id: data.nfseio_emitente_id,
        nfseio_ambiente: data.nfseio_ambiente,
        template_wa_cobranca: data.template_wa_cobranca,
        template_wa_das: data.template_wa_das,
        template_wa_nfse: data.template_wa_nfse,
      });
    } catch (e: any) {
      setError(e.message ?? "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const update = useCallback(async (payload: UpdateEscritorioPayload) => {
    if (!config?.id) throw new Error("Config não carregada");

    // Montar patch — apenas campos definidos
    const patch: Record<string, any> = {};
    const fields: (keyof UpdateEscritorioPayload)[] = [
      "razao_social","nome_fantasia","cnpj","crc","email","telefone","whatsapp",
      "dia_cobranca","dias_suspensao","asaas_api_key","nfeio_api_key",
      "evolution_api_key","evolution_api_url","nfseio_emitente_id","nfseio_ambiente",
      "template_wa_cobranca","template_wa_das","template_wa_nfse"
    ];
    for (const f of fields) {
      if (payload[f] !== undefined) patch[f] = payload[f];
    }

    const { error: err } = await supabase
      .from("escritorio_config")
      .update(patch)
      .eq("id", config.id);

    if (err) throw err;
    await fetch(); // Recarrega
  }, [config?.id, fetch]);

  return { config, loading, error, refresh: fetch, update };
}

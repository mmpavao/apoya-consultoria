/**
 * Hook: useIntegracoes
 * - Leitura: tipo, ativa, updated_at (sem apiKey no frontend)
 * - Escrita: via serverFn com supabaseAdmin (service role)
 * - API keys nunca trafegam para o bundle do cliente
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type IntegracaoTipo = "asaas" | "focusnfe" | "evolution" | "serpro";

export interface Integracao {
  id: string;
  tipo: IntegracaoTipo;
  ativa: boolean;
  updatedAt: string;
  // apiKey e baseUrl NUNCA vêm do frontend — apenas do servidor
}

export interface IntegracaoDisplay {
  id: IntegracaoTipo;
  nome: string;
  descricao: string;
  ativa: boolean;
  updatedAt?: string;
}

const DISPLAY_META: Record<IntegracaoTipo, { nome: string; descricao: string }> = {
  asaas:     { nome: "Asaas",         descricao: "Gateway de cobrança (PIX/boleto)" },
  focusnfe:  { nome: "Focus NF-e",    descricao: "Emissão de NFS-e, NF-e, NFC-e e documentos fiscais" },
  evolution: { nome: "Evolution API", descricao: "WhatsApp (Evolution API self-hosted)" },
  serpro:    { nome: "SERPRO",        descricao: "Consulta CNPJ + gateway DAS" },
};

function fromDb(row: Record<string, unknown>): IntegracaoDisplay {
  const tipo = row.tipo as IntegracaoTipo;
  return {
    id: tipo,
    nome: DISPLAY_META[tipo]?.nome ?? tipo,
    descricao: DISPLAY_META[tipo]?.descricao ?? "",
    ativa: row.ativa as boolean,
    updatedAt: row.updated_at as string | undefined,
  };
}

export function useIntegracoes() {
  const [integracoes, setIntegracoes] = useState<IntegracaoDisplay[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      // Apenas colunas permitidas (sem config/apiKey — bloqueadas pelo SECURITY_FIXES.sql)
      const { data, error: err } = await db
        .from("integracao_config")
        .select("id, tipo, ativa, updated_at")
        .order("tipo");

      if (err) throw err;
      if (!data || data.length === 0) {
        // Seed inicial se a tabela estiver vazia
        setIntegracoes(
          (Object.keys(DISPLAY_META) as IntegracaoTipo[]).map((tipo) => ({
            id: tipo,
            nome: DISPLAY_META[tipo].nome,
            descricao: DISPLAY_META[tipo].descricao,
            ativa: false,
          }))
        );
      } else {
        setIntegracoes(data.map(fromDb));
      }
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar integrações";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Ativar/desativar integração (não salva apiKey — apenas flag)
  const toggleAtiva = useCallback(async (tipo: IntegracaoTipo, ativa: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { error: err } = await db
        .from("integracao_config")
        .upsert({ tipo, ativa, updated_at: new Date().toISOString() }, { onConflict: "tipo" });
      if (err) throw err;
      toast.success(`${DISPLAY_META[tipo].nome} ${ativa ? "ativada" : "desativada"}`);
      await fetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar integração");
    }
  }, [fetch]);

  return { integracoes, loading, error, refresh: fetch, toggleAtiva };
}

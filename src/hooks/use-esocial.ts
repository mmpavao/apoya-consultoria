/**
 * use-esocial.ts — rastreamento MANUAL de eventos eSocial por empresa+competência.
 * Persiste em public.esocial_evento. NÃO transmite ao gov (controle interno).
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EsocialStatus = "pendente" | "transmitido" | "erro";

export interface EsocialRegistro {
  id?: string;
  codigo: string;
  status: EsocialStatus;
  transmitido_em?: string | null;
  observacoes?: string | null;
}

export function useEsocial(empresaId?: string, competencia?: string) {
  const [registros, setRegistros] = useState<Record<string, EsocialRegistro>>({});
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!empresaId || !competencia) { setRegistros({}); return; }
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("esocial_evento")
        .select("*").eq("empresa_id", empresaId).eq("competencia", competencia);
      if (error) throw error;
      const map: Record<string, EsocialRegistro> = {};
      (data ?? []).forEach((r: EsocialRegistro & { codigo: string }) => { map[r.codigo] = r; });
      setRegistros(map);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar eSocial"); }
    finally { setLoading(false); }
  }, [empresaId, competencia]);

  useEffect(() => { fetch(); }, [fetch]);

  const marcar = useCallback(async (codigo: string, status: EsocialStatus, observacoes?: string) => {
    if (!empresaId || !competencia) { toast.error("Selecione empresa e competência"); return false; }
    const row = {
      empresa_id: empresaId, competencia, codigo, status,
      transmitido_em: status === "transmitido" ? new Date().toISOString() : null,
      observacoes: observacoes?.trim() || null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("esocial_evento")
      .upsert(row, { onConflict: "empresa_id,competencia,codigo" });
    if (error) { toast.error("Erro ao salvar: " + error.message); return false; }
    toast.success("Status atualizado");
    fetch();
    return true;
  }, [empresaId, competencia, fetch]);

  return { registros, loading, marcar, refresh: fetch };
}

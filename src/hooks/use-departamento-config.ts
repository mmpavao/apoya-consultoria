/**
 * useDepartamentoConfig — preferências (toggles) por setor, persistidas em
 * public.departamento_config (1 linha por setor, config jsonb).
 * Substitui o useState-que-some das abas Configurações.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DepartamentoConfig = Record<string, unknown>;

export function useDepartamentoConfig(setor: string) {
  const [config, setConfig] = useState<DepartamentoConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("departamento_config")
        .select("config")
        .eq("setor", setor)
        .maybeSingle();
      if (error) throw error;
      setConfig((data?.config as DepartamentoConfig) ?? {});
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("departamento_config load:", (e as Error)?.message);
      setError((e as Error)?.message ?? "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, [setor]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: DepartamentoConfig) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("departamento_config").upsert({
        setor,
        config: next,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      }, { onConflict: "setor" });
      if (error) throw error;
      setConfig(next);
      toast.success("Configurações salvas");
      return true;
    } catch (e) {
      toast.error("Erro ao salvar: " + ((e as Error)?.message ?? "tente novamente"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [setor]);

  return { config, loading, saving, save, error, reload: load };
}

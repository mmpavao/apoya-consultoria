/**
 * useAgenteAtividade(setor)
 * Atividade real do agente do setor (lê /api/agentes/atividade, que consulta
 * agente_logs server-side). Expõe o status do agente, o feed de atividades e
 * uma ação para EXECUTAR o agente ao vivo (chama a edge function + recarrega).
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ModuleAgentStatus, ModuleLogEntry } from "@/components/layout/ModuleDashboard";
import { toast } from "sonner";

const SUPA_URL = "https://ajaqbdsalxfgrwpjbtbn.supabase.co";

// setor → { edge function, nome exibido }
const SETOR_AGENTE: Record<string, { edge: string; nome: string }> = {
  fiscal:     { edge: "agente-fiscal",     nome: "Agente Fiscal" },
  financeiro: { edge: "agente-financeiro", nome: "Agente Financeiro" },
  dp:         { edge: "agente-rh",         nome: "Agente RH/DP" },
  contabil:   { edge: "agente-contabil",   nome: "Agente Contábil" },
  societario: { edge: "agente-societario", nome: "Agente Societário" },
};

export function useAgenteAtividade(setor: string) {
  const cfg = SETOR_AGENTE[setor];
  const [status, setStatus]   = useState<ModuleAgentStatus | null>(
    cfg ? { nome: cfg.nome, edge_fn: cfg.edge } : null
  );
  const [logs, setLogs]       = useState<ModuleLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const fetchAtividade = useCallback(async () => {
    if (!cfg) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/agentes/atividade?setor=${setor}`, {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      const data = await res.json().catch(() => ({}));
      setStatus({
        nome: cfg.nome,
        edge_fn: cfg.edge,
        ultima_execucao: data?.agente?.ultima_execucao ?? null,
        ultimo_resultado: data?.agente?.ultimo_resultado ?? null,
        total_alertas: data?.agente?.total_alertas ?? undefined,
      });
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch {
      /* mantém estado anterior */
    } finally {
      setLoading(false);
    }
  }, [setor, cfg]);

  useEffect(() => { fetchAtividade(); }, [fetchAtividade]);

  // Executa o agente ao vivo e recarrega a atividade
  const executar = useCallback(async () => {
    if (!cfg) return;
    setRunning(true);
    toast.loading(`Executando ${cfg.nome}…`, { id: "run-" + setor });
    try {
      // envia o token do usuário (antes ia sem Authorization) — pré-requisito
      // p/ as edge functions passarem a exigir auth (fail-closed) depois
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPA_URL}/functions/v1/${cfg.edge}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ trigger: "manual" }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        const n = data?.resumo?.tarefas_criadas;
        toast.success(n != null ? `${cfg.nome}: ${n} tarefa(s) triada(s)` : `${cfg.nome} executado`, { id: "run-" + setor });
      } else {
        toast.error(`Falha ao executar ${cfg.nome}`, { id: "run-" + setor });
      }
      await fetchAtividade();
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? "tente novamente"}`, { id: "run-" + setor });
    } finally {
      setRunning(false);
    }
  }, [cfg, setor, fetchAtividade]);

  return { status, logs, loading, running, executar, refetch: fetchAtividade };
}

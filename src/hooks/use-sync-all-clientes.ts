/**
 * useSyncAllClientes
 * Percorre todos os clientes com CNPJ, consulta o SERPRO via cnpj-enrich
 * e atualiza regime, alíquota ISS, CNAE, situação fiscal e flag de dívida no banco.
 *
 * Usa fila serial (1 por vez) para não sobrecarregar o gateway.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Cliente } from "@/hooks/use-clientes";

export interface SyncResult {
  id: string;
  razaoSocial: string;
  cnpj: string;
  status: "ok" | "erro" | "sem_cnpj" | "ignorado";
  regimeAntes?: string;
  regimeDepois?: string;
  msg?: string;
}

export interface SyncState {
  running: boolean;
  current: string | null;       // nome do cliente sendo processado
  progress: number;             // 0–100
  done: number;
  total: number;
  results: SyncResult[];
}

const INITIAL: SyncState = {
  running: false, current: null, progress: 0, done: 0, total: 0, results: [],
};

function normalizeRegime(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const r = raw.toUpperCase();
  if (r.includes("MEI"))                          return "MEI";
  if (r.includes("SIMPLES"))                      return "Simples";
  if (r.includes("PRESUMIDO") || r.includes("LP")) return "Lucro Presumido";
  if (r.includes("REAL")      || r.includes("LR")) return "Lucro Real";
  return raw;
}

export function useSyncAllClientes() {
  const [state, setState] = useState<SyncState>(INITIAL);
  const abortRef = useRef(false);

  const sync = useCallback(async (clientes: Cliente[]) => {
    const comCnpj = clientes.filter(c => c.cnpj && c.cnpj.replace(/\D/g, "").length === 14);
    if (!comCnpj.length) {
      toast.warning("Nenhum cliente com CNPJ válido para sincronizar.");
      return;
    }

    abortRef.current = false;
    const results: SyncResult[] = [];
    setState({ running: true, current: null, progress: 0, done: 0, total: comCnpj.length, results });

    for (let i = 0; i < comCnpj.length; i++) {
      if (abortRef.current) break;
      const c = comCnpj[i];
      setState(s => ({ ...s, current: c.razaoSocial, done: i, progress: Math.round((i / comCnpj.length) * 100) }));

      let result: SyncResult = {
        id: c.id,
        razaoSocial: c.razaoSocial,
        cnpj: c.cnpj,
        status: "ignorado",
        regimeAntes: c.regime,
      };

      try {
        const { data, error } = await supabase.functions.invoke("cnpj-enrich", {
          body: { cnpj: c.cnpj.replace(/\D/g, "") },
        });

        if (error || !data?.ok) {
          result = { ...result, status: "erro", msg: error?.message ?? data?.error ?? "Falha na consulta" };
        } else {
          const r = data.data as Record<string, unknown>;
          const regimeDepois = normalizeRegime(r.regime as string);
          const patch: Record<string, unknown> = {};

          if (regimeDepois && regimeDepois !== c.regime) {
            patch.regime = regimeDepois === "Simples" ? "Simples Nacional" : regimeDepois;
          }
          if (r.cnaePrincipal)              patch.cnae                = r.cnaePrincipal;
          if (r.codigoServicoNfse)          patch.codigo_servico_nfse = r.codigoServicoNfse;
          if (r.aliquotaIss !== undefined)   patch.aliquota_iss        = Number(r.aliquotaIss);
          if (r.dividaAtivaRfb !== undefined || r.dividaAtivaPgfn !== undefined) {
            patch.divida_ativa = !!(r.dividaAtivaRfb || r.dividaAtivaPgfn);
          }
          if (r.dteAtivo !== undefined)      patch.dte_ativo           = r.dteAtivo;
          if (r.situacaoCadastral)           patch.situacao_cadastral  = r.situacaoCadastral;

          if (Object.keys(patch).length > 0) {
            const { error: upErr } = await supabase.from("clientes").update(patch).eq("id", c.id);
            if (upErr) {
              result = { ...result, status: "erro", msg: upErr.message };
            } else {
              result = { ...result, status: "ok", regimeAntes: c.regime, regimeDepois, msg: `${Object.keys(patch).length} campo(s) atualizado(s)` };
            }
          } else {
            result = { ...result, status: "ok", regimeDepois: c.regime, msg: "Dados já atualizados" };
          }
        }
      } catch (err) {
        result = { ...result, status: "erro", msg: err instanceof Error ? err.message : "Erro desconhecido" };
      }

      results.push(result);
      setState(s => ({ ...s, results: [...results] }));

      // Throttle: 800ms entre cada chamada para não sobrecarregar o gateway
      if (i < comCnpj.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    const ok    = results.filter(r => r.status === "ok").length;
    const erros = results.filter(r => r.status === "erro").length;
    setState(s => ({ ...s, running: false, current: null, progress: 100, done: comCnpj.length }));
    toast.success(`Sincronização concluída: ${ok} atualizados${erros ? `, ${erros} com erro` : ""}`);
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL);
  }, []);

  return { state, sync, abort, reset };
}

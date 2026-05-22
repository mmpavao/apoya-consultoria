/**
 * ApuracaoMensalCard — Card de apuração fiscal por competência
 * Mostra: status, valores apurados, checklist de fechamento, ações
 */
import { useState, useEffect } from "react";
import {
  Calculator, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, FileText, Send, Lock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface ApuracaoMensal {
  id: string;
  mes_referencia: string;
  regime: string;
  receita_bruta?: number;
  das_valor?: number;
  das_codigo_barras?: string;
  das_vencimento?: string;
  das_pago_em?: string;
  icms_a_pagar?: number;
  iss_a_pagar?: number;
  pis_a_pagar?: number;
  cofins_a_pagar?: number;
  irpj_valor?: number;
  csll_valor?: number;
  aliquota_efetiva?: number;
  status?: string;
  checklist?: Record<string, boolean>;
}

const CHECKLIST_LABELS: Record<string, string> = {
  nfe_entrada_ok:       "NF-e de entrada escrituradas",
  nfe_saida_ok:         "NF-e de saída escrituradas",
  folha_ok:             "Folha de pagamento lançada",
  conciliacao_ok:       "Conciliação bancária 100%",
  provisoes_ok:         "Provisões lançadas (férias, 13º)",
  depreciacao_ok:       "Depreciação lançada",
  pgdas_transmitido:    "PGDAS-D transmitido",
  das_enviado_cliente:  "DAS enviado ao cliente",
  balancete_ok:         "Balancete gerado e equilibrado",
};

const fmtBRL = (v?: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtPct = (v?: number | null) =>
  v != null ? (v * 100).toFixed(2) + "%" : "—";

interface Props {
  clienteId: string;
  regime: string;
  mesReferencia?: string; // Se omitido, usa o mês anterior
}

function getMesAnterior(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ApuracaoMensalCard({ clienteId, regime, mesReferencia }: Props) {
  const mes = mesReferencia ?? getMesAnterior();
  const [apuracao, setApuracao] = useState<ApuracaoMensal | null>(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving]     = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("apuracoes_mensais")
        .select("*")
        .eq("empresa_id", clienteId)
        .eq("mes_referencia", mes)
        .maybeSingle();
      setApuracao(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [clienteId, mes]);

  async function criarApuracao() {
    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
        .from("apuracoes_mensais")
        .upsert({
          empresa_id: clienteId,
          mes_referencia: mes,
          regime,
          status: "em_andamento",
        })
        .select()
        .single();
      if (error) throw error;
      setApuracao(data);
      toast.success("Apuração criada para " + mes);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleChecklist(key: string) {
    if (!apuracao) return;
    const current = apuracao.checklist ?? {};
    const updated = { ...current, [key]: !current[key] };
    const { error } = await (supabase as any)
      .from("apuracoes_mensais")
      .update({ checklist: updated })
      .eq("id", apuracao.id);
    if (error) { toast.error("Erro ao atualizar checklist"); return; }
    setApuracao(prev => prev ? { ...prev, checklist: updated } : prev);
  }

  async function fecharPeriodo() {
    if (!apuracao) return;
    const checklist = apuracao.checklist ?? {};
    const pendentes = Object.entries(CHECKLIST_LABELS)
      .filter(([k]) => !checklist[k])
      .map(([, v]) => v);

    if (pendentes.length > 0) {
      toast.error(`Pendências: ${pendentes.slice(0, 2).join(", ")}${pendentes.length > 2 ? ` e +${pendentes.length - 2}` : ""}`);
      return;
    }

    const { error } = await (supabase as any)
      .from("apuracoes_mensais")
      .update({ status: "fechado" })
      .eq("id", apuracao.id);

    if (error) { toast.error("Erro ao fechar: " + error.message); return; }
    toast.success(`Competência ${mes} fechada`);
    carregar();
  }

  const [mesLabel, ano] = (() => {
    const [y, m] = mes.split("-");
    const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return [meses[parseInt(m) - 1], y];
  })();

  const checkTotal  = Object.keys(CHECKLIST_LABELS).length;
  const checkOk     = Object.entries(apuracao?.checklist ?? {}).filter(([k, v]) => CHECKLIST_LABELS[k] && v).length;
  const pctFechamento = checkTotal > 0 ? Math.round((checkOk / checkTotal) * 100) : 0;

  return (
    <div className="surface-card overflow-hidden">
      {/* Header clicável */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        onClick={e => { e.stopPropagation(); setExpanded(o => !o); }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Apuração — {mesLabel}/{ano}</p>
            <p className="text-[11px] text-muted-foreground">{regime} · {pctFechamento}% concluído</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {apuracao?.status === "fechado" && (
            <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> Fechado
            </span>
          )}
          {!loading && !apuracao && (
            <span className="text-[11px] text-muted-foreground/60">Não iniciada</span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/40">

          {loading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && !apuracao && (
            <div className="flex flex-col items-center py-6 gap-3">
              <p className="text-sm text-muted-foreground">Apuração não iniciada para esta competência</p>
              <Button
                type="button"
                size="sm"
                onClick={e => { e.stopPropagation(); criarApuracao(); }}
                disabled={saving}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Iniciar apuração
              </Button>
            </div>
          )}

          {!loading && apuracao && (
            <>
              {/* Valores apurados */}
              {(apuracao.das_valor || apuracao.receita_bruta || apuracao.icms_a_pagar) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
                  {apuracao.receita_bruta != null && (
                    <div className="rounded-xl bg-muted/30 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Receita Bruta</p>
                      <p className="text-base font-bold tabular-nums">{fmtBRL(apuracao.receita_bruta)}</p>
                    </div>
                  )}
                  {apuracao.aliquota_efetiva != null && apuracao.aliquota_efetiva > 0 && (
                    <div className="rounded-xl bg-muted/30 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Alíquota Efetiva</p>
                      <p className="text-base font-bold tabular-nums">{fmtPct(apuracao.aliquota_efetiva)}</p>
                    </div>
                  )}
                  {apuracao.das_valor != null && apuracao.das_valor > 0 && (
                    <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">DAS a Pagar</p>
                      <p className="text-base font-bold tabular-nums text-primary">{fmtBRL(apuracao.das_valor)}</p>
                    </div>
                  )}
                  {apuracao.icms_a_pagar != null && apuracao.icms_a_pagar > 0 && (
                    <div className="rounded-xl bg-muted/30 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ICMS a Pagar</p>
                      <p className="text-base font-bold tabular-nums">{fmtBRL(apuracao.icms_a_pagar)}</p>
                    </div>
                  )}
                  {apuracao.iss_a_pagar != null && apuracao.iss_a_pagar > 0 && (
                    <div className="rounded-xl bg-muted/30 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ISS a Pagar</p>
                      <p className="text-base font-bold tabular-nums">{fmtBRL(apuracao.iss_a_pagar)}</p>
                    </div>
                  )}
                  {apuracao.irpj_valor != null && apuracao.irpj_valor > 0 && (
                    <div className="rounded-xl bg-muted/30 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">IRPJ</p>
                      <p className="text-base font-bold tabular-nums">{fmtBRL(apuracao.irpj_valor)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Checklist de fechamento */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Checklist de fechamento</p>
                  <span className="text-xs font-bold tabular-nums">{checkOk}/{checkTotal}</span>
                </div>
                {/* Barra de progresso */}
                <div className="h-1.5 w-full bg-muted rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pctFechamento}%` }}
                  />
                </div>
                <div className="space-y-1.5">
                  {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                    const ok = !!(apuracao.checklist?.[key]);
                    const locked = apuracao.status === "fechado";
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={locked}
                        onClick={e => { e.stopPropagation(); toggleChecklist(key); }}
                        className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                          locked ? "cursor-default" : "hover:bg-muted/40 cursor-pointer"
                        }`}
                      >
                        {ok
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        }
                        <span className={`text-xs ${ok ? "line-through text-muted-foreground/60" : "text-foreground"}`}>
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ações */}
              {apuracao.status !== "fechado" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8"
                    onClick={e => { e.stopPropagation(); toast.info("Geração de DAS via SERPRO em implementação"); }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Gerar DAS
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5 h-8 ml-auto"
                    onClick={e => { e.stopPropagation(); fecharPeriodo(); }}
                    disabled={pctFechamento < 100}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Fechar competência
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

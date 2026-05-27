/**
 * ApuracaoMensalCard — Card de apuração fiscal por competência
 * 
 * Redesenhado para operação humana:
 * - Cada etapa explica O QUE É e O QUE O USUÁRIO DEVE FAZER
 * - Ações diretas por etapa (não só checkbox cego)
 * - Progresso visual claro
 * - Status por regime (Simples Nacional vs LP/LR)
 */
import { useState, useEffect } from "react";
import {
  Calculator, CheckCircle2, Circle, ChevronDown, ChevronUp,
  Loader2, FileText, Lock, ArrowRight, Receipt, Users,
  CreditCard, BarChart3, Send, Building2, BookOpen, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

// ─── Definição das etapas com contexto humano ───────────────────────────────
interface Etapa {
  key: string;
  label: string;
  descricao: string;          // O que o usuário precisa fazer
  icone: any;
  acao?: string;              // Texto do botão de ação (opcional)
  categoria: "entrada" | "saida" | "dp" | "fiscal" | "contabil" | "fechamento";
}

const ETAPAS_SIMPLES: Etapa[] = [
  {
    key: "nfe_entrada_ok",
    label: "Notas de Entrada",
    descricao: "Verifique se todas as notas fiscais recebidas pelo cliente no mês foram registradas. Vá em NF Recebidas e confirme que a lista está completa.",
    icone: FileText,
    acao: "Ver NF Recebidas",
    categoria: "entrada",
  },
  {
    key: "nfe_saida_ok",
    label: "Notas de Saída",
    descricao: "Confirme que todas as notas emitidas pelo cliente no mês estão registradas. Vá em NF Emitidas e valide se bate com o movimento real.",
    icone: Send,
    acao: "Ver NF Emitidas",
    categoria: "saida",
  },
  {
    key: "folha_ok",
    label: "Folha de Pagamento",
    descricao: "Se o cliente tem funcionários, a folha do mês precisa estar calculada e lançada. Vá em Dep. Pessoal e verifique se a folha do mês está com status 'calculada'.",
    icone: Users,
    acao: "Ver DP",
    categoria: "dp",
  },
  {
    key: "conciliacao_ok",
    label: "Conciliação Bancária",
    descricao: "Compare o extrato bancário do cliente com os lançamentos do sistema. Toda entrada e saída deve ter um lançamento correspondente. Solicite o extrato ao cliente se necessário.",
    icone: CreditCard,
    acao: "Ver Financeiro",
    categoria: "contabil",
  },
  {
    key: "pgdas_transmitido",
    label: "PGDAS-D Transmitido",
    descricao: "A declaração mensal do Simples Nacional (PGDAS-D) precisa ser transmitida antes do vencimento. Vá em Consultas Fiscais > PGDAS para verificar o status e transmitir se necessário.",
    icone: Building2,
    acao: "Ver PGDAS",
    categoria: "fiscal",
  },
  {
    key: "das_enviado_cliente",
    label: "DAS Enviado ao Cliente",
    descricao: "Após gerar o DAS (guia de pagamento do Simples), envie o código de barras ao cliente via WhatsApp ou e-mail para que ele realize o pagamento até o dia 20.",
    icone: Receipt,
    acao: "Gerar DAS",
    categoria: "fiscal",
  },
  {
    key: "balancete_ok",
    label: "Balancete Verificado",
    descricao: "Gere o balancete do mês no módulo Contábil e verifique se está equilibrado (Total Débitos = Total Créditos). Um balancete desequilibrado indica lançamento incorreto.",
    icone: BarChart3,
    acao: "Ver Contábil",
    categoria: "contabil",
  },
];

// Para LP/LR, adiciona etapas adicionais
const ETAPAS_EXTRAS_LP_LR: Etapa[] = [
  {
    key: "provisoes_ok",
    label: "Provisões Lançadas",
    descricao: "Lance as provisões mensais: 1/12 do 13º salário e 1/12 de férias por funcionário. Se o cliente não tem funcionários, marque como concluído.",
    icone: BookOpen,
    categoria: "contabil",
  },
  {
    key: "depreciacao_ok",
    label: "Depreciação Lançada",
    descricao: "Calcule e lance a depreciação mensal dos ativos imobilizados do cliente (equipamentos, veículos, móveis). Se não há ativos, marque como concluído.",
    icone: Calculator,
    categoria: "contabil",
  },
];

const CATEGORIA_COR: Record<string, string> = {
  entrada:   "bg-blue-50 text-blue-700 border-blue-200",
  saida:     "bg-purple-50 text-purple-700 border-purple-200",
  dp:        "bg-amber-50 text-amber-700 border-amber-200",
  fiscal:    "bg-orange-50 text-orange-700 border-orange-200",
  contabil:  "bg-slate-50 text-slate-700 border-slate-200",
  fechamento:"bg-emerald-50 text-emerald-700 border-emerald-200",
};

const CATEGORIA_LABEL: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  dp: "Dep. Pessoal",
  fiscal: "Fiscal",
  contabil: "Contábil",
  fechamento: "Fechamento",
};

const fmtBRL = (v?: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

interface Props {
  clienteId: string;
  regime: string;
  mesReferencia?: string;
  /** Callbacks para navegar para outras abas */
  onNavegar?: (aba: "fiscal" | "dp" | "contabil" | "financeiro") => void;
}

function getMesAnterior(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMesLabel(mes: string): { mesLabel: string; ano: string } {
  const [y, m] = mes.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return { mesLabel: meses[parseInt(m) - 1], ano: y };
}

export function ApuracaoMensalCard({ clienteId, regime, mesReferencia, onNavegar }: Props) {
  const mes = mesReferencia ?? getMesAnterior();
  const { mesLabel, ano } = getMesLabel(mes);

  const [apuracao, setApuracao] = useState<ApuracaoMensal | null>(null);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving]     = useState(false);

  // Determinar etapas por regime
  const regimeUpper = (regime ?? "").toUpperCase();
  const isSimples = regimeUpper.includes("SIMPLES") || regimeUpper === "MEI";
  const etapas = isSimples
    ? ETAPAS_SIMPLES
    : [...ETAPAS_SIMPLES.filter(e => !["pgdas_transmitido","das_enviado_cliente"].includes(e.key)), ...ETAPAS_EXTRAS_LP_LR];

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
          checklist: {},
        })
        .select()
        .single();
      if (error) throw error;
      setApuracao(data);
      toast.success(`Apuração ${mesLabel}/${ano} iniciada`);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEtapa(key: string) {
    if (!apuracao) return;
    const atual = apuracao.checklist ?? {};
    const novo = { ...atual, [key]: !atual[key] };
    const { error } = await (supabase as any)
      .from("apuracoes_mensais")
      .update({ checklist: novo })
      .eq("id", apuracao.id);
    if (error) { toast.error("Erro ao salvar"); return; }
    setApuracao(prev => prev ? { ...prev, checklist: novo } : prev);
    if (!atual[key]) toast.success("Etapa marcada como concluída");
  }

  async function fecharPeriodo() {
    if (!apuracao) return;
    const checklist = apuracao.checklist ?? {};
    const pendentes = etapas.filter(e => !checklist[e.key]).map(e => e.label);
    if (pendentes.length > 0) {
      toast.error(`Conclua primeiro: ${pendentes.slice(0, 2).join(", ")}${pendentes.length > 2 ? ` (+${pendentes.length - 2})` : ""}`);
      return;
    }
    const { error } = await (supabase as any)
      .from("apuracoes_mensais")
      .update({ status: "fechado" })
      .eq("id", apuracao.id);
    if (error) { toast.error("Erro ao fechar: " + error.message); return; }
    toast.success(`Competência ${mesLabel}/${ano} fechada com sucesso!`);
    carregar();
  }

  const checklist = apuracao?.checklist ?? {};
  const total = etapas.length;
  const concluidas = etapas.filter(e => checklist[e.key]).length;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  const fechado = apuracao?.status === "fechado";

  function handleAcao(etapa: Etapa) {
    if (!onNavegar) return;
    if (etapa.acao?.includes("NF")) onNavegar("fiscal");
    else if (etapa.acao?.includes("DP")) onNavegar("dp");
    else if (etapa.acao?.includes("Contábil")) onNavegar("contabil");
    else if (etapa.acao?.includes("Financeiro")) onNavegar("financeiro");
    else if (etapa.acao?.includes("DAS") || etapa.acao?.includes("PGDAS")) onNavegar("fiscal");
  }

  return (
    <div className="surface-card overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Apuração — {mesLabel}/{ano}</p>
            <p className="text-[11px] text-muted-foreground">
              {regime} · {apuracao ? `${concluidas}/${total} etapas` : "Não iniciada"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fechado && (
            <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> Fechado
            </span>
          )}
          {apuracao && !fechado && pct > 0 && (
            <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {pct}%
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Estado: apuração não iniciada */}
          {!loading && !apuracao && (
            <div className="px-5 py-6 flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
                <Calculator className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">Apuração de {mesLabel}/{ano} não iniciada</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Clique em "Iniciar" para abrir o checklist de fechamento mensal.
                  Você será guiado por cada etapa necessária.
                </p>
              </div>
              <Button size="sm" onClick={criarApuracao} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Iniciar apuração
              </Button>
            </div>
          )}

          {/* Estado: apuração iniciada — lista de etapas */}
          {!loading && apuracao && (
            <div className="divide-y divide-border/40">
              {/* Barra de progresso */}
              <div className="px-5 py-3 bg-muted/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Progresso do fechamento
                  </span>
                  <span className="text-[11px] font-bold text-foreground">{concluidas}/{total}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Valores apurados (se preenchidos) */}
              {(apuracao.das_valor || apuracao.receita_bruta) && (
                <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {apuracao.receita_bruta != null && (
                    <div className="rounded-lg bg-muted/30 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Receita Bruta</p>
                      <p className="text-sm font-bold tabular-nums">{fmtBRL(apuracao.receita_bruta)}</p>
                    </div>
                  )}
                  {apuracao.das_valor != null && apuracao.das_valor > 0 && (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">DAS a Pagar</p>
                      <p className="text-sm font-bold tabular-nums text-primary">{fmtBRL(apuracao.das_valor)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Etapas */}
              {etapas.map((etapa) => {
                const ok = !!checklist[etapa.key];
                const Icon = etapa.icone;
                return (
                  <div
                    key={etapa.key}
                    className={`px-5 py-3.5 flex items-start gap-3 transition-colors ${fechado ? "opacity-60" : "hover:bg-muted/10"}`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      className="mt-0.5 flex-shrink-0"
                      onClick={() => !fechado && toggleEtapa(etapa.key)}
                      disabled={fechado}
                    >
                      {ok
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        : <Circle className="h-5 w-5 text-muted-foreground/40" />
                      }
                    </button>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${ok ? "line-through text-muted-foreground/60" : "text-foreground"}`}>
                          {etapa.label}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${CATEGORIA_COR[etapa.categoria]}`}>
                          {CATEGORIA_LABEL[etapa.categoria]}
                        </span>
                      </div>

                      {/* Descrição expandida — só mostra se não concluído */}
                      {!ok && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                          {etapa.descricao}
                        </p>
                      )}

                      {/* Botão de ação direta */}
                      {!ok && etapa.acao && onNavegar && (
                        <button
                          type="button"
                          className="mt-1.5 text-[11px] font-semibold text-primary flex items-center gap-1 hover:underline"
                          onClick={() => handleAcao(etapa)}
                        >
                          {etapa.acao} <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Botão fechar período */}
              <div className="px-5 py-4">
                {fechado ? (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Competência {mesLabel}/{ano} fechada</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={fecharPeriodo}
                      disabled={pct < 100}
                      className="gap-2"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Fechar Competência
                    </Button>
                    {pct < 100 && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {total - concluidas} etapa{total - concluidas > 1 ? "s" : ""} pendente{total - concluidas > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

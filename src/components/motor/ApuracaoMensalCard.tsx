/**
 * ApuracaoMensalCard — UX guiada por etapas
 * Sprint 2 fix: seletor de mês/ano + progresso visual + ações inline
 * Estado local (useState) — sem persistência nesta versão
 */
import { useState } from "react";
import {
  Calculator, CheckCircle2, Circle, Loader2,
  FileText, Send, Users, CreditCard, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Etapa {
  key: string;
  label: string;
  categoria: "Fiscal" | "DP" | "Contábil";
  acaoLabel?: string;
}

const ETAPAS_SN: Etapa[] = [
  { key: "faturamento",  label: "Lançar faturamento do mês",       categoria: "Fiscal"   },
  { key: "nf_emitidas",  label: "Conferir notas emitidas",          categoria: "Fiscal"   },
  { key: "pro_labore",   label: "Verificar pró-labore",             categoria: "DP"       },
  { key: "pgdas",        label: "Transmitir PGDAS-D",               categoria: "Fiscal",  acaoLabel: "Transmitir" },
  { key: "das",          label: "Gerar DAS e enviar ao cliente",    categoria: "Fiscal",  acaoLabel: "Gerar DAS"  },
];

const CATEGORIA_STYLE: Record<string, string> = {
  Fiscal:  "bg-blue-50 text-blue-700 border-blue-200",
  DP:      "bg-purple-50 text-purple-700 border-purple-200",
  Contábil:"bg-emerald-50 text-emerald-700 border-emerald-200",
};

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function gerarAnos(): number[] {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1];
}

interface Props {
  clienteId: string;
  regime: string;
  /** Callback para navegar para outra aba da ficha */
  onNavegar?: (aba: "fiscal" | "dp" | "contabil" | "financeiro") => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────
export function ApuracaoMensalCard({ regime, onNavegar }: Props) {
  const hoje = new Date();

  // Seletor de mês/ano — default = mês corrente
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);   // 1-12
  const [ano, setAno] = useState<number>(hoje.getFullYear());

  // Checklist local (sem persistência — UX apenas)
  const [concluidas, setConcluidas] = useState<Set<string>>(new Set());
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);

  const regimeLabel = (() => {
    const r = (regime ?? "").toUpperCase();
    if (r.includes("MEI"))     return "MEI";
    if (r.includes("SIMPLES")) return "Simples Nacional";
    if (r.includes("PRESUMIDO")) return "Lucro Presumido";
    if (r.includes("REAL"))    return "Lucro Real";
    return regime ?? "—";
  })();

  // Apenas Simples Nacional neste sprint
  const etapas = ETAPAS_SN;

  const total      = etapas.length;
  const qtdOk      = etapas.filter(e => concluidas.has(e.key)).length;
  const pct        = total > 0 ? Math.round((qtdOk / total) * 100) : 0;
  const tudoFeito  = qtdOk === total;

  function toggle(key: string) {
    setConcluidas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleAcao(etapa: Etapa) {
    setAcaoLoading(etapa.key);
    await new Promise(r => setTimeout(r, 600)); // feedback visual
    setAcaoLoading(null);

    if (onNavegar) {
      if (etapa.categoria === "DP")      { onNavegar("dp");       return; }
      if (etapa.categoria === "Contábil"){ onNavegar("contabil"); return; }
      onNavegar("fiscal");
    }
  }

  function handleContinuar() {
    if (tudoFeito) return;
    // Navegar para a primeira etapa pendente
    const pendente = etapas.find(e => !concluidas.has(e.key));
    if (!pendente || !onNavegar) return;
    if (pendente.categoria === "DP")      { onNavegar("dp");       return; }
    if (pendente.categoria === "Contábil"){ onNavegar("contabil"); return; }
    onNavegar("fiscal");
  }

  return (
    <div className="surface-card overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">
              Apuração — {MESES[mes - 1]}/{ano}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{regimeLabel}</p>
          </div>
        </div>

        {/* Seletor mês/ano */}
        <div className="flex items-center gap-2">
          <Select value={String(mes)} onValueChange={v => { setMes(Number(v)); setConcluidas(new Set()); }}>
            <SelectTrigger className="h-7 w-28 text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MESES.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(ano)} onValueChange={v => { setAno(Number(v)); setConcluidas(new Set()); }}>
            <SelectTrigger className="h-7 w-20 text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gerarAnos().map(y => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Barra de progresso ────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">
            {qtdOk}/{total} etapas concluídas
          </span>
          <span className="text-xs font-semibold text-primary">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2 rounded-full" />
      </div>

      {/* ── Lista de etapas ───────────────────────────────────────────────── */}
      <ul className="px-5 pb-3 space-y-2 mt-2">
        {etapas.map((etapa, idx) => {
          const feita   = concluidas.has(etapa.key);
          const anterior = idx === 0 || concluidas.has(etapas[idx - 1].key);
          const emAndamento = !feita && anterior;

          return (
            <li
              key={etapa.key}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                feita        ? "bg-emerald-50/60"  :
                emAndamento  ? "bg-primary/5 ring-1 ring-primary/20" :
                               "bg-muted/30 opacity-60",
              ].join(" ")}
            >
              {/* Ícone de status */}
              <button
                type="button"
                className="shrink-0 hover:scale-110 transition-transform"
                onClick={() => toggle(etapa.key)}
                title={feita ? "Marcar como pendente" : "Marcar como concluída"}
              >
                {feita ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : emAndamento ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
              </button>

              {/* Título + badge */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={[
                    "text-sm font-medium",
                    feita ? "line-through text-muted-foreground" : "",
                  ].join(" ")}>
                    {etapa.label}
                  </span>
                  <Badge
                    variant="outline"
                    className={["text-[10px] px-1.5 py-0 h-4 font-medium", CATEGORIA_STYLE[etapa.categoria]].join(" ")}
                  >
                    {etapa.categoria}
                  </Badge>
                </div>
              </div>

              {/* Botão de ação inline (apenas se pendente e ativa) */}
              {!feita && emAndamento && etapa.acaoLabel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-6 text-[11px] rounded-lg px-2 gap-1"
                  disabled={acaoLoading === etapa.key}
                  onClick={() => handleAcao(etapa)}
                >
                  {acaoLoading === etapa.key
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Send className="h-3 w-3" />
                  }
                  {etapa.acaoLabel}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {/* ── Rodapé ────────────────────────────────────────────────────────── */}
      <div className="px-5 pb-4 pt-1">
        <Button
          className="w-full rounded-xl h-9 text-sm font-medium"
          variant={tudoFeito ? "outline" : "default"}
          disabled={tudoFeito}
          onClick={handleContinuar}
        >
          {tudoFeito ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-500" />
              Apuração concluída ✅
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-1.5" />
              Continuar apuração
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

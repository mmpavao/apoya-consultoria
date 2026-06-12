/**
 * Hook: useDashboard
 * KPIs reais do dashboard — substitui 100% os mocks estáticos do _app.index.tsx
 * Fonte: Supabase (clientes, das_guias, cobrancas, obrigacoes, mensagem_whatsapp,
 *                  calendario_fiscal, nfse_emitida)
 */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ── Tipos ─────────────────────────────────────────────────── */
export interface DashboardKpis {
  clientesAtivos:    number;
  clientesTotal:     number;
  inadimplentes:     number;
  suspensos:         number;
  dasEmAberto:       number;       // pendente ou vencida
  dasVencendoHoje:   number;
  honorariosMes:     number;       // cobranças pagas no mês corrente
  honorariosAtraso:  number;       // cobranças vencidas
  obrigacoesMes:     number;       // total de obrigações do mês
  obrigacoesPendentes: number;
  obrigacoesAtrasadas: number;
  wasMsgNaoLidas:    number;
  nfseEmitidaMes:    number;
}

export interface CalFiscalItem {
  dia:      string;    // "20"
  mes:      string;    // "Mai"
  label:    string;
  urgente:  boolean;
}

export interface ClienteRecente {
  id:         string;
  nome:       string;
  regime:     string;
  status:     string;
  honorario:  string;
}

export interface HonorarioMes {
  mes:       string;
  recebido:  number;
  previsto:  number;
}

export interface AlertaDash {
  tipo:   "danger" | "warning" | "success" | "info";
  texto:  string;
  sub:    string;
}

export interface DashboardData {
  kpis:            DashboardKpis;
  calFiscal:       CalFiscalItem[];
  clientesRecentes: ClienteRecente[];
  honorariosData:  HonorarioMes[];
  alertas:         AlertaDash[];
}

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const ZERO_KPIS: DashboardKpis = {
  clientesAtivos: 0, clientesTotal: 0, inadimplentes: 0, suspensos: 0,
  dasEmAberto: 0, dasVencendoHoje: 0,
  honorariosMes: 0, honorariosAtraso: 0,
  obrigacoesMes: 0, obrigacoesPendentes: 0, obrigacoesAtrasadas: 0,
  wasMsgNaoLidas: 0, nfseEmitidaMes: 0,
};

export function useDashboard() {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now   = new Date();
      const year  = now.getFullYear();
      const month = now.getMonth(); // 0-based
      const mesAtual = `${year}-${String(month + 1).padStart(2, "0")}`;
      const hoje  = now.toISOString().slice(0, 10);
      const amanha = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);

      /* ── 1. Clientes ───────────────────────────────────── */
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, razao_social, regime, status, valor_honorario, created_at")
        .order("created_at", { ascending: false });

      const clientesArr  = clientes ?? [];
      const ativos       = clientesArr.filter(c => c.status === "ativo").length;
      const inadimplentes = clientesArr.filter(c => c.status === "inadimplente").length;
      const suspensos    = clientesArr.filter(c => c.status === "suspenso").length;

      const clientesRecentes: ClienteRecente[] = clientesArr.slice(0, 6).map(c => ({
        id:        c.id,
        nome:      c.razao_social ?? "—",
        regime:    c.regime ?? "—",
        status:    c.status ?? "inativo",
        honorario: c.valor_honorario
          ? `R$ ${Number(c.valor_honorario).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
          : "—",
      }));

      /* ── 2. DAS ─────────────────────────────────────────── */
      const { data: dasGuias } = await supabase
        .from("das_guias")
        .select("status, vencimento")
        .in("status", ["pendente", "gerada", "enviada", "vencida"])
        .then(r => r, () => ({ data: [] })) as any;

      const dasArr       = (dasGuias ?? []) as any[];
      const dasEmAberto  = dasArr.filter(d => ["pendente","gerada","enviada"].includes(d.status)).length;
      const dasVencHoje  = dasArr.filter(d => d.vencimento === hoje || d.vencimento === amanha).length;

      /* ── 3. Cobranças ────────────────────────────────────── */
      const { data: cobrancas } = await supabase
        .from("cobrancas")
        .select("status, valor, competencia, vencimento");

      const cobArr = cobrancas ?? [];
      const honorariosMes = cobArr
        .filter(c => c.status === "paga" && (c.competencia ?? "").startsWith(mesAtual))
        .reduce((s, c) => s + Number(c.valor ?? 0), 0);
      const honorariosAtraso = cobArr
        .filter(c => c.status === "vencida")
        .reduce((s, c) => s + Number(c.valor ?? 0), 0);

      /* ── 4. Obrigações ───────────────────────────────────── */
      const { data: obrigacoes } = await supabase
        .from("obrigacoes")
        .select("status, competencia, vencimento");

      const obArr = obrigacoes ?? [];
      const obPendentes = obArr.filter(o => o.status === "pendente").length;
      const obAtrasadas = obArr.filter(
        o => o.status === "pendente" && o.vencimento && o.vencimento < hoje
      ).length;

      /* ── 5. WhatsApp não lidas ──────────────────────────── */
      const waNaoLidasResult = await supabase
        .from("mensagem_whatsapp")
        .select("id", { count: "exact", head: true })
        .is("lida_em", null)
        .eq("direcao", "recebida")
        .then(r => r, () => ({ count: 0 }));
      const waNaoLidas = waNaoLidasResult.count;

      /* ── 6. NFS-e emitidas no mês ───────────────────────── */
      const nfseResult = await supabase
        .from("nfse_emitida")
        .select("id", { count: "exact", head: true })
        .eq("status", "emitida")
        .gte("created_at", `${mesAtual}-01`)
        .then(r => r, () => ({ count: 0 }));
      const nfseCount = nfseResult.count;

      /* ── 7. Honorários por mês (últimos 6) ──────────────── */
      const honorariosData: HonorarioMes[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(year, month - i, 1);
        const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const mesLabel = MESES_ABREV[d.getMonth()];
        const recebido = cobArr
          .filter(c => c.status === "paga" && (c.competencia ?? "").startsWith(mesStr))
          .reduce((s, c) => s + Number(c.valor ?? 0), 0);
        const previsto = clientesArr
          .filter(c => c.status === "ativo")
          .reduce((s, c) => s + Number(c.valor_honorario ?? 0), 0);
        honorariosData.push({ mes: mesLabel, recebido, previsto });
      }

      /* ── 8. Calendário fiscal — próximas obrigações ─────── */
      const calFiscalResult = await supabase
        .from("calendario_fiscal")
        .select("nome, dia_vencimento, mes_vencimento, periodicidade")
        .eq("ativo", true)
        .order("dia_vencimento", { ascending: true })
        .limit(5)
        .then(r => r, () => ({ data: [] as any[] }));
      const calItems = calFiscalResult.data;

      const calFiscal: CalFiscalItem[] = (calItems ?? []).map((item: any) => {
        const mesRef  = item.mes_vencimento ?? (month + 1);
        const mesAbrev = MESES_ABREV[(mesRef - 1) % 12];
        const diaStr  = String(item.dia_vencimento ?? 20).padStart(2, "0");
        const dataVenc = new Date(year, mesRef - 1, item.dia_vencimento ?? 20);
        const diffDias = Math.ceil((dataVenc.getTime() - now.getTime()) / 86_400_000);
        return {
          dia:     diaStr,
          mes:     mesAbrev,
          label:   item.nome,
          urgente: diffDias >= 0 && diffDias <= 5,
        };
      });

      /* ── 9. Alertas dinâmicos ────────────────────────────── */
      const alertas: AlertaDash[] = [];

      if (dasVencHoje > 0)
        alertas.push({ tipo: "danger",  texto: `${dasVencHoje} DAS vencendo hoje/amanhã`, sub: "Ação necessária" });
      if (inadimplentes > 0)
        alertas.push({ tipo: "warning", texto: `${inadimplentes} cliente${inadimplentes > 1 ? "s" : ""} inadimplente${inadimplentes > 1 ? "s" : ""}`, sub: "Verificar régua de cobrança" });
      if (obAtrasadas > 0)
        alertas.push({ tipo: "danger",  texto: `${obAtrasadas} obrigação${obAtrasadas > 1 ? "ões" : ""} atrasada${obAtrasadas > 1 ? "s" : ""}`, sub: "Prazo já vencido" });
      if (obPendentes > 0)
        alertas.push({ tipo: "warning", texto: `${obPendentes} obrigação${obPendentes > 1 ? "ões" : ""} pendente${obPendentes > 1 ? "s" : ""} este mês`, sub: "Verificar checklist" });
      if (alertas.length === 0)
        alertas.push({ tipo: "success", texto: "Tudo em dia 🎉", sub: "Nenhum alerta crítico no momento" });

      /* ── Montar resultado ────────────────────────────────── */
      const kpis: DashboardKpis = {
        clientesAtivos:      ativos,
        clientesTotal:       clientesArr.length,
        inadimplentes,
        suspensos,
        dasEmAberto,
        dasVencendoHoje:     dasVencHoje,
        honorariosMes,
        honorariosAtraso,
        obrigacoesMes:       obArr.length,
        obrigacoesPendentes: obPendentes,
        obrigacoesAtrasadas: obAtrasadas,
        wasMsgNaoLidas:      waNaoLidas ?? 0,
        nfseEmitidaMes:      nfseCount  ?? 0,
      };

      setData({ kpis, calFiscal, clientesRecentes, honorariosData, alertas });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar dashboard";
      setError(msg);
      setData({
        kpis: ZERO_KPIS, calFiscal: [], clientesRecentes: [],
        honorariosData: [], alertas: [{ tipo: "danger", texto: "Erro ao carregar dados", sub: msg }],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}

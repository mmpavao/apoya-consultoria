/**
 * Rota: /contabil — Contabilidade (visão consolidada)
 * KPIs + tabela de todos os clientes com períodos contábeis
 * Escopo: Simples Nacional apenas
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { BookOpen, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, KpiGrid, KpiCard } from "@/components/PagePlaceholder";
import { DataTable, InlineBadge, type ColDef } from "@/components/DataTable";
import { useAbrirPeriodo } from "@/hooks/use-contabil";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contabil")({
  component: ContabilPage,
  head: () => ({ meta: [{ title: "Contábil · APOYA Gestão" }] }),
});

interface ClienteContabil {
  id: string;
  razao_social: string;
  regime: string;
  periodo_status: string | null;
  qtd_lancamentos: number;
  ultimo_fechamento: string | null;
  tem_divergencia: boolean;
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function ContabilPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<ClienteContabil[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAbrirPeriodo, setShowAbrirPeriodo] = useState(false);
  const { abrirPeriodo, loading: abrindo } = useAbrirPeriodo();
  const [periodoForm, setPeriodoForm] = useState({
    empresa_id: "",
    competencia: new Date().toISOString().slice(0, 7),
  });
  const competencia = mesAtual();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;

        const { data: clientesData } = await db
          .from("clientes")
          .select("id, razao_social, regime")
          .eq("status", "ativo")
          .order("razao_social");

        if (!clientesData?.length) { setClientes([]); setLoading(false); return; }

        const ids = clientesData.map((c: { id: string }) => c.id);

        // Períodos do mês atual
        const { data: periodosData } = await db
          .from("periodos_contabeis")
          .select("empresa_id, status, fechado_em")
          .in("empresa_id", ids)
          .eq("mes_referencia", competencia);

        const periodoMap: Record<string, { status: string; fechado_em: string | null }> = {};
        for (const p of periodosData ?? []) {
          periodoMap[p.empresa_id] = { status: p.status, fechado_em: p.fechado_em };
        }

        // Lançamentos do mês atual
        const { data: lancData } = await db
          .from("lancamentos_contabeis")
          .select("empresa_id")
          .in("empresa_id", ids)
          .eq("mes_referencia", competencia);

        const lancCount: Record<string, number> = {};
        for (const l of lancData ?? []) {
          lancCount[l.empresa_id] = (lancCount[l.empresa_id] ?? 0) + 1;
        }

        const lista: ClienteContabil[] = clientesData.map((c: { id: string; razao_social: string; regime: string }) => ({
          id: c.id,
          razao_social: c.razao_social,
          regime: c.regime,
          periodo_status: periodoMap[c.id]?.status ?? null,
          qtd_lancamentos: lancCount[c.id] ?? 0,
          ultimo_fechamento: periodoMap[c.id]?.fechado_em ?? null,
          tem_divergencia: false,
        }));

        setClientes(lista);
      } finally {
        setLoading(false);
      }
    })();
  }, [competencia]);

  const periodosAbertos   = clientes.filter(c => c.periodo_status === "aberto").length;
  const periodosFechados  = clientes.filter(c => c.periodo_status === "fechado").length;
  const semPeriodo        = clientes.filter(c => !c.periodo_status).length;
  const comDivergencia    = clientes.filter(c => c.tem_divergencia).length;

  const cols: ColDef<ClienteContabil>[] = [
    {
      key: "razao_social",
      header: "Cliente",
      render: (row) => (
        <button
          className="font-medium hover:underline text-primary text-left"
          onClick={() => navigate({ to: "/clientes/$id", params: { id: row.id } })}
        >
          {row.razao_social}
        </button>
      ),
    },
    {
      key: "regime",
      header: "Regime",
      render: (row) => <InlineBadge color="blue">{row.regime}</InlineBadge>,
    },
    {
      key: "periodo_status",
      header: `Período ${competencia.split("-").reverse().join("/")}`,
      render: (row) => {
        if (!row.periodo_status) return <InlineBadge color="gray">Sem período</InlineBadge>;
        return row.periodo_status === "fechado"
          ? <InlineBadge color="green">Fechado</InlineBadge>
          : <InlineBadge color="amber">Aberto</InlineBadge>;
      },
    },
    {
      key: "qtd_lancamentos",
      header: "Lançamentos",
      render: (row) => <span className="tabular-nums">{row.qtd_lancamentos}</span>,
    },
    {
      key: "ultimo_fechamento",
      header: "Últ. Fechamento",
      render: (row) => row.ultimo_fechamento
        ? <span className="text-sm">{new Date(row.ultimo_fechamento).toLocaleDateString("pt-BR")}</span>
        : <span className="text-muted-foreground text-sm">—</span>,
    },
    {
      key: "tem_divergencia",
      header: "Divergência",
      render: (row) => row.tem_divergencia
        ? <span className="flex items-center gap-1 text-red-600 text-xs font-medium"><AlertTriangle className="h-3 w-3" /> Sim</span>
        : <span className="text-muted-foreground text-sm">—</span>,
    },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Gestão"
        title="Contabilidade"
        subtitle="Visão consolidada de períodos contábeis de todos os clientes"
        actions={
          <Button size="sm" onClick={() => setShowAbrirPeriodo(true)} className="rounded-xl gap-1.5">
            <Plus className="h-4 w-4" /> Abrir Período
          </Button>
        }
      />

      {/* Dialog — Abrir Período */}
      <Dialog open={showAbrirPeriodo} onOpenChange={setShowAbrirPeriodo}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Abrir Período Contábil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-medium mb-1 block">Empresa</Label>
              <Select value={periodoForm.empresa_id} onValueChange={v => setPeriodoForm(f => ({ ...f, empresa_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente..." /></SelectTrigger>
                <SelectContent>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1 block">Mês de referência</Label>
              <Input
                type="month"
                value={periodoForm.competencia}
                onChange={e => setPeriodoForm(f => ({ ...f, competencia: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbrirPeriodo(false)}>Cancelar</Button>
            <Button
              disabled={abrindo || !periodoForm.empresa_id || !periodoForm.competencia}
              onClick={async () => {
                if (!periodoForm.empresa_id) { toast.error("Selecione uma empresa"); return; }
                const ok = await abrirPeriodo(periodoForm.empresa_id, periodoForm.competencia);
                if (ok) {
                  setShowAbrirPeriodo(false);
                  setPeriodoForm({ empresa_id: "", competencia: new Date().toISOString().slice(0, 7) });
                }
              }}
            >
              {abrindo ? "Abrindo..." : "Abrir Período"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KpiGrid cols={4}>
        <KpiCard icon={Clock}         label="Períodos Abertos"       value={periodosAbertos}  tone="warning" />
        <KpiCard icon={CheckCircle2}  label="Períodos Fechados"      value={periodosFechados} tone="success" />
        <KpiCard icon={BookOpen}      label="Sem Período no Mês"     value={semPeriodo}       tone={semPeriodo > 0 ? "danger" : "neutral"} />
        <KpiCard icon={AlertTriangle} label="Com Divergência"        value={comDivergencia}   tone={comDivergencia > 0 ? "danger" : "neutral"} />
      </KpiGrid>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando clientes...</div>
      ) : (
        <DataTable
          cols={cols}
          rows={clientes}
          emptyText="Nenhum cliente encontrado."
          getKey={(r) => r.id}
          onRowClick={(r) => navigate({ to: "/clientes/$id", params: { id: r.id } })}
        />
      )}
    </div>
  );
}

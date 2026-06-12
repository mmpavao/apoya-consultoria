/**
 * Rota: /contabil — Contabilidade (visão consolidada)
 * Pipeline de tarefas + KPIs + tabela de períodos contábeis por cliente
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SectorGuard } from "@/components/SectorGuard";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineKanban } from "@/components/PipelineKanban";
import { useAbrirPeriodo } from "@/hooks/use-contabil";
import { useAuth } from "@/hooks/use-auth";
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

function ContabilPage__Inner() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [clientes, setClientes] = useState<ClienteContabil[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAbrirPeriodo, setShowAbrirPeriodo] = useState(false);
  const { abrirPeriodo, loading: abrindo } = useAbrirPeriodo();
  const [periodoForm, setPeriodoForm] = useState({
    empresa_id: "",
    competencia: new Date().toISOString().slice(0, 7),
  });
  const competencia = mesAtual();
  const podeAprovar = roles.includes("admin") || roles.includes("contador");

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

        const { data: periodosData } = await db
          .from("periodos_contabeis")
          .select("empresa_id, status, fechado_em")
          .in("empresa_id", ids)
          .eq("mes_referencia", competencia);

        const periodoMap: Record<string, { status: string; fechado_em: string | null }> = {};
        for (const p of periodosData ?? []) {
          periodoMap[p.empresa_id] = { status: p.status, fechado_em: p.fechado_em };
        }

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
        subtitle={`Lançamentos, períodos e fechamento mensal · competência ${competencia.split("-").reverse().join("/")}`}
        actions={
          <Button size="sm" onClick={() => setShowAbrirPeriodo(true)} className="rounded-xl gap-1.5">
            <Plus className="h-4 w-4" /> Abrir Período
          </Button>
        }
      />

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

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="periodos">Períodos</TabsTrigger>
        
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="plano_contas">Plano de Contas</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-0">
          <PipelineKanban setor="contabil" podeAprovar={podeAprovar} />
        </TabsContent>

        <TabsContent value="periodos" className="mt-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Carregando clientes...</p>
            </div>
          ) : clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Nenhum cliente cadastrado</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Cadastre clientes em <strong>Clientes</strong> para que apareçam aqui com seus períodos contábeis.
                </p>
              </div>
            </div>
          ) : semPeriodo === clientes.length ? (
            <div className="mb-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Nenhum período aberto para {competencia.split("-").reverse().join("/")}
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Clique em <strong>+ Abrir Período</strong> para iniciar o mês contábil de cada cliente.
                    Sem período aberto, não é possível registrar lançamentos.
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <DataTable
                  cols={cols}
                  rows={clientes}
                  emptyText="Nenhum cliente encontrado."
                  getKey={(r) => r.id}
                  onRowClick={(r) => navigate({ to: "/clientes/$id", params: { id: r.id } })}
                />
              </div>
            </div>
          ) : (
            <DataTable
              cols={cols}
              rows={clientes}
              emptyText="Nenhum cliente encontrado."
              getKey={(r) => r.id}
              onRowClick={(r) => navigate({ to: "/clientes/$id", params: { id: r.id } })}
            />
          )}
        </TabsContent>

        {/* Lançamentos */}
        <TabsContent value="lancamentos" className="mt-0">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Lançamentos Contábeis</h3>
                <p className="text-sm text-muted-foreground">Débitos e créditos do período corrente</p>
              </div>
              <button className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted">+ Lançamento</button>
            </div>
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">Nenhum lançamento no período</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Abra um período contábil para registrar lançamentos</p>
            </div>
          </div>
        </TabsContent>

        {/* Plano de Contas */}
        <TabsContent value="plano_contas" className="mt-0">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h3 className="font-semibold">Plano de Contas</h3>
            <div className="grid gap-2">
              {["1 — Ativo", "2 — Passivo", "3 — Patrimônio Líquido", "4 — Receitas", "5 — Despesas"].map((c,i)=>(
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer">
                  <span className="text-sm font-mono text-foreground">{c}</span>
                  <span className="text-xs text-muted-foreground">►</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Automações */}
        <TabsContent value="automacoes" className="mt-0">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Automações Contábeis</h3>
              <a href="/automacoes"><button className="text-sm px-3 py-1.5 rounded-md border border-border">Gerenciar</button></a>
            </div>
            {[
              { nome: "Reconciliação Automática", desc: "Concilia extratos bancários com lançamentos" },
              { nome: "Fechamento Mensal", desc: "Fecha período e gera balancete automaticamente" },
            ].map((a,i)=>(
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div><p className="text-sm font-medium">{a.nome}</p><p className="text-xs text-muted-foreground">{a.desc}</p></div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Em breve</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Config */}
        <TabsContent value="config" className="mt-0">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4">Configurações Contábeis</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {[
                { label: "Aprovação antes de fechar período", enabled: true },
                { label: "Gerar balancete automaticamente", enabled: false },
                { label: "Notificar divergências ao contador", enabled: true },
              ].map((item,i)=>(
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="text-sm">{item.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {item.enabled ? "Ativo" : "Inativo"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContabilPage() {
  return (
    <SectorGuard setor="contabil">
      <ContabilPage__Inner />
    </SectorGuard>
  );
}

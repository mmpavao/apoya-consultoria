/**
 * Rota: /dp — Departamento Pessoal (visão consolidada)
 * KPIs + tabela de todos os clientes com empregados
 * Escopo: Simples Nacional apenas
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Users2, AlertTriangle, FileText, UserX, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, KpiGrid, KpiCard } from "@/components/PagePlaceholder";
import { DataTable, InlineBadge, type ColDef, type BadgeColor } from "@/components/DataTable";

export const Route = createFileRoute("/_app/dp")({
  component: DpPage,
  head: () => ({ meta: [{ title: "Dep. Pessoal · APOYA Gestão" }] }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClienteDP {
  id: string;
  razao_social: string;
  regime: string;
  qtd_funcionarios: number;
  status_folha: string | null;
  ferias_vencendo: number;
  proxima_obrigacao: string | null;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const FOLHA_COLOR: Record<string, BadgeColor> = {
  aberta:  "amber" as BadgeColor,
  fechada: "green",
  enviada: "blue",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function DpPage() {
  const [clientes, setClientes] = useState<ClienteDP[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroFolha, setFiltroFolha] = useState<string>("todos");
  const competencia = mesAtual();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any;

        // 1. Clientes com empregados
        const { data: clientesData } = await db
          .from("clientes")
          .select("id, razao_social, regime")
          .eq("tem_empregados", true)
          .order("razao_social");

        if (!clientesData?.length) { setClientes([]); setLoading(false); return; }

        const ids = clientesData.map((c: { id: string }) => c.id);

        // 2. Contagem de funcionários ativos por empresa
        const { data: funcData } = await db
          .from("funcionarios")
          .select("empresa_id")
          .in("empresa_id", ids)
          .eq("status", "ativo");

        const funcCount: Record<string, number> = {};
        for (const f of funcData ?? []) {
          funcCount[f.empresa_id] = (funcCount[f.empresa_id] ?? 0) + 1;
        }

        // 3. Status da folha do mês atual
        const { data: folhaData } = await db
          .from("folha_mensal")
          .select("empresa_id, status")
          .in("empresa_id", ids)
          .eq("competencia", competencia);

        const folhaMap: Record<string, string> = {};
        for (const f of folhaData ?? []) folhaMap[f.empresa_id] = f.status;

        // 4. Férias vencendo em 30 dias
        const em30 = new Date();
        em30.setDate(em30.getDate() + 30);
        const em30Str = em30.toISOString().split("T")[0];
        const hoje = new Date().toISOString().split("T")[0];

        const { data: feriasData } = await db
          .from("ferias")
          .select("empresa_id, periodo_aquisitivo_fim, status")
          .in("empresa_id", ids)
          .lte("periodo_aquisitivo_fim", em30Str)
          .gte("periodo_aquisitivo_fim", hoje)
          .in("status", ["pendente"]);

        const feriasCount: Record<string, number> = {};
        for (const f of feriasData ?? []) {
          feriasCount[f.empresa_id] = (feriasCount[f.empresa_id] ?? 0) + 1;
        }

        // 5. Montar lista final
        const lista: ClienteDP[] = clientesData.map((c: { id: string; razao_social: string; regime: string }) => ({
          id: c.id,
          razao_social: c.razao_social,
          regime: c.regime,
          qtd_funcionarios: funcCount[c.id] ?? 0,
          status_folha: folhaMap[c.id] ?? null,
          ferias_vencendo: feriasCount[c.id] ?? 0,
          proxima_obrigacao: null, // futuro: integrar com tabela obrigacoes
        }));

        setClientes(lista);
      } finally {
        setLoading(false);
      }
    })();
  }, [competencia]);

  // ─── KPIs ───────────────────────────────────────────────────────────────────
  const totalAtivos     = clientes.reduce((s, c) => s + c.qtd_funcionarios, 0);
  const folhasAbertas   = clientes.filter(c => c.status_folha === "aberta").length;
  const semFolha        = clientes.filter(c => !c.status_folha).length;
  const feriasCriticas  = clientes.reduce((s, c) => s + c.ferias_vencendo, 0);
  const folhasFechadas  = clientes.filter(c => c.status_folha === "fechada").length;

  // ─── Filtro ──────────────────────────────────────────────────────────────────
  const clientesFiltrados = clientes.filter(c => {
    if (filtroFolha === "sem_folha") return !c.status_folha;
    if (filtroFolha === "aberta")    return c.status_folha === "aberta";
    if (filtroFolha === "fechada")   return c.status_folha === "fechada";
    if (filtroFolha === "enviada")   return c.status_folha === "enviada";
    return true;
  });

  // ─── Colunas ─────────────────────────────────────────────────────────────────
  const cols: ColDef<ClienteDP>[] = [
    {
      key: "razao_social",
      header: "Cliente",
      render: (v, row) => (
        <Link
          to="/clientes/$id"
          params={{ id: row.id }}
          search={{ tab: "dp" }}
          className="font-medium hover:underline text-primary"
        >
          {v as string}
        </Link>
      ),
    },
    {
      key: "regime",
      header: "Regime",
      render: v => (
        <InlineBadge color="blue">{v as string}</InlineBadge>
      ),
    },
    {
      key: "qtd_funcionarios",
      header: "Funcionários",
      render: v => (
        <span className="tabular-nums font-medium">{v as number}</span>
      ),
    },
    {
      key: "status_folha",
      header: `Folha ${mesAtual().split("-").reverse().join("/")}`,
      render: v => {
        if (!v) return <InlineBadge color="neutral">Sem folha</InlineBadge>;
        const color = FOLHA_COLOR[v as string] ?? "neutral";
        const label = { aberta: "Aberta", fechada: "Fechada", enviada: "Enviada" }[v as string] ?? v;
        return <InlineBadge color={color}>{label as string}</InlineBadge>;
      },
    },
    {
      key: "ferias_vencendo",
      header: "Férias (30d)",
      render: v => {
        const n = v as number;
        if (n === 0) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <span className="flex items-center gap-1 text-orange-600 font-medium text-sm">
            <AlertTriangle className="h-3 w-3" /> {n}
          </span>
        );
      },
    },
    {
      key: "id",
      header: "",
      render: (_, row) => (
        <Link
          to="/clientes/$id"
          params={{ id: row.id }}
          search={{ tab: "dp" }}
          className="text-muted-foreground hover:text-primary"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      ),
    },
  ];

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Gestão"
        title="Departamento Pessoal"
        subtitle="Visão consolidada de todos os clientes com empregados"
      />

      <KpiGrid cols={4}>
        <KpiCard icon={Users2}      label="Funcionários Ativos"       value={totalAtivos}    tone="primary" />
        <KpiCard icon={FileText}    label="Folhas Abertas no Mês"     value={folhasAbertas}  tone="warning"
          hint={semFolha > 0 ? `${semFolha} clientes sem folha aberta` : undefined} />
        <KpiCard icon={FileText}    label="Folhas Fechadas"           value={folhasFechadas} tone="success" />
        <KpiCard icon={AlertTriangle} label="Férias Vencendo (30d)"  value={feriasCriticas} tone={feriasCriticas > 0 ? "danger" : "neutral"} />
      </KpiGrid>

      {/* Filtro */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar por folha:</span>
        <Select value={filtroFolha} onValueChange={setFiltroFolha}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sem_folha">Sem folha aberta</SelectItem>
            <SelectItem value="aberta">Folha aberta</SelectItem>
            <SelectItem value="fechada">Folha fechada</SelectItem>
            <SelectItem value="enviada">Folha enviada</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {clientesFiltrados.length} cliente(s)
        </span>
      </div>

      <DataTable
        cols={cols}
        rows={clientesFiltrados}
        loading={loading}
        emptyLabel={
          clientes.length === 0
            ? "Nenhum cliente com empregados cadastrado. Ative 'Tem empregados CLT' no cadastro do cliente."
            : "Nenhum cliente encontrado com esse filtro."
        }
        keyFn={r => r.id}
      />
    </div>
  );
}

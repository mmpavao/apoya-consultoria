/**
 * Módulo Fiscal — /_app/fiscal/
 *
 * Estrutura:
 *   PageHeader  — titulo + acao
 *   KpiGrid     — 4 KPIs fiscais
 *   PageTabs    — Pipeline | DAS | NFS-e | SERPRO | Documentos
 *
 * B1: pipeline e KPIs funcionais. Abas das/nfse/serpro linkam para as rotas filhas existentes.
 * B2: isolamento de permissao (user_setor_permissoes) sera aplicado aqui.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle, Calendar, FileText, ShieldAlert,
  TrendingDown, RefreshCw, Receipt, Search, BarChart2, Building2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PipelineKanban } from "@/components/PipelineKanban";
import { useFiscalKpis } from "@/hooks/use-fiscal-kpis";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/fiscal/")({
  component: FiscalModulo,
  head: () => ({ meta: [{ title: "Fiscal · APOYA Gestao" }] }),
});

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  variant?: "default" | "warning" | "danger" | "info";
  loading: boolean;
}) {
  const borderBg = {
    default: "border-border bg-card",
    warning: "border-yellow-200 bg-yellow-50",
    danger:  "border-red-200   bg-red-50",
    info:    "border-blue-200  bg-blue-50",
  }[variant];

  const iconColor = {
    default: "text-muted-foreground",
    warning: "text-yellow-600",
    danger:  "text-red-600",
    info:    "text-blue-600",
  }[variant];

  const valueColor = {
    default: "text-foreground",
    warning: "text-yellow-700",
    danger:  "text-red-700",
    info:    "text-blue-700",
  }[variant];

  return (
    <Card className={cn("border transition-colors", borderBg)}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-lg p-2 bg-white/60", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {loading ? (
            <div className="h-6 w-12 bg-muted animate-pulse rounded mt-0.5" />
          ) : (
            <p className={cn("text-2xl font-bold tabular-nums leading-none mt-0.5", valueColor)}>
              {value}
            </p>
          )}
        </div>
        {!loading && value > 0 && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] shrink-0",
              variant === "danger"  ? "border-red-300 text-red-600" :
              variant === "warning" ? "border-yellow-300 text-yellow-600" :
              "border-border"
            )}
          >
            {value === 1 ? "1 item" : `${value} itens`}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ── Placeholder de aba com link para rota filha ───────────────────────────────

function TabLink({ to, label, icon: Icon, desc }: { to: string; label: string; icon: React.ElementType; desc: string }) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center space-y-3">
      <div className="flex justify-center">
        <div className="rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
      <div>
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
      <Link to={to}>
        <Button variant="outline" size="sm">Abrir {label}</Button>
      </Link>
    </div>
  );
}

// ── Modulo Principal ──────────────────────────────────────────────────────────

function FiscalModulo() {
  const { roles } = useAuth();
  const { kpis, loading: kpisLoading, error: kpisError, refetch } = useFiscalKpis();

  // B2 aplicara verificacao real via user_setor_permissoes.
  // Por ora: admin e contador podem aprovar.
  const podeAprovar = roles.includes("admin") || roles.includes("contador");

  return (
    <div className="space-y-6">
      {/* PageHeader */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fiscal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestao tributaria · DAS · NFS-e · SERPRO · Pipeline de obrigacoes
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} disabled={kpisLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-1.5", kpisLoading && "animate-spin")} />
          Atualizar KPIs
        </Button>
      </div>

      {/* KpiGrid */}
      {kpisError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Erro ao carregar KPIs: {kpisError}</span>
          <Button variant="ghost" size="sm" onClick={refetch} className="ml-auto">
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Obrigacoes Vencidas"
            value={kpis?.obrigacoes_vencidas ?? 0}
            icon={AlertTriangle}
            variant={(kpis?.obrigacoes_vencidas ?? 0) > 0 ? "danger" : "default"}
            loading={kpisLoading}
          />
          <KpiCard
            label="A vencer (7 dias)"
            value={kpis?.obrigacoes_a_vencer_7d ?? 0}
            icon={Calendar}
            variant={(kpis?.obrigacoes_a_vencer_7d ?? 0) > 0 ? "warning" : "default"}
            loading={kpisLoading}
          />
          <KpiCard
            label="DAS Pendentes"
            value={kpis?.das_pendentes ?? 0}
            icon={TrendingDown}
            variant={(kpis?.das_pendentes ?? 0) > 0 ? "warning" : "default"}
            loading={kpisLoading}
          />
          <KpiCard
            label="Certificados < 30d"
            value={kpis?.certificados_expirando ?? 0}
            icon={ShieldAlert}
            variant={(kpis?.certificados_expirando ?? 0) > 0 ? "warning" : "default"}
            loading={kpisLoading}
          />
        </div>
      )}

      {/* PageTabs */}
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="das">DAS</TabsTrigger>
          <TabsTrigger value="nfse">NFS-e</TabsTrigger>
          <TabsTrigger value="serpro">SERPRO</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        {/* Pipeline — kanban do setor fiscal */}
        <TabsContent value="pipeline" className="mt-0">
          <PipelineKanban setor="fiscal" podeAprovar={podeAprovar} />
        </TabsContent>

        {/* DAS — link para rota filha existente */}
        <TabsContent value="das" className="mt-0">
          <TabLink
            to="/fiscal/das"
            label="DAS em Lote"
            icon={Receipt}
            desc="Gerenciamento de guias DAS do Simples Nacional para todos os clientes."
          />
        </TabsContent>

        {/* NFS-e — Focus congelada */}
        <TabsContent value="nfse" className="mt-0">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 flex items-center gap-2 text-sm text-amber-700">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            Emissao de NFS-e temporariamente suspensa (pendencia junto a prefeitura de Cacapava).
            Apenas consulta disponivel.
          </div>
          <TabLink
            to="/fiscal/nfse"
            label="NFS-e"
            icon={FileText}
            desc="Consulta de notas fiscais emitidas e recebidas. Emissao suspensa (Focus congelada)."
          />
        </TabsContent>

        {/* SERPRO */}
        <TabsContent value="serpro" className="mt-0">
          <TabLink
            to="/fiscal/serpro"
            label="SERPRO"
            icon={Search}
            desc="Consultas diretas na Receita Federal: PGDAS, PGMEI, Situacao Fiscal, caixa postal."
          />
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="documentos" className="mt-0">
          <div className="rounded-xl border border-dashed bg-card p-8 text-center space-y-2">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Repositorio de documentos fiscais em desenvolvimento.
            </p>
            <p className="text-xs text-muted-foreground/60">Disponivel na fase C.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

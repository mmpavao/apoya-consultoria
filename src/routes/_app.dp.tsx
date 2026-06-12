import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SectorGuard } from "@/components/SectorGuard";
import { useState, useMemo, useEffect } from "react";
import { Plus, Users, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PipelineKanban } from "@/components/PipelineKanban";
import { useClientes } from "@/hooks/use-clientes";
import { useFuncionarios } from "@/hooks/use-dp";
import { useAuth } from "@/hooks/use-auth";
import { FuncionarioFormDialog } from "@/components/dp";

export const Route = createFileRoute("/_app/dp")({
  component: DpPage,
  head: () => ({ meta: [{ title: "Dep. Pessoal · APOYA Gestão" }] }),
});

function EmpresaRowStats({ empresaId }: { empresaId: string }) {
  const { funcionarios, loading } = useFuncionarios(empresaId);
  const ativos = funcionarios.filter(f => f.status === "ativo").length;

  if (loading) return <td colSpan={3} className="text-muted-foreground text-xs">…</td>;
  return (
    <>
      <td className="text-center font-semibold">{ativos}</td>
      <td className="text-center">—</td>
      <td className="text-center text-amber-600 font-medium">—</td>
    </>
  );
}

// Chaveado pelos valores reais do enum Regime (use-clientes.ts)
const REGIME_BADGE: Record<string, { label: string; cls: string }> = {
  "Simples":          { label: "Simples Nacional", cls: "bg-blue-100 text-blue-700" },
  "Lucro Presumido":  { label: "Lucro Presumido",  cls: "bg-purple-100 text-purple-700" },
  "Lucro Real":       { label: "Lucro Real",        cls: "bg-gray-100 text-gray-600" },
  "MEI":              { label: "MEI",               cls: "bg-green-100 text-green-700" },
  "Doméstica":        { label: "Doméstica",         cls: "bg-pink-100 text-pink-700" },
};

function DpPage__Inner() {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const { clientes, loading } = useClientes();
  const { funcionarios: todosFuncionarios } = useFuncionarios();
  const [query, setQuery] = useState("");
  const [novoFuncOpen, setNovoFuncOpen] = useState(false);
  const [novoFuncEmpresa, setNovoFuncEmpresa] = useState("");
  const podeAprovar = roles.includes("admin") || roles.includes("contador");

  /* ── Agente RH — KPIs dinâmicos ─────────────────────────── */
  const [rhKpis, setRhKpis] = useState<{
    folhas_abertas: number;
    ferias_proximas_30d: number;
  }>({ folhas_abertas: 0, ferias_proximas_30d: 0 });

  useEffect(() => {
    fetch(
      "https://ajaqbdsalxfgrwpjbtbn.supabase.co/functions/v1/agente-rh",
      { method: "POST" }
    )
      .then(r => r.json())
      .then((d: { success?: boolean; resumo?: { folhas_abertas: number; ferias_proximas_30d: number } }) => {
        if (d.success && d.resumo) {
          setRhKpis({
            folhas_abertas:     d.resumo.folhas_abertas,
            ferias_proximas_30d: d.resumo.ferias_proximas_30d,
          });
        }
      })
      .catch(() => { /* silencioso */ });
  }, []);

  const totalAtivos = useMemo(
    () => todosFuncionarios.filter(f => f.status === "ativo").length,
    [todosFuncionarios]
  );
  const totalDemitidos = useMemo(() => {
    const now = new Date();
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return todosFuncionarios.filter(f => f.status === "demitido" && f.data_demissao?.startsWith(mesAtual)).length;
  }, [todosFuncionarios]);

  const empresasFiltradas = useMemo(
    () => clientes.filter(c => !query || c.razaoSocial.toLowerCase().includes(query.toLowerCase())),
    [clientes, query]
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /><span>Carregando…</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-up p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Departamento Pessoal</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão centralizada de funcionários, folha e férias</p>
        </div>
        <Button onClick={() => { setNovoFuncEmpresa(""); setNovoFuncOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />Novo Funcionário
        </Button>
      </div>

      {/* KPIs globais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Funcionários Ativos",  val: totalAtivos,    cls: "text-foreground" },
          { label: "Folhas Abertas",        val: rhKpis.folhas_abertas,      cls: "text-amber-600" },
          { label: "Férias Vencendo (30d)", val: rhKpis.ferias_proximas_30d, cls: "text-amber-600" },
          { label: "Rescisões do Mês",      val: totalDemitidos, cls: "text-red-600" },
        ].map(k => (
          <div key={k.label} className="surface-card px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <p className={cn("text-xl font-bold", k.cls)}>{k.val}</p>
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="empresas" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="folha">Folha</TabsTrigger>
          <TabsTrigger value="esocial">eSocial</TabsTrigger>
          <TabsTrigger value="automacoes">Automações</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-0">
          <PipelineKanban setor="dp" podeAprovar={podeAprovar} />
        </TabsContent>

        <TabsContent value="empresas" className="mt-0">
          <div className="flex items-center gap-3 mb-4">
            <Input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar empresa…" className="max-w-xs" />
            <span className="text-sm text-muted-foreground">{empresasFiltradas.length} empresas</span>
          </div>

          <div className="surface-card overflow-hidden">
            <table className="ft-table w-full">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Regime</th>
                  <th className="text-center">Funcionários</th>
                  <th className="text-center">Folha Atual</th>
                  <th className="text-center">Férias Vencendo</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {empresasFiltradas.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-8 text-sm">Nenhuma empresa encontrada</td></tr>
                )}
                {empresasFiltradas.map(cliente => {
                  const rb = REGIME_BADGE[cliente.regime ?? "Simples"] ?? REGIME_BADGE["Simples"];
                  return (
                    <tr key={cliente.id}>
                      <td>
                        <div>
                          <p className="font-medium text-sm">{cliente.razaoSocial}</p>
                          <p className="text-xs text-muted-foreground">{cliente.cnpj}</p>
                        </div>
                      </td>
                      <td>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", rb.cls)}>{rb.label}</span>
                      </td>
                      <EmpresaRowStats empresaId={cliente.id} />
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setNovoFuncEmpresa(cliente.id); setNovoFuncOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            title="Novo funcionário"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                          <Button size="sm" variant="outline"
                            onClick={() => navigate({ to: "/dp/$empresaId", params: { empresaId: cliente.id } })}>
                            Ver DP <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Folha Mensal */}
        <TabsContent value="folha" className="mt-0">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Folha de Pagamento</h3>
                <p className="text-sm text-muted-foreground">Processamento mensal de salários e encargos</p>
              </div>
              <Button size="sm" variant="outline">+ Nova Folha</Button>
            </div>
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma folha aberta este mês</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Cadastre funcionários para processar folhas</p>
            </div>
          </div>
        </TabsContent>

        {/* eSocial */}
        <TabsContent value="esocial" className="mt-0">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">eSocial</h3>
              <a href="/obrigacoes"><Button variant="outline" size="sm">Ver Obrigações</Button></a>
            </div>
            {["S-1000 — Informações do Empregador","S-2200 — Cadastramento Inicial","S-1200 — Remuneração"].map((e,i)=>(
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <p className="text-sm font-mono text-foreground">{e}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pendente</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Automações */}
        <TabsContent value="automacoes" className="mt-0">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Automações DP</h3>
              <a href="/automacoes"><Button variant="outline" size="sm">Gerenciar</Button></a>
            </div>
            {[
              { nome: "Monitor eSocial", desc: "Verifica eventos vencidos diariamente" },
              { nome: "Alerta Férias", desc: "Notifica 30 dias antes do vencimento" },
            ].map((a,i)=>(
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div><p className="text-sm font-medium">{a.nome}</p><p className="text-xs text-muted-foreground">{a.desc}</p></div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Ativa</span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Config */}
        <TabsContent value="config" className="mt-0">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold mb-4">Configurações do DP</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {[
                { label: "Calcular FGTS automaticamente", enabled: true },
                { label: "Alertar rescisões pendentes", enabled: true },
                { label: "Aprovação antes de fechar folha", enabled: false },
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

      {novoFuncOpen && novoFuncEmpresa && (
        <FuncionarioFormDialog
          open={novoFuncOpen}
          onClose={() => setNovoFuncOpen(false)}
          empresaId={novoFuncEmpresa}
        />
      )}
    </div>
  );
}

function DpPage() {
  return (
    <SectorGuard setor="dp">
      <DpPage__Inner />
    </SectorGuard>
  );
}

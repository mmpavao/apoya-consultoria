import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fmtBRL, fmtDate } from "@/lib/format";
import { useState, useMemo } from "react";
import { ArrowLeft, Plus, Pencil, UserX, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useClientes } from "@/hooks/use-clientes";
import {
  type Funcionario, type StatusFunc,
  useFuncionarios,
} from "@/hooks/use-dp";
import {
  FuncionarioFormDialog, DemissaoDialog,
  FolhaTab, FeriasTab, RescisaoTab,
} from "@/components/dp";

export const Route = createFileRoute("/_app/dp_/$empresaId")({
  component: DpEmpresaPage,
  head: () => ({ meta: [{ title: "DP Empresa · APOYA Gestão" }] }),
});

type DpTab = "funcionarios" | "folha" | "ferias" | "rescisoes";

const DP_TABS: { id: DpTab; label: string }[] = [
  { id:"funcionarios", label:"Funcionários" },
  { id:"folha",        label:"Folha Mensal" },
  { id:"ferias",       label:"Férias" },
  { id:"rescisoes",    label:"Rescisões" },
];

const STATUS_BADGE: Record<StatusFunc, { label: string; cls: string }> = {
  ativo:     { label:"Ativo",     cls:"bg-green-100 text-green-700" },
  afastado:  { label:"Afastado",  cls:"bg-amber-100 text-amber-700" },
  demitido:  { label:"Demitido",  cls:"bg-red-100 text-red-700" },
};

// Chaveado pelos valores reais do enum Regime (use-clientes.ts)
const REGIME_BADGE: Record<string, { label: string; cls: string }> = {
  "Simples":          { label:"Simples Nacional", cls:"bg-blue-100 text-blue-700" },
  "Lucro Presumido":  { label:"Lucro Presumido",  cls:"bg-purple-100 text-purple-700" },
  "Lucro Real":       { label:"Lucro Real",       cls:"bg-gray-100 text-gray-600" },
  "MEI":              { label:"MEI",              cls:"bg-green-100 text-green-700" },
  "Doméstica":        { label:"Doméstica",        cls:"bg-pink-100 text-pink-700" },
};

const maskCpf = (cpf: string) => cpf ? "***.***.***-**" : "—";

function FuncionariosTab({
  empresaId, tab, setTab,
}: { empresaId: string; tab: DpTab; setTab: (t: DpTab) => void }) {
  const { funcionarios, loading, refresh } = useFuncionarios(empresaId);
  const [query, setQuery]       = useState("");
  const [filtro, setFiltro]     = useState<StatusFunc | "todos">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editFuncionario, setEditFuncionario] = useState<Funcionario | null>(null);
  const [demissaoFuncionario, setDemissaoFuncionario] = useState<Funcionario | null>(null);

  const exibir = useMemo(() =>
    funcionarios.filter(f => {
      const matchQ = !query || f.nome.toLowerCase().includes(query.toLowerCase()) || (f.cargo ?? "").toLowerCase().includes(query.toLowerCase());
      const matchS = filtro === "todos" || f.status === filtro;
      return matchQ && matchS;
    }),
    [funcionarios, query, filtro]
  );

  function handleEditar(f: Funcionario) { setEditFuncionario(f); setFormOpen(true); }
  function handleFecharForm() { setFormOpen(false); setEditFuncionario(null); }

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /><span>Carregando funcionários…</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* KPIs rápidos */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Ativos",   val: funcionarios.filter(f=>f.status==="ativo").length,    cls:"text-green-600" },
          { label:"Afastados",val: funcionarios.filter(f=>f.status==="afastado").length, cls:"text-amber-600" },
          { label:"Demitidos",val: funcionarios.filter(f=>f.status==="demitido").length, cls:"text-red-600" },
        ].map(k => (
          <div key={k.label} className="surface-card px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={cn("text-xl font-bold", k.cls)}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar nome ou cargo…" className="pl-9" />
        </div>
        <Select value={filtro} onValueChange={v => setFiltro(v as typeof filtro)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="afastado">Afastados</SelectItem>
            <SelectItem value="demitido">Demitidos</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => { setEditFuncionario(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />Adicionar Funcionário
        </Button>
      </div>

      {/* Tabela */}
      <div className="surface-card overflow-hidden">
        <table className="ft-table w-full">
          <thead><tr>
            <th>Nome</th><th>CPF</th><th>Cargo</th><th>Admissão</th>
            <th>Salário</th><th>Contrato</th><th>Status</th><th>Ações</th>
          </tr></thead>
          <tbody>
            {exibir.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                {query || filtro !== "todos" ? "Nenhum funcionário encontrado com este filtro" : "Nenhum funcionário cadastrado"}
              </td></tr>
            )}
            {exibir.map(func => {
              const sb = STATUS_BADGE[func.status];
              return (
                <tr key={func.id}>
                  <td className="font-medium">{func.nome}</td>
                  <td className="text-muted-foreground font-mono text-xs">{maskCpf(func.cpf)}</td>
                  <td>{func.cargo ?? "—"}</td>
                  <td>{fmtDate(func.data_admissao)}</td>
                  <td className="font-medium">{fmtBRL(func.salario_base)}</td>
                  <td className="uppercase text-xs font-semibold text-muted-foreground">{func.tipo_contrato}</td>
                  <td>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", sb.cls)}>{sb.label}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleEditar(func)} title="Editar"
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {func.status !== "demitido" && (
                        <button onClick={() => setDemissaoFuncionario(func)} title="Demitir"
                          className="p-1.5 rounded-lg hover:bg-red-100 transition-colors text-muted-foreground hover:text-red-600">
                          <UserX className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FuncionarioFormDialog
        open={formOpen} onClose={handleFecharForm}
        empresaId={empresaId} funcionario={editFuncionario}
        onSaved={refresh}
      />
      {demissaoFuncionario && (
        <DemissaoDialog
          open={!!demissaoFuncionario}
          onClose={() => setDemissaoFuncionario(null)}
          funcionario={demissaoFuncionario}
          onDemitido={() => { refresh(); setTab("rescisoes"); }}
        />
      )}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
function DpEmpresaPage() {
  const { empresaId } = Route.useParams();
  const navigate = useNavigate();
  const { clientes } = useClientes();
  const [activeTab, setActiveTab] = useState<DpTab>("funcionarios");

  const cliente = clientes.find(c => c.id === empresaId);
  const rb = REGIME_BADGE[cliente?.regime ?? "Simples"] ?? REGIME_BADGE["Simples"];

  return (
    <div className="space-y-5 animate-fade-up p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate({ to: "/dp" })}
          className="mt-1 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold font-display text-foreground">
              {cliente?.razaoSocial ?? "Carregando…"}
            </h1>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", rb.cls)}>{rb.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            CNPJ: {cliente?.cnpj ?? "—"}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-0.5 border-b border-border/60 overflow-x-auto">
        {DP_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={cn(
              "shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap",
              activeTab === t.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo por aba */}
      <div>
        {activeTab === "funcionarios" && (
          <FuncionariosTab empresaId={empresaId} tab={activeTab} setTab={setActiveTab} />
        )}
        {activeTab === "folha" && <FolhaTab empresaId={empresaId} />}
        {activeTab === "ferias" && <FeriasTab empresaId={empresaId} />}
        {activeTab === "rescisoes" && <RescisaoTab empresaId={empresaId} />}
      </div>
    </div>
  );
}

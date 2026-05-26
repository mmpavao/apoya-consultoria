/**
 * Rota: /dp — Departamento Pessoal (visão consolidada)
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { Users2, AlertTriangle, FileText, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, KpiGrid, KpiCard } from "@/components/PagePlaceholder";
import { DataTable, InlineBadge, type ColDef } from "@/components/DataTable";
import { useCreateFuncionario } from "@/hooks/use-dp";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dp")({
  component: DpPage,
  head: () => ({ meta: [{ title: "Dep. Pessoal · APOYA Gestão" }] }),
});

interface ClienteDP {
  id: string; razao_social: string; regime: string;
  qtd_funcionarios: number; status_folha: string | null; ferias_vencendo: number;
}

interface ClienteSimples { id: string; razao_social: string; }

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function compLabel(c: string) {
  const [a, m] = c.split("-");
  return `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][+m-1]}/${a}`;
}
function fmtCPF(v: string) {
  return v.replace(/\D/g,"").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,"$1.$2.$3-$4").slice(0,14);
}

function DpPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<ClienteDP[]>([]);
  const [todosClientes, setTodosClientes] = useState<ClienteSimples[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [showDialog, setShowDialog] = useState(false);
  const comp = mesAtual();

  // ── hook de criação
  const { create: criarFuncionario, loading: criando } = useCreateFuncionario();

  // ── form estado
  const emptyForm = {
    empresa_id: "", nome: "", cpf: "", cargo: "",
    data_admissao: new Date().toISOString().split("T")[0],
    salario_base: "",
  };
  const [form, setForm] = useState(emptyForm);

  // ── carregar dados consolidados
  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: cl } = await db.from("clientes")
        .select("id,razao_social,regime")
        .eq("tem_empregados", true)
        .order("razao_social");

      setTodosClientes(cl ?? []);

      if (!cl?.length) { setClientes([]); return; }
      const ids = cl.map((c: { id: string }) => c.id);

      const { data: fc } = await db.from("funcionarios")
        .select("empresa_id").in("empresa_id", ids).eq("status", "ativo");
      const { data: fo } = await db.from("folha_mensal")
        .select("empresa_id,status").in("empresa_id", ids).eq("competencia", comp);

      const em30 = new Date(); em30.setDate(em30.getDate() + 30);
      const { data: fe } = await db.from("ferias")
        .select("empresa_id").in("empresa_id", ids).in("status", ["pendente"])
        .lte("periodo_aquisitivo_fim", em30.toISOString().split("T")[0])
        .gte("periodo_aquisitivo_fim", new Date().toISOString().split("T")[0]);

      const fcMap: Record<string, number> = {};
      const foMap: Record<string, string> = {};
      const feMap: Record<string, number> = {};
      for (const f of fc ?? []) fcMap[f.empresa_id] = (fcMap[f.empresa_id] ?? 0) + 1;
      for (const f of fo ?? []) foMap[f.empresa_id] = f.status;
      for (const f of fe ?? []) feMap[f.empresa_id] = (feMap[f.empresa_id] ?? 0) + 1;

      setClientes(cl.map((c: { id: string; razao_social: string; regime: string }) => ({
        ...c,
        qtd_funcionarios: fcMap[c.id] ?? 0,
        status_folha: foMap[c.id] ?? null,
        ferias_vencendo: feMap[c.id] ?? 0,
      })));
    } finally { setLoading(false); }
  }, [comp]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── KPIs
  const total     = clientes.reduce((s, c) => s + c.qtd_funcionarios, 0);
  const abertas   = clientes.filter(c => c.status_folha === "aberta").length;
  const semFolha  = clientes.filter(c => !c.status_folha).length;
  const ferias    = clientes.reduce((s, c) => s + c.ferias_vencendo, 0);

  // ── filtro
  const rows = clientes.filter(c => {
    if (filtro === "sem_folha") return !c.status_folha;
    if (filtro === "aberta")    return c.status_folha === "aberta";
    if (filtro === "fechada")   return c.status_folha === "fechada";
    return true;
  });

  const FOLHA_COR: Record<string, string> = { aberta: "amber", fechada: "green", enviada: "blue" };
  const FOLHA_LBL: Record<string, string> = { aberta: "Aberta", fechada: "Fechada", enviada: "Enviada" };

  const cols: ColDef<ClienteDP>[] = [
    {
      key: "razao_social", header: "Cliente",
      render: (r) => (
        <button className="font-medium hover:underline text-primary text-left"
          onClick={() => navigate({ to: "/clientes/$id", params: { id: r.id } })}>
          {r.razao_social}
        </button>
      ),
    },
    {
      key: "regime", header: "Regime",
      render: (r) => <InlineBadge color="blue">{r.regime}</InlineBadge>,
    },
    {
      key: "qtd_funcionarios", header: "Funcionários",
      render: (r) => <span className="tabular-nums font-medium">{r.qtd_funcionarios}</span>,
    },
    {
      key: "status_folha", header: `Folha ${compLabel(comp)}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (r) => r.status_folha
        ? <InlineBadge color={(FOLHA_COR[r.status_folha] ?? "gray") as any}>{FOLHA_LBL[r.status_folha] ?? r.status_folha}</InlineBadge>
        : <InlineBadge color="gray">Sem folha</InlineBadge>,
    },
    {
      key: "ferias_vencendo", header: "Férias (30d)",
      render: (r) => r.ferias_vencendo > 0
        ? <span className="flex items-center gap-1 text-orange-600 font-medium text-sm"><AlertTriangle className="h-3 w-3" />{r.ferias_vencendo}</span>
        : <span className="text-muted-foreground text-sm">—</span>,
    },
  ];

  // ── salvar funcionário
  async function handleSalvar() {
    if (!form.empresa_id || !form.nome || !form.cpf || !form.data_admissao || !form.salario_base) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const ok = await criarFuncionario({
      empresa_id: form.empresa_id,
      nome: form.nome,
      cpf: form.cpf.replace(/\D/g, ""),
      cargo: form.cargo || undefined,
      data_admissao: form.data_admissao,
      salario_base: Number(form.salario_base),
      tipo_contrato: "clt",
      status: "ativo",
      dependentes: 0,
    });
    if (ok) {
      setShowDialog(false);
      setForm(emptyForm);
      carregar();
    }
  }

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        eyebrow="Gestão"
        title="Departamento Pessoal"
        subtitle="Visão consolidada de todos os clientes com empregados"
        actions={
          <Button size="sm" onClick={() => setShowDialog(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Funcionário
          </Button>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard icon={Users2}        label="Funcionários Ativos"   value={total}    tone="primary" />
        <KpiCard icon={FileText}      label="Folhas Abertas"        value={abertas}  tone="warning"
          hint={semFolha > 0 ? `${semFolha} sem folha` : undefined} />
        <KpiCard icon={FileText}      label="Folhas Fechadas"       value={clientes.filter(c => c.status_folha === "fechada").length} tone="success" />
        <KpiCard icon={AlertTriangle} label="Férias Vencendo (30d)" value={ferias}   tone={ferias > 0 ? "danger" : "neutral"} />
      </KpiGrid>

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sem_folha">Sem folha aberta</SelectItem>
            <SelectItem value="aberta">Folha aberta</SelectItem>
            <SelectItem value="fechada">Folha fechada</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rows.length} cliente(s)</span>
      </div>

      {loading
        ? <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        : <DataTable cols={cols} rows={rows} getKey={r => r.id} emptyText="Nenhum cliente encontrado."
            onRowClick={r => navigate({ to: "/clientes/$id", params: { id: r.id } })} />
      }

      {/* ── Dialog Novo Funcionário ── */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Empresa <span className="text-red-500">*</span></Label>
              <Select value={form.empresa_id} onValueChange={v => setForm(f => ({ ...f, empresa_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar empresa..." /></SelectTrigger>
                <SelectContent>
                  {todosClientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome Completo <span className="text-red-500">*</span></Label>
              <Input placeholder="Nome do funcionário" value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>CPF <span className="text-red-500">*</span></Label>
                <Input placeholder="000.000.000-00" value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: fmtCPF(e.target.value) }))}
                  maxLength={14} />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input placeholder="Ex: Vendedor" value={form.cargo}
                  onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de Admissão <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.data_admissao}
                  onChange={e => setForm(f => ({ ...f, data_admissao: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Salário Base (R$) <span className="text-red-500">*</span></Label>
                <Input type="number" placeholder="0,00" min="0" step="0.01" value={form.salario_base}
                  onChange={e => setForm(f => ({ ...f, salario_base: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            <Button onClick={handleSalvar} disabled={criando}>
              {criando ? "Salvando..." : "Cadastrar Funcionário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

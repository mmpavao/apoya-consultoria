import { useState } from "react";
import { Plus, Check, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Ferias, type StatusFerias, useFuncionarios, useFerias } from "@/hooks/use-dp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FeriasFormDialog } from "./FeriasFormDialog";

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const BADGE: Record<StatusFerias, { label: string; cls: string }> = {
  pendente:  { label:"Pendente",  cls:"bg-gray-100 text-gray-600" },
  agendada:  { label:"Agendada",  cls:"bg-blue-100 text-blue-700" },
  paga:      { label:"Paga",      cls:"bg-green-100 text-green-700" },
  vencida:   { label:"Vencida",   cls:"bg-red-100 text-red-700" },
};

type Props = { empresaId: string };

export function FeriasTab({ empresaId }: Props) {
  const { funcionarios } = useFuncionarios(empresaId);
  const { ferias, loading, refresh: refetch } = useFerias(empresaId);
  const [filtro, setFiltro] = useState<StatusFerias | "todos">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Ferias | null>(null);
  const [deleting, setDeleting] = useState(false);

  const hoje = new Date();
  const em30dias = new Date(hoje); em30dias.setDate(hoje.getDate() + 30);

  const vencidas    = ferias.filter(f => f.status === "vencida").length;
  const vencendo30  = ferias.filter(f => {
    if (!f.periodo_aquisitivo_fim || f.status === "paga") return false;
    const fim = new Date(f.periodo_aquisitivo_fim);
    return fim >= hoje && fim <= em30dias;
  }).length;
  const agendadas   = ferias.filter(f => f.status === "agendada").length;

  const exibir = filtro === "todos" ? ferias : ferias.filter(f => f.status === filtro);

  function getNomeFuncionario(id: string) {
    return funcionarios.find(f => f.id === id)?.nome ?? id.slice(0,8)+"…";
  }
  function getCargo(id: string) {
    return funcionarios.find(f => f.id === id)?.cargo ?? "—";
  }

  async function marcarPaga(ferias: Ferias) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("ferias").update({ status:"paga" }).eq("id", ferias.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Férias marcadas como pagas!"); refetch();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("ferias").delete().eq("id", confirmDelete.id);
    setDeleting(false);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Férias excluídas!"); setConfirmDelete(null); refetch();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /><span>Carregando férias…</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"Vencidas",        val: vencidas,   cls: vencidas > 0 ? "text-red-600" : "text-foreground" },
          { label:"Vencendo (30d)",  val: vencendo30, cls: vencendo30 > 0 ? "text-amber-600" : "text-foreground" },
          { label:"Agendadas",       val: agendadas,  cls:"text-blue-600" },
          { label:"Total",           val: ferias.length, cls:"text-foreground" },
        ].map(k => (
          <div key={k.label} className="surface-card px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={cn("text-xl font-bold", k.cls)}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Header tabela */}
      <div className="flex items-center justify-between gap-3">
        <Select value={filtro} onValueChange={v => setFiltro(v as typeof filtro)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="agendada">Agendada</SelectItem>
            <SelectItem value="paga">Paga</SelectItem>
            <SelectItem value="vencida">Vencida</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Agendar Férias
        </Button>
      </div>

      {/* Tabela */}
      <div className="surface-card overflow-hidden">
        <table className="ft-table w-full">
          <thead><tr>
            <th>Funcionário</th><th>Cargo</th><th>Per. Aquisitivo</th>
            <th>Dias Gozo</th><th>Abono</th><th>Status</th><th>Ações</th>
          </tr></thead>
          <tbody>
            {exibir.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted-foreground py-8 text-sm">Nenhum registro de férias</td></tr>
            )}
            {exibir.map(fer => (
              <tr key={fer.id} className={cn(fer.status === "vencida" && "bg-red-50/50 dark:bg-red-950/20")}>
                <td className="font-medium">{getNomeFuncionario(fer.funcionario_id)}</td>
                <td className="text-muted-foreground">{getCargo(fer.funcionario_id)}</td>
                <td className="text-sm">{fmtDate(fer.periodo_aquisitivo_ini)} – {fmtDate(fer.periodo_aquisitivo_fim)}</td>
                <td>{fer.dias_gozo}d</td>
                <td>{fer.abono_pecuniario ? `Sim (${fer.dias_abono}d)` : "Não"}</td>
                <td>
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", BADGE[fer.status].cls)}>
                    {BADGE[fer.status].label}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1.5">
                    {fer.status !== "paga" && (
                      <button onClick={() => marcarPaga(fer)} title="Marcar como paga"
                        className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => setConfirmDelete(fer)} title="Excluir"
                      className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FeriasFormDialog
        open={formOpen} onClose={() => setFormOpen(false)}
        empresaId={empresaId} funcionarios={funcionarios}
        onSaved={refetch}
      />

      <Dialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Férias?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

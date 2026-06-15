import { useState } from "react";
import { fmtBRL } from "@/lib/format";
import { Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useFuncionarios, useFolhaMensal, useCreateFolha, useFecharFolha,
} from "@/hooks/use-dp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


function competenciasRecentes(): string[] {
  const list: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  }
  return list;
}

function fmtCompetencia(c: string) {
  const [y, m] = c.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(m)-1]}/${y}`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  aberta:  { label:"Aberta",  cls:"bg-amber-100 text-amber-700" },
  fechada: { label:"Fechada", cls:"bg-blue-100 text-blue-700" },
  enviada: { label:"Enviada", cls:"bg-green-100 text-green-700" },
};

type Props = { empresaId: string };

export function FolhaTab({ empresaId }: Props) {
  const compList = competenciasRecentes();
  const now = new Date();
  const currentComp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const [competencia, setCompetencia] = useState(currentComp);
  const [confirmClose, setConfirmClose] = useState(false);
  const [markingEnviada, setMarkingEnviada] = useState(false);

  const { funcionarios } = useFuncionarios(empresaId);
  const { folha, loading, refresh: refetch } = useFolhaMensal(empresaId, competencia);
  const { createFolha: criar, loading: criando } = useCreateFolha();
  const { fecharFolha: fechar, loading: fechando } = useFecharFolha();

  const ativos = funcionarios.filter(f => f.status === "ativo");

  async function handleAbrirFolha() {
    const ok = await criar(empresaId, competencia);
    if (ok) refetch();
  }

  async function handleFecharFolha() {
    if (!folha) return;
    const ok = await fechar(folha.id);
    if (ok) { setConfirmClose(false); refetch(); }
  }

  async function handleMarcarEnviada() {
    if (!folha) return;
    setMarkingEnviada(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("folha_mensal").update({ status:"enviada" }).eq("id", folha.id);
    setMarkingEnviada(false);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    toast.success("Folha marcada como enviada!"); refetch();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /><span>Carregando folha…</span>
    </div>
  );

  const badge = folha ? STATUS_BADGE[folha.status] : null;

  return (
    <div className="space-y-4">
      {/* Header competência */}
      <div className="flex items-center gap-3">
        <div className="w-48">
          <Select value={competencia} onValueChange={setCompetencia}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {compList.map(c => <SelectItem key={c} value={c}>{fmtCompetencia(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {badge && (
          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", badge.cls)}>{badge.label}</span>
        )}
      </div>

      {/* Sem folha */}
      {!folha && (
        <div className="surface-card p-8 text-center space-y-3">
          <p className="text-muted-foreground">Folha de <strong>{fmtCompetencia(competencia)}</strong> não foi aberta ainda.</p>
          <Button onClick={handleAbrirFolha} disabled={criando}>
            {criando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Abrir Folha
          </Button>
        </div>
      )}

      {/* Folha existe */}
      {folha && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label:"Funcionários", val: String(folha.total_funcionarios) },
              { label:"Proventos",    val: fmtBRL(folha.total_proventos) },
              { label:"Descontos",    val: fmtBRL(folha.total_descontos) },
              { label:"Líquido",      val: fmtBRL(folha.total_liquido) },
              { label:"FGTS",         val: fmtBRL(folha.total_fgts) },
              { label:"INSS Empresa", val: fmtBRL(folha.total_inss_empresa) },
            ].map(k => (
              <div key={k.label} className="surface-card px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
                <p className="text-sm font-bold text-foreground truncate">{k.val}</p>
              </div>
            ))}
          </div>

          {/* Tabela de funcionários */}
          <div className="surface-card overflow-hidden">
            <table className="ft-table w-full">
              <thead><tr>
                <th>Funcionário</th><th>Cargo</th><th>Salário Base</th>
                <th>Proventos</th><th>Descontos</th><th>Líquido</th><th>FGTS</th>
              </tr></thead>
              <tbody>
                {ativos.length === 0 && (
                  <tr><td colSpan={7} className="text-center text-muted-foreground py-6 text-sm">Nenhum funcionário ativo</td></tr>
                )}
                {ativos.map(func => (
                  <tr key={func.id}>
                    <td className="font-medium">{func.nome}</td>
                    <td className="text-muted-foreground">{func.cargo ?? "—"}</td>
                    <td>{fmtBRL(func.salario_base)}</td>
                    <td>—</td><td>—</td><td>—</td><td>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Observações */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observações da Folha</p>
            <Textarea defaultValue={folha.observacoes ?? ""} rows={2} placeholder="Notas sobre esta competência..." disabled={folha.status !== "aberta"} />
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            {folha.status === "aberta" && (
              <Button variant="outline" onClick={() => setConfirmClose(true)}>
                <ChevronDown className="h-4 w-4 mr-1.5" />Fechar Folha
              </Button>
            )}
            {folha.status === "fechada" && (
              <Button onClick={handleMarcarEnviada} disabled={markingEnviada}>
                {markingEnviada && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Marcar como Enviada
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Confirm fechar */}
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Fechar Folha?</DialogTitle>
            <DialogDescription>Após fechar, os valores serão travados para auditoria. Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClose(false)} disabled={fechando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleFecharFolha} disabled={fechando}>
              {fechando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

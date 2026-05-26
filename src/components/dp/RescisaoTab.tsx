import { useState } from "react";
import { Eye, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type Rescisao, type TipoRescisao, useFuncionarios, useRescisoes } from "@/hooks/use-dp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RescisaoDetalheDialog } from "./RescisaoDetalheDialog";

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const fmtBRL  = (v: number) => v.toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });

const TIPO_BADGE: Record<TipoRescisao, { label: string; cls: string }> = {
  sem_justa_causa: { label:"Sem Justa Causa",   cls:"bg-amber-100 text-amber-700" },
  com_justa_causa: { label:"Com Justa Causa",   cls:"bg-red-100 text-red-700" },
  pedido_demissao: { label:"Pedido Demissão",   cls:"bg-blue-100 text-blue-700" },
  acordo:          { label:"Acordo",            cls:"bg-green-100 text-green-700" },
  aposentadoria:   { label:"Aposentadoria",     cls:"bg-purple-100 text-purple-700" },
};

type EditState = { open: boolean; rescisao: Rescisao | null };
const EDIT_FIELDS: { key: keyof Rescisao; label: string }[] = [
  { key:"saldo_salario",        label:"Saldo Salário" },
  { key:"ferias_vencidas",      label:"Férias Vencidas" },
  { key:"ferias_proporcionais", label:"Férias Proporcionais" },
  { key:"decimo_proporcional",  label:"13º Proporcional" },
  { key:"multa_fgts",           label:"Multa FGTS (40%)" },
  { key:"inss_desconto",        label:"INSS Desconto" },
  { key:"irrf_desconto",        label:"IRRF Desconto" },
];

type Props = { empresaId: string };

export function RescisaoTab({ empresaId }: Props) {
  const { funcionarios } = useFuncionarios(empresaId);
  const { rescisoes, loading, refresh: refetch } = useRescisoes(empresaId);
  const [detalhe, setDetalhe]  = useState<Rescisao | null>(null);
  const [edit, setEdit]        = useState<EditState>({ open: false, rescisao: null });
  const [editVals, setEditVals] = useState<Record<string, string>>({});
  const [saving, setSaving]    = useState(false);

  function getNome(id: string) {
    return funcionarios.find(f => f.id === id)?.nome ?? id.slice(0,8)+"…";
  }

  async function toggleHomologada(r: Rescisao) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("rescisoes")
      .update({ homologada: !r.homologada, homologada_em: !r.homologada ? new Date().toISOString() : null })
      .eq("id", r.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Homologação atualizada!"); refetch();
  }

  function openEdit(r: Rescisao) {
    const vals: Record<string, string> = {};
    EDIT_FIELDS.forEach(({ key }) => { vals[key as string] = String(r[key] ?? 0); });
    setEditVals(vals);
    setEdit({ open: true, rescisao: r });
  }

  async function handleSaveEdit() {
    if (!edit.rescisao) return;
    setSaving(true);
    const update: Record<string, number> = {};
    let totalBruto = 0;
    EDIT_FIELDS.forEach(({ key }) => {
      const v = parseFloat(editVals[key as string]) || 0;
      update[key as string] = v;
      if (!["inss_desconto","irrf_desconto"].includes(key as string)) totalBruto += v;
    });
    const totalDescontos = (parseFloat(editVals["inss_desconto"]) || 0) + (parseFloat(editVals["irrf_desconto"]) || 0);
    update.total_bruto = totalBruto;
    update.total_liquido = totalBruto - totalDescontos;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("rescisoes").update(update).eq("id", edit.rescisao.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Rescisão atualizada!"); setEdit({ open: false, rescisao: null }); refetch();
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /><span>Carregando rescisões…</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="surface-card overflow-hidden">
        <table className="ft-table w-full">
          <thead><tr>
            <th>Funcionário</th><th>Tipo</th><th>Demissão</th>
            <th>Saldo Sal.</th><th>Férias</th><th>13º Prop.</th>
            <th>Multa FGTS</th><th>Total Líq.</th><th>Homologada</th><th>Ações</th>
          </tr></thead>
          <tbody>
            {rescisoes.length === 0 && (
              <tr><td colSpan={10} className="text-center text-muted-foreground py-8 text-sm">Nenhuma rescisão registrada</td></tr>
            )}
            {rescisoes.map(r => {
              const tb = TIPO_BADGE[r.tipo];
              return (
                <tr key={r.id}>
                  <td className="font-medium">{getNome(r.funcionario_id)}</td>
                  <td>
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", tb.cls)}>{tb.label}</span>
                  </td>
                  <td>{fmtDate(r.data_demissao)}</td>
                  <td>{fmtBRL(r.saldo_salario)}</td>
                  <td>{fmtBRL(r.ferias_vencidas + r.ferias_proporcionais)}</td>
                  <td>{fmtBRL(r.decimo_proporcional)}</td>
                  <td>{fmtBRL(r.multa_fgts)}</td>
                  <td className="font-semibold text-primary">{fmtBRL(r.total_liquido)}</td>
                  <td>
                    <input type="checkbox" checked={r.homologada}
                      onChange={() => toggleHomologada(r)}
                      className="h-4 w-4 accent-primary cursor-pointer" />
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setDetalhe(r)} title="Ver detalhes"
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => openEdit(r)} title="Editar valores"
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog detalhe */}
      {detalhe && (
        <RescisaoDetalheDialog open={!!detalhe} onClose={() => setDetalhe(null)}
          rescisao={detalhe} nomeFuncionario={getNome(detalhe.funcionario_id)} />
      )}

      {/* Dialog editar valores */}
      <Dialog open={edit.open} onOpenChange={v => !v && setEdit({ open:false, rescisao:null })}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar Verbas Rescisórias</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {EDIT_FIELDS.map(({ key, label }) => (
              <div key={key as string}>
                <Label>{label} (R$)</Label>
                <Input type="number" min="0" step="0.01"
                  value={editVals[key as string] ?? "0"}
                  onChange={e => setEditVals(prev => ({ ...prev, [key as string]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit({ open:false, rescisao:null })} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

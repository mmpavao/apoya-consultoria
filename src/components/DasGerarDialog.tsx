import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientes } from "@/hooks/use-clientes";
import { supabase } from "@/integrations/supabase/client";

type Props = { open: boolean; onClose: () => void; onCreated?: () => void; };

const now = new Date();
const prevMonth = (() => {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();
const venc20 = (() => {
  const d = new Date(now.getFullYear(), now.getMonth(), 20);
  return d.toISOString().split("T")[0];
})();

export function DasGerarDialog({ open, onClose, onCreated }: Props) {
  const { clientes } = useClientes();
  const elegíveis = clientes.filter(c => ["MEI", "Simples"].includes(c.regime) && c.status === "ativo");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ clienteId: "", competencia: prevMonth, vencimento: venc20, valor: "" });

  useEffect(() => { if (!open) return; setForm(f => ({ ...f, clienteId: "", valor: "" })); }, [open]);

  const cliente = clientes.find(c => c.id === form.clienteId);
  const tipo = cliente?.regime === "MEI" ? "DASMEI" : "DAS";

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.clienteId || !form.vencimento) { toast.error("Selecione o cliente e o vencimento"); return; }
    setSaving(true);
    const { error } = await supabase.from("das_guias").insert({
      cliente_id: form.clienteId,
      cliente_nome: cliente?.razaoSocial ?? "",
      cnpj: cliente?.cnpj ?? "",
      regime: cliente?.regime ?? "",
      tipo,
      competencia: form.competencia,
      vencimento: form.vencimento,
      valor: form.valor ? parseFloat(form.valor) : 0,
      status: "pendente",
    });
    setSaving(false);
    if (error) { toast.error("Erro ao criar guia: " + error.message); return; }
    toast.success(`Guia ${tipo} criada para ${cliente?.razaoSocial}!`);
    window.dispatchEvent(new Event("apoya:das:changed"));
    onCreated?.();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Guia DAS</DialogTitle>
          <DialogDescription>Gere uma guia DAS/DASMEI para o cliente selecionado.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente (MEI / Simples Nacional) *</Label>
            <Select value={form.clienteId} onValueChange={v => up("clienteId", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>{elegíveis.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial} <span className="text-muted-foreground text-xs ml-1">({c.regime})</span></SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.clienteId && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              Tipo detectado: <strong>{tipo}</strong> · Regime: <strong>{cliente?.regime}</strong>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Competência</Label>
              <Input type="month" value={form.competencia} onChange={e => up("competencia", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Vencimento</Label>
              <Input type="date" value={form.vencimento} onChange={e => up("vencimento", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Valor estimado (R$) <span className="text-muted-foreground text-xs">— opcional</span></Label>
            <Input type="number" min="0" step="0.01" value={form.valor} onChange={e => up("valor", e.target.value)} placeholder="Deixe em branco se não souber" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Gerar guia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
const prevMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, "0") || "12"}`;

export function NfseFormDialog({ open, onClose, onCreated }: Props) {
  const { clientes } = useClientes();
  const ativos = clientes.filter(c => c.status === "ativo");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clienteId: "", competencia: prevMonth,
    valorServico: "", tomadorRazao: "", tomadorCnpj: "",
    aliquotaCbs: "0.9", aliquotaIbs: "0.1",
  });

  useEffect(() => { if (!open) return; setForm(f => ({ ...f, clienteId: "", valorServico: "" })); }, [open]);

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const cliente = clientes.find(c => c.id === form.clienteId);

  const valor = parseFloat(form.valorServico) || 0;
  const tribCbs = valor * (parseFloat(form.aliquotaCbs) / 100);
  const tribIbs = valor * (parseFloat(form.aliquotaIbs) / 100);

  async function handleSave() {
    if (!form.clienteId || !form.valorServico) { toast.error("Preencha cliente e valor"); return; }
    setSaving(true);
    const { error } = await supabase.from("nfse_notas").insert({
      cliente_id: form.clienteId,
      cliente_nome: cliente?.razaoSocial ?? "",
      cnpj: cliente?.cnpj ?? "",
      competencia: form.competencia,
      valor_servico: valor,
      status: "rascunho",
      tomador_razao: form.tomadorRazao || null,
      tomador_cnpj: form.tomadorCnpj || null,
      aliquota_cbs: parseFloat(form.aliquotaCbs),
      aliquota_ibs: parseFloat(form.aliquotaIbs),
    });
    setSaving(false);
    if (error) { toast.error("Erro ao criar nota: " + error.message); return; }
    toast.success("Rascunho de NFS-e criado!");
    window.dispatchEvent(new Event("apoya:nfse:changed"));
    onCreated?.();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova NFS-e</DialogTitle>
          <DialogDescription>Crie um rascunho de nota fiscal de serviço eletrônica.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Prestador (cliente) *</Label>
            <Select value={form.clienteId} onValueChange={v => up("clienteId", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>{ativos.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Competência</Label>
              <Input type="month" value={form.competencia} onChange={e => up("competencia", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Valor do serviço (R$) *</Label>
              <Input type="number" min="0" step="0.01" value={form.valorServico} onChange={e => up("valorServico", e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tomador — Razão Social</Label>
              <Input value={form.tomadorRazao} onChange={e => up("tomadorRazao", e.target.value)} placeholder="Opcional" />
            </div>
            <div className="grid gap-1.5">
              <Label>Tomador — CNPJ/CPF</Label>
              <Input value={form.tomadorCnpj} onChange={e => up("tomadorCnpj", e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Alíquota CBS (%)</Label>
              <Input type="number" min="0" step="0.01" value={form.aliquotaCbs} onChange={e => up("aliquotaCbs", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Alíquota IBS (%)</Label>
              <Input type="number" min="0" step="0.01" value={form.aliquotaIbs} onChange={e => up("aliquotaIbs", e.target.value)} />
            </div>
          </div>
          {valor > 0 && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-0.5">
              <div className="flex justify-between"><span>CBS:</span><span className="font-medium">R$ {tribCbs.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>IBS:</span><span className="font-medium">R$ {tribIbs.toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total tributos:</span><span>R$ {(tribCbs + tribIbs).toFixed(2)}</span></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

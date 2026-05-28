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
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const nextMonth10 = (() => {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 10);
  return d.toISOString().split("T")[0];
})();

export function CobrancaFormDialog({ open, onClose, onCreated }: Props) {
  const { clientes } = useClientes();
  const ativos = clientes.filter(c => c.status === "ativo" || c.status === "inadimplente");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clienteId: "",
    descricao: "Mensalidade APOYA",
    valor: "",
    forma: "UNDEFINED" as "PIX" | "BOLETO" | "UNDEFINED",
    vencimento: nextMonth10,
    competencia: thisMonth,
  });

  useEffect(() => {
    if (!open) return;
    setForm(f => ({ ...f, clienteId: "", valor: "" }));
  }, [open]);

  useEffect(() => {
    if (!form.clienteId) return;
    const c = clientes.find(x => x.id === form.clienteId);
    if (c?.valorHonorario) setForm(f => ({ ...f, valor: String(c.valorHonorario), forma: (c.formaPagamento as any) ?? "UNDEFINED" }));
  }, [form.clienteId, clientes]);

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.clienteId || !form.valor || !form.vencimento) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      // Usar rota do servidor (supabaseAdmin) para contornar RLS
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const res = await fetch("/api/cobranca/criar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          cliente_id:  form.clienteId,
          valor:       parseFloat(form.valor),
          descricao:   form.descricao,
          forma:       form.forma,
          vencimento:  form.vencimento,
          competencia: form.competencia,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.warning(`Cobrança já existe para ${form.competencia}. Status: ${data.status}`);
        } else {
          toast.error("Erro ao criar cobrança: " + (data.error ?? res.statusText));
        }
        return;
      }

      toast.success("Cobrança criada com sucesso!");
      window.dispatchEvent(new Event("apoya:cobrancas:changed"));
      onCreated?.();
      onClose();
    } catch (e: unknown) {
      toast.error("Erro inesperado: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Cobrança</DialogTitle>
          <DialogDescription>Crie uma cobrança de honorários para um cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            <Select value={form.clienteId} onValueChange={v => up("clienteId", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>{ativos.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={e => up("descricao", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Valor (R$) *</Label>
              <Input type="number" min="0" step="0.01" value={form.valor} onChange={e => up("valor", e.target.value)} placeholder="0,00" />
            </div>
            <div className="grid gap-1.5">
              <Label>Forma</Label>
              <Select value={form.forma} onValueChange={v => up("forma", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNDEFINED">PIX / Boleto / Cartão</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Competência</Label>
              <Input type="month" value={form.competencia} onChange={e => up("competencia", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Vencimento *</Label>
              <Input type="date" value={form.vencimento} onChange={e => up("vencimento", e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

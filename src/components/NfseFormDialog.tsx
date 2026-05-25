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
const prevMonth = `${now.getFullYear()}-${String(now.getMonth() || 12).padStart(2, "0")}`;

export function NfseFormDialog({ open, onClose, onCreated }: Props) {
  const { clientes } = useClientes();
  const ativos = clientes.filter(c => c.status === "ativo");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clienteId: "", competencia: prevMonth,
    valorServico: "", tomadorRazao: "", tomadorCnpj: "",
    aliquotaCbs: "0.9", aliquotaIbs: "0.1", aliquotaIss: "2.0",
    descricaoServico: "Serviços contábeis mensais conforme contrato",
    serie: "A",
  });

  useEffect(() => { if (!open) return; setForm(f => ({ ...f, clienteId: "", valorServico: "" })); }, [open]);

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const cliente = clientes.find(c => c.id === form.clienteId);

  const valor = parseFloat(form.valorServico) || 0;
  const aliquotaCbs = parseFloat(form.aliquotaCbs) || 0;
  const aliquotaIbs = parseFloat(form.aliquotaIbs) || 0;
  const aliquotaIss = parseFloat(form.aliquotaIss) || 0;
  const tribCbs = valor * (aliquotaCbs / 100);
  const tribIbs = valor * (aliquotaIbs / 100);
  const tribIss = valor * (aliquotaIss / 100);

  async function handleSave() {
    if (!form.clienteId || !form.valorServico) { toast.error("Preencha cliente e valor"); return; }
    setSaving(true);
    const hoje = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("nfse_notas").insert({
      cliente_id: form.clienteId,
      cliente_nome: cliente?.razaoSocial ?? "",
      cnpj: cliente?.cnpj ?? "",
      cnpj_tomador: form.tomadorCnpj || (cliente?.cnpj ?? ""),
      competencia: form.competencia,
      valor_servico: valor,
      valor_cbs: tribCbs,
      valor_ibs: tribIbs,
      valor_iss: tribIss,
      valor_liquido: valor,
      aliquota_cbs: aliquotaCbs,
      aliquota_ibs: aliquotaIbs,
      aliquota_iss: aliquotaIss,
      status: "rascunho",
      tomador_razao: form.tomadorRazao || null,
      tomador_cnpj: form.tomadorCnpj || null,
      tomador: form.tomadorRazao || (cliente?.razaoSocial ?? ""),
      descricao_servico: form.descricaoServico,
      emissao: hoje,
      regime: cliente?.regime ?? "Simples Nacional",
      serie: form.serie,
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
          <DialogTitle>Nova NFS-e (Rascunho)</DialogTitle>
          <DialogDescription>Crie um rascunho para revisão antes de emitir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={form.clienteId} onValueChange={v => up("clienteId", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente…" /></SelectTrigger>
              <SelectContent>
                {ativos.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Competência</Label>
              <Input type="month" value={form.competencia} onChange={e => up("competencia", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" value={form.valorServico} onChange={e => up("valorServico", e.target.value)} placeholder="0,00" min="0" step="0.01" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição do serviço</Label>
            <Input value={form.descricaoServico} onChange={e => up("descricaoServico", e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Alíq. CBS (%)</Label>
              <Input type="number" value={form.aliquotaCbs} onChange={e => up("aliquotaCbs", e.target.value)} step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label>Alíq. IBS (%)</Label>
              <Input type="number" value={form.aliquotaIbs} onChange={e => up("aliquotaIbs", e.target.value)} step="0.01" />
            </div>
            <div className="space-y-1.5">
              <Label>Alíq. ISS (%)</Label>
              <Input type="number" value={form.aliquotaIss} onChange={e => up("aliquotaIss", e.target.value)} step="0.01" />
            </div>
          </div>

          {valor > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Valor bruto</span><span>R$ {valor.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CBS</span><span>R$ {tribCbs.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">IBS</span><span>R$ {tribIbs.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">ISS</span><span>R$ {tribIss.toFixed(2)}</span></div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tomador (nome)</Label>
              <Input value={form.tomadorRazao} onChange={e => up("tomadorRazao", e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ/CPF do tomador</Label>
              <Input value={form.tomadorCnpj} onChange={e => up("tomadorCnpj", e.target.value)} placeholder="Opcional" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

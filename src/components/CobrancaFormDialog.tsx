import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useClientes } from "@/hooks/use-clientes";
import { supabase } from "@/integrations/supabase/client";

export type CobrancaEdit = {
  id: string; clienteId: string; descricao?: string; valor: number;
  forma?: string; vencimento: string; competencia?: string;
};
type Props = { open: boolean; onClose: () => void; onCreated?: () => void; cobranca?: CobrancaEdit | null };

const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const nextMonth10 = (() => {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 10);
  return d.toISOString().split("T")[0];
})();

export function CobrancaFormDialog({ open, onClose, onCreated, cobranca }: Props) {
  const { clientes } = useClientes();
  const isEdit = !!cobranca;
  // Apenas clientes ativos ou inadimplentes
  const ativos = clientes.filter(c => c.status === "ativo" || c.status === "inadimplente");
  const [saving, setSaving]           = useState(false);
  const [semContrato, setSemContrato] = useState(false);
  const [form, setForm] = useState({
    clienteId:   "",
    descricao:   "Mensalidade APOYA",
    valor:       "",
    forma:       "UNDEFINED" as "PIX" | "BOLETO" | "UNDEFINED",
    vencimento:  nextMonth10,
    competencia: thisMonth,
  });

  // Reset/prefill ao abrir
  useEffect(() => {
    if (!open) return;
    if (cobranca) {
      setForm({
        clienteId:   cobranca.clienteId,
        descricao:   cobranca.descricao ?? "Mensalidade APOYA",
        valor:       String(cobranca.valor ?? ""),
        forma:       (cobranca.forma as "PIX" | "BOLETO" | "UNDEFINED") ?? "UNDEFINED",
        vencimento:  cobranca.vencimento,
        competencia: cobranca.competencia ?? thisMonth,
      });
    } else {
      setForm(f => ({ ...f, clienteId: "", valor: "" }));
    }
    setSemContrato(false);
  }, [open, cobranca]);

  // Preenche valor do honorário ao selecionar cliente + verifica contrato
  useEffect(() => {
    if (!form.clienteId) { setSemContrato(false); return; }
    const c = clientes.find(x => x.id === form.clienteId);
    if (c?.valorHonorario) setForm(f => ({ ...f, valor: String(c.valorHonorario) }));

    // Verifica contrato ativo via Supabase
    (async () => {
      const { data } = await (supabase as any)
        .from("contrato_cliente")
        .select("id")
        .eq("cliente_id", form.clienteId)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();
      setSemContrato(!data);
    })();
  }, [form.clienteId, clientes]);

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.clienteId || !form.valor || !form.vencimento) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    if (!isEdit && semContrato) {
      toast.error("Este cliente não possui contrato ativo. Assine o contrato antes de gerar cobrança.");
      return;
    }

    // EDIÇÃO: update direto (sem passar pelo gateway)
    if (isEdit && cobranca) {
      setSaving(true);
      try {
        const { error } = await supabase.from("cobrancas").update({
          valor:       parseFloat(form.valor),
          descricao:   form.descricao,
          forma:       form.forma,
          vencimento:  form.vencimento,
          competencia: form.competencia,
        } as any).eq("id", cobranca.id);
        if (error) { toast.error("Erro ao salvar: " + error.message); return; }
        toast.success("Cobrança atualizada");
        window.dispatchEvent(new Event("apoya:cobrancas:changed"));
        onCreated?.();
        onClose();
      } finally { setSaving(false); }
      return;
    }

    setSaving(true);
    try {
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

      toast.success("Cobrança criada! Use 'Emitir' para enviar ao Asaas.");
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
          <DialogTitle>{isEdit ? "Editar Cobrança" : "Nova Cobrança"}</DialogTitle>
          <DialogDescription>{isEdit ? "Ajuste os dados da cobrança." : "Crie uma cobrança de honorários para um cliente."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            <Select value={form.clienteId} onValueChange={v => up("clienteId", v)} disabled={isEdit}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {ativos.map(c => <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Aviso sem contrato */}
          {semContrato && form.clienteId && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Este cliente não possui contrato ativo. Assine o contrato de prestação de serviços antes de gerar cobranças.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={e => up("descricao", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Valor (R$) *</Label>
              <Input type="number" min="0" step="0.01" value={form.valor}
                onChange={e => up("valor", e.target.value)} placeholder="0,00" />
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
          <Button onClick={handleSave} disabled={saving || (!isEdit && semContrato)}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Salvar cobrança"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

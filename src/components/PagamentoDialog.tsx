import { useState } from "react";
import { fmtBRL } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type Cobranca } from "@/hooks/use-cobrancas";

interface Props { cobranca:Cobranca|null; open:boolean; onClose:()=>void; onSaved?:()=>void; }
const FORMAS = [{value:"PIX",label:"PIX"},{value:"BOLETO",label:"Boleto"},{value:"DEBITO",label:"Débito"},{value:"DINHEIRO",label:"Dinheiro"},{value:"CARTAO",label:"Cartão"}];

export function PagamentoDialog({cobranca,open,onClose,onSaved}:Props) {
  const [dataPagamento,setDataPagamento] = useState(new Date().toISOString().split("T")[0]);
  const [forma,setForma] = useState("PIX");
  const [observacao,setObservacao] = useState("");
  const [salvando,setSalvando] = useState(false);

  async function handleSalvar() {
    if (!cobranca) return;
    setSalvando(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const {error} = await (supabase as any).from("cobrancas").update({
        status:"paga", pago_em:dataPagamento, forma,
        ...(observacao?{observacoes:observacao}:{}),
      }).eq("id",cobranca.id);
      if (error) throw error;
      toast.success(`Pagamento registrado — ${fmtBRL(cobranca.valor)}`);
      window.dispatchEvent(new Event("apoya:cobrancas:changed"));
      onSaved?.(); onClose();
    } catch(e) {
      toast.error(e instanceof Error?e.message:"Erro ao registrar pagamento");
    } finally { setSalvando(false); }
  }

  if (!cobranca) return null;
  return (
    <Dialog open={open} onOpenChange={v=>{if(!v)onClose();}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500"/>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </div>
        </DialogHeader>
        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-medium">{cobranca.clienteNome}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="font-bold">{fmtBRL(cobranca.valor)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Competência:</span><span>{cobranca.competencia}</span></div>
          {cobranca.diasAtraso>0 && <div className="flex justify-between"><span className="text-muted-foreground">Atraso:</span><span className="text-rose-600 font-semibold">{cobranca.diasAtraso}d</span></div>}
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Data do pagamento <span className="text-destructive">*</span></Label>
            <Input type="date" value={dataPagamento} onChange={e=>setDataPagamento(e.target.value)}/>
          </div>
          <div className="space-y-1.5">
            <Label>Forma <span className="text-destructive">*</span></Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{FORMAS.map(f=><SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Textarea placeholder="Ex: comprovante enviado por email..." rows={2} value={observacao} onChange={e=>setObservacao(e.target.value)}/>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando||!dataPagamento||!forma} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-4 w-4"/>{salvando?"Salvando...":"Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

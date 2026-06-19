import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Funcionario, type TipoRescisao, useDemitirFuncionario } from "@/hooks/use-dp";

type Props = {
  open: boolean; onClose: () => void;
  funcionario: Funcionario; onDemitido?: () => void;
};

const TIPOS: { value: TipoRescisao; label: string }[] = [
  { value:"sem_justa_causa",  label:"Sem Justa Causa" },
  { value:"com_justa_causa",  label:"Com Justa Causa" },
  { value:"pedido_demissao",  label:"Pedido de Demissão" },
  { value:"acordo",           label:"Acordo (LGPD/Comum)" },
  { value:"aposentadoria",    label:"Aposentadoria" },
];

export function DemissaoDialog({ open, onClose, funcionario, onDemitido }: Props) {
  const { demitir, loading } = useDemitirFuncionario();
  const [dataDemissao, setDataDemissao] = useState("");
  const [tipo, setTipo] = useState<TipoRescisao>("sem_justa_causa");
  const [obs, setObs] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await demitir(funcionario.id, dataDemissao, tipo, obs);
    if (ok) { onDemitido?.(); onClose(); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Demissão</DialogTitle>
          <DialogDescription>Esta ação irá marcar o funcionário como demitido e registrar a rescisão.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Funcionário</Label>
            <Input value={funcionario.nome} disabled className="bg-muted" />
          </div>
          <div>
            <Label>Data de Demissão *</Label>
            <Input type="date" value={dataDemissao} onChange={e => setDataDemissao(e.target.value)} required />
          </div>
          <div>
            <Label>Tipo de Rescisão *</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as TipoRescisao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} placeholder="Motivo ou observações adicionais..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar Demissão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

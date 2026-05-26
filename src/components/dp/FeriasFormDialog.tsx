import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type Funcionario, useCreateFerias } from "@/hooks/use-dp";

type Props = {
  open: boolean; onClose: () => void; empresaId: string;
  funcionarios: Funcionario[]; onSaved?: () => void;
};

const BLANK = {
  funcionario_id:"", periodo_aquisitivo_ini:"", periodo_aquisitivo_fim:"",
  gozo_inicio:"", gozo_fim:"", dias_gozo:"30",
  abono_pecuniario: false, dias_abono:"0",
};

export function FeriasFormDialog({ open, onClose, empresaId, funcionarios, onSaved }: Props) {
  const { create: agendar, loading } = useCreateFerias();
  const [f, setF] = useState(BLANK);

  useEffect(() => { if (!open) setF(BLANK); }, [open]);

  const set = (k: keyof typeof BLANK, v: string | boolean) =>
    setF(prev => ({ ...prev, [k]: v }));

  // Calcular dias_gozo automaticamente
  useEffect(() => {
    if (f.gozo_inicio && f.gozo_fim) {
      const ini = new Date(f.gozo_inicio);
      const fim = new Date(f.gozo_fim);
      const diff = Math.max(0, Math.round((fim.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      set("dias_gozo", String(diff));
    }
  }, [f.gozo_inicio, f.gozo_fim]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await agendar({
      funcionario_id: f.funcionario_id,
      empresa_id: empresaId,
      periodo_aquisitivo_ini: f.periodo_aquisitivo_ini,
      periodo_aquisitivo_fim: f.periodo_aquisitivo_fim,
      gozo_inicio: f.gozo_inicio || undefined,
      gozo_fim: f.gozo_fim || undefined,
      dias_gozo: parseInt(f.dias_gozo) || 30,
      abono_pecuniario: f.abono_pecuniario,
      dias_abono: f.abono_pecuniario ? parseInt(f.dias_abono) || 0 : 0,
      status: "agendada",
    });
    if (ok) { onSaved?.(); onClose(); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Agendar Férias</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Funcionário *</Label>
            <Select value={f.funcionario_id} onValueChange={v => set("funcionario_id",v)} required>
              <SelectTrigger><SelectValue placeholder="Selecionar funcionário..." /></SelectTrigger>
              <SelectContent>
                {funcionarios.filter(fn => fn.status === "ativo").map(fn => (
                  <SelectItem key={fn.id} value={fn.id}>{fn.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período Aquisitivo — Início *</Label>
              <Input type="date" value={f.periodo_aquisitivo_ini} onChange={e => set("periodo_aquisitivo_ini",e.target.value)} required />
            </div>
            <div>
              <Label>Período Aquisitivo — Fim *</Label>
              <Input type="date" value={f.periodo_aquisitivo_fim} onChange={e => set("periodo_aquisitivo_fim",e.target.value)} required />
            </div>
            <div>
              <Label>Início do Gozo</Label>
              <Input type="date" value={f.gozo_inicio} onChange={e => set("gozo_inicio",e.target.value)} />
            </div>
            <div>
              <Label>Fim do Gozo</Label>
              <Input type="date" value={f.gozo_fim} onChange={e => set("gozo_fim",e.target.value)} />
            </div>
            <div>
              <Label>Dias de Gozo</Label>
              <Input type="number" min="1" max="30" value={f.dias_gozo} onChange={e => set("dias_gozo",e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={f.abono_pecuniario} onCheckedChange={v => set("abono_pecuniario",v)} id="abono" />
            <Label htmlFor="abono">Abono Pecuniário (vender 1/3)</Label>
          </div>
          {f.abono_pecuniario && (
            <div>
              <Label>Dias de Abono (máx. 10)</Label>
              <Input type="number" min="1" max="10" value={f.dias_abono} onChange={e => set("dias_abono",e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading || !f.funcionario_id || !f.periodo_aquisitivo_ini || !f.periodo_aquisitivo_fim}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agendar Férias
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

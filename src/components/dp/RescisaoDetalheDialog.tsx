import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { type Rescisao } from "@/hooks/use-dp";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR",{ style:"currency", currency:"BRL" });

type Props = { open: boolean; onClose: () => void; rescisao: Rescisao; nomeFuncionario: string };

export function RescisaoDetalheDialog({ open, onClose, rescisao: r, nomeFuncionario }: Props) {
  const totalBruto = r.saldo_salario + r.ferias_vencidas + r.ferias_proporcionais + r.decimo_proporcional + r.multa_fgts;
  const totalDescontos = r.inss_desconto + r.irrf_desconto;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Rescisão — {nomeFuncionario}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          {/* Col 1 — Verbas */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Verbas Rescisórias</p>
            {[
              { label:"Saldo de Salário",      val: r.saldo_salario },
              { label:"Férias Vencidas",        val: r.ferias_vencidas },
              { label:"Férias Proporcionais",   val: r.ferias_proporcionais },
              { label:"13º Proporcional",       val: r.decimo_proporcional },
              { label:"Multa FGTS (40%)",       val: r.multa_fgts },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{fmtBRL(item.val)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-bold">
              <span>Total Bruto</span>
              <span>{fmtBRL(totalBruto)}</span>
            </div>
          </div>

          {/* Col 2 — Descontos */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Descontos</p>
            {[
              { label:"INSS", val: r.inss_desconto },
              { label:"IRRF", val: r.irrf_desconto },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-red-600">- {fmtBRL(item.val)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-bold">
              <span>Total Descontos</span>
              <span className="text-red-600">- {fmtBRL(totalDescontos)}</span>
            </div>
            <div className="mt-4 pt-2">
              <p className="text-xs text-muted-foreground">FGTS Total a Sacar</p>
              <p className="text-base font-bold text-blue-600">{fmtBRL(r.fgts_saldo)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Homologada</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.homologada ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {r.homologada ? "Sim" : "Não"}
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé total líquido */}
        <div className="border-t mt-4 pt-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Líquido a Receber</p>
          <p className="text-2xl font-bold text-primary mt-1">{fmtBRL(r.total_liquido)}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

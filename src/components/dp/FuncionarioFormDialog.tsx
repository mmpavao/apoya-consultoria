import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type Funcionario, type TipoContrato, useCreateFuncionario, useUpdateFuncionario } from "@/hooks/use-dp";

type Props = {
  open: boolean; onClose: () => void; empresaId: string;
  funcionario?: Funcionario | null; onSaved?: () => void;
};

function maskCpf(v: string) {
  return v.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2").slice(0,14);
}

const TIPOS: { value: TipoContrato; label: string }[] = [
  { value:"clt", label:"CLT" },{ value:"pj", label:"PJ" },
  { value:"estagiario", label:"Estagiário" },{ value:"autonomo", label:"Autônomo" },
];

const BLANK = {
  nome:"", cpf:"", pis:"", cargo:"", departamento:"", salario_base:"",
  data_admissao:"", tipo_contrato:"clt" as TipoContrato, jornada:"",
  banco:"", agencia:"", conta:"", tipo_conta:"corrente", dependentes:"0", observacoes:"",
};

export function FuncionarioFormDialog({ open, onClose, empresaId, funcionario, onSaved }: Props) {
  const { create: criar, loading: criando } = useCreateFuncionario();
  const { update: atualizar, loading: atualizando } = useUpdateFuncionario();
  const isEdit = !!funcionario;
  const saving = criando || atualizando;
  const [f, setF] = useState(BLANK);

  useEffect(() => {
    if (funcionario) {
      setF({
        nome: funcionario.nome, cpf: funcionario.cpf, pis: funcionario.pis ?? "",
        cargo: funcionario.cargo ?? "", departamento: funcionario.departamento ?? "",
        salario_base: String(funcionario.salario_base), data_admissao: funcionario.data_admissao,
        tipo_contrato: funcionario.tipo_contrato, jornada: funcionario.jornada ?? "",
        banco: funcionario.banco ?? "", agencia: funcionario.agencia ?? "",
        conta: funcionario.conta ?? "", tipo_conta: funcionario.tipo_conta ?? "corrente",
        dependentes: String(funcionario.dependentes), observacoes: funcionario.observacoes ?? "",
      });
    } else { setF(BLANK); }
  }, [funcionario, open]);

  const set = (k: keyof typeof BLANK, v: string) => setF(prev => ({ ...prev, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      empresa_id: empresaId, nome: f.nome.trim(), cpf: f.cpf.trim(),
      pis: f.pis || undefined, cargo: f.cargo || undefined, departamento: f.departamento || undefined,
      salario_base: parseFloat(f.salario_base) || 0, data_admissao: f.data_admissao,
      tipo_contrato: f.tipo_contrato, jornada: f.jornada || undefined,
      banco: f.banco || undefined, agencia: f.agencia || undefined,
      conta: f.conta || undefined, tipo_conta: f.tipo_conta || undefined,
      dependentes: parseInt(f.dependentes) || 0, observacoes: f.observacoes || undefined,
    };
    const ok = isEdit && funcionario
      ? await atualizar(funcionario.id, data)
      : await criar({ ...data, status: "ativo" });
    if (ok) { onSaved?.(); onClose(); }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome Completo *</Label>
              <Input value={f.nome} onChange={e => set("nome",e.target.value)} required placeholder="Nome completo" />
            </div>
            <div>
              <Label>CPF *</Label>
              <Input value={f.cpf} onChange={e => set("cpf",maskCpf(e.target.value))} required placeholder="000.000.000-00" maxLength={14} />
            </div>
            <div>
              <Label>PIS</Label>
              <Input value={f.pis} onChange={e => set("pis",e.target.value)} placeholder="000.00000.00-0" />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input value={f.cargo} onChange={e => set("cargo",e.target.value)} placeholder="Ex: Auxiliar Administrativo" />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input value={f.departamento} onChange={e => set("departamento",e.target.value)} placeholder="Ex: Financeiro" />
            </div>
            <div>
              <Label>Data de Admissão *</Label>
              <Input type="date" value={f.data_admissao} onChange={e => set("data_admissao",e.target.value)} required />
            </div>
            <div>
              <Label>Salário Base (R$) *</Label>
              <Input type="number" min="0" step="0.01" value={f.salario_base} onChange={e => set("salario_base",e.target.value)} required placeholder="0,00" />
            </div>
            <div>
              <Label>Tipo de Contrato *</Label>
              <Select value={f.tipo_contrato} onValueChange={v => set("tipo_contrato",v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jornada</Label>
              <Input value={f.jornada} onChange={e => set("jornada",e.target.value)} placeholder="44h semanais, seg-sex 08-18" />
            </div>
            <div>
              <Label>Dependentes</Label>
              <Input type="number" min="0" value={f.dependentes} onChange={e => set("dependentes",e.target.value)} />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados Bancários</p>
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Banco</Label><Input value={f.banco} onChange={e => set("banco",e.target.value)} placeholder="001" /></div>
            <div><Label>Agência</Label><Input value={f.agencia} onChange={e => set("agencia",e.target.value)} placeholder="0000-0" /></div>
            <div><Label>Conta</Label><Input value={f.conta} onChange={e => set("conta",e.target.value)} placeholder="00000-0" /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={f.tipo_conta} onValueChange={v => set("tipo_conta",v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corrente">Corrente</SelectItem>
                  <SelectItem value="poupança">Poupança</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={f.observacoes} onChange={e => set("observacoes",e.target.value)} rows={2} placeholder="Observações internas..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar Alterações" : "Criar Funcionário"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

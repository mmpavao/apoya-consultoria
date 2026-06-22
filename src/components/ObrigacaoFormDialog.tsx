import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClientes } from "@/hooks/use-clientes";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Obrigacao, ObrigacaoTipo } from "@/hooks/use-obrigacoes";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  /** Quando fornecido, abre em modo EDIÇÃO */
  obrigacao?: Obrigacao;
};

const TIPOS: ObrigacaoTipo[] = [
  "DAS","DASN-Simei","DCTFWeb","EFD-Contribuições","EFD-ICMS/IPI",
  "EFD-Reinf","ECF","ECD","DIRBI","DEFIS","NFSe","FGTS Digital","eSocial",
];

const STATUS_OPTS = [
  { value: "pendente",      label: "Pendente" },
  { value: "em_andamento",  label: "Em andamento" },
  { value: "concluida",     label: "Concluída" },
  { value: "atrasada",      label: "Atrasada" },
];

const DESC_AUTO: Record<ObrigacaoTipo, string> = {
  "DAS": "Pagamento do DAS — Simples Nacional",
  "DASN-Simei": "Declaração Anual do Simei",
  "DCTFWeb": "Declaração de Débitos e Créditos Tributários Federais Web",
  "EFD-Contribuições": "Escrituração Fiscal Digital — PIS/COFINS",
  "EFD-ICMS/IPI": "Escrituração Fiscal Digital — ICMS/IPI",
  "EFD-Reinf": "Escrituração Fiscal Digital de Retenções",
  "ECF": "Escrituração Contábil Fiscal",
  "ECD": "Escrituração Contábil Digital",
  "DIRBI": "Declaração de Incentivos, Renúncias, Benefícios e Imunidades",
  "DEFIS": "Declaração de Informações Socioeconômicas e Fiscais",
  "NFSe": "Emissão de Nota Fiscal de Serviço Eletrônica",
  "FGTS Digital": "Recolhimento do FGTS via FGTS Digital",
  "eSocial": "Obrigação eSocial",
};

const now        = new Date();
const prevMonth  = `${now.getFullYear()}-${String(now.getMonth() || 12).padStart(2,"0")}`;
const nextMonth20= new Date(now.getFullYear(), now.getMonth()+1, 20).toISOString().split("T")[0];

type FormState = {
  clienteId: string; tipo: ObrigacaoTipo | "";
  descricao: string; competencia: string;
  vencimento: string; responsavel: string; status: string;
};

export function ObrigacaoFormDialog({ open, onClose, onCreated, obrigacao }: Props) {
  const { clientes }   = useClientes();
  const { profile }    = useAuth();
  const [saving, setSaving] = useState(false);
  const isEdit = !!obrigacao;

  const [form, setForm] = useState<FormState>({
    clienteId: "", tipo: "" as ObrigacaoTipo | "",
    descricao: "", competencia: prevMonth,
    vencimento: nextMonth20, responsavel: "", status: "pendente",
  });

  // Preencher form ao abrir
  useEffect(() => {
    if (!open) return;
    if (obrigacao) {
      // Modo edição — pré-preencher com dados existentes
      setForm({
        clienteId:   obrigacao.clienteId,
        tipo:        obrigacao.tipo as ObrigacaoTipo,
        descricao:   obrigacao.descricao ?? "",
        competencia: obrigacao.competencia ?? prevMonth,
        vencimento:  obrigacao.vencimento,
        responsavel: obrigacao.responsavel ?? "",
        status:      obrigacao.status,
      });
    } else {
      // Modo criação — limpar
      setForm({
        clienteId: "", tipo: "", descricao: "",
        competencia: prevMonth, vencimento: nextMonth20,
        responsavel: profile?.nome ?? "", status: "pendente",
      });
    }
  }, [open, obrigacao, profile]);

  const up = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  function handleTipo(t: ObrigacaoTipo) {
    setForm(f => ({ ...f, tipo: t, descricao: isEdit ? f.descricao : (DESC_AUTO[t] ?? "") }));
  }

  const cliente = clientes.find(c => c.id === form.clienteId);

  async function handleSave() {
    if (!form.clienteId || !form.tipo || !form.vencimento) {
      toast.error("Preencha cliente, tipo e vencimento");
      return;
    }
    setSaving(true);

    if (isEdit) {
      // UPDATE
      const { error } = await (supabase as any).from("obrigacoes").update({
        cliente_id:   form.clienteId,
        cliente_nome: cliente?.razaoSocial ?? obrigacao!.clienteNome,
        tipo:         form.tipo,
        descricao:    form.descricao,
        competencia:  form.competencia,
        vencimento:   form.vencimento,
        status:       form.status,
        responsavel:  form.responsavel,
      }).eq("id", obrigacao!.id);

      setSaving(false);
      if (error) { toast.error("Erro ao salvar: " + error.message); return; }
      toast.success("Obrigação atualizada!");
    } else {
      // INSERT — nunca fabricar regime (STANDARDS #1). Exigir cliente com regime resolvido.
      if (!cliente?.regime) {
        setSaving(false);
        toast.error("Cliente sem regime definido. Defina o regime no cadastro antes de criar obrigações.");
        return;
      }
      const { error } = await (supabase as any).from("obrigacoes").insert({
        id:           crypto.randomUUID(),
        cliente_id:   form.clienteId,
        cliente_nome: cliente.razaoSocial ?? "",
        regime:       cliente.regime,
        tipo:         form.tipo,
        descricao:    form.descricao,
        competencia:  form.competencia,
        vencimento:   form.vencimento,
        status:       "pendente",
        responsavel:  form.responsavel,
      });

      setSaving(false);
      if (error) { toast.error("Erro ao criar obrigação: " + error.message); return; }
      toast.success("Obrigação cadastrada!");
    }

    window.dispatchEvent(new Event("apoya:obrigacoes:changed"));
    onCreated?.();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Obrigação" : "Nova Obrigação Fiscal"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Atualize os dados da obrigação fiscal." : "Cadastre uma obrigação fiscal para acompanhamento."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Cliente *</Label>
            <Select value={form.clienteId} onValueChange={v => up("clienteId", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.filter(c => c.status === "ativo").map(c =>
                  <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={v => handleTipo(v as ObrigacaoTipo)}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={e => up("descricao", e.target.value)} />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Responsável</Label>
              <Input value={form.responsavel} onChange={e => up("responsavel", e.target.value)} />
            </div>
            {isEdit && (
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => up("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Criar obrigação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

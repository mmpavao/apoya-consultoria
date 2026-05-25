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
import type { ObrigacaoTipo } from "@/hooks/use-obrigacoes";

type Props = { open: boolean; onClose: () => void; onCreated?: () => void; };

const TIPOS: ObrigacaoTipo[] = [
  "DAS","DASN-Simei","DCTFWeb","EFD-Contribuições","EFD-ICMS/IPI",
  "EFD-Reinf","ECF","ECD","DIRBI","DEFIS","NFSe","FGTS Digital","eSocial",
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

const now = new Date();
const prevMonth = `${now.getFullYear()}-${String(now.getMonth() || 12).padStart(2, "0")}`;
const nextMonth20 = new Date(now.getFullYear(), now.getMonth() + 1, 20).toISOString().split("T")[0];

export function ObrigacaoFormDialog({ open, onClose, onCreated }: Props) {
  const { clientes } = useClientes();
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    clienteId: "", tipo: "" as ObrigacaoTipo | "",
    descricao: "", competencia: prevMonth, vencimento: nextMonth20,
    responsavel: "",
  });

  useEffect(() => {
    if (!open) return;
    // profile.nome é o campo correto (não full_name)
    setForm(f => ({ ...f, clienteId: "", tipo: "", descricao: "", responsavel: profile?.nome ?? "" }));
  }, [open, profile]);

  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  function handleTipo(t: ObrigacaoTipo) {
    setForm(f => ({ ...f, tipo: t, descricao: DESC_AUTO[t] ?? "" }));
  }

  const cliente = clientes.find(c => c.id === form.clienteId);

  async function handleSave() {
    if (!form.clienteId || !form.tipo || !form.vencimento) {
      toast.error("Preencha cliente, tipo e vencimento");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("obrigacoes").insert({
      id: crypto.randomUUID(),                          // obrigatório no schema
      cliente_id: form.clienteId,
      cliente_nome: cliente?.razaoSocial ?? "",
      regime: cliente?.regime ?? "Simples Nacional",
      tipo: form.tipo,
      descricao: form.descricao,
      competencia: form.competencia,
      vencimento: form.vencimento,
      status: "pendente",
      responsavel: form.responsavel,
    });
    setSaving(false);
    if (error) { toast.error("Erro ao criar obrigação: " + error.message); return; }
    toast.success("Obrigação cadastrada!");
    window.dispatchEvent(new Event("apoya:obrigacoes:changed"));
    onCreated?.();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Obrigação Fiscal</DialogTitle>
          <DialogDescription>Cadastre uma obrigação fiscal para acompanhamento.</DialogDescription>
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
          <div className="grid gap-1.5">
            <Label>Responsável</Label>
            <Input value={form.responsavel} onChange={e => up("responsavel", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

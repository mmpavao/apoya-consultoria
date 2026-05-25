import { useState } from "react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead, LeadFormData, useLeadsCrm, ETAPA_LABEL, TEMP_LABEL, CANAL_LABEL } from "@/hooks/use-leads-crm";
import { toast } from "sonner";

interface NovoLeadFormProps {
  leadInicial?: Lead;
  onSave: () => void;
  onCancel: () => void;
}

const RESPONSAVEIS = [
  "Ana | Atendimento",
  "Sofia | Fiscal",
  "Hugo | DP",
  "Marcos | Contábil",
  "Pedro | Societário",
  "Rafael | Compliance",
  "Carla | Financeiro",
  "O Contador | COO",
];

const REGIMES = ["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"];

export function NovoLeadForm({ leadInicial, onSave, onCancel }: NovoLeadFormProps) {
  const { criarLead, atualizarLead } = useLeadsCrm();
  const [salvando, setSalvando] = useState(false);

  const [form, setForm] = useState<Partial<LeadFormData>>({
    nome:              leadInicial?.nome ?? "",
    telefone:          leadInicial?.telefone ?? "",
    email:             leadInicial?.email ?? "",
    cnpj:              leadInicial?.cnpj ?? "",
    razao_social:      leadInicial?.razao_social ?? "",
    regime_tributario: leadInicial?.regime_tributario ?? "",
    municipio:         leadInicial?.municipio ?? "",
    uf:                leadInicial?.uf ?? "",
    etapa:             leadInicial?.etapa ?? "novo",
    temperatura:       leadInicial?.temperatura ?? "morno",
    canal:             leadInicial?.canal ?? "whatsapp",
    origem:            leadInicial?.origem ?? "whatsapp",
    responsavel:       leadInicial?.responsavel ?? "Ana | Atendimento",
    honorario_proposto:leadInicial?.honorario_proposto ?? undefined,
    proximo_passo:     leadInicial?.proximo_passo ?? "",
    observacoes:       leadInicial?.observacoes ?? "",
    tags:              leadInicial?.tags ?? [],
    metadados:         leadInicial?.metadados ?? {},
  });

  const set = (field: keyof LeadFormData, value: unknown) =>
    setForm(p => ({ ...p, [field]: value }));

  const handleSave = async () => {
    if (!form.nome?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.telefone?.trim()) { toast.error("Telefone é obrigatório"); return; }
    setSalvando(true);
    try {
      if (leadInicial) {
        await atualizarLead(leadInicial.id, form as Partial<Lead>);
        toast.success("Lead atualizado!");
      } else {
        await criarLead(form as Partial<LeadFormData>);
        toast.success("Lead criado!");
      }
      onSave();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setSalvando(false); }
  };

  return (
    <div className="space-y-5">
      {/* Identificação */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Identificação
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome *</Label>
            <Input
              placeholder="Nome do contato ou empresa"
              value={form.nome ?? ""}
              onChange={e => set("nome", e.target.value)}
            />
          </div>
          <div>
            <Label>Telefone / WhatsApp *</Label>
            <Input
              placeholder="+55 11 99999-9999"
              value={form.telefone ?? ""}
              onChange={e => set("telefone", e.target.value)}
            />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              placeholder="email@empresa.com"
              value={form.email ?? ""}
              onChange={e => set("email", e.target.value)}
            />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input
              placeholder="00.000.000/0001-00"
              value={form.cnpj ?? ""}
              onChange={e => set("cnpj", e.target.value)}
            />
          </div>
          <div>
            <Label>Razão Social</Label>
            <Input
              placeholder="Nome da empresa"
              value={form.razao_social ?? ""}
              onChange={e => set("razao_social", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Dados empresariais */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Dados Empresariais
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Regime</Label>
            <Select value={form.regime_tributario ?? ""} onValueChange={v => set("regime_tributario", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Município</Label>
            <Input
              placeholder="São Paulo"
              value={form.municipio ?? ""}
              onChange={e => set("municipio", e.target.value)}
            />
          </div>
          <div>
            <Label>UF</Label>
            <Input
              placeholder="SP"
              maxLength={2}
              value={form.uf ?? ""}
              onChange={e => set("uf", e.target.value.toUpperCase())}
            />
          </div>
        </div>
      </div>

      {/* Funil comercial */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Funil Comercial
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Etapa</Label>
            <Select value={form.etapa ?? "novo"} onValueChange={v => set("etapa", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ETAPA_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Temperatura</Label>
            <Select value={form.temperatura ?? "morno"} onValueChange={v => set("temperatura", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TEMP_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Canal de origem</Label>
            <Select value={form.canal ?? "whatsapp"} onValueChange={v => set("canal", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CANAL_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Select value={form.responsavel ?? "Ana | Atendimento"} onValueChange={v => set("responsavel", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RESPONSAVEIS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Honorário proposto (R$/mês)</Label>
            <Input
              type="number"
              placeholder="497"
              value={form.honorario_proposto ?? ""}
              onChange={e => set("honorario_proposto", e.target.value ? parseFloat(e.target.value) : undefined)}
            />
          </div>
        </div>
      </div>

      {/* Acompanhamento */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Acompanhamento
        </p>
        <div className="space-y-3">
          <div>
            <Label>Próximo passo</Label>
            <Input
              placeholder="O que precisa acontecer agora?"
              value={form.proximo_passo ?? ""}
              onChange={e => set("proximo_passo", e.target.value)}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              placeholder="Contexto, histórico, informações relevantes..."
              rows={3}
              value={form.observacoes ?? ""}
              onChange={e => set("observacoes", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={salvando}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={salvando}>
          {salvando ? "Salvando..." : leadInicial ? "Salvar alterações" : "Criar lead"}
        </Button>
      </div>
    </div>
  );
}

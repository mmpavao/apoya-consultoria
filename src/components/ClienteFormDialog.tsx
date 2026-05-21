import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useClientes, RESPONSAVEIS, REGIME_LABEL, STATUS_LABEL, type Cliente, type Regime, type Status, type TierServico, type FormaPagamento } from "@/hooks/use-clientes";
import { formatCNPJ, isValidCNPJ, lookupCNPJ, onlyDigits } from "@/lib/cnpj";

const REGIMES: Regime[] = ["MEI", "Simples", "Lucro Presumido", "Lucro Real", "Doméstica"];
const STATUSES: Status[] = ["ativo", "inadimplente", "suspenso", "inativo", "em_analise"];
const TIERS: TierServico[] = ["MEI", "Simples", "Empresarial", "Doméstica"];
const FORMAS: FormaPagamento[] = ["PIX", "Boleto", "Débito automático"];

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cliente?: Cliente | null;
};

const empty: Omit<Cliente, "id" | "createdAt"> = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", regime: "Simples", regimeHibrido: false,
  tier: "Simples", status: "ativo",
  responsavel: RESPONSAVEIS[0], email: "", telefone: "", whatsapp: "",
  inscricaoMunicipal: "", inscricaoEstadual: "",
  codigoServicoNfse: "", diaVencimento: 10, valorHonorario: undefined,
  formaPagamento: "PIX", temEmpregados: false, temIncentivoFiscal: false,
  endereco: { cep: "", logradouro: "", numero: "", bairro: "", municipio: "", uf: "" },
  atividadePrincipal: "", observacoes: "",
};

export function ClienteFormDialog({ open, onOpenChange, cliente }: Props) {
  const { clientes, createCliente, updateCliente } = useClientes();
  const [form, setForm] = useState<Omit<Cliente, "id" | "createdAt">>(empty);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (open) setForm(cliente ? { ...empty, ...cliente, endereco: { ...empty.endereco, ...(cliente.endereco ?? {}) } } : empty);
  }, [open, cliente]);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const updateEnd = (k: keyof NonNullable<Cliente["endereco"]>, v: string) =>
    setForm((f) => ({ ...f, endereco: { ...f.endereco, [k]: v } }));

  // Auto-tier MEI
  useEffect(() => {
    if (form.regime === "MEI" && form.tier !== "MEI") setForm((f) => ({ ...f, tier: "MEI" }));
    if (form.regime === "Doméstica" && form.tier !== "Doméstica") setForm((f) => ({ ...f, tier: "Doméstica" }));
    if (form.regime !== "Simples" && form.regimeHibrido) setForm((f) => ({ ...f, regimeHibrido: false }));
  }, [form.regime]);

  async function handleLookup() {
    if (!isValidCNPJ(form.cnpj)) { toast.error("CNPJ inválido"); return; }
    setLooking(true);
    const data = await lookupCNPJ(form.cnpj);
    setLooking(false);
    if (!data) { toast.error("Não foi possível consultar o CNPJ agora"); return; }
    setForm((f) => ({
      ...f,
      razaoSocial: data.razaoSocial ?? f.razaoSocial,
      nomeFantasia: data.nomeFantasia ?? f.nomeFantasia,
      email: data.email ?? f.email,
      telefone: data.telefone ?? f.telefone,
      atividadePrincipal: data.atividadePrincipal ?? f.atividadePrincipal,
      regime: data.regime ?? f.regime,
      endereco: { ...f.endereco, ...(data.endereco ?? {}) },
    }));
    toast.success("Dados preenchidos pela Receita");
  }

  async function handleSave() {
    if (!form.razaoSocial.trim()) return toast.error("Razão social obrigatória");
    if (!isValidCNPJ(form.cnpj)) return toast.error("CNPJ inválido");
    if (!form.whatsapp?.trim()) return toast.error("WhatsApp é obrigatório (canal principal)");
    // CNPJ único
    const dup = clientes.find((c) => onlyDigits(c.cnpj) === onlyDigits(form.cnpj) && c.id !== cliente?.id);
    if (dup) return toast.error("Já existe cliente com este CNPJ");
    const payload = { ...form, cnpj: formatCNPJ(form.cnpj) };
    if (cliente) {
      await updateCliente(cliente.id, payload);
      toast.success("Cliente atualizado");
    } else {
      await createCliente(payload);
      toast.success("Cliente criado");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Informe o CNPJ e use "Buscar na Receita Federal" para autopreencher os dados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* CNPJ + lookup */}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={(e) => update("cnpj", formatCNPJ(e.target.value))} placeholder="00.000.000/0000-00" maxLength={18} />
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={handleLookup} disabled={looking || onlyDigits(form.cnpj).length !== 14} className="rounded-xl">
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar na Receita Federal
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Razão Social *">
              <Input value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} />
            </Field>
            <Field label="Nome Fantasia">
              <Input value={form.nomeFantasia ?? ""} onChange={(e) => update("nomeFantasia", e.target.value)} />
            </Field>
            <Field label="Regime tributário *">
              <Select value={form.regime} onValueChange={(v) => update("regime", v as Regime)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIMES.map((r) => <SelectItem key={r} value={r}>{REGIME_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tier de serviço">
              <Select value={form.tier ?? "Simples"} onValueChange={(v) => update("tier", v as TierServico)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            {form.regime === "Simples" && (
              <Field label="Regime Híbrido (IBS/CBS)">
                <div className="flex h-10 items-center gap-2 rounded-md border border-input px-3">
                  <Switch checked={!!form.regimeHibrido} onCheckedChange={(v) => update("regimeHibrido", v)} />
                  <span className="text-sm text-muted-foreground">{form.regimeHibrido ? "Sim" : "Não"}</span>
                </div>
              </Field>
            )}
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => update("status", v as Status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Responsável interno">
              <Select value={form.responsavel} onValueChange={(v) => update("responsavel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESPONSAVEIS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Atividade principal (CNAE)">
              <Input value={form.atividadePrincipal ?? ""} onChange={(e) => update("atividadePrincipal", e.target.value)} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
            </Field>
            <Field label="Telefone">
              <Input value={form.telefone ?? ""} onChange={(e) => update("telefone", e.target.value)} />
            </Field>
            <Field label="WhatsApp *">
              <Input value={form.whatsapp ?? ""} onChange={(e) => update("whatsapp", e.target.value)} placeholder="+5511999999999" />
            </Field>
            <Field label="Inscrição Municipal">
              <Input value={form.inscricaoMunicipal ?? ""} onChange={(e) => update("inscricaoMunicipal", e.target.value)} />
            </Field>
            <Field label="Inscrição Estadual">
              <Input value={form.inscricaoEstadual ?? ""} onChange={(e) => update("inscricaoEstadual", e.target.value)} />
            </Field>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-medium">NFS-e e Cobrança</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Código de serviço NFS-e">
                <Input value={form.codigoServicoNfse ?? ""} onChange={(e) => update("codigoServicoNfse", e.target.value)} placeholder="ex: 17.19 — Tabela LC 116/2003" />
              </Field>
              <Field label="Dia de vencimento da cobrança">
                <Select value={String(form.diaVencimento ?? 10)} onValueChange={(v) => update("diaVencimento", Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor do honorário mensal (R$)">
                <Input type="number" min={0} step="0.01" value={form.valorHonorario ?? ""} onChange={(e) => update("valorHonorario", e.target.value ? Number(e.target.value) : undefined)} />
              </Field>
              <Field label="Forma de pagamento">
                <Select value={form.formaPagamento ?? "PIX"} onValueChange={(v) => update("formaPagamento", v as FormaPagamento)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleField label="Tem empregados" checked={!!form.temEmpregados} onChange={(v) => update("temEmpregados", v)} hint="Habilita eSocial e Folha/FGTS" />
            <ToggleField label="Tem incentivo fiscal" checked={!!form.temIncentivoFiscal} onChange={(v) => update("temIncentivoFiscal", v)} hint="Habilita DIRBI (2026)" />
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className="mb-3 text-sm font-medium">Endereço</h3>
            <div className="grid gap-3 sm:grid-cols-6">
              <Field label="CEP" className="sm:col-span-2">
                <Input value={form.endereco?.cep ?? ""} onChange={(e) => updateEnd("cep", e.target.value)} />
              </Field>
              <Field label="Logradouro" className="sm:col-span-3">
                <Input value={form.endereco?.logradouro ?? ""} onChange={(e) => updateEnd("logradouro", e.target.value)} />
              </Field>
              <Field label="Nº" className="sm:col-span-1">
                <Input value={form.endereco?.numero ?? ""} onChange={(e) => updateEnd("numero", e.target.value)} />
              </Field>
              <Field label="Bairro" className="sm:col-span-2">
                <Input value={form.endereco?.bairro ?? ""} onChange={(e) => updateEnd("bairro", e.target.value)} />
              </Field>
              <Field label="Município" className="sm:col-span-3">
                <Input value={form.endereco?.municipio ?? ""} onChange={(e) => updateEnd("municipio", e.target.value)} />
              </Field>
              <Field label="UF" className="sm:col-span-1">
                <Input maxLength={2} value={form.endereco?.uf ?? ""} onChange={(e) => updateEnd("uf", e.target.value.toUpperCase())} />
              </Field>
            </div>
          </div>

          <Field label="Observações">
            <Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => update("observacoes", e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleSave} className="rounded-xl">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

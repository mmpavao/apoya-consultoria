/**
 * ClienteFormDialog — Cadastro e edição de cliente
 * v3: auto-fill no onBlur do CNPJ + enriquecimento SERPRO + todos os campos do motor
 */
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Search, Loader2, Building2, MapPin, Phone, DollarSign, FileText, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useClientes, type Cliente, type Regime, type FormaPagamento } from "@/hooks/use-clientes";
import { formatCNPJ, isValidCNPJ, onlyDigits } from "@/lib/cnpj";

const REGIMES: Regime[] = ["MEI", "Simples", "Lucro Presumido", "Lucro Real", "Doméstica"];
const FORMAS: FormaPagamento[] = ["PIX", "Boleto", "Débito automático"];

interface Props {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (v: boolean) => void;
  cliente?: Cliente;
}

const EMPTY: Partial<Cliente> = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", regime: "Simples", regimeHibrido: false,
  status: "ativo", tier: "Simples",
  responsavel: "APOYA",
  email: "", telefone: "", whatsapp: "",
  valorHonorario: undefined, diaVencimento: 20,
  formaPagamento: "PIX",
  temEmpregados: false, temIncentivoFiscal: false,
  endereco: { cep: "", logradouro: "", numero: "", complemento: "", bairro: "", municipio: "", uf: "" },
};

type SectionId = "identificacao" | "fiscal" | "contato" | "cobranca" | "configuracoes";

const SECTIONS: { id: SectionId; label: string; icon: any }[] = [
  { id: "identificacao", label: "Identificação", icon: Building2 },
  { id: "fiscal",        label: "Fiscal",        icon: FileText  },
  { id: "contato",       label: "Contato",        icon: Phone     },
  { id: "cobranca",      label: "Cobrança",       icon: DollarSign },
  { id: "configuracoes", label: "Configurações",  icon: Users     },
];

export function ClienteFormDialog({ open, onClose, onOpenChange, cliente }: Props) {
  const { clientes, createCliente, updateCliente } = useClientes();

  const [form, setForm]       = useState<Partial<Cliente>>(cliente ?? EMPTY);
  const [saving, setSaving]   = useState(false);
  const [section, setSection] = useState<SectionId>("identificacao");
  const [sectionErrors, setSectionErrors] = useState<Set<SectionId>>(new Set());

  // Resetar form quando o dialog abre
  const prevOpen = useRef(false);
  if (open !== prevOpen.current) {
    prevOpen.current = open;
    if (open) {
      setForm(cliente ?? EMPTY);
      setSection("identificacao");
      setSectionErrors(new Set());
    }
  }

  const update_ = (field: keyof Cliente, val: any) =>
    setForm(p => ({ ...p, [field]: val }));
  const updateEnd = (field: string, val: string) =>
    setForm(p => ({ ...p, endereco: { ...(p.endereco ?? {}), [field]: val } }));

  // ── Salvar ────────────────────────────────────────────────
  async function handleSubmit() {
    // Validações com navegação automática para a aba com erro
    if (!form.cnpj?.trim() || !isValidCNPJ(form.cnpj ?? "")) {
      toast.error("CNPJ inválido ou não preenchido");
      setSection("identificacao"); return;
    }
    if (!form.razaoSocial?.trim()) {
      toast.error("Razão Social obrigatória");
      setSection("identificacao"); return;
    }
    const dup = clientes.find(c => onlyDigits(c.cnpj ?? "") === onlyDigits(form.cnpj ?? "") && c.id !== cliente?.id);
    if (dup) { toast.error(`CNPJ já cadastrado: ${dup.razaoSocial}`); setSection("identificacao"); return; }

    setSaving(true);
    try {
      // Garantir responsavel no payload (NOT NULL no banco) — não usar setForm (async)
      const payload = {
        ...form,
        cnpj: formatCNPJ(form.cnpj ?? ""),
        responsavel: form.responsavel?.trim() || "APOYA",
      };
      if (cliente?.id) {
        const ok = await updateCliente(cliente.id, payload);
        if (!ok) { setSaving(false); return; }
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const criado = await createCliente(payload as any);
        if (!criado) {
          // createCliente já exibiu toast.error — apenas parar aqui
          setSaving(false);
          return;
        }
        toast.success("Cliente cadastrado com sucesso!");
      }
      onClose?.(); onOpenChange?.(false);
    } catch (e: any) {
      const msg = e?.message ?? "tente novamente";
      // Mapear erros do banco para mensagens amigáveis
      if (msg.includes("responsavel")) {
        toast.error("Campo Responsável é obrigatório");
        setSection("configuracoes");
      } else if (msg.includes("cnpj") && msg.includes("unique")) {
        toast.error("CNPJ já cadastrado em outro cliente");
        setSection("identificacao");
      } else if (msg.includes("regime")) {
        toast.error("Selecione um Regime Tributário");
        setSection("fiscal");
      } else {
        toast.error("Erro ao salvar: " + msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose?.(); onOpenChange?.(false); } }}>
      <DialogContent className="max-h-[92vh] overflow-hidden flex flex-col sm:max-w-2xl p-0">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-lg font-semibold">
            {cliente ? "Editar Cliente" : "Novo Cliente"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Digite o CNPJ — os dados são preenchidos automaticamente
          </p>
        </DialogHeader>

        {/* Tabs de seção */}
        <div className="flex gap-0 border-b border-border/60 px-6 shrink-0 overflow-x-auto">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={e => { e.stopPropagation(); setSection(s.id); setSectionErrors(prev => { const n = new Set(prev); n.delete(s.id); return n; }); }}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                section === s.id
                  ? "border-primary text-primary"
                  : sectionErrors.has(s.id)
                    ? "border-rose-400 text-rose-500"
                    : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.icon className="h-3 w-3" />
              {s.label}
              {sectionErrors.has(s.id) && (
                <span className="ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
              )}
            </button>
          ))}
        </div>

        {/* Corpo scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── SEÇÃO: IDENTIFICAÇÃO ── */}
          {section === "identificacao" && (
            <>
              {/* CNPJ + lookup */}
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">CNPJ *</Label>
                <Input
                  value={form.cnpj ?? ""}
                  onChange={e => update_("cnpj", formatCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  className="font-mono"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 grid gap-1.5">
                  <Label className="text-xs font-medium">Razão Social *</Label>
                  <Input value={form.razaoSocial ?? ""} onChange={e => update_("razaoSocial", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Nome Fantasia</Label>
                  <Input value={form.nomeFantasia ?? ""} onChange={e => update_("nomeFantasia", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Atividade Principal (CNAE)</Label>
                  <Input value={form.atividadePrincipal ?? ""} onChange={e => update_("atividadePrincipal", e.target.value)} />
                </div>
              </div>

              {/* Endereço */}
              <div className="rounded-xl border border-border/60 p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Endereço</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">CEP</Label>
                    <Input value={form.endereco?.cep ?? ""} onChange={e => updateEnd("cep", e.target.value)} maxLength={9} />
                  </div>
                  <div className="sm:col-span-2 grid gap-1.5">
                    <Label className="text-xs">Logradouro</Label>
                    <Input value={form.endereco?.logradouro ?? ""} onChange={e => updateEnd("logradouro", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Número</Label>
                    <Input value={form.endereco?.numero ?? ""} onChange={e => updateEnd("numero", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Complemento</Label>
                    <Input value={form.endereco?.complemento ?? ""} onChange={e => updateEnd("complemento", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Bairro</Label>
                    <Input value={form.endereco?.bairro ?? ""} onChange={e => updateEnd("bairro", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 grid gap-1.5">
                    <Label className="text-xs">Município</Label>
                    <Input value={form.endereco?.municipio ?? ""} onChange={e => updateEnd("municipio", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">UF</Label>
                    <Input value={form.endereco?.uf ?? ""} onChange={e => updateEnd("uf", e.target.value.toUpperCase())} maxLength={2} />
                  </div>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Observações</Label>
                <Textarea rows={2} value={form.observacoes ?? ""} onChange={e => update_("observacoes", e.target.value)} />
              </div>
            </>
          )}

          {/* ── SEÇÃO: FISCAL ── */}
          {section === "fiscal" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Regime Tributário *</Label>
                  <Select value={form.regime} onValueChange={v => update_("regime", v as Regime)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REGIMES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Tier de Serviço</Label>
                  <Select value={form.tier ?? "Simples"} onValueChange={v => update_("tier", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEI">MEI</SelectItem>
                      <SelectItem value="Simples">Simples Nacional</SelectItem>
                      <SelectItem value="Empresarial">Empresarial (LP/LR)</SelectItem>
                      <SelectItem value="Doméstica">Doméstica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Inscrição Municipal</Label>
                  <Input value={form.inscricaoMunicipal ?? ""} onChange={e => update_("inscricaoMunicipal", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Inscrição Estadual</Label>
                  <Input value={form.inscricaoEstadual ?? ""} onChange={e => update_("inscricaoEstadual", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Código Serviço NFS-e (LC 116)</Label>
                  <Input value={form.codigoServicoNfse ?? ""} onChange={e => update_("codigoServicoNfse", e.target.value)} placeholder="ex: 17.19" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium">Alíquota ISS (%)</Label>
                  <Input type="number" min={0} max={5} step={0.01} value={form.aliquotaIss ?? ""} onChange={e => update_("aliquotaIss", e.target.value ? Number(e.target.value) : undefined)} placeholder="ex: 2.5" />
                </div>
              </div>

              <div className="space-y-2.5">
                <ToggleField label="Tem empregados CLT" checked={!!form.temEmpregados} onChange={v => update_("temEmpregados", v)} hint="Habilita eSocial, folha e FGTS" />
                <ToggleField label="Tem incentivo fiscal" checked={!!form.temIncentivoFiscal} onChange={v => update_("temIncentivoFiscal", v)} hint="Habilita DIRBI mensal (2026)" />
                <ToggleField label="Regime híbrido (Reforma Tributária)" checked={!!form.regimeHibrido} onChange={v => update_("regimeHibrido", v)} hint="CBS/IBS separados do DAS — janelas abril/setembro" />
              </div>

              {/* ── Acesso SERPRO ── */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Acesso SERPRO / eCAC</p>
                <div className="space-y-2.5">
                  <ToggleField
                    label="Tem Certificado Digital A1/A3"
                    checked={!!(form as any).tem_certificado}
                    onChange={v => update_("tem_certificado" as any, v)}
                    hint="Necessário para consultas avançadas via SERPRO"
                  />
                  <ToggleField
                    label="Tem Procuração no eCAC"
                    checked={!!(form as any).tem_procuracao}
                    onChange={v => update_("tem_procuracao" as any, v)}
                    hint="Autoriza APOYA a consultar dados fiscais em nome do cliente"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── SEÇÃO: CONTATO ── */}
          {section === "contato" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Responsável</Label>
                <Input value={form.responsavel ?? ""} onChange={e => update_("responsavel", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">E-mail</Label>
                <Input type="email" value={form.email ?? ""} onChange={e => update_("email", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Telefone</Label>
                <Input value={form.telefone ?? ""} onChange={e => update_("telefone", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">WhatsApp</Label>
                <Input value={form.whatsapp ?? ""} onChange={e => update_("whatsapp", e.target.value)} placeholder="+5512999999999" />
              </div>
            </div>
          )}

          {/* ── SEÇÃO: COBRANÇA ── */}
          {section === "cobranca" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Honorário Mensal (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.valorHonorario ?? ""} onChange={e => update_("valorHonorario", e.target.value ? Number(e.target.value) : undefined)} placeholder="0,00" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Dia de Vencimento</Label>
                <Input type="number" min={1} max={28} value={form.diaVencimento ?? 20} onChange={e => update_("diaVencimento", Number(e.target.value))} />
              </div>
              <div className="sm:col-span-2 grid gap-1.5">
                <Label className="text-xs font-medium">Forma de Pagamento</Label>
                <Select value={form.formaPagamento ?? "PIX"} onValueChange={v => update_("formaPagamento", v as FormaPagamento)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── SEÇÃO: CONFIGURAÇÕES ── */}
          {section === "configuracoes" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">Status</Label>
                <Select value={form.status ?? "ativo"} onValueChange={v => update_("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="em_analise">Em análise</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium">CPF do titular (MEI/PF)</Label>
                <Input value={form.cpf ?? ""} onChange={e => update_("cpf", e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/60 shrink-0 gap-2">
          <Button variant="outline" onClick={e => { e.stopPropagation(); onClose?.(); onOpenChange?.(false); }} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={e => { e.stopPropagation(); handleSubmit(); }} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando…</> : (cliente ? "Salvar alterações" : "Cadastrar cliente")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleField({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 px-3.5 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

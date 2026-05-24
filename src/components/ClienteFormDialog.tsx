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
import { useCnpjLookup } from "@/hooks/use-cnpj-lookup";
import { useCnpjSerpro } from "@/hooks/use-cnpj-serpro";
import { useSocios } from "@/hooks/use-socios";

const REGIMES: Regime[] = ["MEI", "Simples", "Lucro Presumido", "Lucro Real", "Doméstica"];
const FORMAS: FormaPagamento[] = ["PIX", "Boleto", "Débito automático"];

interface Props {
  open: boolean;
  onClose: () => void;
  cliente?: Cliente;
}

const EMPTY: Partial<Cliente> = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", regime: "Simples", regimeHibrido: false,
  status: "ativo", tier: "Simples",
  email: "", telefone: "", whatsapp: "",
  valorHonorario: undefined, diaVencimento: 20,
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

export function ClienteFormDialog({ open, onClose, cliente }: Props) {
  const { clientes, createCliente, updateCliente } = useClientes();
  const { importarDosCNPJ } = useSocios(null);
  const [dadosCnpjParaSocios, setDadosCnpjParaSocios] = useState<any>(null);
  const { buscar: buscarBrasil, loading: loadingBrasil } = useCnpjLookup();
  const { enriquecer: enriquecerSerpro }                 = useCnpjSerpro();

  const [form, setForm]       = useState<Partial<Cliente>>(cliente ?? EMPTY);
  const [saving, setSaving]   = useState(false);
  const [looking, setLooking] = useState(false);
  const [section, setSection] = useState<SectionId>("identificacao");
  const [serproInfo,   setSerproInfo]   = useState<string | null>(null);
  const [serproAlerts, setSerproAlerts] = useState<string[]>([]);
  const cnpjRef = useRef<string>("");

  // Resetar form quando o dialog abre
  const prevOpen = useRef(false);
  if (open !== prevOpen.current) {
    prevOpen.current = open;
    if (open) {
      setForm(cliente ?? EMPTY);
      setSection("identificacao");
      setSerproInfo(null);
      setSerproAlerts([]);
      setDadosCnpjParaSocios(null);
    }
  }

  const update_ = (field: keyof Cliente, val: any) =>
    setForm(p => ({ ...p, [field]: val }));
  const updateEnd = (field: string, val: string) =>
    setForm(p => ({ ...p, endereco: { ...(p.endereco ?? {}), [field]: val } }));

  // ── Auto-fill ao sair do campo CNPJ ───────────────────────
  async function handleCnpjBlur() {
    const digits = onlyDigits(form.cnpj ?? "");
    if (digits.length !== 14 || digits === cnpjRef.current) return;
    if (!isValidCNPJ(digits)) { toast.error("CNPJ inválido"); return; }
    cnpjRef.current = digits;

    // Verificar duplicata
    const dup = clientes.find(c => onlyDigits(c.cnpj) === digits && c.id !== cliente?.id);
    if (dup) { toast.error(`CNPJ já cadastrado: ${dup.razaoSocial}`); return; }

    setLooking(true);
    toast.loading("Buscando dados do CNPJ…", { id: "cnpj-lookup" });

    try {
      // 1. BrasilAPI — dados cadastrais (rápido, público)
      const cadastral = await buscarBrasil(digits);
      if (cadastral) {
        setForm(prev => ({
          ...prev,
          razaoSocial:         cadastral.razaoSocial      ?? prev.razaoSocial,
          nomeFantasia:        cadastral.nomeFantasia      ?? prev.nomeFantasia,
          atividadePrincipal:  cadastral.atividadePrincipal ?? prev.atividadePrincipal,
          email:               cadastral.email             ?? prev.email,
          telefone:            cadastral.telefone          ?? prev.telefone,
          // Regime pela BrasilAPI
          regime: (cadastral.optanteMei       ? "MEI"
                  : cadastral.optanteSimplesNacional ? "Simples"
                  : prev.regime) as Regime,
          endereco: {
            cep:        cadastral.cep        ?? prev.endereco?.cep        ?? "",
            logradouro: cadastral.logradouro ?? prev.endereco?.logradouro ?? "",
            numero:     cadastral.numero     ?? prev.endereco?.numero     ?? "",
            complemento:cadastral.complemento?? prev.endereco?.complemento?? "",
            bairro:     cadastral.bairro     ?? prev.endereco?.bairro     ?? "",
            municipio:  cadastral.municipio  ?? prev.endereco?.municipio  ?? "",
            uf:         cadastral.uf         ?? prev.endereco?.uf         ?? "",
          },
          codigoMunicipioIbge: cadastral.codigoMunicipioIbge ?? prev.codigoMunicipioIbge,
        }));
      }

      // Guardar sócios para importação após salvar
      if (cadastral?.socios && cadastral.socios.length > 0) {
        setDadosCnpjParaSocios(cadastral);
      }
      toast.loading("Consultando SERPRO…", { id: "cnpj-lookup" });

      // 2. SERPRO — regime real + situação fiscal (pode demorar mais)
      const serpro = await enriquecerSerpro(digits);
      if (serpro && Object.keys(serpro).length > 0) {
        setForm(prev => ({
          ...prev,
          // Regime SERPRO tem prioridade (é a fonte oficial)
          regime: serpro.regime ?? prev.regime,
        }));

        // Montar mensagem informativa
        const infos: string[] = [];
        const alerts: string[] = [];
        if (serpro.regime)                infos.push(`Regime: ${serpro.regime}`);
        if (serpro.dteAtivo !== undefined) infos.push(`DTE: ${serpro.dteAtivo ? "✅ Ativo" : "Não enquadrado"}`);
        if (serpro.ultimoPgdasPeriodo)    infos.push(`Último PGDAS: ${serpro.ultimoPgdasPeriodo}`);
        if (serpro.dividaAtivaRfb)        alerts.push("Dívida ativa na Receita Federal");
        if (serpro.dividaAtivaPgfn)       alerts.push("Dívida ativa na PGFN");
        if (infos.length > 0)  setSerproInfo(infos.join(" · "));
        if (alerts.length > 0) setSerproAlerts(alerts);
      }

      toast.success("Dados preenchidos automaticamente", { id: "cnpj-lookup" });
    } catch (err: any) {
      toast.error("Erro ao buscar CNPJ: " + (err?.message ?? "timeout"), { id: "cnpj-lookup" });
    } finally {
      setLooking(false);
    }
  }

  // ── Lookup manual (botão) ──────────────────────────────────
  async function handleLookupManual() {
    cnpjRef.current = ""; // forçar re-fetch
    await handleCnpjBlur();
  }

  // ── Salvar ────────────────────────────────────────────────
  async function handleSubmit() {
    if (!form.razaoSocial?.trim()) { toast.error("Razão Social obrigatória"); return; }
    if (!isValidCNPJ(form.cnpj ?? "")) { toast.error("CNPJ inválido"); return; }

    const dup = clientes.find(c => onlyDigits(c.cnpj ?? "") === onlyDigits(form.cnpj ?? "") && c.id !== cliente?.id);
    if (dup) { toast.error(`CNPJ já cadastrado: ${dup.razaoSocial}`); return; }

    setSaving(true);
    try {
      const payload = { ...form, cnpj: formatCNPJ(form.cnpj ?? "") };
      if (cliente?.id) {
        await updateCliente(cliente.id, payload);
        toast.success("Cliente atualizado");
      } else {
        const criado = await createCliente(payload as any);
        toast.success("Cliente cadastrado");
        // Importar sócios automaticamente se temos dados da Receita
        if (criado?.id && dadosCnpjParaSocios?.socios?.length) {
          await importarDosCNPJ(criado.id, dadosCnpjParaSocios.socios);
          toast.success(`${dadosCnpjParaSocios.socios.length} sócio(s) importados da Receita Federal`);
        }
      }
      onClose();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? "tente novamente"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
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
              onClick={e => { e.stopPropagation(); setSection(s.id); }}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                section === s.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.icon className="h-3 w-3" />
              {s.label}
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
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={form.cnpj ?? ""}
                      onChange={e => update_("cnpj", formatCNPJ(e.target.value))}
                      onBlur={handleCnpjBlur}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      className="font-mono"
                    />
                    {looking && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={e => { e.stopPropagation(); handleLookupManual(); }}
                    disabled={looking || onlyDigits(form.cnpj ?? "").length !== 14}
                    className="gap-1.5 shrink-0"
                  >
                    <Search className="h-4 w-4" />
                    {looking ? "Buscando…" : "Buscar"}
                  </Button>
                </div>

                {/* Info SERPRO */}
                {(serproInfo || serproAlerts.length > 0 || (dadosCnpjParaSocios?.socios?.length ?? 0) > 0) && (
                  <div className="space-y-1.5">
                    {serproInfo && (
                      <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                        <span className="text-blue-600 text-xs font-semibold shrink-0">SERPRO</span>
                        <p className="text-xs text-blue-700">{serproInfo}</p>
                      </div>
                    )}
                    {serproAlerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
                        <span className="text-rose-500 text-sm shrink-0">⚠️</span>
                        <p className="text-xs text-rose-700"><span className="font-semibold">Pendência fiscal:</span> {a}</p>
                      </div>
                    ))}
                    {(dadosCnpjParaSocios?.socios?.length ?? 0) > 0 && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                        <span className="font-semibold">👥 {dadosCnpjParaSocios!.socios!.length} sócio(s) encontrado(s):</span>{" "}
                        {dadosCnpjParaSocios!.socios!.map((s: any) => s.nome).join(" · ")}
                        <div className="mt-0.5 opacity-70">Serão importados automaticamente ao salvar</div>
                      </div>
                    )}
                  </div>
                )}
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
          <Button variant="outline" onClick={e => { e.stopPropagation(); onClose(); }} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={e => { e.stopPropagation(); handleSubmit(); }} disabled={saving || looking}>
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

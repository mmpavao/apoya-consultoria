/**
 * EmitirNfseModal — Modal completo de emissão de NFS-e
 *
 * Funcionalidades:
 * - Seletor de cliente com busca (auto-fill cód. serviço + alíquota ISS do cadastro)
 * - Auto-fill do tomador via CNPJ (BrasilAPI)
 * - Campos: descrição, valor, LC116, alíquota ISS, ISS retido, competência
 * - Dados completos do tomador com endereço, IBGE, inscrição municipal
 * - Preview do ISS calculado em tempo real
 * - Tela de sucesso com opção de emitir outra
 */
import { useState, useEffect, useRef } from "react";
import { Building2, CheckCircle2, FileText, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useClientes, type Cliente } from "@/hooks/use-clientes";
import { useNfse } from "@/hooks/use-nfse";
import { useCnpjLookup } from "@/hooks/use-cnpj-lookup";

// ─── helpers ────────────────────────────────────────────────────────────────

function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/50 pb-1.5">
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── form state ──────────────────────────────────────────────────────────────

interface NfseForm {
  descricao: string;
  valor: string;
  codigoServico: string;
  aliquotaIss: string;
  issRetido: boolean;
  competencia: string;
  observacoes: string;
  tomNome: string;
  tomDoc: string;
  tomEmail: string;
  tomTelefone: string;
  tomCep: string;
  tomLogradouro: string;
  tomNumero: string;
  tomComplemento: string;
  tomBairro: string;
  tomMunicipio: string;
  tomUf: string;
  tomCodigoIbge: string;
  tomInscricaoMunicipal: string;
}

function emptyForm(): NfseForm {
  const now = new Date();
  return {
    descricao: "", valor: "", codigoServico: "", aliquotaIss: "2",
    issRetido: false,
    competencia: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    observacoes: "",
    tomNome: "", tomDoc: "", tomEmail: "", tomTelefone: "",
    tomCep: "", tomLogradouro: "", tomNumero: "", tomComplemento: "",
    tomBairro: "", tomMunicipio: "", tomUf: "", tomCodigoIbge: "",
    tomInscricaoMunicipal: "",
  };
}

// ─── componente principal ────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  clientePreSelecionado?: Cliente;
  onSucesso?: (nota: any) => void;
}

export function EmitirNfseModal({ open, onClose, clientePreSelecionado, onSucesso }: Props) {
  const { clientes } = useClientes();
  const { emitir, loading: emitindo } = useNfse();
  const { buscar: buscarCnpj, loading: buscandoCnpj } = useCnpjLookup();

  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [query, setQuery]           = useState("");
  const [showDrop, setShowDrop]     = useState(false);
  const [form, setForm]             = useState<NfseForm>(emptyForm());
  const [buscandoTom, setBuscandoTom] = useState(false);
  const [emitida, setEmitida]       = useState<{ numero?: string } | null>(null);

  // Pre-selecionar cliente quando abrir com prop
  useEffect(() => {
    if (clientePreSelecionado && open) aplicarCliente(clientePreSelecionado);
  }, [clientePreSelecionado, open]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setClienteSelecionado(null);
      setEmitida(null);
      setQuery("");
      setShowDrop(false);
    }
  }, [open]);

  function aplicarCliente(c: Cliente) {
    setClienteSelecionado(c);
    setQuery(c.razaoSocial);
    setShowDrop(false);
    setForm(p => ({
      ...p,
      codigoServico: c.codigoServicoNfse ?? p.codigoServico,
      aliquotaIss:   (c as any).aliquotaIss != null ? String((c as any).aliquotaIss) : p.aliquotaIss,
    }));
  }

  const filtrados = clientes.filter(c => {
    const q = query.trim().toLowerCase();
    return !q
      || c.razaoSocial.toLowerCase().includes(q)
      || (c.cnpj ?? "").includes(q)
      || (c.nomeFantasia ?? "").toLowerCase().includes(q);
  }).slice(0, 8);

  async function handleBuscarTomador() {
    const digits = form.tomDoc.replace(/\D/g, "");
    if (digits.length !== 14) { toast.error("CNPJ do tomador deve ter 14 dígitos"); return; }
    setBuscandoTom(true);
    const d = await buscarCnpj(form.tomDoc);
    if (d) {
      setForm(p => ({
        ...p,
        tomNome:        d.razaoSocial   || p.tomNome,
        tomEmail:       d.email         || p.tomEmail,
        tomTelefone:    d.telefone      || p.tomTelefone,
        tomCep:         d.cep           || p.tomCep,
        tomLogradouro:  d.logradouro    || p.tomLogradouro,
        tomNumero:      d.numero        || p.tomNumero,
        tomComplemento: d.complemento   || p.tomComplemento,
        tomBairro:      d.bairro        || p.tomBairro,
        tomMunicipio:   d.municipio     || p.tomMunicipio,
        tomUf:          d.uf            || p.tomUf,
        tomCodigoIbge:  d.codigoMunicipioIbge || p.tomCodigoIbge,
      }));
      toast.success("Dados do tomador preenchidos automaticamente");
    }
    setBuscandoTom(false);
  }

  function validar(): string | null {
    if (!clienteSelecionado)           return "Selecione o cliente emissor";
    if (!form.descricao.trim())        return "Preencha a descrição do serviço";
    const val = parseFloat(form.valor.replace(",", "."));
    if (!val || val <= 0)              return "Informe um valor válido";
    if (!form.codigoServico.trim())    return "Informe o código de serviço LC116";
    if (!form.tomNome.trim())          return "Informe o nome do tomador";
    if (!form.tomDoc.replace(/\D/g, "").length) return "Informe o CNPJ ou CPF do tomador";
    if (!form.tomMunicipio.trim())     return "Informe o município do tomador";
    if (!form.tomUf.trim())            return "Informe o estado (UF) do tomador";
    return null;
  }

  async function handleEmitir() {
    const erro = validar();
    if (erro) { toast.error(erro); return; }

    const val = parseFloat(form.valor.replace(",", "."));
    const iss = parseFloat(form.aliquotaIss.replace(",", ".")) / 100;

    const resultado = await emitir(clienteSelecionado!.id, {
      description:     form.descricao,
      servicesAmount:  val,
      cityServiceCode: form.codigoServico,
      issRate:         isNaN(iss) ? 0.02 : iss,
      issRetained:     form.issRetido,
      competencia:     form.competencia || undefined,
      borrower: {
        name:             form.tomNome,
        federalTaxNumber: form.tomDoc.replace(/\D/g, ""),
        email:            form.tomEmail || undefined,
        address: {
          country:    "BRA",
          postalCode: form.tomCep.replace(/\D/g, "") || undefined,
          street:     form.tomLogradouro || undefined,
          number:     form.tomNumero || undefined,
          district:   form.tomBairro || undefined,
          state:      form.tomUf,
          city: { code: form.tomCodigoIbge || "3550308", name: form.tomMunicipio },
        },
      },
    } as any);

    if (resultado) { setEmitida(resultado); onSucesso?.(resultado); }
  }

  const inp = (field: keyof NfseForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const issCalc = (() => {
    const v = parseFloat(form.valor.replace(",", "."));
    const a = parseFloat(form.aliquotaIss.replace(",", ".")) / 100;
    if (!v || !a || isNaN(v) || isNaN(a)) return null;
    return (v * a).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  })();

  // ─── tela de sucesso ───────────────────────────────────────────────────────
  if (emitida) return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>NFS-e emitida com sucesso</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold">
              {emitida.numero ? `NFS-e #${emitida.numero}` : "Nota enviada para processamento"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Aguardando processamento pelo município.
            </p>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" className="flex-1"
              onClick={() => { setEmitida(null); setForm(emptyForm()); }}>
              Emitir outra
            </Button>
            <Button className="flex-1" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ─── formulário principal ─────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Emitir NFS-e
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* ── Emissor ────────────────────────────────────────────────── */}
          <Section title="Emissor — Cliente da APOYA">
            <div className="relative">
              <Field label="Cliente emissor" required>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar por nome ou CNPJ…"
                    value={query}
                    onChange={e => { setQuery(e.target.value); setShowDrop(true); setClienteSelecionado(null); }}
                    onFocus={() => setShowDrop(true)}
                    onBlur={() => setTimeout(() => setShowDrop(false), 150)}
                  />
                </div>
              </Field>
              {showDrop && filtrados.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-background shadow-elevated overflow-hidden">
                  {filtrados.map(c => (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      onMouseDown={e => { e.preventDefault(); aplicarCliente(c); }}
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.razaoSocial}</p>
                        <p className="text-[11px] text-muted-foreground">{c.cnpj} · {c.regime}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {clienteSelecionado && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-sm leading-snug">
                  <p className="font-semibold text-foreground">{clienteSelecionado.razaoSocial}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {clienteSelecionado.cnpj}
                    {clienteSelecionado.inscricaoMunicipal ? ` · IM: ${clienteSelecionado.inscricaoMunicipal}` : ""}
                    {clienteSelecionado.municipio
                      ? ` · ${clienteSelecionado.municipio}/${clienteSelecionado.endereco?.uf ?? clienteSelecionado.uf ?? ""}`
                      : ""}
                  </p>
                </div>
              </div>
            )}
          </Section>

          {/* ── Serviço ────────────────────────────────────────────────── */}
          <Section title="Dados do Serviço">
            <Field label="Descrição do serviço" required>
              <Textarea
                rows={2}
                placeholder="Serviços de assessoria contábil — ref. competência do mês…"
                value={form.descricao}
                onChange={inp("descricao")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor total (R$)" required>
                <Input placeholder="1.500,00" value={form.valor} onChange={inp("valor")} />
              </Field>
              <Field label="Competência">
                <Input type="month" value={form.competencia} onChange={inp("competencia")} />
              </Field>
              <Field label="Código de Serviço LC116" required hint="Ex: 17.19 — serviços contábeis">
                <Input placeholder="17.19" value={form.codigoServico} onChange={inp("codigoServico")} />
              </Field>
              <Field
                label="Alíquota ISS (%)"
                hint={issCalc ? `ISS estimado: ${issCalc}` : "Taxa definida pelo município"}
              >
                <Input placeholder="2" value={form.aliquotaIss} onChange={inp("aliquotaIss")} />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.issRetido}
                onCheckedChange={v => setForm(p => ({ ...p, issRetido: v }))}
              />
              <Label className="text-sm cursor-pointer">ISS retido na fonte pelo tomador</Label>
            </div>
          </Section>

          {/* ── Tomador ────────────────────────────────────────────────── */}
          <Section title="Tomador do Serviço">
            <div className="grid grid-cols-3 gap-2 items-end">
              <div className="col-span-2">
                <Field label="CNPJ ou CPF do tomador" required>
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={form.tomDoc}
                    onChange={inp("tomDoc")}
                  />
                </Field>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onClick={handleBuscarTomador}
                disabled={buscandoTom || buscandoCnpj}
              >
                {buscandoTom || buscandoCnpj
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Search className="h-3.5 w-3.5" />}
                Auto-fill
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Razão Social / Nome" required>
                  <Input placeholder="Nome ou razão social" value={form.tomNome} onChange={inp("tomNome")} />
                </Field>
              </div>
              <Field label="E-mail">
                <Input type="email" placeholder="contato@empresa.com" value={form.tomEmail} onChange={inp("tomEmail")} />
              </Field>
              <Field label="Telefone">
                <Input placeholder="(11) 99999-9999" value={form.tomTelefone} onChange={inp("tomTelefone")} />
              </Field>
              <Field label="CEP">
                <Input placeholder="00000-000" value={form.tomCep} onChange={inp("tomCep")} />
              </Field>
              <Field label="Número">
                <Input placeholder="123" value={form.tomNumero} onChange={inp("tomNumero")} />
              </Field>
              <div className="col-span-2">
                <Field label="Logradouro">
                  <Input placeholder="Rua, Av., Travessa…" value={form.tomLogradouro} onChange={inp("tomLogradouro")} />
                </Field>
              </div>
              <Field label="Bairro">
                <Input placeholder="Bairro" value={form.tomBairro} onChange={inp("tomBairro")} />
              </Field>
              <Field label="Complemento">
                <Input placeholder="Sala, Bloco…" value={form.tomComplemento} onChange={inp("tomComplemento")} />
              </Field>
              <Field label="Município" required>
                <Input placeholder="São Paulo" value={form.tomMunicipio} onChange={inp("tomMunicipio")} />
              </Field>
              <Field label="UF" required>
                <Input placeholder="SP" maxLength={2} value={form.tomUf} onChange={inp("tomUf")} />
              </Field>
              <Field label="Cód. IBGE do Município" hint="Preenchido automaticamente pelo auto-fill">
                <Input placeholder="3550308" value={form.tomCodigoIbge} onChange={inp("tomCodigoIbge")} />
              </Field>
              <Field label="Insc. Municipal do Tomador">
                <Input placeholder="Opcional" value={form.tomInscricaoMunicipal} onChange={inp("tomInscricaoMunicipal")} />
              </Field>
            </div>
          </Section>

          {/* ── Observações ──────────────────────────────────────────── */}
          <Section title="Observações">
            <Textarea
              rows={2}
              placeholder="Informações adicionais que constarão na nota…"
              value={form.observacoes}
              onChange={inp("observacoes")}
            />
          </Section>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border/40">
          <Button variant="outline" onClick={onClose} disabled={emitindo}>
            Cancelar
          </Button>
          <Button
            onClick={handleEmitir}
            disabled={emitindo || !clienteSelecionado}
            className="gap-2 min-w-36"
          >
            {emitindo
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Emitindo…</>
              : <><Send className="h-4 w-4" /> Emitir NFS-e</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

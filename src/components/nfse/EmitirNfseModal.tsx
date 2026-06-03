/**
 * EmitirNfseModal — Emissão de NFS-e via Focus NF-e
 *
 * - Seletor de cliente emissor
 * - Auto-fill tomador via CNPJ (BrasilAPI)
 * - Dropdown de UF + Município via IBGE API
 * - Campos padronizados com máscara/validação
 * - Preview ISS em tempo real
 * - Tela de sucesso
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Building2, CheckCircle2, ChevronDown, FileText,
  Loader2, MapPin, Search, Send, X,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useClientes, type Cliente } from "@/hooks/use-clientes";
import { useNfse } from "@/hooks/use-nfse";
import { useCnpjLookup } from "@/hooks/use-cnpj-lookup";

// ── UFs do Brasil ────────────────────────────────────────────────────────────
const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

// ── Hook: municípios por UF ──────────────────────────────────────────────────
function useMunicipios(uf: string) {
  const [municipios, setMunicipios] = useState<{ id: number; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const cache = useRef<Record<string, { id: number; nome: string }[]>>({});

  useEffect(() => {
    if (!uf) { setMunicipios([]); return; }
    if (cache.current[uf]) { setMunicipios(cache.current[uf]); return; }
    setLoading(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then(r => r.json())
      .then(data => {
        const list = (data ?? []).map((m: any) => ({ id: m.id, nome: m.nome }));
        cache.current[uf] = list;
        setMunicipios(list);
      })
      .catch(() => setMunicipios([]))
      .finally(() => setLoading(false));
  }, [uf]);

  return { municipios, loading };
}

// ── Componentes auxiliares ───────────────────────────────────────────────────
function Field({
  label, required, hint, children,
}: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-1">
      {title}
    </p>
  );
}

// ── Form state ───────────────────────────────────────────────────────────────
interface NfseForm {
  descricao:      string;
  valor:          string;
  codigoServico:  string;
  aliquotaIss:    string;
  issRetido:      boolean;
  competencia:    string;
  naturezaOp:     string;
  regimeTrib:     string;
  tomDoc:         string;
  tomNome:        string;
  tomEmail:       string;
  tomTelefone:    string;
  tomCep:         string;
  tomLogradouro:  string;
  tomNumero:      string;
  tomComplemento: string;
  tomBairro:      string;
  tomUf:          string;
  tomMunicipio:   string;
  tomCodigoIbge:  string;
  inscricaoMunicipal: string;
}

function emptyForm(): NfseForm {
  const now = new Date();
  return {
    descricao: "Serviços de assessoria contábil — ref. competência do mês",
    valor: "", codigoServico: "17.19", aliquotaIss: "3",
    issRetido: false,
    competencia: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    naturezaOp: "1", regimeTrib: "6",
    tomDoc: "", tomNome: "", tomEmail: "", tomTelefone: "",
    tomCep: "", tomLogradouro: "", tomNumero: "", tomComplemento: "",
    tomBairro: "", tomUf: "SP", tomMunicipio: "", tomCodigoIbge: "",
    inscricaoMunicipal: "",
  };
}

// ── Modal principal ──────────────────────────────────────────────────────────
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

  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [query, setQuery]           = useState("");
  const [showDrop, setShowDrop]     = useState(false);
  const [form, setForm]             = useState<NfseForm>(emptyForm());
  const [emitida, setEmitida]       = useState<{ numero?: string; id?: string } | null>(null);

  const { municipios, loading: loadingMun } = useMunicipios(form.tomUf);

  // Pre-selecionar cliente
  useEffect(() => {
    if (clientePreSelecionado && open) aplicarCliente(clientePreSelecionado);
  }, [clientePreSelecionado, open]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setForm(emptyForm()); setClienteSel(null);
      setEmitida(null); setQuery(""); setShowDrop(false);
    }
  }, [open]);

  function aplicarCliente(c: Cliente) {
    setClienteSel(c);
    setQuery(c.razaoSocial);
    setShowDrop(false);
    setForm(p => ({
      ...p,
      codigoServico:  c.codigoServicoNfse ?? p.codigoServico,
      aliquotaIss:    (c as any).aliquota_iss != null ? String((c as any).aliquota_iss) : p.aliquotaIss,
      inscricaoMunicipal: (c as any).inscricao_municipal ?? p.inscricaoMunicipal,
    }));
  }

  const upd = (field: keyof NfseForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const filtrados = clientes.filter(c => {
    const q = query.trim().toLowerCase();
    return !q || c.razaoSocial.toLowerCase().includes(q) || (c.cnpj ?? "").includes(q);
  }).slice(0, 8);

  // Auto-fill tomador
  async function handleAutoFill() {
    const digits = form.tomDoc.replace(/\D/g, "");
    if (digits.length !== 14 && digits.length !== 11) {
      toast.error("CNPJ/CPF inválido"); return;
    }
    if (digits.length === 14) {
      const d = await buscarCnpj(form.tomDoc);
      if (d) {
        const ibge = d.codigoMunicipioIbge ?? "";
        const uf   = d.uf ?? "SP";
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
          tomUf:          uf,
          tomMunicipio:   d.municipio     || p.tomMunicipio,
          tomCodigoIbge:  ibge,
        }));
        toast.success("Dados preenchidos automaticamente");
      }
    }
  }

  // Quando muda município via dropdown, atualizar código IBGE
  function handleMunicipioChange(nome: string) {
    const found = municipios.find(m => m.nome === nome);
    setForm(p => ({ ...p, tomMunicipio: nome, tomCodigoIbge: found ? String(found.id) : p.tomCodigoIbge }));
  }

  // Quando muda UF, limpar município
  function handleUfChange(uf: string) {
    setForm(p => ({ ...p, tomUf: uf, tomMunicipio: "", tomCodigoIbge: "" }));
  }

  function validar(): string | null {
    if (!clienteSel)                    return "Selecione o cliente emissor";
    if (!form.descricao.trim())         return "Preencha a descrição do serviço";
    const val = parseFloat(form.valor.replace(",", "."));
    if (!val || val <= 0)               return "Valor inválido";
    if (!form.codigoServico.trim())     return "Informe o código LC116";
    if (!form.tomNome.trim())           return "Informe o nome do tomador";
    if (!form.tomDoc.replace(/\D/g, "").length) return "Informe CNPJ/CPF do tomador";
    if (!form.tomMunicipio.trim())      return "Selecione o município do tomador";
    if (!form.tomUf.trim())             return "Selecione o estado do tomador";
    return null;
  }

  async function handleEmitir() {
    const erro = validar();
    if (erro) { toast.error(erro); return; }

    const val  = parseFloat(form.valor.replace(",", "."));
    const ali  = parseFloat(form.aliquotaIss.replace(",", "."));
    const digits = form.tomDoc.replace(/\D/g, "");

    const resultado = await emitir(clienteSel!.id, {
      competencia:   form.competencia,
      data_emissao:  new Date().toISOString(),
      natureza_operacao: form.naturezaOp,
      regime_especial_tributacao: form.regimeTrib,
      optante_simples_nacional: true,
      prestador: {
        // inscricao_municipal e codigo_municipio vêm do escritorio_config no backend
      },
      tomador: {
        cnpj:  digits.length === 14 ? digits : undefined,
        cpf:   digits.length === 11 ? digits : undefined,
        razao_social: form.tomNome,
        email: form.tomEmail || undefined,
        endereco: {
          logradouro:       form.tomLogradouro || undefined,
          numero:           form.tomNumero     || undefined,
          complemento:      form.tomComplemento || undefined,
          bairro:           form.tomBairro      || undefined,
          cep:              form.tomCep.replace(/\D/g, "") || undefined,
          municipio:        form.tomMunicipio,
          uf:               form.tomUf,
          codigo_municipio: form.tomCodigoIbge || undefined,
        },
      },
      servico: {
        discriminacao:              form.descricao,
        valor_servicos:             val,
        aliquota_iss:               isNaN(ali) ? 0 : ali,
        iss_retido:                 form.issRetido,
        item_lista_servico:         form.codigoServico,
        codigo_municipio:           form.tomCodigoIbge || undefined,
        codigo_tributacao_municipio: form.codigoServico,
      },
    });

    if (resultado) {
      setEmitida(resultado);
      onSucesso?.(resultado);
    }
  }

  const issCalc = (() => {
    const v = parseFloat(form.valor.replace(",", "."));
    const a = parseFloat(form.aliquotaIss.replace(",", "."));
    if (!v || !a || isNaN(v) || isNaN(a)) return null;
    return (v * a / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  })();

  // ── Tela de sucesso ────────────────────────────────────────────────────────
  if (emitida) return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>NFS-e enviada com sucesso</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="h-16 w-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold">
              {emitida.numero ? `NFS-e #${emitida.numero}` : "Processando…"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Aguardando confirmação do município.
            </p>
          </div>
          <div className="flex gap-2 w-full mt-2">
            <Button variant="outline" className="flex-1"
              onClick={() => { setEmitida(null); setForm(emptyForm()); }}>
              Emitir outra
            </Button>
            <Button className="flex-1 bg-[oklch(0.66_0.195_44)] hover:opacity-90 text-white"
              onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // ── Formulário ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[oklch(0.66_0.195_44)]" />
            Emitir NFS-e — Focus NF-e
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">

          {/* ── EMISSOR ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-1">
              EMISSOR — CLIENTE DA APOYA
            </p>
            <Field label="Cliente emissor" required>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar cliente por nome ou CNPJ…"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setShowDrop(true); }}
                  onFocus={() => setShowDrop(true)}
                />
                {showDrop && filtrados.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                    {filtrados.map(c => (
                      <button key={c.id}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center gap-3 text-sm"
                        onClick={() => aplicarCliente(c)}>
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-medium">{c.razaoSocial}</p>
                          <p className="text-xs text-muted-foreground">{c.cnpj} · {c.regime}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>

          {/* ── SERVIÇO ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <Section title="Dados do Serviço" />
            <Field label="Descrição do serviço" required>
              <Textarea
                className="resize-none" rows={3}
                placeholder="Ex: Serviços de assessoria contábil — ref. competência de junho/2026"
                value={form.descricao}
                onChange={upd("descricao")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor total (R$)" required>
                <Input
                  placeholder="1.500,00"
                  value={form.valor}
                  onChange={upd("valor")}
                />
              </Field>
              <Field label="Competência">
                <Input
                  type="month"
                  value={form.competencia}
                  onChange={upd("competencia")}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Código de Serviço LC116" required hint="Ex: 17.19 — serviços contábeis">
                <Input
                  placeholder="17.19"
                  value={form.codigoServico}
                  onChange={upd("codigoServico")}
                />
              </Field>
              <Field label="Alíquota ISS (%)" hint={issCalc ? `ISS: ${issCalc}` : "Taxa do município"}>
                <Input
                  placeholder="3"
                  value={form.aliquotaIss}
                  onChange={upd("aliquotaIss")}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Natureza da Operação">
                <Select value={form.naturezaOp} onValueChange={v => setForm(p=>({...p, naturezaOp:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Tributação no município</SelectItem>
                    <SelectItem value="2">2 — Tributação fora do município</SelectItem>
                    <SelectItem value="3">3 — Isenção</SelectItem>
                    <SelectItem value="4">4 — Imune</SelectItem>
                    <SelectItem value="5">5 — Exigibilidade suspensa (decisão judicial)</SelectItem>
                    <SelectItem value="6">6 — Exigibilidade suspensa (proc. administrativo)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Regime Especial de Tributação">
                <Select value={form.regimeTrib} onValueChange={v => setForm(p=>({...p, regimeTrib:v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Microempresa Municipal</SelectItem>
                    <SelectItem value="2">2 — Estimativa</SelectItem>
                    <SelectItem value="3">3 — Sociedade de Profissionais</SelectItem>
                    <SelectItem value="4">4 — Cooperativa</SelectItem>
                    <SelectItem value="5">5 — MEI do Simples Nacional</SelectItem>
                    <SelectItem value="6">6 — ME/EPP do Simples Nacional</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="issRetido"
                checked={form.issRetido}
                onCheckedChange={v => setForm(p => ({ ...p, issRetido: v }))}
              />
              <Label htmlFor="issRetido" className="text-sm cursor-pointer">
                ISS retido na fonte pelo tomador
              </Label>
            </div>
            <Field label="Inscrição Municipal do Prestador">
              <Input
                placeholder="Inscrição municipal (opcional)"
                value={form.inscricaoMunicipal}
                onChange={upd("inscricaoMunicipal")}
              />
            </Field>
          </div>

          {/* ── TOMADOR ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <Section title="Tomador do Serviço" />
            <div className="flex gap-2">
              <Field label="CNPJ ou CPF do tomador" required>
                <Input
                  className="font-mono"
                  placeholder="00.000.000/0001-00"
                  value={form.tomDoc}
                  onChange={upd("tomDoc")}
                />
              </Field>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="sm"
                  className="h-10 gap-1.5 whitespace-nowrap"
                  onClick={handleAutoFill}
                  disabled={buscandoCnpj}>
                  {buscandoCnpj ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Auto-fill
                </Button>
              </div>
            </div>
            <Field label="Razão Social / Nome" required>
              <Input placeholder="Nome ou razão social" value={form.tomNome} onChange={upd("tomNome")} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail">
                <Input type="email" placeholder="contato@empresa.com" value={form.tomEmail} onChange={upd("tomEmail")} />
              </Field>
              <Field label="Telefone">
                <Input placeholder="(11) 99999-9999" value={form.tomTelefone} onChange={upd("tomTelefone")} />
              </Field>
            </div>

            {/* Endereço */}
            <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Endereço do Tomador
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="CEP">
                  <Input className="font-mono" placeholder="00000-000" value={form.tomCep} onChange={upd("tomCep")} />
                </Field>
                <Field label="Número">
                  <Input placeholder="123" value={form.tomNumero} onChange={upd("tomNumero")} />
                </Field>
                <Field label="Complemento">
                  <Input placeholder="Sala, Bloco…" value={form.tomComplemento} onChange={upd("tomComplemento")} />
                </Field>
              </div>
              <Field label="Logradouro">
                <Input placeholder="Rua, Av., Travessa…" value={form.tomLogradouro} onChange={upd("tomLogradouro")} />
              </Field>
              <Field label="Bairro">
                <Input placeholder="Bairro" value={form.tomBairro} onChange={upd("tomBairro")} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Estado (UF)" required>
                  <Select value={form.tomUf} onValueChange={handleUfChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      {UF_LIST.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="col-span-2">
                  <Field label="Município" required>
                    {loadingMun ? (
                      <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                      </div>
                    ) : (
                      <Select
                        value={form.tomMunicipio}
                        onValueChange={handleMunicipioChange}
                        disabled={!form.tomUf || municipios.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={form.tomUf ? "Selecione…" : "Escolha a UF primeiro"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {municipios.map(m => (
                            <SelectItem key={m.id} value={m.nome}>{m.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                </div>
              </div>
              {form.tomCodigoIbge && (
                <p className="text-[11px] text-muted-foreground">
                  Código IBGE: {form.tomCodigoIbge}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Rodapé ──────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center pt-4 border-t border-border/60 mt-2">
          {issCalc && (
            <p className="text-sm text-muted-foreground">
              ISS estimado: <span className="font-bold text-foreground">{issCalc}</span>
              {form.issRetido && <span className="text-xs ml-1">(retido na fonte)</span>}
            </p>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={emitindo}>Cancelar</Button>
            <Button
              className="gap-2 bg-[oklch(0.66_0.195_44)] hover:opacity-90 text-white"
              onClick={handleEmitir}
              disabled={emitindo || !clienteSel}>
              {emitindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {emitindo ? "Emitindo…" : "Emitir NFS-e"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

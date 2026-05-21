import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Building2, Calendar, DollarSign, Edit, FileText,
  Mail, MapPin, MessageSquare, Phone, Save, Trash2, User, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  useClientes,
  REGIME_LABEL,
  STATUS_LABEL,
  type Cliente,
  type Regime,
  type Status,
  type FormaPagamento,
} from "@/hooks/use-clientes";

export const Route = createFileRoute("/_app/clientes/$id")({
  component: ClienteDetailPage,
  head: () => ({ meta: [{ title: "Cliente · APOYA Gestão" }] }),
});

const STATUS_COLOR: Record<Status, string> = {
  ativo:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  inadimplente:"bg-amber-50   text-amber-700   border-amber-200",
  suspenso:    "bg-red-50     text-red-700     border-red-200",
  inativo:     "bg-slate-50   text-slate-500   border-slate-200",
  em_analise:  "bg-blue-50    text-blue-700    border-blue-200",
};

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function ClienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { clientes, loading, updateCliente, deleteCliente } = useClientes();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sincronizar quando clientes carregam
  useEffect(() => {
    if (!loading) {
      const found = clientes.find((c) => c.id === id) ?? null;
      setCliente(found);
      if (found) setForm(found);
    }
  }, [id, clientes, loading]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Link to="/clientes">
          <Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
        </Link>
      </div>
    );
  }

  async function handleSave() {
    if (!form || !cliente) return;
    setSaving(true);
    try {
      await updateCliente(cliente.id, form);
      setEditMode(false);
      toast.success("Cliente atualizado com sucesso");
    } catch {
      toast.error("Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Deseja excluir o cliente "${cliente?.razaoSocial}"? Esta ação é irreversível.`)) return;
    setDeleting(true);
    try {
      await deleteCliente(cliente!.id);
      toast.success("Cliente excluído");
      navigate({ to: "/clientes" });
    } catch {
      toast.error("Erro ao excluir cliente");
      setDeleting(false);
    }
  }

  const f = (field: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/clientes">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{cliente.razaoSocial}</h1>
            <p className="text-sm text-muted-foreground">{cliente.cnpj}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setForm(cliente); }}>
                <X className="mr-1.5 h-3.5 w-3.5" />Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir
              </Button>
              <Button size="sm" onClick={() => setEditMode(true)}>
                <Edit className="mr-1.5 h-3.5 w-3.5" />Editar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Status badge ── */}
      <div className="flex items-center gap-3">
        <Badge className={`${STATUS_COLOR[cliente.status]} border text-xs`}>
          {STATUS_LABEL[cliente.status]}
        </Badge>
        <span className="text-xs text-muted-foreground">{REGIME_LABEL[cliente.regime]}</span>
      </div>

      {editMode ? (
        /* ── Formulário de edição ── */
        <div className="surface-card p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Razão Social</Label>
              <Input value={form.razaoSocial ?? ""} onChange={f("razaoSocial")} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome Fantasia</Label>
              <Input value={form.nomeFantasia ?? ""} onChange={f("nomeFantasia")} />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input value={form.cnpj ?? ""} onChange={f("cnpj")} />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Input value={form.responsavel ?? ""} onChange={f("responsavel")} />
            </div>
            <div className="space-y-1.5">
              <Label>Regime</Label>
              <Select value={form.regime ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, regime: v as Regime }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(REGIME_LABEL)).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, status: v as Status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_LABEL)).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={form.email ?? ""} onChange={f("email")} type="email" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ""} onChange={f("telefone")} />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp ?? ""} onChange={f("whatsapp")} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Honorário (R$)</Label>
              <Input value={form.valorHonorario ?? ""} onChange={f("valorHonorario")} type="number" />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select value={form.formaPagamento ?? ""} onValueChange={(v) => setForm((p) => ({ ...p, formaPagamento: v as FormaPagamento }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Débito automático">Débito automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dia de Vencimento</Label>
              <Input value={form.diaVencimento ?? ""} onChange={f("diaVencimento")} type="number" min={1} max={28} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes ?? ""} onChange={f("observacoes")} rows={3} />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.temEmpregados ?? false}
                onCheckedChange={(v) => setForm((p) => ({ ...p, temEmpregados: v }))}
              />
              <Label>Tem empregados (eSocial)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.temIncentivoFiscal ?? false}
                onCheckedChange={(v) => setForm((p) => ({ ...p, temIncentivoFiscal: v }))}
              />
              <Label>Tem incentivo fiscal</Label>
            </div>
          </div>
        </div>
      ) : (
        /* ── Visualização ── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="surface-card p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />Dados Fiscais
            </p>
            <Field label="Razão Social" value={cliente.razaoSocial} />
            <Field label="Nome Fantasia" value={cliente.nomeFantasia} />
            <Field label="CNPJ" value={cliente.cnpj} />
            <Field label="Regime" value={REGIME_LABEL[cliente.regime]} />
            <Field label="Insc. Municipal" value={cliente.inscricaoMunicipal} />
            <Field label="Insc. Estadual" value={cliente.inscricaoEstadual} />
          </div>

          <div className="surface-card p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />Contato
            </p>
            <Field label="Responsável" value={cliente.responsavel} />
            <Field label="E-mail" value={cliente.email} />
            <Field label="Telefone" value={cliente.telefone} />
            <Field label="WhatsApp" value={cliente.whatsapp} />
          </div>

          <div className="surface-card p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />Financeiro
            </p>
            <Field label="Honorário" value={cliente.valorHonorario ? `R$ ${cliente.valorHonorario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : undefined} />
            <Field label="Forma de Pagamento" value={cliente.formaPagamento} />
            <Field label="Dia de Vencimento" value={cliente.diaVencimento ? `Dia ${cliente.diaVencimento}` : undefined} />
          </div>

          <div className="surface-card p-5 space-y-4 sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />Endereço
            </p>
            <Field label="Município" value={cliente.endereco?.municipio} />
            <Field label="UF" value={cliente.endereco?.uf} />
            <Field label="CEP" value={cliente.endereco?.cep} />
            <Field label="Logradouro" value={cliente.endereco?.logradouro} />
          </div>

          <div className="surface-card p-5 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />Obrigações
            </p>
            <Field label="Tem empregados" value={cliente.temEmpregados ? "Sim" : "Não"} />
            <Field label="Incentivo fiscal" value={cliente.temIncentivoFiscal ? "Sim" : "Não"} />
            <Field label="Cód. Serviço NFS-e" value={cliente.codigoServicoNfse} />
            <Field label="Atividade principal" value={cliente.atividadePrincipal} />
          </div>

          {cliente.observacoes && (
            <div className="surface-card p-5 space-y-2 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{cliente.observacoes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

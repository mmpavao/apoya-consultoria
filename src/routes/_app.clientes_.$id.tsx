/**
 * Página de detalhes do cliente — padrão contábil completo
 * Tabs: Visão Geral | Fiscal | Financeiro | Contato | Histórico
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Building2, Calendar, CheckCircle2, Clock, DollarSign,
  Edit, FileText, Mail, MapPin, MessageSquare, Phone, Save, Trash2,
  User, X, AlertTriangle, Briefcase, CreditCard, Hash, Home,
  Info, ReceiptText, ShieldCheck, Users, Zap, ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  REGIME_LABEL, STATUS_LABEL,
  type Cliente, type Regime, type Status, type FormaPagamento,
} from "@/hooks/use-clientes";
import { useClienteById } from "@/hooks/use-cliente-by-id";
import { useCobrancas } from "@/hooks/use-cobrancas";
import { useObrigacoes } from "@/hooks/use-obrigacoes";
import { TabServicos } from "@/components/cliente/TabServicos";
import { TabContratos } from "@/components/cliente/TabContratos";
import { TabDocumentos } from "@/components/cliente/TabDocumentos";
import { TabFiscal } from "@/components/cliente/TabFiscal";
import { TabFinanceiro } from "@/components/cliente/TabFinanceiro";

export const Route = createFileRoute("/_app/clientes_/$id")({
  component: ClienteDetailPage,
  head: () => ({ meta: [{ title: "Cliente · APOYA Gestão" }] }),
});

// ── Helpers visuais ────────────────────────────────────────────────────────

const STATUS_CFG: Record<Status, { label: string; cls: string; dot: string }> = {
  ativo:       { label: "Ativo",       cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  inadimplente:{ label: "Inadimplente",cls: "bg-amber-50   text-amber-700   border-amber-200",  dot: "bg-amber-500"   },
  suspenso:    { label: "Suspenso",    cls: "bg-red-50     text-red-700     border-red-200",     dot: "bg-red-500"     },
  inativo:     { label: "Inativo",     cls: "bg-slate-50   text-slate-500   border-slate-200",   dot: "bg-slate-400"   },
  em_analise:  { label: "Em análise",  cls: "bg-blue-50    text-blue-700    border-blue-200",    dot: "bg-blue-500"    },
};

const REGIME_CFG: Record<string, string> = {
  MEI:              "bg-violet-50 text-violet-700 border-violet-200",
  Simples:          "bg-blue-50 text-blue-700 border-blue-200",
  "Lucro Presumido":"bg-orange-50 text-orange-700 border-orange-200",
  "Lucro Real":     "bg-rose-50 text-rose-700 border-rose-200",
  Doméstica:        "bg-teal-50 text-teal-700 border-teal-200",
};

const fmtBRL = (v?: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

function Avatar({ nome, regime }: { nome: string; regime: string }) {
  const initials = nome.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const colors: Record<string, string> = {
    MEI: "from-violet-500 to-violet-700",
    Simples: "from-blue-500 to-blue-700",
    "Lucro Presumido": "from-orange-500 to-orange-700",
    "Lucro Real": "from-rose-500 to-rose-700",
    Doméstica: "from-teal-500 to-teal-700",
  };
  return (
    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colors[regime] ?? "from-slate-500 to-slate-700"} text-white font-bold text-lg shadow-sm`}>
      {initials}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value?: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
        {href ? (
          <a href={href} className="text-sm text-primary hover:underline break-all">{value}</a>
        ) : (
          <p className="text-sm text-foreground break-words">{value}</p>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/60 bg-muted/20">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

function KpiMini({ label, value, sub, tone = "neutral" }: { label: string; value: string | number; sub?: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const tones = {
    neutral: "text-foreground",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger:  "text-red-600",
  };
  return (
    <div className="surface-card flex flex-col gap-0.5 px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────

type Tab = "geral" | "fiscal" | "financeiro" | "servicos" | "contratos" | "documentos" | "contato" | "historico";
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "geral",      label: "Visão Geral", icon: Building2   },
  { id: "fiscal",     label: "Fiscal",      icon: FileText    },
  { id: "financeiro", label: "Financeiro",  icon: DollarSign  },
  { id: "servicos",   label: "Serviços",    icon: Briefcase   },
  { id: "contratos",  label: "Contratos",   icon: ReceiptText  },
  { id: "documentos", label: "Documentos",  icon: FileText    },
  { id: "contato",    label: "Contato",     icon: User        },
  { id: "historico",  label: "Histórico",   icon: Clock       },
];

// ── Componente principal ──────────────────────────────────────────────────

function ClienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { cliente, loading, error: clienteError, update: updateClienteById } = useClienteById(id);
  const { cobrancas } = useCobrancas();
  const { obrigacoes } = useObrigacoes();

  const [tab, setTab]         = useState<Tab>("geral");

  const [editMode, setEditMode] = useState(false);
  const [form, setForm]         = useState<Partial<Cliente>>({});
  const [saving, setSaving]     = useState(false);

  // Sincronizar form quando cliente carrega
  useEffect(() => {
    if (cliente) setForm(cliente);
  }, [cliente]);

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  if (!cliente) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-muted-foreground">Cliente não encontrado.</p>
      <Link to="/clientes"><Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button></Link>
    </div>
  );

  // Dados derivados
  const cobCliente  = cobrancas.filter(c => c.clienteId === id);
  const obgCliente  = obrigacoes.filter(o => o.clienteId === id);
  const totalDevido = cobCliente.filter(c => c.status === "pendente" || c.status === "vencida").reduce((s, c) => s + c.valor, 0);
  const totalPago   = cobCliente.filter(c => c.status === "paga").reduce((s, c) => s + c.valor, 0);
  const obgPendente = obgCliente.filter(o => o.status === "pendente" || o.status === "atrasada").length;
  const obgAtrasada = obgCliente.filter(o => o.status === "atrasada").length;
  const st          = STATUS_CFG[cliente.status];

  async function handleSave() {
    setSaving(true);
    try {
      await updateClienteById(form);
      setEditMode(false);
      toast.success("Cliente atualizado");
    } catch { toast.error("Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Excluir "${cliente?.razaoSocial}"? Esta ação é irreversível.`)) return;
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Cliente excluído");
    navigate({ to: "/clientes" });
  }

  const f = (field: keyof Cliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="animate-fade-up space-y-5 pb-12">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link to="/clientes" className="hover:text-foreground transition-colors">Clientes</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{cliente.razaoSocial}</span>
      </nav>

      {/* ── Hero card ── */}
      <div className="surface-card px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Identidade */}
          <div className="flex items-start gap-4">
            <Avatar nome={cliente.razaoSocial} regime={cliente.regime} />
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground leading-tight">{cliente.razaoSocial}</h1>
              {cliente.nomeFantasia && (
                <p className="text-sm text-muted-foreground mt-0.5">{cliente.nomeFantasia}</p>
              )}
              <p className="font-mono text-xs text-muted-foreground mt-1">{cliente.cnpj}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${st.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${REGIME_CFG[cliente.regime] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                  {REGIME_LABEL[cliente.regime]}
                </span>
                {cliente.regimeHibrido && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                    <Zap className="h-3 w-3" />Híbrido
                  </span>
                )}
                {cliente.temEmpregados && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                    <Users className="h-3 w-3" />eSocial
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex shrink-0 items-center gap-2">
            {editMode ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditMode(false); setForm(cliente); }}>
                  <X className="mr-1.5 h-3.5 w-3.5" />Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  {saving ? "Salvando…" : "Salvar"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:border-destructive" onClick={handleDelete}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir
                </Button>
                <Button size="sm" onClick={() => setEditMode(true)}>
                  <Edit className="mr-1.5 h-3.5 w-3.5" />Editar
                </Button>
                {cliente.whatsapp && (
                  <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => navigate({ to: "/whatsapp", search: { tel: cliente.whatsapp!.replace(/\D/g,""), nome: cliente.razaoSocial } })}>
                    <MessageSquare className="h-3.5 w-3.5" />WhatsApp
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* KPIs rápidos */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiMini label="Honorário"     value={fmtBRL(cliente.valorHonorario)} sub={`Venc. dia ${cliente.diaVencimento ?? "—"}`} />
          <KpiMini label="Em aberto"     value={fmtBRL(totalDevido)} tone={totalDevido > 0 ? "warning" : "neutral"} sub={`${cobCliente.filter(c=>c.status==="pendente"||c.status==="vencida").length} cobranças`} />
          <KpiMini label="Total pago"    value={fmtBRL(totalPago)} tone="success" sub={`${cobCliente.filter(c=>c.status==="paga").length} pagas`} />
          <KpiMini label="Obrigações"    value={obgPendente} tone={obgAtrasada > 0 ? "danger" : obgPendente > 0 ? "warning" : "success"} sub={obgAtrasada > 0 ? `${obgAtrasada} atrasada${obgAtrasada>1?"s":""}` : "Em dia"} />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-border/60 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═════════════════════ ABA: VISÃO GERAL ═════════════════════ */}
      {tab === "geral" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Dados cadastrais */}
          <SectionCard title="Dados Cadastrais" icon={Building2}>
            <InfoRow icon={Hash}         label="CNPJ / CPF"          value={cliente.cnpj} />
            <InfoRow icon={Briefcase}    label="Razão Social"         value={cliente.razaoSocial} />
            <InfoRow icon={Building2}    label="Nome Fantasia"        value={cliente.nomeFantasia} />
            <InfoRow icon={FileText}     label="Atividade Principal"  value={cliente.atividadePrincipal} />
            <InfoRow icon={Hash}         label="Insc. Municipal"      value={cliente.inscricaoMunicipal} />
            <InfoRow icon={Hash}         label="Insc. Estadual"       value={cliente.inscricaoEstadual} />
          </SectionCard>

          {/* Regime e características */}
          <SectionCard title="Regime Tributário" icon={ShieldCheck}>
            <InfoRow icon={ShieldCheck}  label="Regime"               value={REGIME_LABEL[cliente.regime]} />
            <InfoRow icon={Zap}          label="Regime Híbrido"       value={cliente.regimeHibrido ? "Sim" : undefined} />
            <InfoRow icon={ReceiptText}  label="Cód. Serviço NFS-e"   value={cliente.codigoServicoNfse} />
            <InfoRow icon={Users}        label="Tem Empregados (eSocial)" value={cliente.temEmpregados ? "Sim" : "Não"} />
            <InfoRow icon={Zap}          label="Incentivo Fiscal"     value={cliente.temIncentivoFiscal ? "Sim" : "Não"} />
            <InfoRow icon={User}         label="Responsável APOYA"    value={cliente.responsavel} />
          </SectionCard>

          {/* Endereço */}
          <SectionCard title="Endereço" icon={MapPin}>
            <InfoRow icon={Home}         label="Logradouro"   value={[cliente.endereco?.logradouro, cliente.endereco?.numero].filter(Boolean).join(", ")} />
            <InfoRow icon={MapPin}       label="Bairro"       value={cliente.endereco?.bairro} />
            <InfoRow icon={MapPin}       label="CEP"          value={cliente.endereco?.cep} />
            <InfoRow icon={MapPin}       label="Município/UF" value={[cliente.endereco?.municipio ?? cliente.municipio, cliente.endereco?.uf ?? cliente.uf].filter(Boolean).join(" / ")} />
          </SectionCard>

          {/* Observações */}
          {cliente.observacoes && (
            <SectionCard title="Observações" icon={Info}>
              <p className="py-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{cliente.observacoes}</p>
            </SectionCard>
          )}
        </div>
      )}

      {/* ═════════════════════ ABA: FISCAL ═════════════════════ */}
      {tab === "fiscal" && (
        <TabFiscal
          cliente={{
            ...cliente,
            tem_certificado: (cliente as any).tem_certificado ?? false,
            tem_procuracao:  (cliente as any).tem_procuracao  ?? false,
          }}
        />
      )}


      {tab === "financeiro" && (
        <TabFinanceiro cliente={cliente} />
      )}

            {/* ═════════════════════ ABA: CONTATO ═════════════════════ */}
      {tab === "contato" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Dados de Contato" icon={User}>
            <InfoRow icon={Mail}        label="E-mail"       value={cliente.email} href={cliente.email ? `mailto:${cliente.email}` : undefined} />
            <InfoRow icon={Phone}       label="Telefone"     value={cliente.telefone} href={cliente.telefone ? `tel:${cliente.telefone}` : undefined} />
            <div className="flex items-start gap-3 py-2.5 border-b border-border/50">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">WhatsApp</p>
                  {cliente.whatsapp ? (
                    <button
                      className="text-sm text-primary hover:underline font-medium"
                      onClick={() => navigate({ to: "/whatsapp", search: { tel: cliente.whatsapp!.replace(/\D/g,""), nome: cliente.razaoSocial } })}
                    >
                      {cliente.whatsapp}
                    </button>
                  ) : <p className="text-sm text-muted-foreground">—</p>}
                </div>
              </div>
            <InfoRow icon={User}        label="Responsável APOYA" value={cliente.responsavel} />
          </SectionCard>

          <SectionCard title="Endereço Completo" icon={MapPin}>
            <InfoRow icon={Home}        label="Logradouro / Número" value={[cliente.endereco?.logradouro, cliente.endereco?.numero].filter(Boolean).join(", ")} />
            <InfoRow icon={MapPin}      label="Bairro"              value={cliente.endereco?.bairro} />
            <InfoRow icon={Hash}        label="CEP"                 value={cliente.endereco?.cep} />
            <InfoRow icon={Building2}   label="Município"           value={cliente.endereco?.municipio ?? cliente.municipio} />
            <InfoRow icon={MapPin}      label="Estado (UF)"         value={cliente.endereco?.uf ?? cliente.uf} />
          </SectionCard>
        </div>
      )}

      {/* ═════════════════════ ABA: SERVIÇOS ═════════════════════ */}
      {tab === "servicos" && <TabServicos clienteId={id} />}

      {/* ═════════════════════ ABA: CONTRATOS ════════════════════ */}
      {tab === "contratos" && <TabContratos
          clienteId={id}
          clienteEmail={cliente.email}
          clienteWhatsapp={cliente.whatsapp}
          clienteNome={cliente.razaoSocial}
        />}

      {/* ═════════════════════ ABA: DOCUMENTOS ═══════════════════ */}
      {tab === "documentos" && <TabDocumentos clienteId={id} />}

      {/* ═════════════════════ ABA: HISTÓRICO ═════════════════════ */}
      {tab === "historico" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Linha do Tempo" icon={Clock}>
            <div className="divide-y divide-border/50">
              <div className="flex items-start gap-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Cliente cadastrado</p>
                  <p className="text-xs text-muted-foreground">{new Date(cliente.createdAt).toLocaleDateString("pt-BR", { day:"2-digit",month:"long",year:"numeric" })}</p>
                </div>
              </div>
              {cobCliente.filter(c=>c.status==="paga").slice(0,5).map(c => (
                <div key={c.id} className="flex items-start gap-3 py-2.5">
                  <DollarSign className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Pagamento recebido — {fmtBRL(c.valor)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(c.vencimento).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              ))}
              {cobCliente.filter(c=>c.status==="vencida").slice(0,3).map(c => (
                <div key={c.id} className="flex items-start gap-3 py-2.5">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Cobrança vencida — {fmtBRL(c.valor)}</p>
                    <p className="text-xs text-muted-foreground">Venceu em {new Date(c.vencimento).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              ))}
              {obgCliente.filter(o=>o.status==="concluida").slice(0,5).map(o => (
                <div key={o.id} className="flex items-start gap-3 py-2.5">
                  <FileText className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{o.tipo} — concluída</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.vencimento).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Resumo Geral" icon={Info}>
            <InfoRow icon={Calendar}    label="Cadastro em"         value={new Date(cliente.createdAt).toLocaleDateString("pt-BR")} />
            <InfoRow icon={DollarSign}  label="Total arrecadado"    value={fmtBRL(totalPago)} />
            <InfoRow icon={AlertTriangle} label="Em aberto"         value={totalDevido > 0 ? fmtBRL(totalDevido) : "Sem pendências"} />
            <InfoRow icon={FileText}    label="Obrigações totais"   value={String(obgCliente.length)} />
            <InfoRow icon={CheckCircle2} label="Obrigações concluídas" value={String(obgCliente.filter(o=>o.status==="concluida").length)} />
            <InfoRow icon={AlertTriangle} label="Obrigações atrasadas" value={obgAtrasada > 0 ? String(obgAtrasada) : "Nenhuma"} />
          </SectionCard>
        </div>
      )}

      {/* ═════════════════════ FORMULÁRIO DE EDIÇÃO ═════════════════════ */}
      {editMode && (
        <div className="surface-card p-6 space-y-6">
          <h3 className="font-semibold text-base flex items-center gap-2"><Edit className="h-4 w-4" />Editar dados do cliente</h3>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Razão Social", "razaoSocial"],
              ["Nome Fantasia", "nomeFantasia"],
              ["CNPJ / CPF", "cnpj"],
              ["Atividade Principal", "atividadePrincipal"],
              ["Insc. Municipal", "inscricaoMunicipal"],
              ["Insc. Estadual", "inscricaoEstadual"],
              ["Cód. Serviço NFS-e", "codigoServicoNfse"],
              ["E-mail", "email"],
              ["Telefone", "telefone"],
              ["WhatsApp", "whatsapp"],
            ].map(([label, field]) => (
              <div key={field} className="space-y-1.5">
                <Label>{label}</Label>
                <Input value={(form as any)[field] ?? ""} onChange={f(field as keyof Cliente)} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Regime</Label>
              <Select value={form.regime ?? ""} onValueChange={(v) => setForm(p => ({ ...p, regime: v as Regime }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REGIME_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? ""} onValueChange={(v) => setForm(p => ({ ...p, status: v as Status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor Honorário (R$)</Label>
              <Input value={form.valorHonorario ?? ""} onChange={f("valorHonorario")} type="number" />
            </div>
            <div className="space-y-1.5">
              <Label>Dia de Vencimento</Label>
              <Input value={form.diaVencimento ?? ""} onChange={f("diaVencimento")} type="number" min={1} max={28} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de Pagamento</Label>
              <Select value={form.formaPagamento ?? ""} onValueChange={(v) => setForm(p => ({ ...p, formaPagamento: v as FormaPagamento }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="Boleto">Boleto</SelectItem>
                  <SelectItem value="Débito automático">Débito automático</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável APOYA</Label>
              <Input value={form.responsavel ?? ""} onChange={f("responsavel")} />
            </div>
            <div className="space-y-1.5">
              <Label>Município</Label>
              <Input value={form.endereco?.municipio ?? ""} onChange={e => setForm(p => ({ ...p, endereco: { ...p.endereco, municipio: e.target.value } }))} />
            </div>
            <div className="space-y-1.5">
              <Label>UF</Label>
              <Input value={form.endereco?.uf ?? ""} onChange={e => setForm(p => ({ ...p, endereco: { ...p.endereco, uf: e.target.value } }))} maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>CEP</Label>
              <Input value={form.endereco?.cep ?? ""} onChange={e => setForm(p => ({ ...p, endereco: { ...p.endereco, cep: e.target.value } }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Logradouro</Label>
              <Input value={form.endereco?.logradouro ?? ""} onChange={e => setForm(p => ({ ...p, endereco: { ...p.endereco, logradouro: e.target.value } }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input value={form.endereco?.numero ?? ""} onChange={e => setForm(p => ({ ...p, endereco: { ...p.endereco, numero: e.target.value } }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={form.endereco?.bairro ?? ""} onChange={e => setForm(p => ({ ...p, endereco: { ...p.endereco, bairro: e.target.value } }))} />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={form.temEmpregados ?? false} onCheckedChange={(v) => setForm(p => ({ ...p, temEmpregados: v }))} />
              <Label>Tem empregados (eSocial)</Label>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={form.regimeHibrido ?? false} onCheckedChange={(v) => setForm(p => ({ ...p, regimeHibrido: v }))} />
              <Label>Regime Híbrido</Label>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={form.temIncentivoFiscal ?? false} onCheckedChange={(v) => setForm(p => ({ ...p, temIncentivoFiscal: v }))} />
              <Label>Tem incentivo fiscal</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes ?? ""} onChange={f("observacoes")} rows={4} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setEditMode(false); setForm(cliente); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

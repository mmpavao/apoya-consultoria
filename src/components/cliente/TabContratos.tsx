/**
 * TabContratos — Gestão completa de contratos por cliente
 * Integração Clicksign: enviar, acompanhar, cancelar, baixar PDF assinado
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  FileText, Plus, Send, RefreshCw, XCircle, Download,
  ExternalLink, Copy, Clock, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, Eye, Trash2, Edit3,
  Mail, MessageSquare, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  useContratosCliente,
  type ContratoCliente,
  type NovoContratoPayload,
  STATUS_LABEL,
  STATUS_TONE,
} from "@/hooks/use-contratos-cliente";

// ── Templates de contrato ─────────────────────────────────────
const TEMPLATES: Record<string, { titulo: string; html: string }> = {
  prestacao_servicos: {
    titulo: "Contrato de Prestação de Serviços Contábeis",
    html: `<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS</h1>

<p>Pelo presente instrumento particular, as partes abaixo identificadas celebram o presente Contrato de Prestação de Serviços Contábeis:</p>

<h2>PARTES CONTRATANTES</h2>
<p><strong>CONTRATADA:</strong> APOYA Consultoria Contábil, inscrita no CNPJ/MF sob o nº [CNPJ APOYA], com sede na [ENDEREÇO APOYA].</p>
<p><strong>CONTRATANTE:</strong> [RAZÃO SOCIAL CLIENTE], inscrito no CNPJ/CPF sob o nº [CNPJ/CPF CLIENTE], com sede/domicílio em [ENDEREÇO CLIENTE].</p>

<h2>CLÁUSULA 1ª — OBJETO</h2>
<p>A CONTRATADA obriga-se a prestar ao CONTRATANTE os seguintes serviços contábeis: escrituração contábil completa, apuração de tributos, entrega de obrigações acessórias, orientação fiscal e tributária.</p>

<h2>CLÁUSULA 2ª — HONORÁRIOS</h2>
<p>Pelos serviços prestados, o CONTRATANTE pagará à CONTRATADA o valor mensal de R$ [VALOR], vencível todo dia [DIA VENCIMENTO] do mês subsequente à competência.</p>

<h2>CLÁUSULA 3ª — PRAZO</h2>
<p>O presente contrato tem vigência por prazo indeterminado, podendo ser rescindido por qualquer das partes mediante aviso prévio de 30 (trinta) dias.</p>

<h2>CLÁUSULA 4ª — OBRIGAÇÕES DO CONTRATANTE</h2>
<p>O CONTRATANTE compromete-se a fornecer à CONTRATADA, mensalmente e nos prazos combinados, todos os documentos fiscais, financeiros e contábeis necessários à execução dos serviços.</p>

<h2>CLÁUSULA 5ª — FORO</h2>
<p>Fica eleito o foro da Comarca de [CIDADE], para dirimir quaisquer questões oriundas do presente contrato.</p>

<p>E por estarem de acordo, as partes assinam o presente contrato eletronicamente via plataforma Clicksign.</p>`,
  },
  abertura_empresa: {
    titulo: "Contrato de Abertura de Empresa",
    html: `<h1>CONTRATO DE SERVIÇOS — ABERTURA DE EMPRESA</h1>

<p>As partes abaixo identificadas celebram o presente contrato de prestação de serviços para abertura de pessoa jurídica:</p>

<h2>PARTES</h2>
<p><strong>CONTRATADA:</strong> APOYA Consultoria Contábil</p>
<p><strong>CONTRATANTE:</strong> [NOME DO CLIENTE]</p>

<h2>OBJETO</h2>
<p>A CONTRATADA prestará os seguintes serviços: análise de viabilidade, registro na Junta Comercial, inscrição estadual e municipal, alvará de funcionamento e orientações iniciais.</p>

<h2>HONORÁRIOS</h2>
<p>Valor total: R$ [VALOR], a ser pago conforme acordado entre as partes.</p>

<h2>PRAZO DE EXECUÇÃO</h2>
<p>Estimativa de 30 a 60 dias úteis, condicionado à regularidade dos documentos fornecidos pelo CONTRATANTE.</p>`,
  },
  distrato: {
    titulo: "Distrato de Serviços Contábeis",
    html: `<h1>DISTRATO DE CONTRATO DE SERVIÇOS CONTÁBEIS</h1>

<p>Pelo presente instrumento, as partes acordam o encerramento do contrato de prestação de serviços contábeis, nas seguintes condições:</p>

<h2>PARTES</h2>
<p><strong>CONTRATADA:</strong> APOYA Consultoria Contábil</p>
<p><strong>CONTRATANTE:</strong> [NOME DO CLIENTE]</p>

<h2>DATA DE ENCERRAMENTO</h2>
<p>O contrato fica rescindido em [DATA], ficando a CONTRATADA obrigada a entregar ao CONTRATANTE toda a documentação em seu poder no prazo de 15 dias.</p>

<h2>PENDÊNCIAS FINANCEIRAS</h2>
<p>As partes declaram que não existem pendências financeiras entre si, estando quites e nada mais tendo a reclamar uma da outra.</p>`,
  },
};

// ── Badge de status Clicksign ─────────────────────────────────
function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    nao_enviado:           { label: "Não enviado",     color: "bg-zinc-100 text-zinc-600 border-zinc-200",         icon: FileText },
    enviando:              { label: "Enviando…",       color: "bg-blue-50 text-blue-600 border-blue-200",           icon: Clock },
    aguardando_assinatura: { label: "Aguardando",      color: "bg-amber-50 text-amber-600 border-amber-200",        icon: Clock },
    assinado:              { label: "Assinado ✓",      color: "bg-emerald-50 text-emerald-700 border-emerald-200",  icon: CheckCircle2 },
    cancelado:             { label: "Cancelado",       color: "bg-red-50 text-red-600 border-red-200",              icon: XCircle },
    expirado:              { label: "Expirado",        color: "bg-orange-50 text-orange-600 border-orange-200",     icon: AlertTriangle },
    recusado:              { label: "Recusado",        color: "bg-rose-50 text-rose-700 border-rose-200",           icon: XCircle },
    rascunho:              { label: "Rascunho",        color: "bg-zinc-100 text-zinc-500 border-zinc-200",          icon: Edit3 },
  };
  const key = status ?? "nao_enviado";
  const cfg = map[key] ?? map.nao_enviado;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
      <Icon className="h-3 w-3" />{cfg.label}
    </span>
  );
}

// ── Painel expandido do contrato ──────────────────────────────
function ContratoRow({
  contrato, clienteId,
  onEnviar, onReenviar, onCancelar,
  actionLoading,
}: {
  contrato: ContratoCliente;
  clienteId: string;
  onEnviar: (id: string) => void;
  onReenviar: (id: string) => void;
  onCancelar: (id: string) => void;
  actionLoading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isBusy = actionLoading === contrato.id
               || actionLoading === `${contrato.id}_resend`
               || actionLoading === `${contrato.id}_cancel`;
  const signUrl = contrato.clicksign_url ?? contrato.clicksign_sign_url;
  const pdfUrl  = contrato.clicksign_pdf_url ?? contrato.clicksign_signed_pdf;
  const csStatus = contrato.clicksign_status ?? "nao_enviado";

  return (
    <div className="surface-card rounded-xl border border-border/60 overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <button className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{contrato.numero}</span>
            <span className="font-medium text-sm truncate">{contrato.titulo}</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <StatusBadge status={csStatus} />
            <span className="text-xs text-muted-foreground">
              {contrato.tipo} • {contrato.data_inicio instanceof Date ? contrato.data_inicio.toLocaleDateString("pt-BR") : contrato.data_inicio ? new Date(contrato.data_inicio as any).toLocaleDateString("pt-BR") : "—"}
            </span>
            {contrato.valor_total > 0 && (
              <span className="text-xs font-semibold text-foreground/80">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contrato.valor_total)}
              </span>
            )}
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          {csStatus === "nao_enviado" || csStatus === "rascunho" ? (
            <Button
              size="sm"
              disabled={isBusy}
              onClick={() => onEnviar(contrato.id)}
              className="gap-1.5 h-7 px-2.5 text-xs bg-primary/90 hover:bg-primary"
            >
              {isBusy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              {isBusy ? "Enviando…" : "Enviar para assinar"}
            </Button>
          ) : csStatus === "aguardando_assinatura" ? (
            <>
              <Button size="sm" variant="outline" disabled={isBusy}
                onClick={() => onReenviar(contrato.id)}
                className="gap-1 h-7 px-2 text-xs">
                <RefreshCw className={`h-3 w-3 ${actionLoading === `${contrato.id}_resend` ? "animate-spin" : ""}`} />
                Renotificar
              </Button>
              {signUrl && (
                <Button size="sm" variant="outline"
                  className="gap-1 h-7 px-2 text-xs"
                  onClick={() => { navigator.clipboard.writeText(signUrl); toast.success("Link copiado!"); }}>
                  <Copy className="h-3 w-3" /> Link
                </Button>
              )}
              <Button size="sm" variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                disabled={isBusy}
                onClick={() => onCancelar(contrato.id)}>
                <XCircle className="h-3 w-3" />
              </Button>
            </>
          ) : csStatus === "assinado" ? (
            <>
              {pdfUrl && (
                <Button size="sm" variant="outline" className="gap-1 h-7 px-2.5 text-xs text-emerald-600 border-emerald-200"
                  onClick={() => window.open(pdfUrl, "_blank")}>
                  <Download className="h-3 w-3" /> PDF assinado
                </Button>
              )}
              <span className="text-xs text-emerald-600 font-medium">
                {contrato.clicksign_assinado_em
                  ? `Assinado em ${new Date(contrato.clicksign_assinado_em).toLocaleDateString("pt-BR")}`
                  : "Assinado"}
              </span>
            </>
          ) : null}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/20 px-4 py-3 space-y-3">
          {/* Dados Clicksign */}
          {contrato.clicksign_envelope_id && (
            <div className="rounded-lg bg-background border border-border/60 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Clicksign</p>
              <div className="grid grid-cols-1 gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Envelope ID:</span>
                  <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{contrato.clicksign_envelope_id}</code>
                  <button onClick={() => { navigator.clipboard.writeText(contrato.clicksign_envelope_id!); toast.success("Copiado!"); }}>
                    <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
                {contrato.clicksign_enviado_em && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28 shrink-0">Enviado em:</span>
                    <span>{new Date(contrato.clicksign_enviado_em).toLocaleString("pt-BR")}</span>
                  </div>
                )}
                {signUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-28 shrink-0">Link assinatura:</span>
                    <a href={signUrl} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 truncate max-w-xs">
                      Abrir link <ExternalLink className="h-3 w-3" />
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(signUrl); toast.success("Link copiado!"); }}>
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview HTML */}
          {contrato.corpo_html && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Conteúdo do contrato
              </p>
              <div
                className="prose prose-sm max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-background p-3 text-xs"
                dangerouslySetInnerHTML={{ __html: contrato.corpo_html }}
              />
            </div>
          )}

          {/* Observações */}
          {contrato.observacoes && (
            <p className="text-xs text-muted-foreground italic">Obs: {contrato.observacoes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal Novo Contrato ────────────────────────────────────────
function ModalNovoContrato({
  open, onClose, clienteId,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  onCreate: (clienteId: string, payload: NovoContratoPayload) => Promise<ContratoCliente>;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<NovoContratoPayload>>({
    tipo: "prestacao_servicos",
    data_inicio: new Date().toISOString().slice(0, 10),
    valor_total: 0,
    notificacao_canal: "email",
    deadline_days: 30,
  });
  const [notifEmail, setNotifEmail]       = useState(true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);

  const tpl = TEMPLATES[form.tipo ?? "prestacao_servicos"];

  const handleTipoChange = (tipo: string) => {
    const t = TEMPLATES[tipo];
    setForm(f => ({
      ...f,
      tipo,
      titulo: t?.titulo ?? f.titulo,
      corpo_html: t?.html ?? f.corpo_html,
    }));
  };

  const handleSubmit = async () => {
    if (!form.titulo || !form.data_inicio) { toast.error("Preencha título e data de início"); return; }
    setSaving(true);
    try {
      await onCreate(clienteId, {
        ...form as NovoContratoPayload,
        titulo: form.titulo!,
        tipo: form.tipo!,
        data_inicio: form.data_inicio!,
        corpo_html: form.corpo_html ?? tpl?.html,
        notificacao_canal: notifEmail && notifWhatsapp ? "both" : notifWhatsapp ? "whatsapp" : "email",
        deadline_days: form.deadline_days ?? 30,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Novo Contrato
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo de contrato</Label>
              <Select value={form.tipo} onValueChange={handleTipoChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prestacao_servicos">Prestação de Serviços</SelectItem>
                  <SelectItem value="abertura_empresa">Abertura de Empresa</SelectItem>
                  <SelectItem value="distrato">Distrato</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input type="number" min={0} step={0.01}
                value={form.valor_total ?? 0}
                onChange={e => setForm(f => ({ ...f, valor_total: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label>Título do contrato</Label>
            <Input
              value={form.titulo ?? tpl?.titulo ?? ""}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex: Contrato de Prestação de Serviços — Janeiro 2026" />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input type="date" value={form.data_inicio ?? ""}
                onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de fim (opcional)</Label>
              <Input type="date" value={form.data_fim ?? ""}
                onChange={e => setForm(f => ({ ...f, data_fim: e.target.value || undefined }))} />
            </div>
          </div>

          {/* Conteúdo HTML */}
          <div className="space-y-1.5">
            <Label>Conteúdo do contrato</Label>
            <Textarea
              className="font-mono text-xs h-40 resize-none"
              value={form.corpo_html ?? tpl?.html ?? ""}
              onChange={e => setForm(f => ({ ...f, corpo_html: e.target.value }))}
              placeholder="Conteúdo HTML do contrato..." />
            <p className="text-[11px] text-muted-foreground">
              Suporta HTML simples (h1, h2, p, strong). Este conteúdo será convertido em PDF e enviado ao Clicksign.
            </p>
          </div>

          {/* Configurações Clicksign */}
          <div className="rounded-xl border border-border/60 p-3 space-y-3 bg-muted/20">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              Configurações de assinatura (Clicksign)
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo para assinar (dias)</Label>
                <Input type="number" min={1} max={365}
                  value={form.deadline_days ?? 30}
                  onChange={e => setForm(f => ({ ...f, deadline_days: parseInt(e.target.value) || 30 }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lembrete automático (dias)</Label>
                <Input type="number" min={1} max={30}
                  defaultValue={3} disabled />
                <p className="text-[10px] text-muted-foreground">A cada 3 dias (padrão Clicksign)</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={notifEmail} onCheckedChange={setNotifEmail} />
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Notificar por e-mail
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={notifWhatsapp} onCheckedChange={setNotifWhatsapp} />
                <Label className="text-xs flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Notificar por WhatsApp
                </Label>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label>Observações internas (opcional)</Label>
            <Textarea className="h-16 resize-none text-xs"
              value={form.observacoes ?? ""}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value || undefined }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── TabContratos (componente principal) ────────────────────────
export function TabContratos({ 
  clienteId, 
  clienteEmail: _email, 
  clienteWhatsapp: _wpp, 
  clienteNome: _nome 
}: { 
  clienteId: string;
  clienteEmail?: string;
  clienteWhatsapp?: string;
  clienteNome?: string;
}) {
  const {
    contratos, loading, actionLoading,
    criar, enviarParaAssinatura, reenviarNotificacao, cancelarEnvelope,
  } = useContratosCliente(clienteId);

  const [modalOpen, setModalOpen] = useState(false);

  // KPIs
  const total     = contratos.length;
  const assinados = contratos.filter(c => c.clicksign_status === "assinado" || c.status === "assinado").length;
  const pendentes = contratos.filter(c => c.clicksign_status === "aguardando_assinatura").length;
  const rascunhos = contratos.filter(c => !c.clicksign_status || c.clicksign_status === "nao_enviado" || c.clicksign_status === "rascunho").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> Carregando contratos…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-3">
            <div className="text-center">
              <p className="text-xl font-bold text-foreground">{total}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-600">{assinados}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Assinados</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-xl font-bold text-amber-500">{pendentes}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Aguardando</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-xl font-bold text-zinc-400">{rascunhos}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Rascunhos</p>
            </div>
          </div>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Novo contrato
        </Button>
      </div>

      {/* Aviso sobre o fluxo */}
      {contratos.some(c => c.clicksign_status === "aguardando_assinatura") && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
          <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-700">
              {pendentes} contrato(s) aguardando assinatura
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              O Clicksign envia lembretes automáticos a cada 3 dias. Use "Renotificar" para envio imediato.
            </p>
          </div>
        </div>
      )}

      {/* Lista de contratos */}
      {contratos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="rounded-full bg-muted/60 p-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhum contrato cadastrado</p>
          <p className="text-xs text-muted-foreground max-w-xs text-center">
            Crie um contrato, preencha o conteúdo e envie para assinatura digital via Clicksign.
          </p>
          <Button size="sm" onClick={() => setModalOpen(true)} className="gap-2 mt-1">
            <Plus className="h-4 w-4" /> Criar primeiro contrato
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {contratos.map(c => (
            <ContratoRow
              key={c.id}
              contrato={c}
              clienteId={clienteId}
              onEnviar={enviarParaAssinatura}
              onReenviar={reenviarNotificacao}
              onCancelar={cancelarEnvelope}
              actionLoading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Rodapé informativo */}
      {contratos.length > 0 && (
        <div className="rounded-xl bg-muted/40 border border-border/40 px-4 py-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary/60 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Assinaturas eletrônicas com validade jurídica — powered by{" "}
            <a href="https://clicksign.com" target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline font-medium">
              Clicksign
            </a>
            . Eventos são registrados em tempo real via webhook.
          </p>
        </div>
      )}

      <ModalNovoContrato
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        clienteId={clienteId}
        onCreate={criar}
      />
    </div>
  );
}

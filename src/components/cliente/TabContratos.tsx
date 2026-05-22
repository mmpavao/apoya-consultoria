/**
 * TabContratos — Contratos com integração Clicksign API v3
 * Fluxo: Rascunho → Enviar → Clicksign (email/WhatsApp) → Assinado
 */
import { useState } from "react";
import {
  Plus, FileText, Pencil, Trash2, Clock, CheckCircle2, AlertTriangle,
  FileSignature, X, ExternalLink, Loader2, Send, RefreshCw,
  Ban, Download, History, Mail, MessageSquare, Info,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useContratosCliente,
  type ContratoCliente, type CanalNotificacao, type NovoContratoPayload,
  STATUS_LABEL, STATUS_TONE,
} from "@/hooks/use-contratos-cliente";

// ── Utilitários ────────────────────────────────────────────────────────────
const fmtBRL  = (v?: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtData = (d?: string) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const fmtDT   = (d?: string) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const STATUS_ICON: Record<string, React.ElementType> = {
  rascunho:              FileText,
  aguardando_assinatura: Clock,
  assinado:              CheckCircle2,
  cancelado:             X,
  expirado:              AlertTriangle,
  recusado:              Ban,
};

const STATUS_CLS: Record<string, string> = {
  rascunho:              "bg-slate-50 text-slate-600 border-slate-200",
  aguardando_assinatura: "bg-amber-50 text-amber-700 border-amber-200",
  assinado:              "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelado:             "bg-red-50 text-red-700 border-red-200",
  expirado:              "bg-orange-50 text-orange-700 border-orange-200",
  recusado:              "bg-rose-50 text-rose-700 border-rose-200",
};

const TIPOS = [
  { value: "mensalidade",       label: "Contrato de Mensalidade" },
  { value: "prestacao_servico", label: "Prestação de Serviços" },
  { value: "abertura_empresa",  label: "Abertura de Empresa" },
  { value: "procuracao",        label: "Procuração" },
  { value: "confidencialidade", label: "NDA / Confidencialidade" },
  { value: "outros",            label: "Outros" },
];

// ── Templates HTML por tipo ────────────────────────────────────────────────
const TEMPLATES: Record<string, string> = {
  mensalidade: `<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS</h2>
<p>Pelo presente instrumento particular, as partes abaixo qualificadas ajustam entre si a prestação de serviços contábeis, nos termos e condições estabelecidos neste contrato.</p>
<h3>1. OBJETO</h3>
<p>A APOYA CONSULTORIA CONTÁBIL obriga-se a prestar os seguintes serviços:</p>
<ul>
<li>Escrituração contábil e fiscal</li>
<li>Apuração e pagamento de impostos</li>
<li>Emissão e gestão de guias DAS/DASMEI</li>
<li>Orientações tributárias e fiscais</li>
</ul>
<h3>2. REMUNERAÇÃO</h3>
<p>Pelos serviços prestados, o CONTRATANTE pagará mensalmente à APOYA o valor estipulado neste contrato, no vencimento acordado.</p>
<h3>3. PRAZO</h3>
<p>O presente contrato vigorará por prazo indeterminado, podendo ser rescindido por qualquer das partes com aviso prévio de 30 dias.</p>
<h3>4. OBRIGAÇÕES DAS PARTES</h3>
<p>O CONTRATANTE compromete-se a fornecer tempestivamente todos os documentos necessários para a realização dos serviços.</p>
<h3>5. FORO</h3>
<p>As partes elegem o Foro da Comarca de Brasília/DF para dirimir quaisquer questões oriundas deste contrato.</p>`,
  abertura_empresa: `<h2>CONTRATO DE ABERTURA DE EMPRESA</h2>
<p>Contrato para prestação de serviços de abertura e regularização de empresa junto aos órgãos competentes.</p>
<h3>1. OBJETO</h3><p>Abertura de empresa (CNPJ, Inscrição Estadual, Alvará de Funcionamento).</p>
<h3>2. PRAZO</h3><p>Estimado em 30 a 60 dias úteis, sujeito a prazos dos órgãos públicos.</p>
<h3>3. HONORÁRIOS</h3><p>Conforme proposta apresentada e aceita pelo contratante.</p>`,
};

// ── Modal Criar/Editar ─────────────────────────────────────────────────────
function ModalContrato({
  clienteId, contrato, clienteEmail, clienteWhatsapp, clienteNome, onClose,
}: {
  clienteId:      string;
  contrato?:      ContratoCliente;
  clienteEmail?:  string;
  clienteWhatsapp?: string;
  clienteNome?:   string;
  onClose: () => void;
}) {
  const { criar, atualizar } = useContratosCliente(clienteId);
  const [form, setForm] = useState<NovoContratoPayload>({
    titulo:              contrato?.titulo      ?? "",
    tipo:                contrato?.tipo        ?? "mensalidade",
    valor_total:         contrato?.valor_total ?? 0,
    data_inicio:         contrato?.data_inicio ?? new Date().toISOString().slice(0, 10),
    data_fim:            contrato?.data_fim    ?? "",
    corpo_html:          contrato?.corpo_html  ?? TEMPLATES.mensalidade,
    observacoes:         contrato?.observacoes ?? "",
    signatario_nome:     contrato?.signatario_nome    ?? clienteNome    ?? "",
    signatario_email:    contrato?.signatario_email   ?? clienteEmail   ?? "",
    signatario_whatsapp: contrato?.signatario_whatsapp ?? clienteWhatsapp ?? "",
    notificacao_canal:   contrato?.notificacao_canal  ?? "email",
    deadline_days:       contrato?.deadline_days      ?? 30,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof NovoContratoPayload, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleTipo = (t: string) => {
    set("tipo", t);
    if (!contrato && TEMPLATES[t]) set("corpo_html", TEMPLATES[t]);
  };

  const handleSave = async () => {
    if (!form.titulo) return;
    setSaving(true);
    try {
      if (contrato) {
        await atualizar(contrato.id, form);
      } else {
        await criar(clienteId, form);
      }
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contrato ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Linha 1: Título + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input value={form.titulo} onChange={e => set("titulo", e.target.value)} placeholder="Contrato de Mensalidade" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={handleTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Linha 2: Valor + Datas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" value={form.valor_total} onChange={e => set("valor_total", Number(e.target.value))} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => set("data_inicio", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fim (opcional)</Label>
              <Input type="date" value={form.data_fim} onChange={e => set("data_fim", e.target.value)} />
            </div>
          </div>

          {/* Corpo HTML */}
          <div className="space-y-1.5">
            <Label>Corpo do Contrato (HTML)</Label>
            <Textarea
              value={form.corpo_html}
              onChange={e => set("corpo_html", e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder="<h2>Título</h2><p>Corpo...</p>"
            />
          </div>

          {/* Seção Assinatura Digital */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <FileSignature className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm text-primary">Assinatura Digital — Clicksign</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome do Signatário</Label>
                <Input value={form.signatario_nome} onChange={e => set("signatario_nome", e.target.value)} placeholder={clienteNome || "Nome completo"} />
              </div>
              <div className="space-y-1.5">
                <Label>Canal de Notificação</Label>
                <Select value={form.notificacao_canal} onValueChange={v => set("notificacao_canal", v as CanalNotificacao)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email"><span className="flex items-center gap-2"><Mail className="h-3.5 w-3.5"/>E-mail</span></SelectItem>
                    <SelectItem value="whatsapp"><span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5"/>WhatsApp</span></SelectItem>
                    <SelectItem value="both"><span className="flex items-center gap-2"><Send className="h-3.5 w-3.5"/>E-mail + WhatsApp</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>E-mail do Signatário</Label>
                <Input type="email" value={form.signatario_email} onChange={e => set("signatario_email", e.target.value)} placeholder={clienteEmail || "email@empresa.com"} />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp do Signatário</Label>
                <Input value={form.signatario_whatsapp} onChange={e => set("signatario_whatsapp", e.target.value)} placeholder={clienteWhatsapp || "(61) 99999-9999"} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Prazo para assinar (dias)</Label>
              <Input type="number" value={form.deadline_days} onChange={e => set("deadline_days", Number(e.target.value))} min={1} max={365} className="w-32" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.titulo}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {contrato ? "Salvar" : "Criar Contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Card de contrato ───────────────────────────────────────────────────────
function ContratoCard({
  contrato, clienteId,
}: { contrato: ContratoCliente; clienteId: string }) {
  const { excluir, enviarParaAssinatura, reenviarNotificacao, cancelarEnvelope, actionLoading } =
    useContratosCliente(clienteId);
  const [editOpen,    setEditOpen]    = useState(false);
  const [histOpen,    setHistOpen]    = useState(false);
  const [confirmCanc, setConfirmCanc] = useState(false);

  const StatusIcon = STATUS_ICON[contrato.status] || FileText;
  const statusCls  = STATUS_CLS[contrato.status]  || STATUS_CLS.rascunho;
  const statusLbl  = STATUS_LABEL[contrato.status] || contrato.status;

  const isSending  = actionLoading === contrato.id;
  const isResend   = actionLoading === contrato.id + "_resend";
  const isCanceling= actionLoading === contrato.id + "_cancel";

  const canSend   = contrato.status === "rascunho" || contrato.status === "recusado";
  const canResend = contrato.status === "aguardando_assinatura";
  const canCancel = contrato.status === "aguardando_assinatura";
  const canEdit   = contrato.status === "rascunho";
  const canDelete = contrato.status === "rascunho" || contrato.status === "cancelado";

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm hover:shadow-md transition-all">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{contrato.numero}</span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusCls}`}>
                <StatusIcon className="h-3 w-3" />
                {statusLbl}
              </span>
            </div>
            <p className="font-semibold text-sm mt-1 truncate">{contrato.titulo}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {TIPOS.find(t => t.value === contrato.tipo)?.label || contrato.tipo}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-base text-foreground">{fmtBRL(contrato.valor_total)}</p>
            <p className="text-[11px] text-muted-foreground">{fmtData(contrato.data_inicio)}</p>
          </div>
        </div>

        {/* Info Clicksign — quando enviado */}
        {contrato.status !== "rascunho" && (
          <div className="mb-3 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-xs">
            {contrato.signatario_nome && (
              <div className="flex items-center gap-2">
                <FileSignature className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Signatário:</span>
                <span className="font-medium">{contrato.signatario_nome}</span>
              </div>
            )}
            {contrato.signatario_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{contrato.signatario_email}</span>
              </div>
            )}
            {contrato.signatario_whatsapp && (
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{contrato.signatario_whatsapp}</span>
              </div>
            )}
            {contrato.enviado_em && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Enviado em {fmtDT(contrato.enviado_em)}</span>
              </div>
            )}
            {contrato.assinado_em && (
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="font-medium">Assinado em {fmtDT(contrato.assinado_em)}</span>
              </div>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Enviar para assinatura */}
          {canSend && (
            <Button size="sm" onClick={() => enviarParaAssinatura(contrato.id)} disabled={isSending} className="gap-1.5">
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {isSending ? "Enviando…" : "Enviar para assinar"}
            </Button>
          )}

          {/* Link de assinatura */}
          {contrato.clicksign_sign_url && contrato.status === "aguardando_assinatura" && (
            <a href={contrato.clicksign_sign_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30">
                <ExternalLink className="h-3.5 w-3.5" />Link de assinatura
              </Button>
            </a>
          )}

          {/* Reenviar notificação */}
          {canResend && (
            <Button size="sm" variant="outline" onClick={() => reenviarNotificacao(contrato.id)} disabled={isResend} className="gap-1.5">
              {isResend ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Reenviar
            </Button>
          )}

          {/* Download PDF assinado */}
          {contrato.clicksign_signed_pdf && (
            <a href={contrato.clicksign_signed_pdf} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="gap-1.5 text-emerald-600">
                <Download className="h-3.5 w-3.5" />PDF assinado
              </Button>
            </a>
          )}

          {/* Histórico */}
          {(contrato.clicksign_events?.length > 0) && (
            <Button size="sm" variant="ghost" onClick={() => setHistOpen(true)} className="gap-1.5 text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              {contrato.clicksign_events.length}
            </Button>
          )}

          <div className="flex-1" />

          {/* Editar */}
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Cancelar Clicksign */}
          {canCancel && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
              onClick={() => setConfirmCanc(true)} disabled={isCanceling}>
              {isCanceling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
            </Button>
          )}

          {/* Excluir */}
          {canDelete && (
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
              onClick={() => excluir(contrato.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Modal Editar */}
      {editOpen && (
        <ModalContrato clienteId={clienteId} contrato={contrato} onClose={() => setEditOpen(false)} />
      )}

      {/* Modal Histórico de eventos */}
      {histOpen && (
        <Dialog open onOpenChange={() => setHistOpen(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />Histórico — {contrato.numero}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-80 overflow-y-auto py-2">
              {[...(contrato.clicksign_events || [])].reverse().map((ev, i) => (
                <div key={i} className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium capitalize">{ev.event.replace(/_/g, " ")}</p>
                    {ev.signatario && <p className="text-xs text-muted-foreground">{ev.signatario}</p>}
                    <p className="text-[11px] text-muted-foreground">{fmtDT(ev.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm cancelar */}
      {confirmCanc && (
        <Dialog open onOpenChange={() => setConfirmCanc(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Cancelar envelope?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              O envelope será cancelado no Clicksign e o link de assinatura ficará inválido. 
              Você poderá criar um novo contrato para reenviar.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmCanc(false)}>Voltar</Button>
              <Button variant="destructive" onClick={async () => {
                await cancelarEnvelope(contrato.id);
                setConfirmCanc(false);
              }}>
                Sim, cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export function TabContratos({
  clienteId, clienteEmail, clienteWhatsapp, clienteNome,
}: {
  clienteId:       string;
  clienteEmail?:   string;
  clienteWhatsapp?: string;
  clienteNome?:    string;
}) {
  const { contratos, loading } = useContratosCliente(clienteId);
  const [novoOpen, setNovoOpen] = useState(false);

  const rascunhos  = contratos.filter(c => c.status === "rascunho");
  const pendentes  = contratos.filter(c => c.status === "aguardando_assinatura");
  const assinados  = contratos.filter(c => c.status === "assinado");
  const outros     = contratos.filter(c => !["rascunho","aguardando_assinatura","assinado"].includes(c.status));

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />Carregando contratos…
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Contratos</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {contratos.length} contrato{contratos.length !== 1 ? "s" : ""} — assinatura via Clicksign
          </p>
        </div>
        <Button size="sm" onClick={() => setNovoOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />Novo Contrato
        </Button>
      </div>

      {/* KPIs rápidos */}
      {contratos.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Rascunhos",        value: rascunhos.length,  cls: "text-slate-600" },
            { label: "Aguard. assinatura", value: pendentes.length, cls: "text-amber-600" },
            { label: "Assinados",         value: assinados.length, cls: "text-emerald-600" },
            { label: "Outros",            value: outros.length,    cls: "text-muted-foreground" },
          ].map(k => (
            <div key={k.label} className="rounded-lg border bg-white p-3 text-center">
              <p className={`text-xl font-bold ${k.cls}`}>{k.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lista de contratos */}
      {contratos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSignature className="h-10 w-10 mb-3 text-muted-foreground/40" />
          <p className="font-medium text-muted-foreground">Nenhum contrato ainda</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
            Crie um contrato e envie para assinatura digital via Clicksign
          </p>
          <Button size="sm" onClick={() => setNovoOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />Criar primeiro contrato
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {contratos.map(c => (
            <ContratoCard key={c.id} contrato={c} clienteId={clienteId} />
          ))}
        </div>
      )}

      {/* Modal novo contrato */}
      {novoOpen && (
        <ModalContrato
          clienteId={clienteId}
          clienteEmail={clienteEmail}
          clienteWhatsapp={clienteWhatsapp}
          clienteNome={clienteNome}
          onClose={() => setNovoOpen(false)}
        />
      )}
    </div>
  );
}

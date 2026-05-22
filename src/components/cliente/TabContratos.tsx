/**
 * TabContratos — Contratos de prestação de serviços por cliente
 */
import { useState } from "react";
import {
  Plus, FileText, Pencil, Trash2, Clock, CheckCircle2, AlertTriangle,
  FileSignature, X, ExternalLink, Loader2, FilePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useContratosCliente, type ContratoCliente } from "@/hooks/use-contratos-cliente";

const fmtBRL = (v?: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtData = (d?: string) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  rascunho:              { label: "Rascunho",             cls: "bg-slate-50 text-slate-500 border-slate-200",       icon: FileText },
  aguardando_assinatura: { label: "Aguard. assinatura",   cls: "bg-amber-50 text-amber-700 border-amber-200",       icon: Clock },
  ativo:                 { label: "Ativo",                cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  encerrado:             { label: "Encerrado",            cls: "bg-blue-50 text-blue-700 border-blue-200",          icon: FileSignature },
  cancelado:             { label: "Cancelado",            cls: "bg-red-50 text-red-700 border-red-200",             icon: X },
};

/* ── Modal criar/editar ─────────────────────────────────────────────────── */
function ModalContrato({
  clienteId, contrato, onClose,
}: { clienteId: string; contrato?: ContratoCliente; onClose: () => void }) {
  const { criar, atualizar } = useContratosCliente(clienteId);
  const [form, setForm] = useState({
    titulo: contrato?.titulo ?? "",
    tipo: (contrato?.tipo ?? "mensalidade") as ContratoCliente["tipo"],
    status: (contrato?.status ?? "rascunho") as ContratoCliente["status"],
    valor_total: String(contrato?.valor_total ?? ""),
    data_inicio: contrato?.data_inicio ?? new Date().toISOString().slice(0, 10),
    data_fim: contrato?.data_fim ?? "",
    observacoes: contrato?.observacoes ?? "",
    corpo_html: contrato?.corpo_html ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.titulo) return;
    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo,
        tipo: form.tipo,
        status: form.status,
        valor_total: Number(form.valor_total ?? 0),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || undefined,
        observacoes: form.observacoes || undefined,
        corpo_html: form.corpo_html || undefined,
      };
      if (contrato) await atualizar(contrato.id, payload);
      else await criar(payload);
      onClose();
    } catch { } finally { setSaving(false); }
  };

  const TIPO_TEMPLATE: Record<string, string> = {
    mensalidade: `<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS</h2>
<p>Por este instrumento particular, as partes abaixo identificadas celebram o presente Contrato de Prestação de Serviços Contábeis, nas condições estabelecidas nas cláusulas seguintes.</p>
<h3>CLÁUSULA 1ª – DO OBJETO</h3>
<p>A APOYA CONTABILIDADE obriga-se a prestar serviços de contabilidade ao CONTRATANTE, incluindo escrituração fiscal, apuração de impostos e cumprimento de obrigações acessórias.</p>
<h3>CLÁUSULA 2ª – DO VALOR E FORMA DE PAGAMENTO</h3>
<p>O valor mensal acordado é de R$ [VALOR], a ser pago até o dia [DIA] de cada mês, via [FORMA].</p>
<h3>CLÁUSULA 3ª – DO PRAZO</h3>
<p>O presente contrato vigorará por prazo indeterminado, podendo ser rescindido por qualquer das partes com aviso prévio de 30 dias.</p>`,
    avulso: `<h2>CONTRATO DE SERVIÇO AVULSO</h2>
<p>Contrato de prestação de serviço específico, sem vínculo de continuidade.</p>
<h3>CLÁUSULA 1ª – DO OBJETO</h3>
<p>A APOYA obriga-se a realizar o serviço de [SERVIÇO] para o CONTRATANTE.</p>
<h3>CLÁUSULA 2ª – DO VALOR</h3>
<p>Valor total: R$ [VALOR], pago conforme acordado.</p>`,
    anual: `<h2>CONTRATO ANUAL DE ASSESSORIA CONTÁBIL</h2>
<p>Contrato de prestação de serviços contábeis pelo período de 12 meses.</p>
<h3>CLÁUSULA 1ª – DO OBJETO</h3>
<p>Serviços contábeis anuais incluindo: planejamento tributário, declarações anuais e assessoria fiscal.</p>
<h3>CLÁUSULA 2ª – DO VALOR</h3>
<p>Valor anual: R$ [VALOR], podendo ser parcelado em 12 mensalidades.</p>`,
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus className="h-4 w-4" />
            {contrato ? "Editar Contrato" : "Novo Contrato"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Título do contrato *</Label>
            <Input value={form.titulo} onChange={e => setForm(p=>({...p,titulo:e.target.value}))} placeholder="Ex: Contrato de Honorários Mensais — Simples Nacional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v: any) => {
                setForm(p => ({ ...p, tipo: v, corpo_html: p.corpo_html || TIPO_TEMPLATE[v] || "" }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensalidade">Mensalidade</SelectItem>
                  <SelectItem value="avulso">Avulso</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm(p=>({...p,status:v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="aguardando_assinatura">Aguardando assinatura</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input type="number" value={form.valor_total} onChange={e => setForm(p=>({...p,valor_total:e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio} onChange={e => setForm(p=>({...p,data_inicio:e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label>Término (opcional)</Label>
              <Input type="date" value={form.data_fim} onChange={e => setForm(p=>({...p,data_fim:e.target.value}))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Corpo do contrato (HTML)</Label>
              {!form.corpo_html && (
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setForm(p => ({ ...p, corpo_html: TIPO_TEMPLATE[p.tipo] || "" }))}>
                  Usar template padrão
                </Button>
              )}
            </div>
            <Textarea
              value={form.corpo_html}
              onChange={e => setForm(p=>({...p,corpo_html:e.target.value}))}
              rows={8}
              className="font-mono text-xs"
              placeholder="Conteúdo HTML do contrato…"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações internas</Label>
            <Input value={form.observacoes} onChange={e => setForm(p=>({...p,observacoes:e.target.value}))} placeholder="Notas internas (não aparece no contrato)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.titulo}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Salvando…</> : contrato ? "Salvar alterações" : "Criar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Card de contrato ───────────────────────────────────────────────────── */
function ContratoCard({ c, clienteId }: { c: ContratoCliente; clienteId: string }) {
  const { excluir, atualizarStatus } = useContratosCliente(clienteId);
  const [editing, setEditing] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const cfg = STATUS_CFG[c.status] ?? STATUS_CFG.rascunho;
  const Icon = cfg.icon;

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-background shadow-sm">
      <div className="flex items-start gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {c.numero && <span className="text-xs text-muted-foreground font-mono">{c.numero}</span>}
            <span className="font-semibold text-sm truncate">{c.titulo}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${cfg.cls}`}>
              <Icon className="h-3 w-3" />{cfg.label}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="capitalize">{c.tipo}</span>
            <span>·</span>
            <span className="font-semibold text-foreground">{fmtBRL(c.valor_total)}</span>
            <span>·</span>
            <span>Início: {fmtData(c.data_inicio)}</span>
            {c.data_fim && <><span>·</span><span>Término: {fmtData(c.data_fim)}</span></>}
          </div>
          {c.clicksign_url && (
            <a href={c.clicksign_url} target="_blank" rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />Abrir no Clicksign
            </a>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {c.status === "rascunho" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-amber-600 hover:text-amber-700"
              onClick={() => atualizarStatus(c.id, "aguardando_assinatura")}>
              <Clock className="h-3 w-3 mr-1" />Enviar p/ assinatura
            </Button>
          )}
          {c.status === "aguardando_assinatura" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600"
              onClick={() => atualizarStatus(c.id, "ativo")}>
              <CheckCircle2 className="h-3 w-3 mr-1" />Marcar assinado
            </Button>
          )}
          {c.corpo_html && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowHtml(s => !s)}>
              <FileText className="h-3 w-3 mr-1" />{showHtml ? "Fechar" : "Ver"}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={() => excluir(c.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Preview HTML do contrato */}
      {showHtml && c.corpo_html && (
        <div className="border-t border-border/50 p-5">
          <div
            className="prose prose-sm max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: c.corpo_html }}
          />
          <p className="mt-4 text-xs text-muted-foreground italic flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Integração Clicksign será habilitada em breve para assinaturas digitais.
          </p>
        </div>
      )}

      {editing && <ModalContrato clienteId={clienteId} contrato={c} onClose={() => setEditing(false)} />}
    </div>
  );
}

/* ── Export principal ───────────────────────────────────────────────────── */
export function TabContratos({ clienteId }: { clienteId: string }) {
  const { contratos, loading } = useContratosCliente(clienteId);
  const [showNovo, setShowNovo] = useState(false);

  const totalAtivo    = contratos.filter(c => c.status === "ativo").length;
  const valorTotal    = contratos.filter(c => c.status === "ativo").reduce((a, c) => a + (c.valor_total ?? 0), 0);
  const aguardando    = contratos.filter(c => c.status === "aguardando_assinatura").length;

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total de contratos", value: String(contratos.length), tone: "text-foreground" },
          { label: "Contratos ativos", value: String(totalAtivo), tone: "text-emerald-600" },
          { label: "Aguard. assinatura", value: String(aguardando), tone: aguardando > 0 ? "text-amber-600" : "text-muted-foreground" },
          { label: "Valor em contratos ativos", value: fmtBRL(valorTotal), tone: "text-primary" },
        ].map(k => (
          <div key={k.label} className="surface-card p-4 rounded-xl">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-xl font-bold tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Aviso Clicksign */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Integração Clicksign em breve</p>
          <p className="text-xs text-amber-700 mt-0.5">Quando a API do Clicksign for integrada, você poderá enviar contratos para assinatura digital diretamente desta tela. Por enquanto, gerencie o status manualmente.</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Contratos de Prestação de Serviços</h3>
          <p className="text-xs text-muted-foreground">{contratos.length} contrato(s)</p>
        </div>
        <Button size="sm" onClick={() => setShowNovo(true)}>
          <Plus className="h-4 w-4 mr-2" />Novo Contrato
        </Button>
      </div>

      {contratos.length === 0 ? (
        <div className="surface-card rounded-xl p-10 text-center text-muted-foreground">
          <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum contrato cadastrado</p>
          <p className="text-xs mt-1">Crie o primeiro contrato para este cliente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contratos.map(c => <ContratoCard key={c.id} c={c} clienteId={clienteId} />)}
        </div>
      )}

      {showNovo && <ModalContrato clienteId={clienteId} onClose={() => setShowNovo(false)} />}
    </div>
  );
}

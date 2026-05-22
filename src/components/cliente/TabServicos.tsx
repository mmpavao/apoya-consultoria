/**
 * TabServicos — Serviços contratados + pagamentos do cliente
 */
import { useState } from "react";
import {
  Plus, Package, CreditCard, Clock, CheckCircle2, AlertTriangle,
  Ban, ChevronDown, ChevronUp, Receipt, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useClienteServicos, useServicoCatalogo, type ClienteServico, type ServicoPagamento } from "@/hooks/use-servicos";

const fmtBRL = (v?: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtData = (d?: string) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const STATUS_SERVICO: Record<string, { label: string; cls: string }> = {
  ativo:     { label: "Ativo",     cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  suspenso:  { label: "Suspenso",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  encerrado: { label: "Encerrado", cls: "bg-slate-50 text-slate-500 border-slate-200" },
  cancelado: { label: "Cancelado", cls: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_PG: Record<string, { label: string; cls: string; Icon: any }> = {
  pendente:  { label: "Pendente",  cls: "bg-amber-50 text-amber-700 border-amber-200",         Icon: Clock },
  pago:      { label: "Pago",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",   Icon: CheckCircle2 },
  atrasado:  { label: "Atrasado",  cls: "bg-red-50 text-red-700 border-red-200",               Icon: AlertTriangle },
  cancelado: { label: "Cancelado", cls: "bg-slate-50 text-slate-500 border-slate-200",         Icon: Ban },
};

/* ── Modal Contratar ────────────────────────────────────────────────────── */
function ModalContratar({ clienteId, onClose }: { clienteId: string; onClose: () => void }) {
  const { servicos: cat } = useServicoCatalogo();
  const { contratar } = useClienteServicos(clienteId);
  const [form, setForm] = useState({
    catalogo_id: "", valor_contratado: "", desconto: "0",
    periodicidade: "mensal" as "mensal"|"anual"|"avulso",
    data_inicio: new Date().toISOString().slice(0, 10), observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const sel = cat.find(s => s.id === form.catalogo_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" />Contratar Serviço</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Serviço *</Label>
            <Select value={form.catalogo_id} onValueChange={id => {
              const s = cat.find(c => c.id === id);
              setForm(p => ({ ...p, catalogo_id: id, valor_contratado: String(s?.valor_padrao ?? ""), periodicidade: (s?.unidade === "hora" ? "avulso" : s?.unidade ?? "mensal") as any }));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {cat.filter(s => s.ativo).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.nome} — {fmtBRL(s.valor_padrao)}/{s.unidade}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sel?.descricao && <p className="text-xs text-muted-foreground">{sel.descricao}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input type="number" value={form.valor_contratado} onChange={e => setForm(p => ({ ...p, valor_contratado: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Desconto (R$)</Label><Input type="number" value={form.desconto} onChange={e => setForm(p => ({ ...p, desconto: e.target.value }))} /></div>
          </div>
          {form.valor_contratado && <p className="text-sm font-semibold text-primary">Valor final: {fmtBRL(Number(form.valor_contratado) - Number(form.desconto ?? 0))}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Periodicidade</Label>
              <Select value={form.periodicidade} onValueChange={(v: any) => setForm(p => ({ ...p, periodicidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="avulso">Avulso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={e => setForm(p => ({ ...p, data_inicio: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label>Observações</Label><Input value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Opcional…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.catalogo_id || !form.valor_contratado} onClick={async () => {
            setSaving(true);
            try { await contratar({ catalogo_id: form.catalogo_id, nome_servico: sel?.nome ?? "", valor_contratado: Number(form.valor_contratado), desconto: Number(form.desconto ?? 0), periodicidade: form.periodicidade, data_inicio: form.data_inicio, observacoes: form.observacoes || undefined }); onClose(); }
            catch { } finally { setSaving(false); }
          }}>{saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Contratando…</> : "Contratar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Modal Pagamento ────────────────────────────────────────────────────── */
function ModalPagamento({ clienteId, servicoId, onClose }: { clienteId: string; servicoId: string; onClose: () => void }) {
  const { registrarPagamento } = useClienteServicos(clienteId);
  const hoje = new Date();
  const [form, setForm] = useState({
    competencia: `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`,
    valor: "", data_vencimento: hoje.toISOString().slice(0,10),
    data_pagamento: "", status: "pendente" as ServicoPagamento["status"],
    forma_pagamento: "pix", observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-4 w-4" />Registrar Pagamento</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Competência</Label><Input value={form.competencia} onChange={e => setForm(p=>({...p,competencia:e.target.value}))} placeholder="2026-05" /></div>
            <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input type="number" value={form.valor} onChange={e => setForm(p=>({...p,valor:e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={form.data_vencimento} onChange={e => setForm(p=>({...p,data_vencimento:e.target.value}))} /></div>
            <div className="space-y-1.5"><Label>Pago em</Label><Input type="date" value={form.data_pagamento} onChange={e => setForm(p=>({...p,data_pagamento:e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v:any) => setForm(p=>({...p,status:v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Forma</Label>
              <Select value={form.forma_pagamento} onValueChange={(v:any) => setForm(p=>({...p,forma_pagamento:v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="ted">TED</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.valor} onClick={async () => {
            setSaving(true);
            try { await registrarPagamento({ cliente_servico_id: servicoId, competencia: form.competencia, valor: Number(form.valor), data_vencimento: form.data_vencimento, data_pagamento: form.data_pagamento || undefined, status: form.status, forma_pagamento: form.forma_pagamento, observacoes: form.observacoes || undefined }); onClose(); }
            catch { } finally { setSaving(false); }
          }}>{saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Salvando…</> : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Cartão de serviço ──────────────────────────────────────────────────── */
function ServicoCard({ sv, pagamentos, clienteId }: { sv: ClienteServico; pagamentos: ServicoPagamento[]; clienteId: string }) {
  const [open, setOpen] = useState(false);
  const [pgModal, setPgModal] = useState(false);
  const { encerrarServico } = useClienteServicos(clienteId);
  const cfg = STATUS_SERVICO[sv.status] ?? STATUS_SERVICO.ativo;
  const pgs = pagamentos.filter(p => p.cliente_servico_id === sv.id);

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-background shadow-sm">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setOpen(o=>!o)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{sv.nome_servico}</span>
            <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full border ${cfg.cls}`}>{cfg.label}</span>
            <span className="text-xs text-muted-foreground capitalize">{sv.periodicidade}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Desde {fmtData(sv.data_inicio)}</span>
            <span className="font-semibold text-foreground">{fmtBRL(sv.valor_final)}</span>
            {sv.desconto > 0 && <span className="line-through">{fmtBRL(sv.valor_contratado)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={e=>{e.stopPropagation();setPgModal(true);}}>
            <Receipt className="h-3 w-3 mr-1" />Pgto
          </Button>
          {sv.status === "ativo" && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={e=>{e.stopPropagation();encerrarServico(sv.id,"encerrado");}}>
              <Ban className="h-3 w-3 mr-1" />Encerrar
            </Button>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pagamentos ({pgs.length})</p>
          {pgs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum pagamento registrado.</p>
          ) : (
            <table className="ft-table w-full text-xs">
              <thead><tr><th>Competência</th><th>Vencimento</th><th>Pago em</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {pgs.map(pg => {
                  const pc = STATUS_PG[pg.status] ?? STATUS_PG.pendente;
                  return (
                    <tr key={pg.id}>
                      <td>{pg.competencia}</td>
                      <td>{fmtData(pg.data_vencimento)}</td>
                      <td>{fmtData(pg.data_pagamento)}</td>
                      <td className="font-semibold">{fmtBRL(pg.valor)}</td>
                      <td><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] font-medium ${pc.cls}`}><pc.Icon className="h-3 w-3" />{pc.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
      {pgModal && <ModalPagamento clienteId={clienteId} servicoId={sv.id} onClose={() => setPgModal(false)} />}
    </div>
  );
}

/* ── Export principal ───────────────────────────────────────────────────── */
export function TabServicos({ clienteId }: { clienteId: string }) {
  const { servicos, pagamentos, loading } = useClienteServicos(clienteId);
  const [showContratar, setShowContratar] = useState(false);

  const totalMensal   = servicos.filter(s=>s.status==="ativo"&&s.periodicidade==="mensal").reduce((a,s)=>a+(s.valor_final??0),0);
  const totalPago     = pagamentos.filter(p=>p.status==="pago").reduce((a,p)=>a+p.valor,0);
  const totalPendente = pagamentos.filter(p=>["pendente","atrasado"].includes(p.status)).reduce((a,p)=>a+p.valor,0);
  const totalAtrasado = pagamentos.filter(p=>p.status==="atrasado").reduce((a,p)=>a+p.valor,0);

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Mensalidade ativa", value: fmtBRL(totalMensal), tone: "text-primary" },
          { label: "Total pago", value: fmtBRL(totalPago), tone: "text-emerald-600" },
          { label: "Em aberto", value: fmtBRL(totalPendente), tone: "text-amber-600" },
          { label: "Atrasado", value: fmtBRL(totalAtrasado), tone: totalAtrasado>0?"text-red-600":"text-muted-foreground" },
        ].map(k => (
          <div key={k.label} className="surface-card p-4 rounded-xl">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-xl font-bold tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Serviços Contratados</h3>
          <p className="text-xs text-muted-foreground">{servicos.length} serviço(s) · {servicos.filter(s=>s.status==="ativo").length} ativo(s)</p>
        </div>
        <Button size="sm" onClick={() => setShowContratar(true)}><Plus className="h-4 w-4 mr-2" />Contratar Serviço</Button>
      </div>

      {servicos.length === 0 ? (
        <div className="surface-card rounded-xl p-10 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhum serviço contratado</p>
          <p className="text-xs mt-1">Clique em "Contratar Serviço" para adicionar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {servicos.map(sv => <ServicoCard key={sv.id} sv={sv} pagamentos={pagamentos} clienteId={clienteId} />)}
        </div>
      )}

      {pagamentos.length > 0 && (
        <div className="surface-card p-5 rounded-xl space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="h-4 w-4" />Últimos 20 Pagamentos</h3>
          <Separator />
          <table className="ft-table w-full text-xs">
            <thead><tr><th>Serviço</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
            <tbody>
              {pagamentos.slice(0,20).map(pg => {
                const pc = STATUS_PG[pg.status] ?? STATUS_PG.pendente;
                return (
                  <tr key={pg.id}>
                    <td className="max-w-[150px] truncate">{(pg.cliente_servico as any)?.nome_servico ?? "—"}</td>
                    <td>{pg.competencia}</td>
                    <td>{fmtData(pg.data_vencimento)}</td>
                    <td className="font-semibold">{fmtBRL(pg.valor)}</td>
                    <td><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[11px] font-medium ${pc.cls}`}><pc.Icon className="h-3 w-3" />{pc.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showContratar && <ModalContratar clienteId={clienteId} onClose={() => setShowContratar(false)} />}
    </div>
  );
}

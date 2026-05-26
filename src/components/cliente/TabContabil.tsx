/**
 * TabContabil — Contabilidade
 * Sub-abas: Período | Lançamentos | Balancete | Conciliação Bancária
 * Escopo: Simples Nacional apenas — banco já existe, apenas interface
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, AlertTriangle, Plus, Lock, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  useLancamentos,
  usePlanoContas,
  usePeriodosContabeis,
  useAbrirPeriodo,
  useFecharPeriodo,
  useExtratosBancarios,
} from "@/hooks/use-contabil";
import { supabase } from "@/integrations/supabase/client";

// ─── Utils ────────────────────────────────────────────────────────────────────

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaLabel(c: string) {
  const [ano, mes] = c.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(mes, 10) - 1]}/${ano}`;
}

function formatMoeda(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function gerarCompetencias(n = 12): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

// ─── Sub-aba: Período ─────────────────────────────────────────────────────────

function SubAbaPeriodo({ clienteId }: { clienteId: string }) {
  const competencia = mesAtual();
  const { periodos, loading, refresh } = usePeriodosContabeis(clienteId);
  const { abrirPeriodo, loading: abrindo } = useAbrirPeriodo();
  const { fecharPeriodo, loading: fechando } = useFecharPeriodo();
  const [confirmFechar, setConfirmFechar] = useState(false);
  const { lancamentos } = useLancamentos(clienteId, competencia);
  const { extratos } = useExtratosBancarios(clienteId, competencia);

  const periodoAtual = periodos.find(p => p.mes_referencia === competencia);

  // Checklist de fechamento
  const nfEntrada   = lancamentos.filter(l => l.tipo === "nf_entrada").length > 0;
  const nfSaida     = lancamentos.filter(l => l.tipo === "nf_saida").length > 0;
  const conciliacao = extratos.length > 0 && extratos.every(e => e.conciliado);
  const balancete   = lancamentos.length > 0;

  const checklist = [
    { label: "NF-e de entrada escrituradas",  ok: nfEntrada },
    { label: "NF-e de saída escrituradas",    ok: nfSaida },
    { label: "Conciliação bancária 100%",     ok: conciliacao },
    { label: "Lançamentos no balancete",      ok: balancete },
    { label: "Balancete equilibrado",         ok: balancete },
  ];
  const checklistOk = checklist.every(c => c.ok);

  const handleAbrirPeriodo = async () => {
    const ok = await abrirPeriodo(clienteId, competencia);
    if (ok) refresh();
  };

  const handleFecharPeriodo = async () => {
    if (!periodoAtual) return;
    const ok = await fecharPeriodo(periodoAtual.id);
    if (ok) { refresh(); setConfirmFechar(false); }
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Período atual */}
      <div className="surface-card rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Período: {competenciaLabel(competencia)}</h3>
          {periodoAtual ? (
            <Badge variant={periodoAtual.status === "fechado" ? "default" : "secondary"}>
              {periodoAtual.status === "fechado" ? "Fechado" : "Aberto"}
            </Badge>
          ) : (
            <Badge variant="outline">Não iniciado</Badge>
          )}
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Checklist de Fechamento</p>
          {checklist.map(item => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              {item.ok
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
              <span className={item.ok ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          {!periodoAtual && (
            <Button size="sm" onClick={handleAbrirPeriodo} disabled={abrindo}>
              <Plus className="h-4 w-4 mr-1" /> {abrindo ? "Abrindo..." : "Abrir Período"}
            </Button>
          )}
          {periodoAtual?.status === "aberto" && (
            <>
              {!confirmFechar ? (
                <Button size="sm" variant="outline" disabled={!checklistOk} onClick={() => setConfirmFechar(true)}>
                  <Lock className="h-4 w-4 mr-1" /> Fechar Período
                </Button>
              ) : (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <span>Confirmar fechamento?</span>
                  <Button size="sm" variant="destructive" onClick={handleFecharPeriodo} disabled={fechando}>
                    {fechando ? "Fechando..." : "Confirmar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmFechar(false)}>Cancelar</Button>
                </div>
              )}
              {!checklistOk && (
                <p className="text-xs text-muted-foreground self-center">
                  Complete o checklist para fechar o período
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Histórico de períodos */}
      {periodos.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico</p>
          <div className="rounded-md border overflow-hidden">
            <table className="ft-table w-full text-sm">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Status</th>
                  <th>Fechado em</th>
                </tr>
              </thead>
              <tbody>
                {periodos.map(p => (
                  <tr key={p.id}>
                    <td>{competenciaLabel(p.mes_referencia)}</td>
                    <td>
                      <Badge variant={p.status === "fechado" ? "default" : "secondary"} className="text-xs">
                        {p.status === "fechado" ? "Fechado" : "Aberto"}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground">
                      {p.fechado_em
                        ? new Date(p.fechado_em).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-aba: Lançamentos ─────────────────────────────────────────────────────

interface NovoLancamentoDialogProps {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  mesReferencia: string;
  onSuccess: () => void;
}

function NovoLancamentoDialog({ open, onClose, clienteId, mesReferencia, onSuccess }: NovoLancamentoDialogProps) {
  const { contas } = usePlanoContas(clienteId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    data_lancamento: new Date().toISOString().split("T")[0],
    historico: "",
    conta_debito: "",
    conta_credito: "",
    valor: "",
  });

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.historico || !form.conta_debito || !form.conta_credito || !form.valor) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (form.conta_debito === form.conta_credito) {
      toast.error("Conta débito e crédito não podem ser iguais");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("lancamentos_contabeis")
        .insert({
          empresa_id: clienteId,
          mes_referencia: mesReferencia,
          data_lancamento: form.data_lancamento,
          historico: form.historico,
          conta_debito: form.conta_debito,
          conta_credito: form.conta_credito,
          valor: parseFloat(form.valor),
          origem: "manual",
          criado_por: user?.id,
        });
      if (error) throw error;
      toast.success("Lançamento criado com sucesso");
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar lançamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Lançamento — {competenciaLabel(mesReferencia)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={form.data_lancamento} onChange={e => f("data_lancamento", e.target.value)} />
            </div>
            <div>
              <Label>Valor *</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.valor} onChange={e => f("valor", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Histórico *</Label>
            <Input placeholder="Descrição do lançamento" value={form.historico} onChange={e => f("historico", e.target.value)} />
          </div>
          <div>
            <Label>Conta Débito *</Label>
            <Select value={form.conta_debito} onValueChange={v => f("conta_debito", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {contas.map(c => (
                  <SelectItem key={c.id} value={c.codigo}>{c.codigo} — {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conta Crédito *</Label>
            <Select value={form.conta_credito} onValueChange={v => f("conta_credito", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {contas.map(c => (
                  <SelectItem key={c.id} value={c.codigo}>{c.codigo} — {c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Débito deve ser igual ao Crédito (partidas dobradas).</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Lançamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubAbaLancamentos({ clienteId }: { clienteId: string }) {
  const competencias = gerarCompetencias();
  const [mes, setMes] = useState(mesAtual());
  const { lancamentos, loading, totais, refresh } = useLancamentos(clienteId, mes);
  const [showNovo, setShowNovo] = useState(false);
  const [filtroContaP, setFiltroContaP] = useState("");

  const filtered = filtroContaP
    ? lancamentos.filter(l => l.conta_debito.includes(filtroContaP) || l.conta_credito.includes(filtroContaP))
    : lancamentos;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label>Competência:</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {competencias.map(c => <SelectItem key={c} value={c}>{competenciaLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Filtrar por conta..."
            value={filtroContaP}
            onChange={e => setFiltroContaP(e.target.value)}
            className="w-40"
          />
        </div>
        <Button size="sm" onClick={() => setShowNovo(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Lançamento
        </Button>
      </div>

      {/* Totalizador */}
      <div className="flex gap-4 p-3 bg-muted/40 rounded-lg text-sm">
        <span>Débitos: <strong>{formatMoeda(totais.totalDebito)}</strong></span>
        <span>Créditos: <strong>{formatMoeda(totais.totalCredito)}</strong></span>
        <span className={totais.equilibrado ? "text-emerald-600" : "text-red-600"}>
          {totais.equilibrado ? "✅ Equilibrado" : "⚠️ Divergente"}
        </span>
        <span className="text-muted-foreground">{lancamentos.length} lançamentos</span>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="ft-table w-full text-sm">
            <thead>
              <tr>
                <th>Data</th>
                <th>Histórico</th>
                <th>Conta Débito</th>
                <th>Conta Crédito</th>
                <th className="text-right">Valor</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhum lançamento neste período</td></tr>
              )}
              {filtered.map(l => (
                <tr key={l.id}>
                  <td className="text-xs">{new Date(l.data_lancamento + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="max-w-xs truncate">{l.historico}</td>
                  <td className="font-mono text-xs">{l.conta_debito}</td>
                  <td className="font-mono text-xs">{l.conta_credito}</td>
                  <td className="text-right tabular-nums">{formatMoeda(l.valor)}</td>
                  <td>
                    <Badge variant={l.origem === "manual" ? "outline" : "secondary"} className="text-xs">
                      {l.origem === "manual" ? "Manual" : "Agente"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NovoLancamentoDialog
        open={showNovo}
        onClose={() => setShowNovo(false)}
        clienteId={clienteId}
        mesReferencia={mes}
        onSuccess={refresh}
      />
    </div>
  );
}

// ─── Sub-aba: Balancete ───────────────────────────────────────────────────────

function SubAbaBalancete({ clienteId }: { clienteId: string }) {
  const competencias = gerarCompetencias();
  const [mes, setMes] = useState(mesAtual());
  const { lancamentos, loading } = useLancamentos(clienteId, mes);
  const { contas } = usePlanoContas(clienteId);

  // Agrupar por tipo de conta
  const grupos = ["ativo", "passivo", "pl", "receita", "despesa"];
  const grupoLabel: Record<string, string> = {
    ativo: "Ativo", passivo: "Passivo", pl: "Patrimônio Líquido", receita: "Receitas", despesa: "Despesas",
  };

  // Calcular saldo por conta
  const saldos: Record<string, number> = {};
  for (const l of lancamentos) {
    saldos[l.conta_debito]  = (saldos[l.conta_debito]  ?? 0) + l.valor;
    saldos[l.conta_credito] = (saldos[l.conta_credito] ?? 0) - l.valor;
  }

  const totalGeral = Object.values(saldos).reduce((s, v) => s + Math.abs(v), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label>Competência:</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {competencias.map(c => <SelectItem key={c} value={c}>{competenciaLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" /> Exportar PDF
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-4">
          {grupos.map(grupo => {
            const contasGrupo = contas.filter(c => c.tipo === grupo);
            if (contasGrupo.length === 0) return null;

            const totalGrupo = contasGrupo.reduce((s, c) => s + (saldos[c.codigo] ?? 0), 0);

            return (
              <div key={grupo} className="rounded-md border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{grupoLabel[grupo]}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatMoeda(totalGrupo)}</span>
                </div>
                <table className="ft-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Conta</th>
                      <th className="text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contasGrupo.map(c => (
                      <tr key={c.id}>
                        <td className="font-mono text-xs">{c.codigo}</td>
                        <td>{c.nome}</td>
                        <td className={`text-right tabular-nums ${(saldos[c.codigo] ?? 0) < 0 ? "text-red-600" : ""}`}>
                          {formatMoeda(saldos[c.codigo] ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="flex justify-between p-3 bg-muted rounded-lg font-semibold text-sm">
            <span>Total Geral</span>
            <span className="tabular-nums">{formatMoeda(totalGeral)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-aba: Conciliação Bancária ────────────────────────────────────────────

function SubAbaConciliacao({ clienteId }: { clienteId: string }) {
  const competencias = gerarCompetencias();
  const [mes, setMes] = useState(mesAtual());
  const { extratos, loading, conciliados, pendentes, refresh } = useExtratosBancarios(clienteId, mes);
  const { lancamentos } = useLancamentos(clienteId, mes);

  const totalBanco     = extratos.reduce((s, e) => s + (e.tipo === "credito" ? e.valor : -e.valor), 0);
  const totalContabil  = lancamentos.reduce((s, l) => s + l.valor, 0);

  const handleConciliar = async (extratoId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("extrato_bancario")
        .update({ conciliado: true })
        .eq("id", extratoId);
      if (error) throw error;
      toast.success("Item conciliado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao conciliar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label>Competência:</Label>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {competencias.map(c => <SelectItem key={c} value={c}>{competenciaLabel(c)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Saldo Banco",    value: formatMoeda(totalBanco),    color: "" },
          { label: "Saldo Contábil", value: formatMoeda(totalContabil), color: "" },
          { label: "Conciliados",    value: conciliados,                color: "text-emerald-600" },
          { label: "Pendentes",      value: pendentes,                  color: pendentes > 0 ? "text-orange-600" : "" },
        ].map(item => (
          <div key={item.label} className="surface-card p-4 rounded-lg">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-lg font-semibold mt-1 ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="ft-table w-full text-sm">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Tipo</th>
                <th className="text-right">Valor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {extratos.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhum extrato importado neste período</td></tr>
              )}
              {extratos.map(e => (
                <tr key={e.id}>
                  <td className="text-xs">{new Date(e.data_transacao + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="max-w-xs truncate">{e.descricao}</td>
                  <td>
                    <Badge variant={e.tipo === "credito" ? "default" : "outline"} className="text-xs">
                      {e.tipo === "credito" ? "Crédito" : "Débito"}
                    </Badge>
                  </td>
                  <td className="text-right tabular-nums">{formatMoeda(e.valor)}</td>
                  <td>
                    {e.conciliado
                      ? <span className="text-emerald-600 text-xs font-medium flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Conciliado</span>
                      : <span className="text-orange-600 text-xs font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Pendente</span>}
                  </td>
                  <td>
                    {!e.conciliado && (
                      <Button size="sm" variant="ghost" onClick={() => handleConciliar(e.id)}>
                        Conciliar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface TabContabilProps {
  clienteId: string;
}

export function TabContabil({ clienteId }: TabContabilProps) {
  return (
    <div className="animate-fade-up space-y-4">
      <Tabs defaultValue="periodo">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="periodo">Período</TabsTrigger>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="balancete">Balancete</TabsTrigger>
          <TabsTrigger value="conciliacao">Conciliação</TabsTrigger>
        </TabsList>

        <TabsContent value="periodo"     className="mt-4"><SubAbaPeriodo     clienteId={clienteId} /></TabsContent>
        <TabsContent value="lancamentos" className="mt-4"><SubAbaLancamentos clienteId={clienteId} /></TabsContent>
        <TabsContent value="balancete"   className="mt-4"><SubAbaBalancete   clienteId={clienteId} /></TabsContent>
        <TabsContent value="conciliacao" className="mt-4"><SubAbaConciliacao clienteId={clienteId} /></TabsContent>
      </Tabs>
    </div>
  );
}

export default TabContabil;

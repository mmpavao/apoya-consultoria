/**
 * Página de Administração — Apoya Gestão
 * Configurações de régua de cobrança, SLA, bloqueios, automações
 */
import { useState, useEffect } from "react";
import {
  Settings, Bell, Shield, Zap, Clock, AlertTriangle,
  Save, RefreshCw, ToggleLeft, ToggleRight, ChevronRight,
  DollarSign, Ban, CheckCircle2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const fmtDate = (d?: string) => d ? new Date(d).toLocaleString("pt-BR") : "—";

// ── Tipos ─────────────────────────────────────────────────────────────────────
type ReguaConfig = {
  id?: string;
  dias_antecedencia_emissao: number;
  dias_lembrete_1: number;
  dias_lembrete_2: number;
  dias_primeiro_contato: number;
  dias_segundo_contato: number;
  dias_terceiro_contato: number;
  dias_suspensao: number;
  dias_cancelamento: number;
  habilitar_protesto: boolean;
  dias_protesto: number;
  habilitar_desconto_pontualidade: boolean;
  percentual_desconto: number;
  percentual_multa: number;
  percentual_juros_mes: number;
  notificar_whatsapp: boolean;
  notificar_email: boolean;
  notificar_sms: boolean;
  msg_lembrete?: string;
  msg_vencida?: string;
  msg_suspensao?: string;
  msg_cancelamento?: string;
};

type AutomacaoPadrao = {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  trigger_tipo: string;
  trigger_cron?: string;
  acao: string;
  ativo: boolean;
  ultima_execucao?: string;
  total_execucoes: number;
};

type ClienteBloqueado = {
  id: string;
  cliente_nome: string;
  motivo: string;
  status: string;
  bloqueado_em: string;
  bloqueado_por: string;
  liberado_em?: string;
  valor_devido?: number;
};

const DEFAULT_CONFIG: ReguaConfig = {
  dias_antecedencia_emissao: 10,
  dias_lembrete_1: 5, dias_lembrete_2: 2,
  dias_primeiro_contato: 1, dias_segundo_contato: 3, dias_terceiro_contato: 7,
  dias_suspensao: 15, dias_cancelamento: 30,
  habilitar_protesto: false, dias_protesto: 20,
  habilitar_desconto_pontualidade: false, percentual_desconto: 0,
  percentual_multa: 2.0, percentual_juros_mes: 1.0,
  notificar_whatsapp: true, notificar_email: true, notificar_sms: false,
};

// ── Campo numérico ─────────────────────────────────────────────────────────────
function NumField({ label, value, onChange, suffix = "dias", min = 0, max = 999 }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number" value={value} min={min} max={max}
          onChange={e => onChange(Number(e.target.value))}
          className="w-20 text-center text-sm font-semibold"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}

// ── Linha de régua visual ────────────────────────────────────────────────────
function ReguaTimeline({ cfg }: { cfg: ReguaConfig }) {
  const steps = [
    { label: `Emissão`, day: -cfg.dias_antecedencia_emissao, color: "bg-blue-500" },
    { label: `Lembrete 1`, day: -cfg.dias_lembrete_1, color: "bg-sky-400" },
    { label: `Lembrete 2`, day: -cfg.dias_lembrete_2, color: "bg-cyan-400" },
    { label: `Vencimento`, day: 0, color: "bg-slate-400" },
    { label: `Contato 1`, day: cfg.dias_primeiro_contato, color: "bg-amber-400" },
    { label: `Contato 2`, day: cfg.dias_segundo_contato, color: "bg-orange-400" },
    { label: `Contato 3`, day: cfg.dias_terceiro_contato, color: "bg-red-400" },
    { label: `Suspensão`, day: cfg.dias_suspensao, color: "bg-red-600" },
    ...(cfg.habilitar_protesto ? [{ label: `Protesto`, day: cfg.dias_protesto, color: "bg-purple-600" }] : []),
    { label: `Cancelamento`, day: cfg.dias_cancelamento, color: "bg-slate-800" },
  ];
  return (
    <div className="mt-4 p-4 bg-slate-50 rounded-lg">
      <p className="text-xs font-semibold text-slate-500 mb-3">LINHA DO TEMPO DA RÉGUA</p>
      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
            <span className="text-slate-700 font-medium">{s.label}</span>
            <span className="text-slate-400">
              {s.day === 0 ? "(venc.)" : s.day < 0 ? `(D-${Math.abs(s.day)})` : `(D+${s.day})`}
            </span>
            {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300 ml-1" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Administracao() {
  const [activeTab, setActiveTab] = useState("regua");
  const [cfg, setCfg] = useState<ReguaConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [automacoes, setAutomacoes] = useState<AutomacaoPadrao[]>([]);
  const [bloqueados, setBloqueados] = useState<ClienteBloqueado[]>([]);

  // Carregar régua
  useEffect(() => {
    supabase.from("regua_cobranca_config").select("*").eq("escritorio_id", "apoya").single()
      .then(({ data }) => { if (data) setCfg(data as ReguaConfig); setLoading(false); });
    supabase.from("automacoes_padrao").select("*").order("tipo").then(({ data }) => setAutomacoes(data ?? []));
    supabase.from("cliente_bloqueio").select("*").eq("status", "ativo").order("bloqueado_em", { ascending: false })
      .then(({ data }) => setBloqueados(data ?? []));
  }, []);

  const set = (k: keyof ReguaConfig) => (v: unknown) => setCfg(p => ({ ...p, [k]: v }));

  const handleSaveRegua = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("regua_cobranca_config")
        .upsert({ ...cfg, escritorio_id: "apoya", updated_at: new Date().toISOString() }, { onConflict: "escritorio_id" });
      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch (e) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleAutomacao = async (id: string, ativo: boolean) => {
    await supabase.from("automacoes_padrao").update({ ativo }).eq("id", id);
    setAutomacoes(p => p.map(a => a.id === id ? { ...a, ativo } : a));
    toast.success(ativo ? "Automação ativada" : "Automação pausada");
  };

  const liberarCliente = async (bloqueioId: string, clienteId: string) => {
    await supabase.from("cliente_bloqueio").update({ status: "liberado", liberado_em: new Date().toISOString() }).eq("id", bloqueioId);
    await supabase.from("clientes").update({ bloqueado: false, status: "ativo", bloqueado_por: null, motivo_bloqueio: null }).eq("id", clienteId);
    setBloqueados(p => p.filter(b => b.id !== bloqueioId));
    toast.success("Cliente liberado!");
  };

  const TIPO_COLORS: Record<string, string> = {
    cobranca: "bg-emerald-50 text-emerald-700 border-emerald-200",
    fiscal:   "bg-blue-50 text-blue-700 border-blue-200",
    dp:       "bg-violet-50 text-violet-700 border-violet-200",
    compliance: "bg-amber-50 text-amber-700 border-amber-200",
    societario: "bg-pink-50 text-pink-700 border-pink-200",
    outro:    "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" /> Administração
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configurações operacionais do escritório — régua de cobrança, automações e controle de acesso
          </p>
        </div>
        {bloqueados.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3.5 w-3.5" /> {bloqueados.length} cliente(s) bloqueado(s)
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="regua" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />Régua</TabsTrigger>
          <TabsTrigger value="automacoes" className="gap-1.5"><Zap className="h-3.5 w-3.5" />Automações</TabsTrigger>
          <TabsTrigger value="bloqueios" className="gap-1.5">
            <Ban className="h-3.5 w-3.5" />Bloqueios
            {bloqueados.length > 0 && <span className="ml-1 bg-red-500 text-white rounded-full text-[10px] px-1">{bloqueados.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="gap-1.5"><Bell className="h-3.5 w-3.5" />Mensagens</TabsTrigger>
        </TabsList>

        {/* ── ABA RÉGUA ─────────────────────────────────────────────────────── */}
        <TabsContent value="regua" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Prazos de Cobrança</CardTitle>
              <CardDescription>Configure quando emitir, lembrar e cobrar. O sistema opera automaticamente com base nesses valores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Emissão antecipada</p>
                <NumField label="Emitir boleto/PIX antes do vencimento" value={cfg.dias_antecedencia_emissao} onChange={set("dias_antecedencia_emissao")} />
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Lembretes pré-vencimento</p>
                <div className="flex gap-6 flex-wrap">
                  <NumField label="1º Lembrete (antes do vencimento)" value={cfg.dias_lembrete_1} onChange={set("dias_lembrete_1")} />
                  <NumField label="2º Lembrete (antes do vencimento)" value={cfg.dias_lembrete_2} onChange={set("dias_lembrete_2")} />
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Cobrança pós-vencimento</p>
                <div className="flex gap-6 flex-wrap">
                  <NumField label="1º Contato (após vencimento)" value={cfg.dias_primeiro_contato} onChange={set("dias_primeiro_contato")} />
                  <NumField label="2º Contato" value={cfg.dias_segundo_contato} onChange={set("dias_segundo_contato")} />
                  <NumField label="3º Contato (último aviso)" value={cfg.dias_terceiro_contato} onChange={set("dias_terceiro_contato")} />
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-red-400 uppercase mb-3">Suspensão e cancelamento</p>
                <div className="flex gap-6 flex-wrap">
                  <NumField label="Suspender acesso após (dias em atraso)" value={cfg.dias_suspensao} onChange={set("dias_suspensao")} />
                  <NumField label="Cancelar contrato após (dias em atraso)" value={cfg.dias_cancelamento} onChange={set("dias_cancelamento")} />
                </div>
                <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                  Ao atingir o prazo de suspensão, <strong>todos os funcionários perdem acesso ao cliente</strong>. Apenas o gestor pode reativar.
                </div>
              </div>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Protesto de boleto</p>
                  <Switch checked={cfg.habilitar_protesto} onCheckedChange={set("habilitar_protesto")} />
                </div>
                {cfg.habilitar_protesto && (
                  <NumField label="Protestar após (dias em atraso)" value={cfg.dias_protesto} onChange={set("dias_protesto")} />
                )}
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Multa e juros</p>
                <div className="flex gap-6 flex-wrap">
                  <NumField label="Multa (% único)" value={cfg.percentual_multa} onChange={set("percentual_multa")} suffix="%" min={0} max={10} />
                  <NumField label="Juros (% ao mês)" value={cfg.percentual_juros_mes} onChange={set("percentual_juros_mes")} suffix="%" min={0} max={5} />
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Canais de notificação</p>
                <div className="flex gap-6 flex-wrap">
                  {[
                    { key: "notificar_whatsapp" as const, label: "WhatsApp" },
                    { key: "notificar_email" as const, label: "E-mail" },
                    { key: "notificar_sms" as const, label: "SMS" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <Switch checked={cfg[key] as boolean} onCheckedChange={set(key)} />
                      <span className="text-sm">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ReguaTimeline cfg={cfg} />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveRegua} disabled={saving} className="gap-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Configurações
            </Button>
          </div>
        </TabsContent>

        {/* ── ABA AUTOMAÇÕES ────────────────────────────────────────────────── */}
        <TabsContent value="automacoes" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Automações do escritório. Ative, pause ou configure cada uma.</p>
          </div>
          <div className="space-y-3">
            {automacoes.map(a => (
              <Card key={a.id} className={`transition-opacity ${a.ativo ? "" : "opacity-60"}`}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900">{a.nome}</span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 ${TIPO_COLORS[a.tipo] ?? ""}`}>{a.tipo}</Badge>
                      {a.ativo ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200">ativa</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 bg-slate-50 text-slate-500 border-slate-200">pausada</Badge>
                      )}
                    </div>
                    {a.descricao && <p className="text-xs text-muted-foreground">{a.descricao}</p>}
                    <div className="mt-2 flex gap-4 text-[11px] text-muted-foreground">
                      {a.trigger_cron && <span>⏰ {a.trigger_cron}</span>}
                      <span>▶ {a.total_execucoes} execuções</span>
                      {a.ultima_execucao && <span>última: {fmtDate(a.ultima_execucao)}</span>}
                    </div>
                  </div>
                  <Switch checked={a.ativo} onCheckedChange={v => toggleAutomacao(a.id, v)} />
                </CardContent>
              </Card>
            ))}
            {automacoes.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhuma automação configurada
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── ABA BLOQUEIOS ─────────────────────────────────────────────────── */}
        <TabsContent value="bloqueios" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />Clientes Bloqueados
              </CardTitle>
              <CardDescription>
                Clientes suspensos por inadimplência. Nenhum funcionário tem acesso a eles.
                Somente o gestor pode liberar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bloqueados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum cliente bloqueado
                </div>
              ) : (
                <div className="space-y-3">
                  {bloqueados.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{b.cliente_nome}</p>
                        <p className="text-xs text-red-600 mt-0.5">
                          Motivo: {b.motivo} · Bloqueado em {fmtDate(b.bloqueado_em)} por {b.bloqueado_por}
                        </p>
                        {b.valor_devido && <p className="text-xs text-red-700 font-semibold">Débito: R${b.valor_devido}</p>}
                      </div>
                      <Button size="sm" variant="outline" className="gap-1 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => liberarCliente(b.id, b.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />Liberar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ABA MENSAGENS ─────────────────────────────────────────────────── */}
        <TabsContent value="mensagens" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" />Mensagens da Régua</CardTitle>
              <CardDescription>
                Personalize as mensagens enviadas em cada etapa.
                Use <code className="bg-slate-100 px-1 rounded">{"{nome}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{valor}"}</code>,
                <code className="bg-slate-100 px-1 rounded">{"{vencimento}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{link}"}</code>,
                <code className="bg-slate-100 px-1 rounded">{"{dias}"}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { key: "msg_lembrete" as const, label: "Lembrete pré-vencimento", color: "border-l-blue-400" },
                { key: "msg_vencida" as const, label: "Fatura vencida (cobrança)", color: "border-l-amber-400" },
                { key: "msg_suspensao" as const, label: "Aviso de suspensão", color: "border-l-red-400" },
                { key: "msg_cancelamento" as const, label: "Cancelamento de contrato", color: "border-l-slate-700" },
              ].map(({ key, label, color }) => (
                <div key={key} className={`pl-4 border-l-4 ${color} space-y-1.5`}>
                  <Label className="text-sm font-semibold">{label}</Label>
                  <Textarea
                    rows={3} value={cfg[key] ?? ""}
                    onChange={e => setCfg(p => ({ ...p, [key]: e.target.value }))}
                    className="text-sm resize-none"
                    placeholder="Digite a mensagem…"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={handleSaveRegua} disabled={saving} className="gap-2">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Mensagens
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * TabDP — Departamento Pessoal
 * Sub-abas: Funcionários | Folha Mensal | Férias
 * Escopo: Simples Nacional apenas
 */
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Plus, UserX, Calendar, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  useFuncionarios,
  useCreateFuncionario,
  useDemitirFuncionario,
  useFolhaMensal,
  useCreateFolha,
  useFecharFolha,
  useFerias,
  type TipoContrato,
  type TipoRescisao,
} from "@/hooks/use-dp";

// ─── Utils ────────────────────────────────────────────────────────────────────

const TIPO_CONTRATO_LABEL: Record<TipoContrato, string> = {
  clt: "CLT",
  pj: "PJ",
  estagiario: "Estagiário",
  autonomo: "Autônomo",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  ativo:    { label: "Ativo",    variant: "default" },
  afastado: { label: "Afastado", variant: "secondary" },
  demitido: { label: "Demitido", variant: "outline" },
};

const FOLHA_STATUS_BADGE: Record<string, { label: string; color: string }> = {
  aberta:  { label: "Aberta",  color: "bg-yellow-100 text-yellow-800" },
  fechada: { label: "Fechada", color: "bg-green-100 text-green-800" },
  enviada: { label: "Enviada", color: "bg-blue-100 text-blue-800" },
};

function formatCPF(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

function formatMoeda(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function competenciaLabel(c: string) {
  const [ano, mes] = c.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[parseInt(mes, 10) - 1]}/${ano}`;
}

// ─── Dialog: Novo Funcionário ─────────────────────────────────────────────────

interface NovoFuncionarioDialogProps {
  open: boolean;
  onClose: () => void;
  clienteId: string;
  onSuccess: () => void;
}

function NovoFuncionarioDialog({ open, onClose, clienteId, onSuccess }: NovoFuncionarioDialogProps) {
  const { create, loading } = useCreateFuncionario();
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    pis: "",
    cargo: "",
    departamento: "",
    salario_base: "",
    data_admissao: "",
    tipo_contrato: "clt" as TipoContrato,
    jornada: "44h_semana",
    banco: "",
    agencia: "",
    conta: "",
    tipo_conta: "",
    dependentes: "0",
    observacoes: "",
  });

  const handleSubmit = async () => {
    if (!form.nome || !form.cpf || !form.data_admissao || !form.salario_base) {
      toast.error("Preencha nome, CPF, data de admissão e salário");
      return;
    }
    const ok = await create({
      empresa_id: clienteId,
      nome: form.nome,
      cpf: form.cpf.replace(/\D/g, ""),
      pis: form.pis || undefined,
      cargo: form.cargo || undefined,
      departamento: form.departamento || undefined,
      salario_base: parseFloat(form.salario_base) || 0,
      data_admissao: form.data_admissao,
      tipo_contrato: form.tipo_contrato,
      jornada: form.jornada,
      banco: form.banco || undefined,
      agencia: form.agencia || undefined,
      conta: form.conta || undefined,
      tipo_conta: form.tipo_conta || undefined,
      dependentes: parseInt(form.dependentes) || 0,
      status: "ativo",
      observacoes: form.observacoes || undefined,
    });
    if (ok) { onSuccess(); onClose(); }
  };

  const f = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Funcionário</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2">
            <Label>Nome completo *</Label>
            <Input value={form.nome} onChange={e => f("nome", e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>CPF *</Label>
            <Input value={form.cpf} onChange={e => f("cpf", e.target.value)} placeholder="000.000.000-00" />
          </div>
          <div>
            <Label>PIS/PASEP</Label>
            <Input value={form.pis} onChange={e => f("pis", e.target.value)} placeholder="000.00000.00-0" />
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={form.cargo} onChange={e => f("cargo", e.target.value)} placeholder="Ex: Auxiliar Administrativo" />
          </div>
          <div>
            <Label>Departamento</Label>
            <Input value={form.departamento} onChange={e => f("departamento", e.target.value)} placeholder="Ex: Financeiro" />
          </div>
          <div>
            <Label>Salário Base *</Label>
            <Input
              type="number"
              value={form.salario_base}
              onChange={e => f("salario_base", e.target.value)}
              placeholder="0,00"
              min="0"
              step="0.01"
            />
          </div>
          <div>
            <Label>Data de Admissão *</Label>
            <Input type="date" value={form.data_admissao} onChange={e => f("data_admissao", e.target.value)} />
          </div>
          <div>
            <Label>Tipo de Contrato</Label>
            <Select value={form.tipo_contrato} onValueChange={v => f("tipo_contrato", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_CONTRATO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Jornada</Label>
            <Select value={form.jornada} onValueChange={v => f("jornada", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="44h_semana">44h/semana</SelectItem>
                <SelectItem value="40h_semana">40h/semana</SelectItem>
                <SelectItem value="36h_semana">36h/semana</SelectItem>
                <SelectItem value="20h_semana">20h/semana (Estágio)</SelectItem>
                <SelectItem value="horista">Horista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dependentes (para IRRF)</Label>
            <Input
              type="number"
              min="0"
              value={form.dependentes}
              onChange={e => f("dependentes", e.target.value)}
            />
          </div>

          <div className="col-span-2 border-t pt-3">
            <p className="text-sm font-medium text-muted-foreground mb-2">Dados Bancários</p>
          </div>
          <div>
            <Label>Banco</Label>
            <Input value={form.banco} onChange={e => f("banco", e.target.value)} placeholder="Ex: 001 - Banco do Brasil" />
          </div>
          <div>
            <Label>Agência</Label>
            <Input value={form.agencia} onChange={e => f("agencia", e.target.value)} placeholder="0000-0" />
          </div>
          <div>
            <Label>Conta</Label>
            <Input value={form.conta} onChange={e => f("conta", e.target.value)} placeholder="00000-0" />
          </div>
          <div>
            <Label>Tipo de Conta</Label>
            <Select value={form.tipo_conta} onValueChange={v => f("tipo_conta", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="salario">Conta Salário</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Observações</Label>
            <Input value={form.observacoes} onChange={e => f("observacoes", e.target.value)} placeholder="Observações adicionais" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Cadastrar Funcionário"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: Demitir ──────────────────────────────────────────────────────────

interface DemitirDialogProps {
  open: boolean;
  onClose: () => void;
  funcionarioId: string;
  funcionarioNome: string;
  onSuccess: () => void;
}

function DemitirDialog({ open, onClose, funcionarioId, funcionarioNome, onSuccess }: DemitirDialogProps) {
  const { demitir, loading } = useDemitirFuncionario();
  const [tipo, setTipo] = useState<TipoRescisao>("sem_justa_causa");
  const [data, setData] = useState("");

  const handleDemitir = async () => {
    if (!data) { toast.error("Informe a data de demissão"); return; }
    const ok = await demitir(funcionarioId, data, tipo);
    if (ok) { onSuccess(); onClose(); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Demitir: {funcionarioNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Tipo de Rescisão</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as TipoRescisao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sem_justa_causa">Sem Justa Causa</SelectItem>
                <SelectItem value="com_justa_causa">Com Justa Causa</SelectItem>
                <SelectItem value="pedido_demissao">Pedido de Demissão</SelectItem>
                <SelectItem value="acordo">Acordo (§484-A)</SelectItem>
                <SelectItem value="aposentadoria">Aposentadoria</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data de Demissão</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Os valores da rescisão serão calculados pelo agente Hugo. Um registro de rescisão será criado automaticamente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDemitir} disabled={loading}>
            {loading ? "Processando..." : "Confirmar Demissão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-aba: Funcionários ────────────────────────────────────────────────────

function SubAbaFuncionarios({ clienteId }: { clienteId: string }) {
  const { funcionarios, loading, refresh } = useFuncionarios(clienteId);
  const [showNovo, setShowNovo] = useState(false);
  const [demitindo, setDemitindo] = useState<{ id: string; nome: string } | null>(null);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando funcionários...</div>;

  const ativos = funcionarios.filter(f => f.status === "ativo");
  const feriasCriticas = funcionarios.filter(f => f.status === "ativo" && (f.dias_sem_ferias ?? 0) > 330);

  return (
    <div className="space-y-4">
      {feriasCriticas.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{feriasCriticas.length} funcionário(s)</strong> com férias vencidas ou próximas do vencimento (mais de 330 dias sem tirar férias).
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {ativos.length} funcionário(s) ativo(s) · {funcionarios.length} total
        </p>
        <Button size="sm" onClick={() => setShowNovo(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Funcionário
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="ft-table w-full text-sm">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CPF</th>
              <th>Cargo</th>
              <th>Contrato</th>
              <th className="text-right">Salário</th>
              <th>Admissão</th>
              <th>Status</th>
              <th>Férias</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {funcionarios.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhum funcionário cadastrado
                </td>
              </tr>
            )}
            {funcionarios.map(f => {
              const feriaAlerta = f.status === "ativo" && (f.dias_sem_ferias ?? 0) > 330;
              return (
                <tr key={f.id} className={feriaAlerta ? "bg-orange-50/50" : ""}>
                  <td className="font-medium">{f.nome}</td>
                  <td className="text-muted-foreground font-mono text-xs">{formatCPF(f.cpf)}</td>
                  <td>{f.cargo ?? "—"}</td>
                  <td>{TIPO_CONTRATO_LABEL[f.tipo_contrato]}</td>
                  <td className="text-right">{formatMoeda(f.salario_base)}</td>
                  <td>{new Date(f.data_admissao + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td>
                    <Badge variant={STATUS_BADGE[f.status].variant}>
                      {STATUS_BADGE[f.status].label}
                    </Badge>
                  </td>
                  <td>
                    {feriaAlerta ? (
                      <span className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" /> {f.dias_sem_ferias}d
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{f.dias_sem_ferias}d</span>
                    )}
                  </td>
                  <td>
                    {f.status === "ativo" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDemitindo({ id: f.id, nome: f.nome })}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <NovoFuncionarioDialog
        open={showNovo}
        onClose={() => setShowNovo(false)}
        clienteId={clienteId}
        onSuccess={refresh}
      />

      {demitindo && (
        <DemitirDialog
          open={!!demitindo}
          onClose={() => setDemitindo(null)}
          funcionarioId={demitindo.id}
          funcionarioNome={demitindo.nome}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}

// ─── Sub-aba: Folha Mensal ────────────────────────────────────────────────────

function SubAbaFolha({ clienteId }: { clienteId: string }) {
  const [competencia, setCompetencia] = useState(mesAtual());
  const { folha, loading, refresh } = useFolhaMensal(clienteId, competencia);
  const { createFolha, loading: criando } = useCreateFolha();
  const { fecharFolha, loading: fechando } = useFecharFolha();
  const [confirmFechar, setConfirmFechar] = useState(false);

  // Gerar lista de competências (12 meses para trás)
  const competencias = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const handleAbrirFolha = async () => {
    const ok = await createFolha(clienteId, competencia);
    if (ok) refresh();
  };

  const handleFecharFolha = async () => {
    if (!folha) return;
    const ok = await fecharFolha(folha.id);
    if (ok) { refresh(); setConfirmFechar(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Competência:</Label>
        <Select value={competencia} onValueChange={setCompetencia}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {competencias.map(c => (
              <SelectItem key={c} value={c}>{competenciaLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && <div className="text-center py-8 text-muted-foreground">Carregando folha...</div>}

      {!loading && !folha && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            Nenhuma folha aberta para <strong>{competenciaLabel(competencia)}</strong>
          </p>
          <Button onClick={handleAbrirFolha} disabled={criando}>
            <Plus className="h-4 w-4 mr-1" />
            {criando ? "Abrindo..." : "Abrir Folha do Mês"}
          </Button>
        </div>
      )}

      {!loading && folha && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Folha de {competenciaLabel(folha.competencia)}</h3>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${FOLHA_STATUS_BADGE[folha.status].color}`}>
              {FOLHA_STATUS_BADGE[folha.status].label}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Funcionários", value: folha.total_funcionarios, moeda: false },
              { label: "Total Proventos", value: folha.total_proventos, moeda: true },
              { label: "Total Descontos", value: folha.total_descontos, moeda: true },
              { label: "Total Líquido", value: folha.total_liquido, moeda: true },
              { label: "FGTS", value: folha.total_fgts, moeda: true },
              { label: "INSS Empresa", value: folha.total_inss_empresa, moeda: true },
            ].map(item => (
              <div key={item.label} className="surface-card p-4 rounded-lg">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold mt-1">
                  {item.moeda ? formatMoeda(item.value as number) : item.value}
                </p>
              </div>
            ))}
          </div>

          {folha.fechado_em && (
            <p className="text-xs text-muted-foreground">
              Fechada em {new Date(folha.fechado_em).toLocaleDateString("pt-BR")}
            </p>
          )}

          {folha.status === "aberta" && (
            <>
              {!confirmFechar ? (
                <Button variant="outline" onClick={() => setConfirmFechar(true)}>
                  <ChevronDown className="h-4 w-4 mr-1" /> Fechar Folha
                </Button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm flex-1">Confirmar fechamento da folha de {competenciaLabel(folha.competencia)}?</p>
                  <Button size="sm" variant="destructive" onClick={handleFecharFolha} disabled={fechando}>
                    {fechando ? "Fechando..." : "Confirmar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmFechar(false)}>Cancelar</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-aba: Férias ──────────────────────────────────────────────────────────

function SubAbaFerias({ clienteId }: { clienteId: string }) {
  const { ferias, loading, refresh } = useFerias(clienteId);
  const [showAgendar, setShowAgendar] = useState(false);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Carregando férias...</div>;

  const hoje = new Date();
  const em30dias = new Date();
  em30dias.setDate(em30dias.getDate() + 30);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {ferias.length} período(s) de férias pendente(s) ou vencido(s)
        </p>
        <Button size="sm" onClick={() => setShowAgendar(true)}>
          <Calendar className="h-4 w-4 mr-1" /> Agendar Férias
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden">
        <table className="ft-table w-full text-sm">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Cargo</th>
              <th>Período Aquisitivo</th>
              <th>Vencimento</th>
              <th>Dias</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ferias.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma férias pendente
                </td>
              </tr>
            )}
            {ferias.map(f => {
              const vencimento = new Date(f.periodo_aquisitivo_fim);
              const critico = vencimento <= em30dias;
              const vencido = vencimento < hoje && f.status === "pendente";

              return (
                <tr key={f.id} className={vencido ? "bg-red-50/50" : critico ? "bg-orange-50/50" : ""}>
                  <td className="font-medium">{f.funcionario?.nome ?? "—"}</td>
                  <td className="text-muted-foreground">{f.funcionario?.cargo ?? "—"}</td>
                  <td className="text-xs">
                    {new Date(f.periodo_aquisitivo_ini + "T00:00:00").toLocaleDateString("pt-BR")} –{" "}
                    {new Date(f.periodo_aquisitivo_fim + "T00:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td>
                    <span className={critico || vencido ? "text-red-600 font-medium" : ""}>
                      {vencimento.toLocaleDateString("pt-BR")}
                      {critico && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                    </span>
                  </td>
                  <td>{f.dias_gozo}d</td>
                  <td>
                    <Badge variant={f.status === "vencida" ? "destructive" : "secondary"}>
                      {f.status.charAt(0).toUpperCase() + f.status.slice(1)}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog de agendamento — simplificado para MVP */}
      <Dialog open={showAgendar} onOpenChange={setShowAgendar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar Férias</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Para agendar férias, selecione o funcionário e defina o período de gozo. O agente Hugo calculará os valores automaticamente.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgendar(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

interface TabDPProps {
  clienteId: string;
}

export function TabDP({ clienteId }: TabDPProps) {
  return (
    <div className="animate-fade-up space-y-4">
      <Tabs defaultValue="funcionarios">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="folha">Folha Mensal</TabsTrigger>
          <TabsTrigger value="ferias">Férias</TabsTrigger>
        </TabsList>

        <TabsContent value="funcionarios" className="mt-4">
          <SubAbaFuncionarios clienteId={clienteId} />
        </TabsContent>

        <TabsContent value="folha" className="mt-4">
          <SubAbaFolha clienteId={clienteId} />
        </TabsContent>

        <TabsContent value="ferias" className="mt-4">
          <SubAbaFerias clienteId={clienteId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TabDP;

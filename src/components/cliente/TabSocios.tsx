/**
 * TabSocios — Quadro societário do cliente
 * Exibe % participação, qualificação, dados pessoais e permite editar/adicionar sócios.
 */
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Users, Loader2, UserCheck, UserX, Building, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSocios, type Socio } from "@/hooks/use-socios";
import { toast } from "sonner";

const fmtData = (d?: string) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const fmtPct = (p?: number) =>
  p !== undefined ? `${Number(p).toFixed(2)}%` : "—";

const fmtCNPJCPF = (v?: string) => {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "***.$2.$3-**");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v;
};

const QUALIFICACOES = [
  "Sócio-Administrador", "Sócio", "Diretor", "Presidente",
  "Representante Legal", "Contador", "Procurador", "Outro",
];

type TipoSocio = "pf" | "pj";
const EMPTY_SOCIO = {
  nome: "", cnpjCpfSocio: "", tipoSocio: "pf" as TipoSocio,
  qualificacao: "Sócio-Administrador", percentual: undefined as number | undefined,
  dataEntrada: "", email: "", telefone: "",
  isAdministrador: false,
};

interface Props { clienteId: string; }

export function TabSocios({ clienteId }: Props) {
  const { socios, loading, load, upsert, remove } = useSocios(clienteId);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState<Partial<Socio> | null>(null);
  const [form, setForm]           = useState(EMPTY_SOCIO);
  const [saving, setSaving]       = useState(false);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_SOCIO);
    setModalOpen(true);
  }

  function openEdit(s: Socio) {
    setEditing(s);
    setForm({
      nome:            s.nome,
      cnpjCpfSocio:    s.cnpjCpfSocio ?? "",
      tipoSocio:       s.tipoSocio,
      qualificacao:    s.qualificacao ?? "Sócio",
      percentual:      s.percentual,
      dataEntrada:     s.dataEntrada ?? "",
      email:           s.email ?? "",
      telefone:        s.telefone ?? "",
      isAdministrador: s.isAdministrador,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const ok = await upsert({
      ...(editing ? { id: editing.id } : {}),
      clienteId,
      ...form,
    });
    setSaving(false);
    if (ok) { setModalOpen(false); toast.success(editing ? "Sócio atualizado" : "Sócio adicionado"); }
  }

  // Calcular total de participação
  const totalPct = socios.reduce((acc, s) => acc + (s.percentual ?? 0), 0);
  const pctOk    = Math.abs(totalPct - 100) < 0.01 || totalPct === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-apoya-orange" />
            Quadro Societário
          </h3>
          {socios.length > 0 && (
            <p className={`text-sm mt-0.5 ${pctOk ? "text-emerald-600" : "text-amber-600"}`}>
              Total: {totalPct.toFixed(2)}%
              {!pctOk && " ⚠️ Participações não totalizam 100%"}
            </p>
          )}
        </div>
        <Button size="sm" onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Adicionar Sócio
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-apoya-orange" />
        </div>
      )}

      {/* Vazio */}
      {!loading && socios.length === 0 && (
        <div className="surface-card p-8 text-center rounded-xl border border-dashed">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhum sócio cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ao cadastrar o CNPJ, os sócios são importados automaticamente da Receita Federal.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar manualmente
          </Button>
        </div>
      )}

      {/* Lista de sócios */}
      {!loading && socios.length > 0 && (
        <div className="grid gap-3">
          {socios.map(s => (
            <div key={s.id} className="surface-card rounded-xl p-4 border border-border/50 flex items-start gap-4">
              {/* Avatar inicial */}
              <div className={`h-11 w-11 rounded-full flex items-center justify-center text-white font-semibold text-base shrink-0
                ${s.tipoSocio === "pj" ? "bg-indigo-500" : "bg-apoya-orange"}`}>
                {s.tipoSocio === "pj"
                  ? <Building className="h-5 w-5" />
                  : s.nome.split(" ").map(n => n[0]).slice(0, 2).join("")
                }
              </div>

              {/* Dados */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{s.nome}</span>
                  {s.isAdministrador && (
                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 border-0">
                      <UserCheck className="h-3 w-3 mr-1" /> Administrador
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {s.tipoSocio === "pj" ? "Pessoa Jurídica" : "Pessoa Física"}
                  </Badge>
                </div>

                <div className="mt-1.5 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground/70">Qualificação</span>
                    <p>{s.qualificacao ?? "—"}</p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground/70">Participação</span>
                    <p className={`font-semibold ${s.percentual ? "text-apoya-orange" : ""}`}>
                      {fmtPct(s.percentual)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground/70">CPF/CNPJ</span>
                    <p className="font-mono">{fmtCNPJCPF(s.cnpjCpfSocio)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground/70">Entrada</span>
                    <p>{fmtData(s.dataEntrada)}</p>
                  </div>
                  {s.email && (
                    <div className="col-span-2">
                      <span className="font-medium text-foreground/70">E-mail</span>
                      <p>{s.email}</p>
                    </div>
                  )}
                  {s.telefone && (
                    <div>
                      <span className="font-medium text-foreground/70">Telefone</span>
                      <p>{s.telefone}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600"
                  onClick={async () => {
                    if (!confirm(`Remover ${s.nome} do quadro societário?`)) return;
                    await remove(s.id);
                  }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gráfico simples de participação */}
      {socios.length > 0 && totalPct > 0 && (
        <div className="surface-card rounded-xl p-4 border border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-3">Composição Societária</p>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
            {socios.filter(s => s.percentual).map((s, i) => {
              const colors = ["#E8721C","#6366f1","#10b981","#f59e0b","#f43f5e","#3b82f6","#8b5cf6","#14b8a6"];
              return (
                <div key={s.id}
                  style={{ width: `${s.percentual}%`, backgroundColor: colors[i % colors.length] }}
                  title={`${s.nome}: ${fmtPct(s.percentual)}`}
                />
              );
            })}
            {totalPct < 100 && (
              <div style={{ width: `${100 - totalPct}%`, backgroundColor: "#e5e7eb" }}
                title="Participação não atribuída" />
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {socios.filter(s => s.percentual).map((s, i) => {
              const colors = ["#E8721C","#6366f1","#10b981","#f59e0b","#f43f5e","#3b82f6","#8b5cf6","#14b8a6"];
              return (
                <div key={s.id} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[i % colors.length] }} />
                  <span>{s.nome.split(" ")[0]} · {fmtPct(s.percentual)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal adicionar/editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Sócio" : "Novo Sócio"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome completo *</Label>
                <Input placeholder="João da Silva" value={form.nome}
                  onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div>
                <Label>CPF / CNPJ</Label>
                <Input placeholder="000.000.000-00" value={form.cnpjCpfSocio ?? ""}
                  onChange={e => setForm(p => ({ ...p, cnpjCpfSocio: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.tipoSocio}
                  onChange={e => setForm(p => ({ ...p, tipoSocio: e.target.value as TipoSocio }))}>
                  <option value="pf">Pessoa Física</option>
                  <option value="pj">Pessoa Jurídica</option>
                </select>
              </div>
              <div>
                <Label>Qualificação</Label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={form.qualificacao ?? ""}
                  onChange={e => setForm(p => ({ ...p, qualificacao: e.target.value }))}>
                  {QUALIFICACOES.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <Label>% Participação</Label>
                <Input type="number" min={0} max={100} step={0.01} placeholder="50.00"
                  value={form.percentual ?? ""}
                  onChange={e => setForm(p => ({ ...p, percentual: e.target.value ? Number(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label>Data de Entrada</Label>
                <Input type="date" value={form.dataEntrada ?? ""}
                  onChange={e => setForm(p => ({ ...p, dataEntrada: e.target.value }))} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" placeholder="joao@email.com" value={form.email ?? ""}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <Label>Telefone / WhatsApp</Label>
                <Input placeholder="(11) 99999-9999" value={form.telefone ?? ""}
                  onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <input type="checkbox" id="is_admin" className="h-4 w-4 accent-apoya-orange"
                  checked={form.isAdministrador}
                  onChange={e => setForm(p => ({ ...p, isAdministrador: e.target.checked }))} />
                <label htmlFor="is_admin" className="text-sm cursor-pointer">
                  Este sócio é administrador da empresa
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editing ? "Salvar alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

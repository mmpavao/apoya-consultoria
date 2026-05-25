/**
 * Configurações → Serviços — Catálogo global de serviços contábeis
 * Rota: /configuracoes/servicos
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Package,
  Search, Tag, DollarSign, Clock, Check, X, Loader2, Settings,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useServicoCatalogo, type ServicoCatalogo } from "@/hooks/use-servicos";

export const Route = createFileRoute("/_app/configuracoes_/servicos")({
  component: ConfiguracoeServicosPage,
  head: () => ({ meta: [{ title: "Catálogo de Serviços · APOYA Gestão" }] }),
});

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CAT_LABEL: Record<string, string> = {
  mensal: "Mensal", avulso: "Avulso", anual: "Anual", eventual: "Eventual",
};
const CAT_CLS: Record<string, string> = {
  mensal:   "bg-blue-50 text-blue-700 border-blue-200",
  avulso:   "bg-violet-50 text-violet-700 border-violet-200",
  anual:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  eventual: "bg-amber-50 text-amber-700 border-amber-200",
};
const UNIDADE_LABEL: Record<string, string> = {
  mensal: "/mês", anual: "/ano", avulso: " (avulso)", hora: "/hora",
};

/* ── Modal criar/editar ─────────────────────────────────────────────────── */
function ModalServico({ servico, onClose }: { servico?: ServicoCatalogo; onClose: () => void }) {
  const { criar, atualizar } = useServicoCatalogo();
  const [form, setForm] = useState({
    codigo:          servico?.codigo ?? "",
    nome:            servico?.nome ?? "",
    descricao:       servico?.descricao ?? "",
    categoria:       servico?.categoria ?? "mensal",
    tipo:            servico?.tipo ?? "servico",
    valor_padrao:    String(servico?.valor_padrao ?? ""),
    unidade:         servico?.unidade ?? "mensal",
    requer_contrato: servico?.requer_contrato ?? true,
    requer_nota:     servico?.requer_nota ?? true,
    ativo:           servico?.ativo ?? true,
    ordem:           String(servico?.ordem ?? "99"),
    tags:            servico?.tags?.join(", ") ?? "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.nome || !form.codigo || !form.valor_padrao) return;
    setSaving(true);
    try {
      const payload = {
        codigo:          form.codigo.toUpperCase().replace(/\s+/g, "_"),
        nome:            form.nome,
        descricao:       form.descricao || undefined,
        categoria:       form.categoria as any,
        tipo:            form.tipo as any,
        valor_padrao:    Number(form.valor_padrao),
        unidade:         form.unidade as any,
        requer_contrato: form.requer_contrato,
        requer_nota:     form.requer_nota,
        ativo:           form.ativo,
        ordem:           Number(form.ordem ?? 99),
        tags:            form.tags ? form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      };
      if (servico) await atualizar(servico.id, payload);
      else await criar(payload);
      onClose();
    } catch { } finally { setSaving(false); }
  };

  // Gerar código automaticamente a partir do nome
  const gerarCodigo = () => {
    const cod = form.nome
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30);
    setForm(p => ({ ...p, codigo: cod }));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {servico ? "Editar Serviço" : "Novo Serviço"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Nome + Código */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Nome do serviço *</Label>
              <Input value={form.nome} onChange={e => setForm((p: any) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Honorário Mensal MEI" />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-10" onClick={gerarCodigo}>
              Gerar código
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Código único *</Label>
            <Input
              value={form.codigo}
              onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase().replace(/\s+/g, "_") }))}
              placeholder="HON_MEI"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Identificador único em maiúsculas com underscore. Usado em automações.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={e => setForm((p: any) => ({ ...p, descricao: e.target.value }))}
              placeholder="Descreva o que inclui este serviço…" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm((p: any) => ({ ...p, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="avulso">Avulso</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="eventual">Eventual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm((p: any) => ({ ...p, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="servico">Serviço</SelectItem>
                  <SelectItem value="imposto">Imposto</SelectItem>
                  <SelectItem value="taxa">Taxa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor padrão (R$) *</Label>
              <Input type="number" value={form.valor_padrao}
                onChange={e => setForm((p: any) => ({ ...p, valor_padrao: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Unidade de cobrança</Label>
              <Select value={form.unidade} onValueChange={v => setForm((p: any) => ({ ...p, unidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Por mês</SelectItem>
                  <SelectItem value="anual">Por ano</SelectItem>
                  <SelectItem value="avulso">Avulso (único)</SelectItem>
                  <SelectItem value="hora">Por hora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ordem de exibição</Label>
              <Input type="number" value={form.ordem} onChange={e => setForm((p: any) => ({ ...p, ordem: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={form.tags} onChange={e => setForm((p: any) => ({ ...p, tags: e.target.value }))}
                placeholder="mensal, mei, rotina" />
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Requer contrato</p>
                <p className="text-xs text-muted-foreground">Exige criação de contrato para ser ativado</p>
              </div>
              <Switch checked={form.requer_contrato} onCheckedChange={v => setForm(p => ({ ...p, requer_contrato: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Requer nota fiscal</p>
                <p className="text-xs text-muted-foreground">NFS-e obrigatória ao registrar pagamento</p>
              </div>
              <Switch checked={form.requer_nota} onCheckedChange={v => setForm(p => ({ ...p, requer_nota: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">Disponível para contratação</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.nome || !form.codigo || !form.valor_padrao}>
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando…</>
              : servico ? "Salvar alterações" : "Criar serviço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Linha da tabela ────────────────────────────────────────────────────── */
function ServicoRow({ s }: { s: ServicoCatalogo }) {
  const { excluir, toggleAtivo } = useServicoCatalogo();
  const [editing, setEditing] = useState(false);

  const catCls = CAT_CLS[s.categoria] ?? CAT_CLS.mensal;
  const catLabel = CAT_LABEL[s.categoria] ?? s.categoria;

  return (
    <tr>
      <td>
        <div>
          <p className="font-medium text-sm">{s.nome}</p>
          {s.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{s.descricao}</p>}
        </div>
      </td>
      <td>
        <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{s.codigo}</code>
      </td>
      <td>
        <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full border ${catCls}`}>
          {catLabel}
        </span>
      </td>
      <td className="font-semibold tabular-nums">
        {fmtBRL(s.valor_padrao)}
        <span className="text-xs font-normal text-muted-foreground">{UNIDADE_LABEL[s.unidade] ?? ""}</span>
      </td>
      <td>
        <div className="flex items-center gap-2">
          {s.requer_contrato && <span title="Requer contrato" className="text-[10px] bg-muted text-muted-foreground px-1 rounded">Contrato</span>}
          {s.requer_nota && <span title="Requer NFS-e" className="text-[10px] bg-muted text-muted-foreground px-1 rounded">NFS-e</span>}
        </div>
      </td>
      <td>
        <button
          onClick={() => toggleAtivo(s.id, !s.ativo)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border transition-colors ${
            s.ativo
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
          }`}
        >
          {s.ativo ? <><Check className="h-3 w-3" />Ativo</> : <><X className="h-3 w-3" />Inativo</>}
        </button>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
            onClick={() => excluir(s.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
      {editing && <ModalServico servico={s} onClose={() => setEditing(false)} />}
    </tr>
  );
}

/* ── Página principal ───────────────────────────────────────────────────── */
function ConfiguracoeServicosPage() {
  const { servicos, loading } = useServicoCatalogo();
  const [showNovo, setShowNovo] = useState(false);
  const [query, setQuery] = useState("");
  const [filtroCat, setFiltroCat] = useState("todos");
  const [filtroAtivo, setFiltroAtivo] = useState("todos");

  const filtered = servicos.filter(s => {
    const matchQ = !query || s.nome.toLowerCase().includes(query.toLowerCase()) || s.codigo.toLowerCase().includes(query.toLowerCase());
    const matchCat = filtroCat === "todos" || s.categoria === filtroCat;
    const matchAtivo = filtroAtivo === "todos" || (filtroAtivo === "ativo" ? s.ativo : !s.ativo);
    return matchQ && matchCat && matchAtivo;
  });

  const kpis = {
    total:    servicos.length,
    ativos:   servicos.filter(s => s.ativo).length,
    mensais:  servicos.filter(s => s.ativo && s.categoria === "mensal").length,
    avulsos:  servicos.filter(s => s.ativo && s.categoria === "avulso").length,
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/configuracoes" className="hover:text-foreground transition-colors flex items-center gap-1">
          <Settings className="h-3.5 w-3.5" />Configurações
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Catálogo de Serviços</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display">Catálogo de Serviços</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os serviços disponíveis para contratação. Esse catálogo é utilizado em todos os módulos do sistema.
          </p>
        </div>
        <Button onClick={() => setShowNovo(true)}>
          <Plus className="h-4 w-4 mr-2" />Novo Serviço
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total de serviços", value: kpis.total, tone: "text-foreground" },
          { label: "Ativos",            value: kpis.ativos, tone: "text-emerald-600" },
          { label: "Mensais",           value: kpis.mensais, tone: "text-blue-600" },
          { label: "Avulsos",           value: kpis.avulsos, tone: "text-violet-600" },
        ].map(k => (
          <div key={k.label} className="surface-card p-4 rounded-xl">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)}
            className="pl-8 h-8 text-xs" placeholder="Buscar por nome ou código…" />
        </div>
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas categorias</SelectItem>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="avulso">Avulso</SelectItem>
            <SelectItem value="anual">Anual</SelectItem>
            <SelectItem value="eventual">Eventual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroAtivo} onValueChange={setFiltroAtivo}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="surface-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum serviço encontrado</p>
          </div>
        ) : (
          <table className="ft-table w-full">
            <thead>
              <tr>
                <th>Serviço</th>
                <th>Código</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Flags</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => <ServicoRow key={s.id} s={s} />)}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {filtered.length} de {servicos.length} serviço(s) exibido(s)
      </p>

      {showNovo && <ModalServico onClose={() => setShowNovo(false)} />}
    </div>
  );
}

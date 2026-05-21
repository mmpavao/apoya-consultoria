import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, Clock,
  ExternalLink, MessageCircle, MoreHorizontal,
  Pencil, Phone, Plus, Search, Trash2, Users, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClienteFormDialog } from "@/components/ClienteFormDialog";
import {
  useClientes, REGIME_LABEL, STATUS_LABEL,
  type Cliente, type Regime, type Status,
} from "@/hooks/use-clientes";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
  head: () => ({ meta: [{ title: "Clientes · APOYA Gestão" }] }),
});

/* ── Cores ── */
const REGIME_CFG: Record<Regime, { bg: string; text: string; dot: string }> = {
  MEI:               { bg: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-400"  },
  Simples:           { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400"    },
  "Lucro Presumido": { bg: "bg-cyan-50",    text: "text-cyan-700",    dot: "bg-cyan-400"    },
  "Lucro Real":      { bg: "bg-indigo-50",  text: "text-indigo-700",  dot: "bg-indigo-400"  },
  Doméstica:         { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
};

const STATUS_CFG: Record<Status, { bg: string; text: string; Icon: React.ElementType }> = {
  ativo:        { bg: "bg-emerald-50", text: "text-emerald-700", Icon: CheckCircle2  },
  inadimplente: { bg: "bg-amber-50",   text: "text-amber-700",   Icon: AlertTriangle },
  suspenso:     { bg: "bg-red-50",     text: "text-red-700",     Icon: Ban           },
  inativo:      { bg: "bg-gray-100",   text: "text-gray-500",    Icon: Clock         },
  em_analise:   { bg: "bg-blue-50",    text: "text-blue-700",    Icon: Clock         },
};

function AvatarBox({ nome, regime }: { nome: string; regime: Regime }) {
  const initials = nome.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const cfg = REGIME_CFG[regime] ?? REGIME_CFG.Simples;
  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${cfg.bg} ${cfg.text}`}>
      {initials}
    </div>
  );
}

function RegimeBadge({ regime }: { regime: Regime }) {
  const cfg = REGIME_CFG[regime] ?? REGIME_CFG.Simples;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {REGIME_LABEL[regime] ?? regime}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const { bg, text, Icon } = STATUS_CFG[status] ?? STATUS_CFG.inativo;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${bg} ${text}`}>
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function StatPill({ label, value, bg, text }: { label: string; value: number; bg: string; text: string }) {
  return (
    <div className={`flex items-baseline gap-1.5 rounded-xl px-3 py-2 ${bg}`}>
      <span className={`text-lg font-bold ${text}`}>{value}</span>
      <span className={`text-xs ${text} opacity-70`}>{label}</span>
    </div>
  );
}

function FSel({ value, onChange, options, display }: {
  value: string; onChange: (v: string) => void;
  options: string[]; display: (o: string) => string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 min-w-[150px] rounded-xl border-border/60 text-sm">
        <SelectValue>{display(value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{display(o)}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const PAGE_SIZE = 20;

function ClientesPage() {
  const { clientes, loading, error, deleteCliente } = useClientes();
  const [query, setQuery]     = useState("");
  const [regime, setRegime]   = useState("todos");
  const [status, setStatus]   = useState("todos");
  const [resp, setResp]       = useState("todos");
  const [dialogOpen, setDialog] = useState(false);
  const [editing, setEditing]   = useState<Cliente | null>(null);
  const [toDelete, setToDelete] = useState<Cliente | null>(null);
  const [page, setPage]         = useState(1);

  const responsaveis = useMemo(() => Array.from(new Set(clientes.map((c) => c.responsavel))), [clientes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clientes.filter((c) => {
      if (q && !`${c.razaoSocial} ${c.nomeFantasia ?? ""} ${c.cnpj}`.toLowerCase().includes(q)) return false;
      if (regime !== "todos" && c.regime !== regime) return false;
      if (status !== "todos" && c.status !== status) return false;
      if (resp   !== "todos" && c.responsavel !== resp) return false;
      return true;
    });
  }, [clientes, query, regime, status, resp]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const ativos        = clientes.filter((c) => c.status === "ativo").length;
  const inadimplentes = clientes.filter((c) => c.status === "inadimplente").length;
  const suspensos     = clientes.filter((c) => c.status === "suspenso").length;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-red-50 p-10 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500 mb-3" />
        <p className="font-medium text-red-700">Erro ao carregar clientes</p>
        <p className="text-sm text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading ? "Carregando…" : `${clientes.length} clientes cadastrados`}
          </p>
        </div>
        <Button className="rounded-xl" onClick={() => { setEditing(null); setDialog(true); }}>
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-2">
        <StatPill label="ativos"        value={ativos}        bg="bg-emerald-50" text="text-emerald-700" />
        <StatPill label="inadimplentes" value={inadimplentes} bg="bg-amber-50"   text="text-amber-700"   />
        <StatPill label="suspensos"     value={suspensos}     bg="bg-red-50"     text="text-red-700"     />
        <StatPill label="total"         value={clientes.length} bg="bg-muted"    text="text-muted-foreground" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Razão social, fantasia ou CNPJ…" className="h-9 rounded-xl pl-9" />
        </div>
        <FSel value={regime} onChange={(v) => { setRegime(v); setPage(1); }}
          options={["todos", "MEI", "Simples", "Lucro Presumido", "Lucro Real", "Doméstica"]}
          display={(o) => o === "todos" ? "Todos regimes" : (REGIME_LABEL[o as Regime] ?? o)} />
        <FSel value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={["todos", "ativo", "inadimplente", "suspenso", "inativo", "em_analise"]}
          display={(o) => o === "todos" ? "Todos status" : (STATUS_LABEL[o as Status] ?? o)} />
        <FSel value={resp} onChange={(v) => { setResp(v); setPage(1); }}
          options={["todos", ...responsaveis]}
          display={(o) => o === "todos" ? "Todos resp." : o} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Cards */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card py-20 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Nenhum cliente encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou cadastre um novo cliente</p>
          <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={() => { setEditing(null); setDialog(true); }}>
            <Plus className="h-3.5 w-3.5" /> Novo Cliente
          </Button>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {pageItems.map((c) => (
            <ClienteCard key={c.id} cliente={c}
              onEdit={(cl) => { setEditing(cl); setDialog(true); }}
              onDelete={setToDelete} />
          ))}
        </div>
      )}

      {/* Paginação */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Página {page} de {totalPages} · {filtered.length} resultados</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
            <Button variant="outline" size="sm" className="rounded-xl" disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
          </div>
        </div>
      )}

      <ClienteFormDialog open={dialogOpen} onOpenChange={setDialog} initial={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. <strong>{toDelete?.razaoSocial}</strong> será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!toDelete) return;
                const ok = await deleteCliente(toDelete.id);
                if (ok) toast.success(`${toDelete.razaoSocial} removido`);
                setToDelete(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClienteCard({ cliente: c, onEdit, onDelete }: {
  cliente: Cliente; onEdit: (c: Cliente) => void; onDelete: (c: Cliente) => void;
}) {
  const honorario = c.valorHonorario
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(c.valorHonorario)
    : null;

  return (
    <div className="group flex items-center gap-4 rounded-2xl border bg-card px-4 py-3.5 shadow-sm transition-all hover:shadow-md hover:border-border/80">
      <AvatarBox nome={c.razaoSocial} regime={c.regime} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/clientes/$id" params={{ id: c.id }} className="truncate font-semibold hover:underline">
            {c.razaoSocial}
          </Link>
          {c.nomeFantasia && <span className="hidden text-xs text-muted-foreground sm:inline">· {c.nomeFantasia}</span>}
          {c.regimeHibrido && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Híbrido</span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{c.cnpj}</span>
          {c.responsavel && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.responsavel}</span>}
          {(c.endereco?.municipio || c.municipio) && (
            <span>{c.endereco?.municipio ?? c.municipio}{(c.endereco?.uf ?? c.uf) ? ` · ${c.endereco?.uf ?? c.uf}` : ""}</span>
          )}
          {honorario && <span className="font-semibold text-foreground">{honorario}/mês</span>}
        </div>
      </div>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        <RegimeBadge regime={c.regime} />
        <StatusBadge status={c.status} />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {c.whatsapp && (
          <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50">
              <MessageCircle className="h-4 w-4" />
            </Button>
          </a>
        )}
        {c.telefone && (
          <a href={`tel:${c.telefone}`}>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
          </a>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/clientes/$id" params={{ id: c.id }}><ExternalLink className="h-4 w-4" /> Ver detalhes</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onEdit(c)}><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(c)}>
            <Trash2 className="h-4 w-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

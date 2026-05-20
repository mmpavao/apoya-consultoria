import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/PagePlaceholder";
import { ClienteFormDialog } from "@/components/ClienteFormDialog";
import { clientesStore, REGIME_LABEL, STATUS_LABEL, type Cliente, type Regime, type Status } from "@/lib/clientes-store";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
  head: () => ({ meta: [{ title: "Clientes · APOYA Gestão" }] }),
});

const REGIME_VARIANT: Record<Regime, string> = {
  MEI: "bg-[oklch(0.55_0.18_300)]/10 text-[oklch(0.45_0.18_300)] border-[oklch(0.55_0.18_300)]/20",
  Simples: "bg-primary-soft text-primary border-primary/20",
  "Lucro Presumido": "bg-info/10 text-info border-info/20",
  "Lucro Real": "bg-info/15 text-info border-info/30",
  "Doméstica": "bg-success/10 text-success border-success/20",
};

const STATUS_VARIANT: Record<Status, string> = {
  ativo: "bg-success/10 text-success border-success/20",
  inadimplente: "bg-warning/15 text-warning-foreground border-warning/30",
  suspenso: "bg-destructive/10 text-destructive border-destructive/20",
  inativo: "bg-muted text-muted-foreground border-border",
  em_analise: "bg-info/10 text-info border-info/20",
};

const PAGE_SIZE = 50;

function ClientesPage() {
  const [items, setItems] = useState<Cliente[]>([]);
  const [query, setQuery] = useState("");
  const [regime, setRegime] = useState<string>("todos");
  const [status, setStatus] = useState<string>("todos");
  const [responsavel, setResponsavel] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [toDelete, setToDelete] = useState<Cliente | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const refresh = () => setItems(clientesStore.list());
    refresh();
    window.addEventListener("apoya:clientes:changed", refresh);
    return () => window.removeEventListener("apoya:clientes:changed", refresh);
  }, []);

  const responsaveis = useMemo(() => Array.from(new Set(items.map((c) => c.responsavel))), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (q && !`${c.razaoSocial} ${c.nomeFantasia ?? ""} ${c.cnpj}`.toLowerCase().includes(q)) return false;
      if (regime !== "todos" && c.regime !== regime) return false;
      if (status !== "todos" && c.status !== status) return false;
      if (responsavel !== "todos" && c.responsavel !== responsavel) return false;
      return true;
    });
  }, [items, query, regime, status, responsavel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [query, regime, status, responsavel]);

  const ativos = items.filter((c) => c.status === "ativo").length;
  const inadimplentes = items.filter((c) => c.status === "inadimplente").length;
  const suspensos = items.filter((c) => c.status === "suspenso").length;

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(c: Cliente) { setEditing(c); setDialogOpen(true); }
  function confirmDelete() {
    if (!toDelete) return;
    clientesStore.remove(toDelete.id);
    toast.success(`${toDelete.razaoSocial} removido`);
    setToDelete(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle={`${ativos} ativos · ${inadimplentes} inadimplentes · ${suspensos} suspensos · ${items.length} no total`}
        actions={
          <Button className="rounded-xl" onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo Cliente
          </Button>
        }
      />

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por razão social, fantasia ou CNPJ"
              className="rounded-xl pl-9"
            />
          </div>
          <FilterSelect label="Regime" value={regime} onChange={setRegime}
            options={["todos", "MEI", "Simples", "Lucro Presumido", "Lucro Real", "Doméstica"]}
            display={(o) => o === "todos" ? "Regime: todos" : (REGIME_LABEL[o as Regime] ?? o)} />
          <FilterSelect label="Status" value={status} onChange={setStatus}
            options={["todos", "ativo", "inadimplente", "suspenso", "inativo", "em_analise"]}
            display={(o) => o === "todos" ? "Status: todos" : (STATUS_LABEL[o as Status] ?? o)} />
          <FilterSelect label="Responsável" value={responsavel} onChange={setResponsavel}
            options={["todos", ...responsaveis]}
            display={(o) => o === "todos" ? "Responsável: todos" : o} />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Regime</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                    <Users className="mx-auto mb-3 h-8 w-8 opacity-40" />
                    Nenhum cliente encontrado
                  </TableCell>
                </TableRow>
              )}
              {pageItems.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to="/clientes/$id" params={{ id: c.id }} className="hover:underline">
                      <div className="font-medium">{c.razaoSocial}</div>
                      {c.nomeFantasia && <div className="text-xs text-muted-foreground">{c.nomeFantasia}</div>}
                    </Link>
                    {c.regimeHibrido && (
                      <Badge variant="outline" className="mt-1 rounded-full border-primary/30 bg-primary-soft text-[10px] text-primary">
                        Regime Híbrido
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.cnpj}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-full border ${REGIME_VARIANT[c.regime]}`}>{REGIME_LABEL[c.regime]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`rounded-full border ${STATUS_VARIANT[c.status]}`}>{STATUS_LABEL[c.status]}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.whatsapp ?? "—"}</TableCell>
                  <TableCell className="text-sm">{c.responsavel}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to="/clientes/$id" params={{ id: c.id }}>
                            <ExternalLink className="h-4 w-4" /> Ver detalhes
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setToDelete(c)}>
                          <Trash2 className="h-4 w-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t p-3 text-sm">
            <span className="text-muted-foreground">
              Página {page} de {totalPages} · {filtered.length} resultados
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
              <Button variant="outline" size="sm" className="rounded-xl" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima</Button>
            </div>
          </div>
        )}
      </div>

      <ClienteFormDialog open={dialogOpen} onOpenChange={setDialogOpen} cliente={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. {toDelete?.razaoSocial} será removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options, display,
}: { label: string; value: string; onChange: (v: string) => void; options: string[]; display?: (o: string) => string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] rounded-xl">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{display ? display(o) : o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle, Ban, CheckCircle2, Clock,
  ExternalLink, Loader2, MessageCircle, MoreHorizontal,
  FileText, Pencil, Phone, Plus, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClienteFormDialog } from "@/components/ClienteFormDialog";
import { DataTable, InlineBadge, TableSearch, TableFooter, type ColDef, type BadgeColor } from "@/components/DataTable";
import { PageHeader, KpiGrid, KpiCard, Pagination } from "@/components/PagePlaceholder";
import { useClientes, REGIME_LABEL, STATUS_LABEL, type Cliente, type Regime, type Status } from "@/hooks/use-clientes";
import { EmitirNfseModal } from "@/components/nfse/EmitirNfseModal";

export const Route = createFileRoute("/_app/clientes")({
  component: ClientesPage,
  head: () => ({ meta: [{ title: "Clientes · APOYA Gestão" }] }),
});

const R_C: Record<Regime, BadgeColor> = {
  MEI:"violet", Simples:"blue", "Lucro Presumido":"cyan", "Lucro Real":"indigo", "Doméstica":"green",
};
const S_C: Record<Status, BadgeColor> = {
  ativo:"green", inadimplente:"amber" as BadgeColor, suspenso:"red", inativo:"gray", em_analise:"blue",
};
const S_I: Record<Status, React.ElementType> = {
  ativo:CheckCircle2, inadimplente:AlertTriangle, suspenso:Ban, inativo:Clock, em_analise:Clock,
};

const fmtBRL = (v:number) => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

function Initials({nome, regime}:{nome:string; regime:Regime}){
  const init=nome.split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const cfg={MEI:"bg-violet-100 text-violet-700", Simples:"bg-blue-100 text-blue-700",
    "Lucro Presumido":"bg-cyan-100 text-cyan-700","Lucro Real":"bg-indigo-100 text-indigo-700",
    "Doméstica":"bg-emerald-100 text-emerald-700"};
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${cfg[regime]??cfg.Simples}`}>
      {init}
    </span>
  );
}

const PAGE_SIZE=25;

function ClientesPage(){
  const navigate = useNavigate();
  const {clientes, loading, error, deleteCliente} = useClientes();
  const [query, setQuery]   = useState("");
  const [regime, setRegime] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [resp, setResp]     = useState("todos");
  const [dialogOpen, setDialog] = useState(false);
  const [editing, setEditing]   = useState<Cliente|null>(null);
  const [toDelete, setToDelete] = useState<Cliente|null>(null);
  const [sel, setSel]           = useState<Set<string>>(new Set());
  const [modalNfse, setModalNfse] = useState(false);
  const [clienteNfse, setClienteNfse] = useState<Cliente | undefined>();
  const [page, setPage]         = useState(1);

  const responsaveis = useMemo(()=>Array.from(new Set(clientes.map(c=>c.responsavel))),[clientes]);

  const filtered = useMemo(()=>{
    const q=query.trim().toLowerCase();
    return clientes.filter(c=>{
      if(q&&!`${c.razaoSocial} ${c.nomeFantasia??""} ${c.cnpj}`.toLowerCase().includes(q)) return false;
      if(regime!=="todos"&&c.regime!==regime) return false;
      if(status!=="todos"&&c.status!==status) return false;
      if(resp!=="todos"&&c.responsavel!==resp) return false;
      return true;
    });
  },[clientes,query,regime,status,resp]);

  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const pageItems=filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const kpi={
    ativos:        clientes.filter(c=>c.status==="ativo").length,
    inadimplentes: clientes.filter(c=>c.status==="inadimplente").length,
    suspensos:     clientes.filter(c=>c.status==="suspenso").length,
  };

  const toggleAll=()=>setSel(sel.size===pageItems.length?new Set():new Set(pageItems.map(c=>c.id)));
  const toggleOne=(id:string)=>{ const s=new Set(sel); s.has(id)?s.delete(id):s.add(id); setSel(s); };

  const cols: ColDef<Cliente>[] = [
    {
      key:"cliente", header:"Cliente",
      cell: c=>(
        <div className="flex items-center gap-2.5" style={{overflow:"visible",whiteSpace:"normal"}}>
          <Initials nome={c.razaoSocial} regime={c.regime}/>
          <div>
            <span className="font-medium text-foreground leading-tight">
              {c.razaoSocial}
            </span>
            {c.nomeFantasia && <div className="text-[11px] text-muted-foreground">{c.nomeFantasia}</div>}
          </div>
        </div>
      ),
    },
    {
      key:"cnpj", header:"CNPJ",
      headerClassName:"hidden md:table-cell", className:"hidden md:table-cell font-mono text-sm text-muted-foreground",
      cell: c=>c.cnpj,
    },
    {
      key:"regime", header:"Regime",
      headerClassName:"hidden sm:table-cell", className:"hidden sm:table-cell",
      cell: c=>(
        <InlineBadge color={R_C[c.regime]} dot>
          {REGIME_LABEL[c.regime]??c.regime}
          {c.regimeHibrido && <span className="ml-1 opacity-60">·H</span>}
        </InlineBadge>
      ),
    },
    {
      key:"responsavel", header:"Resp.",
      headerClassName:"hidden lg:table-cell", className:"hidden lg:table-cell text-sm text-muted-foreground",
      cell: c=>(
        <div style={{overflow:"visible",whiteSpace:"normal"}}>
          <div>{c.responsavel}</div>
          {c.endereco?.municipio && <div className="text-[11px] opacity-60">{c.endereco.municipio}{c.endereco.uf?` · ${c.endereco.uf}`:""}</div>}
        </div>
      ),
    },
    {
      key:"honorario", header:"Honorário",
      headerClassName:"hidden md:table-cell text-right", className:"hidden md:table-cell text-right tabular-nums text-sm font-medium",
      cell: c=>c.valorHonorario?fmtBRL(c.valorHonorario):"-",
    },
    {
      key:"status", header:"Status",
      cell: c=>{
        const Icon=S_I[c.status]??Clock;
        return (
          <div className="flex items-center gap-1.5">
            <InlineBadge color={S_C[c.status]} dot>
              <Icon className="h-3 w-3"/>{STATUS_LABEL[c.status]??c.status}
            </InlineBadge>
          </div>
        );
      },
    },
    {
      key:"acoes", header:"", headerClassName:"w-24 text-right", className:"w-24 text-right",
      cell: c=>(
        <div data-no-rowclick className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" title="Emitir NFS-e"
            onClick={e => { e.stopPropagation(); setClienteNfse(c); setModalNfse(true); }}>
            <FileText className="h-3.5 w-3.5"/>
          </Button>
          {c.whatsapp && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
              title={`Abrir conversa — ${c.whatsapp}`}
              onClick={() => navigate({ to: "/whatsapp", search: { tel: c.whatsapp!.replace(/\D/g,""), nome: c.razaoSocial } })}>
              <MessageCircle className="h-3.5 w-3.5"/>
            </Button>
          )}
          {c.telefone && (
            <a href={`tel:${c.telefone}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                <Phone className="h-3.5 w-3.5"/>
              </Button>
            </a>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5"/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate({ to: "/clientes/$id", params: { id: c.id } })}>
                <ExternalLink className="h-4 w-4"/> Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={()=>{setEditing(c);setDialog(true);}}>
                <Pencil className="h-4 w-4"/> Editar
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={()=>setToDelete(c)}>
                <Trash2 className="h-4 w-4"/> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  if(error){
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border bg-red-50 p-10 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500 mb-3"/>
        <p className="font-medium text-red-700">Erro ao carregar clientes</p>
        <p className="text-sm text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-5">

      <PageHeader
        title="Clientes"
        subtitle={loading ? "Carregando…" : `${clientes.length} clientes cadastrados`}
        actions={
          <>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-9"
            onClick={() => { setClienteNfse(undefined); setModalNfse(true); }}>
            <FileText className="h-4 w-4"/> Emitir NFS-e
          </Button>
          <Button size="sm" className="rounded-xl gap-1.5 h-9"
            onClick={()=>{setEditing(null);setDialog(true);}}>
            <Plus className="h-4 w-4"/> Novo Cliente
          </Button>
          </>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard icon={CheckCircle2} tone="success" label="Ativos"        value={kpi.ativos} />
        <KpiCard icon={AlertTriangle} tone="warning" label="Inadimplentes" value={kpi.inadimplentes} />
        <KpiCard icon={Ban}           tone="danger"  label="Suspensos"     value={kpi.suspensos} />
        <KpiCard icon={Users}         tone="neutral" label="Total"         value={clientes.length} />
      </KpiGrid>


      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/>
        </div>
      )}

      {!loading && (
        <>
          <DataTable
            onRowClick={(c) => navigate({ to: "/clientes/$id", params: { id: c.id } })}
            rows={pageItems}
            cols={cols}
            getKey={c=>c.id}
            selected={sel}
            onToggleAll={toggleAll}
            onToggleRow={toggleOne}
            emptyIcon={<Users className="h-8 w-8"/>}
            emptyText="Nenhum cliente encontrado para os filtros"
            toolbar={
              <>
                <TableSearch value={query} onChange={v=>{setQuery(v);setPage(1);}} placeholder="Razão social, fantasia ou CNPJ…"/>
                <Select value={regime} onValueChange={v=>{setRegime(v);setPage(1);}}>
                  <SelectTrigger className="h-8 w-40 rounded-lg text-xs"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos regimes</SelectItem>
                    <SelectItem value="MEI">MEI</SelectItem>
                    <SelectItem value="Simples">Simples Nacional</SelectItem>
                    <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                    <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                    <SelectItem value="Doméstica">Doméstica</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={v=>{setStatus(v);setPage(1);}}>
                  <SelectTrigger className="h-8 w-32 rounded-lg text-xs"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos status</SelectItem>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inadimplente">Inadimplente</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={resp} onValueChange={v=>{setResp(v);setPage(1);}}>
                  <SelectTrigger className="h-8 w-36 rounded-lg text-xs"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos resp.</SelectItem>
                    {responsaveis.map(r=><SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            }
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TableFooter total={filtered.length} filtered={pageItems.length} selected={sel.size}/>
            <Pagination page={page} totalPages={totalPages} onChange={setPage}
              pageSize={PAGE_SIZE} total={filtered.length}/>
          </div>
        </>
      )}

      <ClienteFormDialog open={dialogOpen} onOpenChange={setDialog} cliente={editing}/>

      <AlertDialog open={!!toDelete} onOpenChange={o=>{if(!o)setToDelete(null);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{toDelete?.razaoSocial}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async()=>{ if(!toDelete) return; await deleteCliente(toDelete.id); setToDelete(null); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    <EmitirNfseModal
      open={modalNfse}
      onClose={() => setModalNfse(false)}
      clientePreSelecionado={clienteNfse}
    />
    </>
  );
}

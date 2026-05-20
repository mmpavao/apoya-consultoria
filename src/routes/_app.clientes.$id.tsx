import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClienteFormDialog } from "@/components/ClienteFormDialog";
import { clientesStore, REGIME_LABEL, STATUS_LABEL, type Cliente } from "@/lib/clientes-store";
import { obrigacoesStore, type Obrigacao } from "@/lib/obrigacoes-store";
import { financeiroStore, type Cobranca } from "@/lib/financeiro-store";
import { nfseStore, type NfseNota } from "@/lib/nfse-store";

export const Route = createFileRoute("/_app/clientes/$id")({
  component: ClienteDetalhe,
  head: ({ params }) => ({ meta: [{ title: `Cliente · APOYA Gestão` }] }),
  loader: ({ params }) => {
    if (typeof window === "undefined") return { id: params.id };
    const c = clientesStore.get(params.id);
    if (!c) throw notFound();
    return { id: params.id };
  },
});

function fmtMoney(v?: number) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function ClienteDetalhe() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const load = () => setCliente(clientesStore.get(id) ?? null);
    load();
    window.addEventListener("apoya:clientes:changed", load);
    return () => window.removeEventListener("apoya:clientes:changed", load);
  }, [id]);

  if (!cliente) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.navigate({ to: "/clientes" })}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cliente.status === "suspenso" && (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-medium">Cliente suspenso</div>
            <div className="text-xs">O atendimento foi suspenso por inadimplência ou solicitação interna.</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/clientes" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Clientes
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{cliente.razaoSocial}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">{cliente.cnpj}</span>
            <span>·</span>
            <Badge variant="outline" className="rounded-full">{REGIME_LABEL[cliente.regime]}</Badge>
            <Badge variant="outline" className="rounded-full">{STATUS_LABEL[cliente.status]}</Badge>
            {cliente.regimeHibrido && <Badge variant="outline" className="rounded-full border-primary/30 bg-primary-soft text-primary">Regime Híbrido</Badge>}
            {cliente.tier && <Badge variant="outline" className="rounded-full">Tier: {cliente.tier}</Badge>}
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)} className="rounded-xl">
          <Pencil className="h-4 w-4" /> Editar
        </Button>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="dados">Dados Cadastrais</TabsTrigger>
          <TabsTrigger value="obrigacoes">Obrigações</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="nfse">NFS-e</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <DadosCadastrais cliente={cliente} />
        </TabsContent>
        <TabsContent value="obrigacoes" className="mt-4">
          <ObrigacoesTab clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="financeiro" className="mt-4">
          <FinanceiroTab clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="nfse" className="mt-4">
          <NfseTab clienteId={cliente.id} />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <EmptyTab title="Histórico WhatsApp" hint="Visualize o histórico de mensagens em WhatsApp → conversa do cliente." />
        </TabsContent>
        <TabsContent value="contratos" className="mt-4">
          <EmptyTab title="Contratos" hint="Esta seção ficará disponível na Fase B (Supabase Storage)." />
        </TabsContent>
      </Tabs>

      <ClienteFormDialog open={editOpen} onOpenChange={setEditOpen} cliente={cliente} />
    </div>
  );
}

function DadosCadastrais({ cliente }: { cliente: Cliente }) {
  const rows: [string, React.ReactNode][] = [
    ["Razão Social", cliente.razaoSocial],
    ["Nome Fantasia", cliente.nomeFantasia ?? "—"],
    ["CNPJ", <span className="font-mono">{cliente.cnpj}</span>],
    ["Regime", REGIME_LABEL[cliente.regime]],
    ["Tier", cliente.tier ?? "—"],
    ["Regime Híbrido", cliente.regimeHibrido ? "Sim" : "Não"],
    ["Status", STATUS_LABEL[cliente.status]],
    ["Responsável interno", cliente.responsavel],
    ["Atividade principal", cliente.atividadePrincipal ?? "—"],
    ["E-mail", cliente.email ?? "—"],
    ["Telefone", cliente.telefone ?? "—"],
    ["WhatsApp", cliente.whatsapp ?? "—"],
    ["Inscrição Municipal", cliente.inscricaoMunicipal ?? "—"],
    ["Inscrição Estadual", cliente.inscricaoEstadual ?? "—"],
    ["Código de serviço NFS-e", cliente.codigoServicoNfse ?? "—"],
    ["Dia de vencimento", cliente.diaVencimento ? `Dia ${cliente.diaVencimento}` : "—"],
    ["Honorário mensal", fmtMoney(cliente.valorHonorario)],
    ["Forma de pagamento", cliente.formaPagamento ?? "—"],
    ["Tem empregados", cliente.temEmpregados ? "Sim" : "Não"],
    ["Tem incentivo fiscal", cliente.temIncentivoFiscal ? "Sim" : "Não"],
    ["Endereço", cliente.endereco?.municipio ? `${cliente.endereco.logradouro ?? ""} ${cliente.endereco.numero ?? ""} · ${cliente.endereco.bairro ?? ""} · ${cliente.endereco.municipio}/${cliente.endereco.uf ?? ""}` : "—"],
    ["Observações", cliente.observacoes ?? "—"],
  ];
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0">
        {rows.map(([label, value], i) => (
          <div key={label} className={`flex flex-col gap-1 p-4 sm:border-b ${i % 2 === 0 ? "sm:border-r" : ""}`}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="text-sm">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ObrigacoesTab({ clienteId }: { clienteId: string }) {
  const [items, setItems] = useState<Obrigacao[]>([]);
  useEffect(() => {
    const load = () => {
      const comp = new Date().toISOString().slice(0, 7);
      setItems(obrigacoesStore.list().filter((o: Obrigacao) => o.clienteId === clienteId && o.competencia === comp));
    };
    load();
    window.addEventListener("apoya:obrigacoes:changed", load);
    window.addEventListener("apoya:clientes:changed", load);
    return () => {
      window.removeEventListener("apoya:obrigacoes:changed", load);
      window.removeEventListener("apoya:clientes:changed", load);
    };
  }, [clienteId]);
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Obrigação</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Sem obrigações no mês atual.</TableCell></TableRow>}
          {items.map((o) => (
            <TableRow key={o.id}>
              <TableCell><div className="font-medium">{o.tipo}</div><div className="text-xs text-muted-foreground">{o.descricao}</div></TableCell>
              <TableCell>{o.competencia}</TableCell>
              <TableCell>{fmtDate(o.vencimento)}</TableCell>
              <TableCell><Badge variant="outline" className="rounded-full capitalize">{o.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FinanceiroTab({ clienteId }: { clienteId: string }) {
  const [items, setItems] = useState<Cobranca[]>([]);
  useEffect(() => {
    const load = () => setItems(financeiroStore.list().filter((c) => c.clienteId === clienteId));
    load();
    window.addEventListener("apoya:financeiro:changed", load);
    return () => window.removeEventListener("apoya:financeiro:changed", load);
  }, [clienteId]);
  const total = useMemo(() => items.reduce((s, c) => s + c.valor, 0), [items]);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 text-sm shadow-sm">Total faturado para este cliente: <strong>{fmtMoney(total)}</strong> · {items.length} cobranças</div>
      <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competência</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">Sem cobranças.</TableCell></TableRow>}
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.competencia}</TableCell>
                <TableCell>{fmtDate(c.vencimento)}</TableCell>
                <TableCell>{fmtMoney(c.valor)}</TableCell>
                <TableCell>{c.forma}</TableCell>
                <TableCell><Badge variant="outline" className="rounded-full capitalize">{c.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NfseTab({ clienteId }: { clienteId: string }) {
  const [items, setItems] = useState<NfseNota[]>([]);
  useEffect(() => {
    const load = () => setItems(nfseStore.list().filter((n) => n.clienteId === clienteId));
    load();
    window.addEventListener("apoya:nfse:changed", load);
    return () => window.removeEventListener("apoya:nfse:changed", load);
  }, [clienteId]);
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número</TableHead>
            <TableHead>Competência</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">Sem NFS-e emitidas.</TableCell></TableRow>}
          {items.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="font-mono text-xs">{n.numero ?? "—"}</TableCell>
              <TableCell>{n.competencia}</TableCell>
              <TableCell>{fmtMoney(n.valorServico)}</TableCell>
              <TableCell><Badge variant="outline" className="rounded-full capitalize">{n.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyTab({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-sm">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

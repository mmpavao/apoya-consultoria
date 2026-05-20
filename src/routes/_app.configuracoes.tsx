import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  Plug,
  Plus,
  Save,
  Settings,
  Trash2,
  UserPlus,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PagePlaceholder";
import {
  configStore,
  roleLabels,
  type Escritorio,
  type Integracao,
  type TemplateWA,
  type Usuario,
  type UsuarioRole,
} from "@/lib/config-store";

export const Route = createFileRoute("/_app/configuracoes")({
  component: ConfiguracoesPage,
  head: () => ({ meta: [{ title: "Configurações · APOYA Gestão" }] }),
});

function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Usuários, integrações, templates de WhatsApp e dados do escritório"
      />

      <Tabs defaultValue="usuarios" className="space-y-4">
        <TabsList className="flex w-full flex-wrap gap-1 sm:w-auto">
          <TabsTrigger value="usuarios" className="gap-2"><Users className="h-4 w-4" />Usuários</TabsTrigger>
          <TabsTrigger value="integracoes" className="gap-2"><Plug className="h-4 w-4" />Integrações</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><MessageSquare className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="escritorio" className="gap-2"><Building2 className="h-4 w-4" />Escritório</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="integracoes"><IntegracoesTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="escritorio"><EscritorioTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Usuários ---------------- */

function UsuariosTab() {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Usuario | null>(null);

  function refresh() { setUsers(configStore.listUsers()); }
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("apoya:config:changed", h);
    return () => window.removeEventListener("apoya:config:changed", h);
  }, []);

  function novo() {
    setEdit({
      id: crypto.randomUUID(),
      nome: "",
      email: "",
      role: "fiscal",
      ativo: true,
      criadoEm: new Date().toISOString().slice(0, 10),
    });
    setOpen(true);
  }

  function salvar() {
    if (!edit) return;
    if (!edit.nome.trim() || !edit.email.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    configStore.saveUser(edit);
    toast.success("Usuário salvo");
    setOpen(false);
    setEdit(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{users.length} usuários · {users.filter(u => u.ativo).length} ativos</div>
        <Button className="rounded-xl gap-2" onClick={novo}>
          <UserPlus className="h-4 w-4" /> Novo usuário
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.nome}</div>
                  <div className="text-xs text-muted-foreground md:hidden">{u.email}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-full">{roleLabels[u.role]}</Badge>
                </TableCell>
                <TableCell>
                  <Switch checked={u.ativo} onCheckedChange={() => { configStore.toggleUser(u.id); refresh(); }} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEdit(u); setOpen(true); }}>Editar</Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm("Remover este usuário?")) { configStore.removeUser(u.id); refresh(); toast.success("Usuário removido"); }
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEdit(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{edit && users.find(u => u.id === edit.id) ? "Editar" : "Novo"} usuário</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Perfil</Label>
                <Select value={edit.role} onValueChange={(v) => setEdit({ ...edit, role: v as UsuarioRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(roleLabels) as UsuarioRole[]).map((r) => (
                      <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm">Usuário ativo</div>
                <Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} className="gap-2"><Save className="h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Integrações ---------------- */

function IntegracoesTab() {
  const [list, setList] = useState<Integracao[]>([]);
  const [testing, setTesting] = useState<string | null>(null);

  function refresh() { setList(configStore.listIntegracoes()); }
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("apoya:config:changed", h);
    return () => window.removeEventListener("apoya:config:changed", h);
  }, []);

  async function test(id: Integracao["id"]) {
    setTesting(id);
    const r = await configStore.testIntegracao(id);
    setTesting(null);
    refresh();
    if (r.ok) toast.success(`${r.msg} · ${r.latencyMs}ms`);
    else toast.error(r.msg);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {list.map((i) => (
        <div key={i.id} className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{i.nome}</div>
                <div className="text-xs text-muted-foreground">{i.descricao}</div>
              </div>
            </div>
            <Switch checked={i.ativo} onCheckedChange={() => { configStore.toggleIntegracao(i.id); refresh(); }} />
          </div>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><KeyRound className="h-3 w-3" /> API Key</Label>
              <Input
                value={i.apiKey}
                onChange={(e) => configStore.saveIntegracao({ ...i, apiKey: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Base URL</Label>
              <Input
                value={i.baseUrl}
                onChange={(e) => configStore.saveIntegracao({ ...i, baseUrl: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-xs text-muted-foreground">
              {i.ultimaSync ? (
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  Última sync {new Date(i.ultimaSync).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" /> Nunca sincronizado
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" disabled={testing === i.id} onClick={() => test(i.id)}>
              {testing === i.id ? "Testando..." : "Testar conexão"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Templates WhatsApp ---------------- */

const EVENTO_LABEL: Record<TemplateWA["evento"], string> = {
  "das-gerado": "DAS gerado",
  "nfse-emitida": "NFS-e emitida",
  "cobranca-vencendo": "Cobrança vencendo",
  "cobranca-vencida": "Cobrança vencida",
  "boas-vindas": "Boas-vindas",
};

function TemplatesTab() {
  const [list, setList] = useState<TemplateWA[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<TemplateWA | null>(null);

  function refresh() { setList(configStore.listTemplates()); }
  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("apoya:config:changed", h);
    return () => window.removeEventListener("apoya:config:changed", h);
  }, []);

  function novo() {
    setEdit({ id: crypto.randomUUID(), nome: "", evento: "das-gerado", texto: "", ativo: true });
    setOpen(true);
  }
  function salvar() {
    if (!edit) return;
    if (!edit.nome.trim() || !edit.texto.trim()) { toast.error("Preencha nome e texto"); return; }
    configStore.saveTemplate(edit);
    toast.success("Template salvo");
    setOpen(false); setEdit(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Use variáveis: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{"{CLIENTE} {COMP} {VENC} {VALOR} {NUMERO} {DIAS} {DESC} {LINK}"}</code>
        </div>
        <Button className="rounded-xl gap-2" onClick={novo}>
          <Plus className="h-4 w-4" /> Novo template
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((t) => (
          <div key={t.id} className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{t.nome}</div>
                <Badge variant="outline" className="mt-1 rounded-full text-[10px]">{EVENTO_LABEL[t.evento]}</Badge>
              </div>
              <Switch checked={t.ativo} onCheckedChange={(v) => { configStore.saveTemplate({ ...t, ativo: v }); refresh(); }} />
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{t.texto}</p>
            <div className="flex justify-end gap-1 border-t pt-2">
              <Button variant="ghost" size="sm" onClick={() => { setEdit(t); setOpen(true); }}>Editar</Button>
              <Button variant="ghost" size="icon" onClick={() => {
                if (confirm("Remover template?")) { configStore.removeTemplate(t.id); refresh(); toast.success("Removido"); }
              }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEdit(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Template de WhatsApp</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Evento</Label>
                <Select value={edit.evento} onValueChange={(v) => setEdit({ ...edit, evento: v as TemplateWA["evento"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENTO_LABEL) as TemplateWA["evento"][]).map((e) => (
                      <SelectItem key={e} value={e}>{EVENTO_LABEL[e]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea rows={6} value={edit.texto} onChange={(e) => setEdit({ ...edit, texto: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} className="gap-2"><Save className="h-4 w-4" />Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Escritório ---------------- */

function EscritorioTab() {
  const [esc, setEsc] = useState<Escritorio | null>(null);
  useEffect(() => { setEsc(configStore.getEscritorio()); }, []);

  if (!esc) return null;

  function salvar() {
    if (!esc) return;
    configStore.saveEscritorio(esc);
    toast.success("Dados do escritório atualizados");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <div className="font-semibold">Dados cadastrais</div>
        </div>
        <div className="space-y-3">
          <Field label="Razão Social" value={esc.razaoSocial} onChange={(v) => setEsc({ ...esc, razaoSocial: v })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CNPJ" value={esc.cnpj} onChange={(v) => setEsc({ ...esc, cnpj: v })} />
            <Field label="CRC" value={esc.crc} onChange={(v) => setEsc({ ...esc, crc: v })} />
          </div>
          <Field label="Endereço" value={esc.endereco} onChange={(v) => setEsc({ ...esc, endereco: v })} />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Settings className="h-4 w-4 text-primary" />
          <div className="font-semibold">Contato</div>
        </div>
        <div className="space-y-3">
          <Field label="Responsável técnico" value={esc.responsavel} onChange={(v) => setEsc({ ...esc, responsavel: v })} />
          <Field label="E-mail" value={esc.email} onChange={(v) => setEsc({ ...esc, email: v })} type="email" />
          <Field label="Telefone" value={esc.telefone} onChange={(v) => setEsc({ ...esc, telefone: v })} />
        </div>
        <div className="flex justify-end pt-2">
          <Button className="rounded-xl gap-2" onClick={salvar}><Save className="h-4 w-4" />Salvar</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

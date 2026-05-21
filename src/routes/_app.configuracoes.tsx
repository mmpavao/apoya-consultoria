import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useIntegracoes, type IntegracaoTipo } from "@/hooks/use-integracoes";
import { useUsuarios, type UsuarioRole, ROLE_LABELS } from "@/hooks/use-usuarios";
import { useEscritorio } from "@/hooks/use-escritorio";
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
import { WhatsappInstancesPanel } from "@/components/whatsapp/WhatsappInstancesPanel";
// config-store: migrado para hooks Supabase (use-usuarios, use-escritorio, use-integracoes)

export const Route = createFileRoute("/_app/configuracoes")({
  component: ConfiguracoesGuard,
  head: () => ({ meta: [{ title: "Configurações · APOYA Gestão" }] }),
});

// ──────────────────────────────────────────────────────────────────────
// Guard: apenas usuários com role "admin" acessam Configurações
// ──────────────────────────────────────────────────────────────────────
function ConfiguracoesGuard() {
  const { roles, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !roles.includes("admin")) {
      navigate({ to: "/" });
    }
  }, [loading, roles, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!roles.includes("admin")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-sm">
          Acesso restrito. Apenas administradores podem acessar as configurações.
        </p>
      </div>
    );
  }

  return <ConfiguracoesPageContent />;
}


function ConfiguracoesPageContent() {
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
        <TabsContent value="integracoes" className="space-y-4">
              <IntegracoesTabsWrapper />
            </TabsContent>

            <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="escritorio"><EscritorioTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Usuários ---------------- */

// ── Usuários (via useUsuarios → Supabase) ────────────────────────────────
function UsuariosTab() {
  const { usuarios, loading, updateRole } = useUsuarios();
  const [editId, setEditId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<UsuarioRole>("assistente");

  function startEdit(u: { id: string; role: UsuarioRole }) {
    setEditId(u.id);
    setNewRole(u.role);
  }

  async function saveRole() {
    if (!editId) return;
    await updateRole(editId, newRole);
    setEditId(null);
  }

  if (loading) return (
    <div className="flex h-32 items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Usuários são gerenciados via Supabase Auth. Para convidar um novo usuário, utilize o painel do Supabase → Authentication.
      </p>
      <div className="surface-card divide-y divide-border overflow-hidden">
        {usuarios.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
        )}
        {usuarios.map((u) => (
          <div key={u.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{u.nome || u.email}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {editId === u.id ? (
                <>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as UsuarioRole)}>
                    <SelectTrigger className="w-36 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(ROLE_LABELS) as [UsuarioRole, string][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={saveRole}><Save className="h-3.5 w-3.5 mr-1" />Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="rounded-full text-xs">{ROLE_LABELS[u.role]}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(u)}>
                    Editar
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ── Templates WhatsApp (via useEscritorio → Supabase) ───────────────────
function TemplatesTab() {
  const { escritorio, loading, saving, save } = useEscritorio();
  const [form, setForm] = useState({ das: "", nfse: "", cobranca: "" });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading && escritorio.id) {
      setForm({
        das:      escritorio.templateWaDas,
        nfse:     escritorio.templateWaNfse,
        cobranca: escritorio.templateWaCobranca,
      });
    }
  }, [loading, escritorio.id, escritorio.templateWaDas, escritorio.templateWaNfse, escritorio.templateWaCobranca]);

  async function handleSave() {
    await save({
      templateWaDas:      form.das,
      templateWaNfse:     form.nfse,
      templateWaCobranca: form.cobranca,
    });
    setDirty(false);
  }

  if (loading) return (
    <div className="flex h-32 items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  const varsHint = (
    <p className="text-xs text-muted-foreground">
      Variáveis: <code className="rounded bg-muted px-1 text-xs">{"{{nome}}"}</code>{" "}
      <code className="rounded bg-muted px-1 text-xs">{"{{competencia}}"}</code>{" "}
      <code className="rounded bg-muted px-1 text-xs">{"{{vencimento}}"}</code>{" "}
      <code className="rounded bg-muted px-1 text-xs">{"{{valor}}"}</code>{" "}
      <code className="rounded bg-muted px-1 text-xs">{"{{link}}"}</code>
    </p>
  );

  return (
    <div className="space-y-6">
      {varsHint}
      {[
        { key: "das",      label: "Template DAS / DASMEI",     field: "das"      as const },
        { key: "nfse",     label: "Template NFS-e emitida",    field: "nfse"     as const },
        { key: "cobranca", label: "Template Cobrança mensal",  field: "cobranca" as const },
      ].map(({ key, label, field }) => (
        <div key={key} className="space-y-2">
          <Label>{label}</Label>
          <Textarea
            value={form[field]}
            onChange={(e) => { setForm((p) => ({ ...p, [field]: e.target.value })); setDirty(true); }}
            rows={4}
            className="font-mono text-sm"
          />
        </div>
      ))}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar templates"}
        </Button>
      </div>
    </div>
  );
}

// ── Escritório (via useEscritorio → Supabase) ────────────────────────────
function EscritorioTab() {
  const { escritorio, loading, saving, save } = useEscritorio();
  const [form, setForm] = useState<Partial<typeof escritorio>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!loading) setForm(escritorio);
  }, [loading, escritorio]);

  const f = (field: keyof typeof escritorio) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setDirty(true);
  };

  if (loading) return (
    <div className="flex h-32 items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="surface-card p-5 space-y-4">
        <p className="text-sm font-semibold">Dados do Escritório</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Razão Social</Label>
            <Input value={form.razaoSocial ?? ""} onChange={f("razaoSocial")} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome Fantasia</Label>
            <Input value={form.nomeFantasia ?? ""} onChange={f("nomeFantasia")} />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input value={form.cnpj ?? ""} onChange={f("cnpj")} />
          </div>
          <div className="space-y-1.5">
            <Label>CRC</Label>
            <Input value={form.crc ?? ""} onChange={f("crc")} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={form.email ?? ""} onChange={f("email")} type="email" />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone ?? ""} onChange={f("telefone")} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp ?? ""} onChange={f("whatsapp")} />
          </div>
          <div className="space-y-1.5">
            <Label>Dia de Cobrança</Label>
            <Input value={form.diaCobranca ?? 10} onChange={f("diaCobranca")} type="number" min={1} max={28} />
          </div>
          <div className="space-y-1.5">
            <Label>Dias para Suspensão (inadimplência)</Label>
            <Input value={form.diasSuspensao ?? 45} onChange={f("diasSuspensao")} type="number" min={1} />
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => save(form)} disabled={saving || !dirty}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar dados"}
        </Button>
      </div>
    </div>
  );
}


// ── Aba de Integrações (Supabase — sem apiKey no frontend) ───────────────
function IntegracoesSuapbaseTab() {
  const { integracoes, loading, toggleAtiva } = useIntegracoes();

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        As chaves de API são gerenciadas pelo administrador do servidor e nunca trafegam
        pelo navegador. Aqui você pode ativar ou desativar cada integração.
      </p>
      <div className="surface-card divide-y divide-border overflow-hidden">
        {integracoes.map((integ) => (
          <div key={integ.id} className="flex items-center justify-between px-5 py-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{integ.nome}</p>
              <p className="text-xs text-muted-foreground">{integ.descricao}</p>
              {integ.updatedAt && (
                <p className="text-xs text-muted-foreground/60">
                  Atualizado: {new Date(integ.updatedAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={integ.ativa ? "border-emerald-500 text-emerald-600" : ""}>
                {integ.ativa ? "Ativa" : "Inativa"}
              </Badge>
              <Switch
                checked={integ.ativa}
                onCheckedChange={(v) => toggleAtiva(integ.id as IntegracaoTipo, v)}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
        <KeyRound className="h-3 w-3" />
        Para atualizar chaves de API, acesse o painel do Supabase → Edge Functions → Secrets.
      </p>
    </div>
  );
}

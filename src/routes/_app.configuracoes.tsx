/**
 * Configurações — APOYA Gestão
 * Reestruturado: 6 abas fragmentadas → 2 abas limpas
 *   Aba 1 — Geral:    Escritório · Usuários · Integrações · Templates · Permissões · Serviços
 *   Aba 2 — MCP/API:  Servidor MCP APOYA + API Keys + Logs
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useUsuarios, type UsuarioRole, ROLE_LABELS } from "@/hooks/use-usuarios";
import { useEscritorio } from "@/hooks/use-escritorio";
import { useEffect, useState, useCallback } from "react";
import {
  Building2, CheckCircle2, ChevronDown, ChevronUp,
  Copy, Eye, EyeOff, KeyRound, Mail, MessageSquare,
  Network, Package, Plug, Plus, RefreshCw, Save,
  Shield, Trash2, UserPlus, Users, XCircle, Zap,
  Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PagePlaceholder";
import { PermissoesTab } from "@/components/PermissoesTab";
import { supabase } from "@/integrations/supabase/client";
import { APP_VERSION, APP_BUILD_DATE, APP_BUILD_TS, APP_SPRINT, VERSION_HISTORY } from "@/lib/version";

export const Route = createFileRoute("/_app/configuracoes")({
  component: ConfiguracoesPage,
  head: () => ({ meta: [{ title: "Configurações · APOYA Gestão" }] }),
});

// ─── helpers ───────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-foreground mb-3">{children}</p>;
}

// ─── Configurações raiz ────────────────────────────────────────────────────
function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        subtitle="Escritório · Usuários · Templates · Permissões"
      />
      <Tabs defaultValue="escritorio" className="space-y-5">
        <TabsList className="h-10 rounded-xl bg-muted/60 p-1 flex flex-wrap gap-0.5">
          <TabsTrigger value="escritorio" className="gap-2 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" />Escritório
          </TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-2 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" />Usuários
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <MessageSquare className="h-4 w-4" />Templates WA
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="gap-2 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Shield className="h-4 w-4" />Permissões
          </TabsTrigger>
          <TabsTrigger value="servicos" className="gap-2 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Package className="h-4 w-4" />Serviços
          </TabsTrigger>
          <TabsTrigger value="sistema" className="gap-2 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Info className="h-4 w-4" /> Sistema
          </TabsTrigger>
        </TabsList>

        {/* ── ABA ESCRITÓRIO ── */}
        <TabsContent value="escritorio" className="space-y-6">
          <EscritorioSection />
        </TabsContent>

        {/* ── ABA USUÁRIOS ── */}
        <TabsContent value="usuarios" className="space-y-6">
          <UsuariosSection />
        </TabsContent>

        {/* ── ABA WHATSAPP ── */}
        <TabsContent value="whatsapp" className="space-y-6">
          <TemplatesSection />
        </TabsContent>

        {/* ── ABA PERMISSÕES ── */}
        <TabsContent value="permissoes" className="space-y-6">
          <PermissoesTab />
        </TabsContent>

        {/* ── ABA SERVIÇOS ── */}
        <TabsContent value="servicos" className="space-y-6">
          <section>
            <SectionTitle>📦 Catálogo de Serviços</SectionTitle>
            <div className="surface-card p-6 rounded-xl flex items-center gap-4">
              <Package className="h-10 w-10 text-primary/40 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">20 serviços padrão carregados</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gerencie o catálogo de serviços disponíveis para contratação.
                </p>
              </div>
              <Link to="/configuracoes/servicos">
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5">
                  <Package className="h-4 w-4" />Gerenciar
                </Button>
              </Link>
            </div>
          </section>
        </TabsContent>

        {/* ── ABA SISTEMA ── (antes vivia dentro do McpSection → aba morta) */}
        <TabsContent value="sistema" className="space-y-6">
          {/* Versão atual */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">APOYA CONTABILIDADE</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{APP_SPRINT}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-mono font-semibold text-emerald-700">
                v{APP_VERSION}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground">Data do deploy</p>
                <p className="font-medium text-foreground mt-0.5">{APP_BUILD_DATE}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Timestamp</p>
                <p className="font-medium text-foreground mt-0.5 font-mono">{APP_BUILD_TS}</p>
              </div>
            </div>
          </div>

          {/* Histórico de versões */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Histórico de versões</h3>
            <div className="space-y-4">
              {VERSION_HISTORY.map((v) => (
                <div key={v.version} className="border-l-2 border-border pl-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-foreground">v{v.version}</span>
                    <span className="text-xs text-muted-foreground">{v.date}</span>
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{v.sha}</span>
                    <span className="text-xs text-muted-foreground">{v.sprint}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {v.changes.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-emerald-500 mt-0.5">✓</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SEÇÃO: ESCRITÓRIO
// ═══════════════════════════════════════════════════════════════════════
function EscritorioSection() {
  const { escritorio, loading, saving, save } = useEscritorio();
  const [form, setForm] = useState<Partial<typeof escritorio>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (!loading) setForm(escritorio); }, [loading, escritorio]);

  const f = (field: keyof typeof escritorio) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setDirty(true);
  };

  if (loading) return <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto my-6" />;

  return (
    <div className="surface-card p-5 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Razão Social",     field: "razaoSocial"   as const },
          { label: "Nome Fantasia",    field: "nomeFantasia"  as const },
          { label: "CNPJ",             field: "cnpj"          as const },
          { label: "CRC",              field: "crc"           as const },
          { label: "E-mail",           field: "email"         as const, type: "email" },
          { label: "Telefone",         field: "telefone"      as const },
          { label: "WhatsApp",         field: "whatsapp"      as const },
          { label: "Dia de Cobrança",  field: "diaCobranca"   as const, type: "number" },
          { label: "Dias para Suspensão", field: "diasSuspensao" as const, type: "number" },
        ].map(({ label, field, type }) => (
          <div key={field} className="space-y-1.5">
            <Label>{label}</Label>
            <Input value={(form as any)[field] ?? ""} onChange={f(field)} type={type} />
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => save(form)} disabled={saving || !dirty} className="gap-2">
          <Save className="h-4 w-4" />{saving ? "Salvando…" : "Salvar dados"}
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SEÇÃO: USUÁRIOS — corrigido: busca de profiles + convite via API
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// SEÇÃO: USUÁRIOS — humanos + agentes IA com badge visual
// ═══════════════════════════════════════════════════════════════════════
function UsuariosSection() {
  const { usuarios, loading, updateRole, refresh } = useUsuarios();
  const { session } = useAuth() as any;
  const [editId, setEditId]     = useState<string | null>(null);
  const [newRole, setNewRole]   = useState<UsuarioRole>("assistente");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNome,  setInviteNome]  = useState("");
  const [inviteRole,  setInviteRole]  = useState<UsuarioRole>("assistente");
  const [inviting,    setInviting]    = useState(false);

  async function saveRole() {
    if (!editId) return;
    await updateRole(editId, newRole);
    setEditId(null);
  }

  async function handleConvidar() {
    if (!inviteEmail.includes("@")) { toast.error("E-mail inválido"); return; }
    setInviting(true);
    try {
      if (inviteRole === "agente") {
        // Agentes IA: criar direto no banco sem enviar e-mail
        const { data: created, error: err } = await (supabase as any)
          .from("profiles").insert({
            id: crypto.randomUUID(),
            email: inviteEmail,
            nome: inviteNome || inviteEmail,
          }).select("id").single();
        if (err) throw err;
        await (supabase as any).from("user_roles").insert({ user_id: created.id, role: "agente" });
        toast.success(`Agente "${inviteNome || inviteEmail}" cadastrado!`);
      } else {
        // Humanos: convidar via API (envia e-mail)
        const token = session?.access_token;
        const res = await fetch("/api/usuarios/convidar", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ email: inviteEmail, nome: inviteNome, role: inviteRole }),
        });
        const data = await res.json() as any;
        if (!res.ok) throw new Error(data.error ?? "Erro ao convidar");
        toast.success(data.message ?? `Convite enviado para ${inviteEmail}!`);
      }
      setInviteOpen(false);
      setInviteEmail(""); setInviteNome(""); setInviteRole("assistente");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar usuário");
    } finally {
      setInviting(false);
    }
  }

  // Separar humanos de agentes para exibição
  const humanos = usuarios.filter(u => !u.isAgent);
  const agentes = usuarios.filter(u => u.isAgent);

  function UserRow({ u }: { u: typeof usuarios[0] }) {
    return (
      <div key={u.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
        <div className="min-w-0 flex items-center gap-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            u.isAgent ? "bg-violet-100 text-violet-700" : "bg-primary/10 text-primary"
          }`}>
            {u.isAgent ? "🤖" : (u.nome || u.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium truncate">{u.nome || u.email}</p>
            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {editId === u.id ? (
            <>
              <Select value={newRole} onValueChange={v => setNewRole(v as UsuarioRole)}>
                <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [UsuarioRole, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={saveRole} className="gap-1"><Save className="h-3.5 w-3.5" />Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
            </>
          ) : (
            <>
              <Badge
                variant="outline"
                className={`rounded-full text-xs ${u.isAgent ? "border-violet-300 text-violet-700 bg-violet-50" : ""}`}>
                {ROLE_LABELS[u.role] ?? u.role}
              </Badge>
              <Button size="sm" variant="ghost" onClick={() => { setEditId(u.id); setNewRole(u.role); }}>
                Editar
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {loading && (
        <div className="py-8 flex justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {/* Humanos */}
      {!loading && humanos.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-2.5 bg-muted/40 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Equipe Humana ({humanos.length})</p>
          </div>
          <div className="divide-y divide-border">
            {humanos.map(u => <UserRow key={u.id} u={u} />)}
          </div>
        </div>
      )}

      {/* Agentes IA */}
      {!loading && agentes.length > 0 && (
        <div className="surface-card overflow-hidden">
          <div className="px-5 py-2.5 bg-violet-50/60 border-b border-violet-100">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">🤖 Agentes IA ({agentes.length})</p>
          </div>
          <div className="divide-y divide-border">
            {agentes.map(u => <UserRow key={u.id} u={u} />)}
          </div>
        </div>
      )}

      {!loading && usuarios.length === 0 && (
        <div className="surface-card py-8 text-center text-sm text-muted-foreground">
          Nenhum usuário cadastrado ainda.
        </div>
      )}

      {/* Botão convidar */}
      <Button size="sm" variant="outline" className="gap-2 rounded-xl" onClick={() => setInviteOpen(true)}>
        <UserPlus className="h-4 w-4" />Adicionar usuário
      </Button>

      {/* Modal novo usuário/agente */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />Adicionar usuário
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>Perfil de acesso</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as UsuarioRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABELS) as [UsuarioRole, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {inviteRole === "agente" && (
                <p className="text-xs text-violet-600 bg-violet-50 rounded-lg px-3 py-2 mt-1">
                  🤖 Agentes IA são cadastrados diretamente — nenhum e-mail de convite é enviado.
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input placeholder="Nome do usuário ou agente" value={inviteNome} onChange={e => setInviteNome(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>E-mail {inviteRole !== "agente" && <span className="text-red-500">*</span>}</Label>
              <Input
                type="email"
                placeholder={inviteRole === "agente" ? "agente@sistema.io (opcional)" : "nome@exemplo.com"}
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleConvidar} disabled={inviting} className="gap-2">
              {inviting
                ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : inviteRole === "agente" ? "🤖" : <Mail className="h-4 w-4" />}
              {inviteRole === "agente" ? "Cadastrar agente" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SEÇÃO: INTEGRAÇÕES — cards com toggle + descrição
// ═══════════════════════════════════════════════════════════════════════

const INTEG_META: Record<string, { icon: string; descricao: string; label: string }> = {
  evolution:  { icon: "💬", label: "WhatsApp",  descricao: "Envio de mensagens via Evolution API self-hosted" },
  serpro:     { icon: "🏛️", label: "SERPRO",    descricao: "Consultas fiscais MEI, PGDAS, Simples Nacional via gateway" },
  focus:      { icon: "🧾", label: "Focus NF-e", descricao: "Emissão de NFS-e e consulta de notas fiscais" },
  asaas:      { icon: "💰", label: "Asaas",     descricao: "Cobranças, boletos e Pix via Asaas" },
  clicksign:  { icon: "✍️", label: "ClickSign", descricao: "Assinatura eletrônica de contratos" },
  elevenlabs: { icon: "🎙️", label: "ElevenLabs",descricao: "Síntese de voz para atendimento automatizado" },
};


// ═══════════════════════════════════════════════════════════════════════
// SEÇÃO: TEMPLATES WHATSAPP
// ═══════════════════════════════════════════════════════════════════════
function TemplatesSection() {
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
    await save({ templateWaDas: form.das, templateWaNfse: form.nfse, templateWaCobranca: form.cobranca });
    setDirty(false);
  }

  if (loading) return <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto my-4" />;

  const varsHint = (
    <p className="text-xs text-muted-foreground">
      Variáveis:{" "}
      {["{{nome}}", "{{competencia}}", "{{vencimento}}", "{{valor}}", "{{link}}"].map(v => (
        <code key={v} className="rounded bg-muted px-1 text-xs mx-0.5">{v}</code>
      ))}
    </p>
  );

  return (
    <div className="surface-card p-5 space-y-5">
      {varsHint}
      {([
        { key: "das",      label: "Template DAS / DASMEI"   },
        { key: "nfse",     label: "Template NFS-e emitida"  },
        { key: "cobranca", label: "Template Cobrança mensal"},
      ] as const).map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <Label>{label}</Label>
          <Textarea
            value={form[key]}
            onChange={e => { setForm(p => ({ ...p, [key]: e.target.value })); setDirty(true); }}
            rows={4}
            className="font-mono text-sm"
          />
        </div>
      ))}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
          <Save className="h-4 w-4" />{saving ? "Salvando…" : "Salvar templates"}
        </Button>
      </div>
    </div>
  );
}


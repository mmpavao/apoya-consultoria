/**
 * Configurações — APOYA Gestão
 * Reestruturado: 6 abas fragmentadas → 2 abas limpas
 *   Aba 1 — Geral:    Escritório · Usuários · Integrações · Templates · Permissões · Serviços
 *   Aba 2 — MCP/API:  Servidor MCP APOYA + API Keys + Logs
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useIntegracoes, type IntegracaoTipo } from "@/hooks/use-integracoes";
import { useUsuarios, type UsuarioRole, ROLE_LABELS } from "@/hooks/use-usuarios";
import { useEscritorio } from "@/hooks/use-escritorio";
import { useEffect, useState, useCallback } from "react";
import {
  Building2, CheckCircle2, ChevronDown, ChevronUp,
  Copy, Eye, EyeOff, KeyRound, Mail, MessageSquare,
  Network, Package, Plug, Plus, RefreshCw, Save,
  Shield, Trash2, UserPlus, Users, XCircle, Zap,
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PagePlaceholder";
import { WhatsappInstancesPanel } from "@/components/whatsapp/WhatsappInstancesPanel";
import { PermissoesTab } from "@/components/PermissoesTab";
import { supabase } from "@/integrations/supabase/client";

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
        subtitle="Escritório · Usuários · Integrações · MCP"
      />
      <Tabs defaultValue="geral" className="space-y-5">
        <TabsList className="h-10 rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="geral"   className="gap-2 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Building2 className="h-4 w-4" />Geral
          </TabsTrigger>
          <TabsTrigger value="mcp"     className="gap-2 rounded-lg text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Network className="h-4 w-4" />MCP / API
          </TabsTrigger>
        </TabsList>

        {/* ── ABA GERAL ── */}
        <TabsContent value="geral" className="space-y-8">
          {/* Escritório */}
          <section>
            <SectionTitle>🏢 Escritório</SectionTitle>
            <EscritorioSection />
          </section>

          {/* Usuários */}
          <section>
            <SectionTitle>👤 Usuários</SectionTitle>
            <UsuariosSection />
          </section>

          {/* Integrações */}
          <section>
            <SectionTitle>🔌 Integrações</SectionTitle>
            <IntegracoesSection />
          </section>

          {/* Templates WhatsApp */}
          <section>
            <SectionTitle>💬 Templates WhatsApp</SectionTitle>
            <TemplatesSection />
          </section>

          {/* Permissões */}
          <section>
            <SectionTitle>🛡️ Permissões e Setores</SectionTitle>
            <PermissoesTab />
          </section>

          {/* Serviços */}
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

        {/* ── ABA MCP/API ── */}
        <TabsContent value="mcp" className="space-y-8">
          <McpSection />
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
      const token = session?.access_token;
      const res = await fetch("/api/usuarios/convidar", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail, nome: inviteNome, role: inviteRole }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error ?? "Erro ao convidar");
      toast.success(data.message ?? `Convite enviado para ${inviteEmail}!`);
      setInviteOpen(false);
      setInviteEmail(""); setInviteNome(""); setInviteRole("assistente");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao convidar usuário");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="surface-card divide-y divide-border overflow-hidden">
        {loading && (
          <div className="py-8 flex justify-center">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && usuarios.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhum usuário cadastrado ainda.
          </div>
        )}
        {usuarios.map(u => (
          <div key={u.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
            <div className="min-w-0 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {(u.nome || u.email).charAt(0).toUpperCase()}
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
                  <Badge variant="outline" className="rounded-full text-xs">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => { setEditId(u.id); setNewRole(u.role); }}>
                    Editar
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Botão convidar */}
      <Button size="sm" variant="outline" className="gap-2 rounded-xl" onClick={() => setInviteOpen(true)}>
        <UserPlus className="h-4 w-4" />Convidar usuário
      </Button>

      {/* Modal convite */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />Convidar usuário
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="nome@exemplo.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input
                placeholder="Nome completo"
                value={inviteNome}
                onChange={e => setInviteNome(e.target.value)}
              />
            </div>
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleConvidar} disabled={inviting} className="gap-2">
              {inviting ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Mail className="h-4 w-4" />}
              Enviar convite
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
  nfeio:      { icon: "🧾", label: "NFE.io",    descricao: "Emissão de NFS-e e consulta de notas fiscais" },
  asaas:      { icon: "💰", label: "Asaas",     descricao: "Cobranças, boletos e Pix via Asaas" },
  clicksign:  { icon: "✍️", label: "ClickSign", descricao: "Assinatura eletrônica de contratos" },
  elevenlabs: { icon: "🎙️", label: "ElevenLabs",descricao: "Síntese de voz para atendimento automatizado" },
};

function IntegracoesSection() {
  const { integracoes, loading, toggleAtiva } = useIntegracoes();

  if (loading) return <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto my-4" />;

  return (
    <div className="space-y-2">
      {/* WhatsApp inline */}
      <div className="surface-card p-0 overflow-hidden divide-y divide-border">
        {integracoes.map(integ => {
          const meta = INTEG_META[integ.tipo] ?? { icon: "🔌", label: integ.tipo, descricao: "" };
          return (
            <div key={integ.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{meta.icon}</span>
                <div>
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">{integ.descricao || meta.descricao}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-medium ${integ.ativa ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {integ.ativa ? "Ativa" : "Inativa"}
                </span>
                <Switch
                  checked={integ.ativa}
                  onCheckedChange={v => toggleAtiva(integ.id as IntegracaoTipo, v)}
                />
              </div>
            </div>
          );
        })}
      </div>
      {/* WhatsApp expandido */}
      <details className="surface-card overflow-hidden">
        <summary className="flex items-center gap-2 px-5 py-3.5 cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <MessageSquare className="h-4 w-4" />
          Configurar instâncias WhatsApp
          <ChevronDown className="h-4 w-4 ml-auto" />
        </summary>
        <div className="border-t border-border px-4 py-4">
          <WhatsappInstancesPanel />
        </div>
      </details>
      <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5 pt-1">
        <KeyRound className="h-3 w-3" />
        Chaves de API são gerenciadas no servidor e nunca trafegam pelo navegador.
      </p>
    </div>
  );
}

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

// ═══════════════════════════════════════════════════════════════════════
// ABA MCP/API — servidor MCP + API Keys + Logs
// ═══════════════════════════════════════════════════════════════════════
const MCP_URL = "https://apoya-mcp.talkzzbot.workers.dev/mcp";

const MCP_TOOLS = [
  "clientes_listar","cliente_buscar","cliente_criar","cliente_atualizar","cliente_excluir","cliente_socios_listar","cliente_socio_criar",
  "usuarios_listar","usuario_buscar","usuario_role_atualizar","usuario_convidar","permissoes_listar","permissoes_atualizar","convites_listar",
  "obrigacoes_listar","obrigacao_criar","obrigacao_atualizar",
  "cobrancas_listar","cobranca_criar","cobranca_atualizar","lancamentos_listar","lancamento_criar","apuracao_buscar","apuracao_registrar",
  "tarefas_listar","tarefa_buscar","tarefa_criar","tarefa_atualizar","tarefa_comentar",
  "whatsapp_enviar","whatsapp_conversas_listar","whatsapp_mensagens_listar","whatsapp_mensagens_pendentes","whatsapp_instancias",
  "nfse_emitir","nfse_listar","das_listar","das_gerar","serpro_consultar",
  "documentos_listar","documento_registrar",
  "escritorio_config_ler","escritorio_config_atualizar","integracoes_listar","integracao_toggle",
  "automacoes_listar","automacao_toggle",
  "mcp_keys_listar","mcp_key_revogar","mcp_key_excluir",
  "agente_log","logs_listar","calendario_fiscal",
];

const SNIPPETS: Record<string, string> = {
  base44: JSON.stringify({ mcpServers: { apoya: { url: MCP_URL, headers: { Authorization: "Bearer SUA_API_KEY" } } } }, null, 2),
  claude: JSON.stringify({ mcpServers: { apoya: { command: "npx", args: ["-y","mcp-remote", MCP_URL], env: { MCP_AUTH_HEADER: "Authorization: Bearer SUA_API_KEY" } } } }, null, 2),
  n8n: `POST ${MCP_URL}\nAuthorization: Bearer SUA_API_KEY\nContent-Type: application/json\n\n{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"clientes_listar","arguments":{}}}`,
};

type ApiKey = { id: string; agent_name: string; description: string | null; is_active: boolean; last_used_at: string | null; created_at: string; expires_at: string | null; };
type LogEntry = { id: string; agente: string; acao: string; resultado: string; executado_em: string; };

function McpSection() {
  const [keys, setKeys]               = useState<ApiKey[]>([]);
  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [toolsOpen, setToolsOpen]     = useState(false);
  const [showRevogadas, setShowRevogadas] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeSnippet, setActiveSnippet] = useState<"base44"|"claude"|"n8n">("base44");
  const [modalOpen, setModalOpen]     = useState(false);
  const [newKeyName, setNewKeyName]   = useState("");
  const [newKeyDesc, setNewKeyDesc]   = useState("");
  const [newKeyValidade, setNewKeyValidade] = useState<"never"|"30"|"90"|"365">("never");
  const [gerandoKey, setGerandoKey]   = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedKeyCopied, setGeneratedKeyCopied] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    const { data } = await (supabase as any).from("mcp_api_keys")
      .select("id, agent_name, description, is_active, last_used_at, created_at, expires_at")
      .order("created_at");
    setKeys((data ?? []) as ApiKey[]);
    setLoadingKeys(false);
  }, []);

  const loadLogs = useCallback(async () => {
    const { data } = await (supabase as any).from("agente_logs")
      .select("id, agente, acao, resultado, executado_em")
      .order("executado_em", { ascending: false }).limit(20);
    setLogs((data ?? []) as LogEntry[]);
  }, []);

  useEffect(() => { loadKeys(); loadLogs(); }, [loadKeys, loadLogs]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const revokeKey = async (id: string) => {
    await (supabase as any).from("mcp_api_keys").update({ is_active: false }).eq("id", id);
    toast.success("Key revogada");
    loadKeys();
  };

  const deleteKey = async (id: string) => {
    await (supabase as any).from("mcp_api_keys").delete().eq("id", id);
    toast.success("Key excluída");
    loadKeys();
  };

  const gerarKey = async () => {
    if (!newKeyName.trim()) { toast.error("Nome obrigatório"); return; }
    setGerandoKey(true);
    const random = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2,"0")).join("");
    const dept   = newKeyName.toLowerCase().replace(/[^a-z0-9]/g,"-").slice(0,20);
    const rawKey = `apoya-${dept}-${random}`;
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,"0")).join("");
    let expiresAt: string | null = null;
    if (newKeyValidade !== "never") { const d = new Date(); d.setDate(d.getDate()+parseInt(newKeyValidade)); expiresAt = d.toISOString(); }
    const { error } = await (supabase as any).from("mcp_api_keys").insert({
      agent_name: newKeyName.trim(), description: newKeyDesc.trim() || null,
      key_hash: hashHex, scopes: [], is_active: true, expires_at: expiresAt,
    });
    if (error) { toast.error("Erro ao gerar key: " + error.message); setGerandoKey(false); return; }
    setGeneratedKey(rawKey);
    setGerandoKey(false);
    loadKeys();
  };

  const closeModal = () => {
    setModalOpen(false);
    setNewKeyName(""); setNewKeyDesc(""); setNewKeyValidade("never");
    setGeneratedKey(null); setGeneratedKeyCopied(false);
  };

  const visibleKeys = keys.filter(k => showRevogadas || k.is_active);
  const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6">
      {/* Servidor */}
      <div className="surface-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Servidor MCP APOYA</span>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">● Operacional</Badge>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
          <code className="flex-1 text-xs font-mono text-foreground break-all">{MCP_URL}</code>
          <button onClick={() => copy(MCP_URL, "url")} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" title="Copiar URL">
            {copiedSnippet === "url" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{MCP_TOOLS.length} ferramentas disponíveis</p>
          <button onClick={() => setToolsOpen(!toolsOpen)} className="text-xs text-primary hover:underline flex items-center gap-1">
            {toolsOpen ? <><ChevronUp className="h-3 w-3"/>Ocultar tools</> : <><ChevronDown className="h-3 w-3"/>Ver tools</>}
          </button>
        </div>
        {toolsOpen && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {MCP_TOOLS.map(t => (
              <code key={t} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground">{t}</code>
            ))}
          </div>
        )}
      </div>

      {/* Snippets */}
      <div className="surface-card p-5 space-y-3">
        <p className="font-semibold text-sm">Como conectar</p>
        <div className="flex gap-2">
          {(["base44","claude","n8n"] as const).map(k => (
            <button key={k} onClick={() => setActiveSnippet(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeSnippet===k?"bg-primary text-primary-foreground":"bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {k === "base44" ? "Base44" : k === "claude" ? "Claude" : "n8n / REST"}
            </button>
          ))}
        </div>
        <div className="relative">
          <pre className="overflow-auto rounded-xl bg-muted/60 p-4 text-xs font-mono text-foreground max-h-48">{SNIPPETS[activeSnippet]}</pre>
          <button onClick={() => copy(SNIPPETS[activeSnippet], activeSnippet)}
            className="absolute top-2 right-2 rounded-lg bg-background border p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            {copiedSnippet === activeSnippet ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500"/> : <Copy className="h-3.5 w-3.5"/>}
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">API Keys</span>
            {!loadingKeys && <Badge variant="outline" className="rounded-full text-xs">{keys.filter(k=>k.is_active).length} ativas</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowRevogadas(!showRevogadas)} className="text-xs text-muted-foreground hover:text-foreground">
              {showRevogadas ? "Ocultar revogadas" : "Ver revogadas"}
            </button>
            <Button size="sm" className="gap-1.5 h-8 rounded-xl" onClick={() => setModalOpen(true)}>
              <Plus className="h-3.5 w-3.5"/>Nova key
            </Button>
          </div>
        </div>
        {loadingKeys ? (
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" />
        ) : (
          <div className="divide-y divide-border">
            {visibleKeys.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma API Key encontrada</p>}
            {visibleKeys.map(k => (
              <div key={k.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{k.agent_name}</p>
                    {!k.is_active && <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted">Revogada</Badge>}
                  </div>
                  {k.description && <p className="text-xs text-muted-foreground truncate">{k.description}</p>}
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    Criada {fmtDate(k.created_at)}
                    {k.last_used_at && ` · Último uso ${fmtDate(k.last_used_at)}`}
                    {k.expires_at && ` · Expira ${fmtDate(k.expires_at)}`}
                  </p>
                </div>
                {k.is_active && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => revokeKey(k.id)} title="Revogar"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 transition-colors">
                      <XCircle className="h-4 w-4"/>
                    </button>
                    <button onClick={() => deleteKey(k.id)} title="Excluir permanentemente"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 className="h-4 w-4"/>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="surface-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Últimas execuções</span>
          </div>
          <button onClick={loadLogs} className="text-muted-foreground hover:text-foreground transition-colors" title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="divide-y divide-border text-xs">
          {logs.length === 0 && <p className="py-3 text-center text-muted-foreground">Nenhum log ainda.</p>}
          {logs.map(l => (
            <div key={l.id} className="py-2.5 flex items-center gap-3">
              <div className={`shrink-0 h-1.5 w-1.5 rounded-full ${l.resultado==="ok"?"bg-emerald-500":"bg-red-500"}`} />
              <span className="text-muted-foreground w-24 shrink-0 truncate">{l.agente}</span>
              <span className="flex-1 truncate font-mono">{l.acao}</span>
              <span className="text-muted-foreground/60 shrink-0">{new Date(l.executado_em).toLocaleTimeString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal nova key */}
      <Dialog open={modalOpen} onOpenChange={v => !v && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary"/>Nova API Key</DialogTitle></DialogHeader>
          {generatedKey ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                <p className="text-sm font-semibold text-emerald-800">✅ Key gerada com sucesso!</p>
                <p className="text-xs text-emerald-700">Copie agora — não será exibida novamente.</p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 text-xs font-mono bg-white rounded-lg px-3 py-2 border border-emerald-200 break-all">{generatedKey}</code>
                  <button onClick={() => { navigator.clipboard.writeText(generatedKey); setGeneratedKeyCopied(true); }}
                    className="shrink-0 text-emerald-600 hover:text-emerald-800">
                    {generatedKeyCopied ? <CheckCircle2 className="h-5 w-5"/> : <Copy className="h-5 w-5"/>}
                  </button>
                </div>
              </div>
              <Button className="w-full" onClick={closeModal}>Fechar</Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 py-2">
                <div className="grid gap-1.5">
                  <Label>Nome / agente *</Label>
                  <Input placeholder="ex: agente_fiscal" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Descrição</Label>
                  <Input placeholder="Uso desta key" value={newKeyDesc} onChange={e => setNewKeyDesc(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Validade</Label>
                  <Select value={newKeyValidade} onValueChange={v => setNewKeyValidade(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="never">Sem expiração</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="365">1 ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeModal}>Cancelar</Button>
                <Button onClick={gerarKey} disabled={gerandoKey} className="gap-2">
                  {gerandoKey ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"/> : <KeyRound className="h-4 w-4"/>}
                  Gerar key
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

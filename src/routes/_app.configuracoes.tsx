import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useIntegracoes, type IntegracaoTipo } from "@/hooks/use-integracoes";
import { useUsuarios, type UsuarioRole, ROLE_LABELS } from "@/hooks/use-usuarios";
import { useEscritorio } from "@/hooks/use-escritorio";
import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MessageSquare,
  Network,
  Package,
  Plug,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
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
import { PageHeader } from "@/components/PagePlaceholder";
import { WhatsappInstancesPanel } from "@/components/whatsapp/WhatsappInstancesPanel";
// config-store: migrado para hooks Supabase (use-usuarios, use-escritorio, use-integracoes)
import { PermissoesTab } from "@/components/PermissoesTab";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/configuracoes")({
  component: ConfiguracoesPageContent,
  head: () => ({ meta: [{ title: "Configurações · APOYA Gestão" }] }),
});

// ──────────────────────────────────────────────────────────────────────
// Configurações — acessível a admins e contadores
// O controle granular é feito dentro da página por ação


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
          <TabsTrigger value="permissoes" className="gap-2"><Shield className="h-4 w-4" />Permissões</TabsTrigger>
          <TabsTrigger value="servicos" className="gap-2"><Package className="h-4 w-4" />Serviços</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="integracoes" className="space-y-4">
              <IntegracoesTabsWrapper />
            </TabsContent>

            <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="escritorio"><EscritorioTab /></TabsContent>
        <TabsContent value="permissoes"><PermissoesTab /></TabsContent>
      <TabsContent value="servicos" className="mt-4">
            <div className="surface-card p-8 rounded-xl text-center">
              <Package className="h-10 w-10 mx-auto mb-3 text-primary/50" />
              <h3 className="font-semibold text-base mb-1">Catálogo de Serviços</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Gerencie os serviços disponíveis para contratação pelos clientes.<br/>
                20 serviços padrão já foram carregados no banco de dados.
              </p>
              <Link to="/configuracoes/servicos">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  <Package className="h-4 w-4" />Gerenciar Catálogo de Serviços →
                </button>
              </Link>
            </div>
          </TabsContent>
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

// ── Aba MCP ──────────────────────────────────────────────────────────────────
const MCP_URL = "https://apoya-mcp.talkzzbot.workers.dev/mcp";

const MCP_TOOLS = [
  "clientes_listar","cliente_buscar","cliente_criar",
  "obrigacoes_listar","obrigacao_criar","obrigacao_atualizar",
  "cobrancas_listar","lancamentos_listar","lancamento_criar",
  "apuracao_buscar","apuracao_registrar",
  "serpro_consultar","nfse_emitir","documento_registrar","agente_log",
];

const SNIPPETS: Record<string, string> = {
  base44: JSON.stringify({
    mcpServers: {
      apoya: {
        url: MCP_URL,
        headers: { Authorization: "Bearer SUA_API_KEY" }
      }
    }
  }, null, 2),
  claude: JSON.stringify({
    mcpServers: {
      apoya: {
        command: "npx",
        args: ["-y","mcp-remote", MCP_URL],
        env: { MCP_AUTH_HEADER: "Authorization: Bearer SUA_API_KEY" }
      }
    }
  }, null, 2),
  n8n: `POST ${MCP_URL}\nAuthorization: Bearer SUA_API_KEY\nContent-Type: application/json\n\n{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"clientes_listar","arguments":{}}}`,
};

type ApiKey = {
  id: string; agent_name: string; description: string | null;
  is_active: boolean; last_used_at: string | null;
  created_at: string; expires_at: string | null;
};
type LogEntry = {
  id: string; agente: string; acao: string;
  resultado: string; executado_em: string;
};

function McpTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [activeSnippet, setActiveSnippet] = useState<"base44" | "claude" | "n8n">("base44");

  // Modal nova key
  const [modalOpen, setModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDesc, setNewKeyDesc] = useState("");
  const [newKeyValidade, setNewKeyValidade] = useState<"never" | "30" | "90" | "365">("never");
  const [gerandoKey, setGerandoKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedKeyCopied, setGeneratedKeyCopied] = useState(false);

  const loadKeys = async () => {
    setLoadingKeys(true);
    const { data } = await supabase
      .from("mcp_api_keys" as any)
      .select("id, agent_name, description, is_active, last_used_at, created_at, expires_at")
      .order("created_at");
    setKeys((data ?? []) as unknown as ApiKey[]);
    setLoadingKeys(false);
  };

  const loadLogs = async () => {
    const { data } = await supabase
      .from("agente_logs" as any)
      .select("id, agente, acao, resultado, executado_em")
      .order("executado_em", { ascending: false })
      .limit(20);
    setLogs((data ?? []) as unknown as LogEntry[]);
  };

  useEffect(() => { loadKeys(); loadLogs(); }, []);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const revokeKey = async (id: string) => {
    await supabase.from("mcp_api_keys" as any).update({ is_active: false }).eq("id", id);
    toast.success("Key revogada");
    loadKeys();
  };

  const gerarKey = async () => {
    if (!newKeyName.trim()) { toast.error("Nome obrigatório"); return; }
    setGerandoKey(true);

    // Gerar key aleatória
    const random = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    const dept = newKeyName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 20);
    const rawKey = `apoya-${dept}-${random}`;

    // Hash SHA-256
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(rawKey));
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    let expiresAt: string | null = null;
    if (newKeyValidade !== "never") {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(newKeyValidade));
      expiresAt = d.toISOString();
    }

    const { error } = await supabase.from("mcp_api_keys" as any).insert({
      agent_name: newKeyName.trim(),
      description: newKeyDesc.trim() || null,
      key_hash: hashHex,
      scopes: [],
      is_active: true,
      expires_at: expiresAt,
    } as any);

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

  return (
    <div className="space-y-6">

      {/* URL do servidor */}
      <div className="surface-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Servidor MCP</span>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">● Operacional</Badge>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2.5">
          <code className="flex-1 text-xs font-mono text-foreground break-all">{MCP_URL}</code>
          <button
            onClick={() => copy(MCP_URL, "url")}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="Copiar URL"
          >
            {copiedSnippet === "url" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Protocolo MCP via HTTP/SSE. Compatible com Base44, Claude Desktop, n8n e qualquer cliente HTTP.
        </p>
      </div>

      {/* Como conectar — Snippets */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Como conectar</span>
        </div>
        <div className="flex gap-2 border-b border-border pb-3">
          {(["base44","claude","n8n"] as const).map(k => (
            <button
              key={k}
              onClick={() => setActiveSnippet(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeSnippet === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "base44" ? "Base44" : k === "claude" ? "Claude Desktop" : "n8n / HTTP"}
            </button>
          ))}
        </div>
        <div className="relative">
          <pre className="bg-muted/40 rounded-lg p-4 text-xs font-mono overflow-x-auto text-foreground leading-relaxed whitespace-pre-wrap break-all">
            {SNIPPETS[activeSnippet]}
          </pre>
          <button
            onClick={() => copy(SNIPPETS[activeSnippet], `snippet-${activeSnippet}`)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            title="Copiar snippet"
          >
            {copiedSnippet === `snippet-${activeSnippet}`
              ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Substitua <code className="bg-muted px-1 rounded">SUA_API_KEY</code> por uma das keys geradas abaixo.
        </p>
      </div>

      {/* API Keys */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">API Keys</span>
            <Badge variant="outline" className="text-xs">{keys.length} keys</Badge>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadKeys}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50"
              title="Atualizar"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5 h-8 text-xs">
              <Plus className="h-3.5 w-3.5" />Gerar nova API Key
            </Button>
          </div>
        </div>

        {loadingKeys ? (
          <div className="flex h-16 items-center justify-center">
            <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma API Key cadastrada.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Criada em</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Último acesso</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map(k => (
                  <tr key={k.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{k.agent_name}</p>
                      {k.description && <p className="text-xs text-muted-foreground">{k.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                      {new Date(k.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                      {k.last_used_at
                        ? new Date(k.last_used_at).toLocaleString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={k.is_active ? "border-emerald-500 text-emerald-600" : "border-red-400 text-red-500"}>
                        {k.is_active ? "Ativa" : "Revogada"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {k.is_active && (
                        <button
                          onClick={() => revokeKey(k.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Revogar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tools disponíveis — colapsável */}
      <div className="surface-card overflow-hidden">
        <button
          onClick={() => setToolsOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Tools disponíveis</span>
            <Badge variant="outline" className="text-xs">{MCP_TOOLS.length} tools</Badge>
          </div>
          {toolsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {toolsOpen && (
          <div className="px-5 pb-5 pt-1">
            <div className="flex flex-wrap gap-2">
              {MCP_TOOLS.map(t => (
                <code key={t} className="bg-muted/60 px-2.5 py-1 rounded-lg text-xs font-mono text-foreground">{t}</code>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Log de acessos */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Log de acessos recentes</span>
          </div>
          <button onClick={loadLogs} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted/50" title="Atualizar">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma chamada registrada ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Hora</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Agente</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Tool / Ação</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.executado_em).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-muted/60 px-1.5 py-0.5 rounded">{l.agente}</code>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{l.acao}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          l.resultado === "sucesso" || l.resultado === "ok"
                            ? "border-emerald-500 text-emerald-600 text-xs"
                            : l.resultado === "erro"
                            ? "border-red-400 text-red-500 text-xs"
                            : "text-xs"
                        }
                      >
                        {l.resultado}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal gerar nova key */}
      <Dialog open={modalOpen} onOpenChange={v => { if (!v) closeModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Gerar nova API Key
            </DialogTitle>
          </DialogHeader>

          {!generatedKey ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Nome da key <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="ex: agente_relatorios, n8n_producao..."
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição (opcional)</Label>
                <Input
                  placeholder="Para que será usada..."
                  value={newKeyDesc}
                  onChange={e => setNewKeyDesc(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
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
              <DialogFooter>
                <Button variant="outline" onClick={closeModal}>Cancelar</Button>
                <Button onClick={gerarKey} disabled={gerandoKey} className="gap-2">
                  {gerandoKey && <RefreshCw className="h-4 w-4 animate-spin" />}
                  Gerar Key
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">⚠️ Copie agora — não será exibida novamente</p>
                <p className="text-xs text-amber-700 dark:text-amber-300">Por segurança, apenas o hash é armazenado no banco.</p>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-3">
                <code className="flex-1 text-xs font-mono break-all">{generatedKey}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    setGeneratedKeyCopied(true);
                    toast.success("Key copiada!");
                  }}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {generatedKeyCopied
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <DialogFooter>
                <Button onClick={closeModal} className="w-full">Fechar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IntegracoesTabsWrapper() {
  const [sub, setSub] = useState<"apis" | "whatsapp" | "mcp">("whatsapp");
  return (
    <div className="space-y-4">
      <Tabs value={sub} onValueChange={(v) => setSub(v as "apis" | "whatsapp" | "mcp")}>
        <TabsList>
          <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare className="h-4 w-4" />WhatsApp</TabsTrigger>
          <TabsTrigger value="apis" className="gap-2"><Plug className="h-4 w-4" />APIs</TabsTrigger>
          <TabsTrigger value="mcp" className="gap-2"><Network className="h-4 w-4" />MCP</TabsTrigger>
        </TabsList>
        <TabsContent value="whatsapp" className="mt-4"><WhatsappInstancesPanel /></TabsContent>
        <TabsContent value="apis" className="mt-4"><IntegracoesSuapbaseTab /></TabsContent>
        <TabsContent value="mcp" className="mt-4"><McpTab /></TabsContent>
      </Tabs>
    </div>
  );
}

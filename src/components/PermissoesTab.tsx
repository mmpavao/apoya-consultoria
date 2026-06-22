/**
 * PermissoesTab — Aba de gestão de setores, permissões e convites
 * Localização: dentro de ConfiguracoesPageContent, tab "permissoes"
 *
 * Sub-abas:
 *   1. Usuários & Setores — atribuir setores/permissões por usuário
 *   2. Convites — enviar, listar, cancelar, reenviar
 */
import { useState } from "react";
import {
  Shield, UserPlus, Mail, Send, X, RefreshCw,
  CheckCircle2, Clock, XCircle, AlertCircle,
  ChevronDown, ChevronUp, Users, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useSetores } from "@/hooks/use-setores";
import { useConvites } from "@/hooks/use-convites";
import { useUsuarios, ROLE_LABELS, type UsuarioRole } from "@/hooks/use-usuarios";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "admin",      label: "Administrador" },
  { value: "supervisor", label: "Supervisor"     },
  { value: "contador",   label: "Contador"       },
  { value: "assistente", label: "Assistente"     },
];

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export function PermissoesTab() {
  return (
    <Tabs defaultValue="atribuicoes" className="space-y-4">
      <TabsList>
        <TabsTrigger value="atribuicoes" className="gap-2">
          <Shield className="h-4 w-4" />Permissões por Usuário
        </TabsTrigger>
        <TabsTrigger value="convites" className="gap-2">
          <UserPlus className="h-4 w-4" />Convites
        </TabsTrigger>
      </TabsList>

      <TabsContent value="atribuicoes"><AtribuicoesTab /></TabsContent>
      <TabsContent value="convites"><ConvitesTab /></TabsContent>
    </Tabs>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ABA 1: Atribuições de permissão por usuário
// ─────────────────────────────────────────────────────────────────────────────
function AtribuicoesTab() {
  const { setores, loading: loadingSetores } = useSetores();
  const { usuarios, loading: loadingUsers  } = useUsuarios();
  const [expandedUser, setExpandedUser]      = useState<string | null>(null);
  const [saving, setSaving]                  = useState(false);
  // Map: userId → Set de permissao_ids
  const [userPerms, setUserPerms]            = useState<Record<string, Set<string>>>({});
  const [loaded, setLoaded]                  = useState<Set<string>>(new Set());

  async function loadUserPerms(userId: string) {
    if (loaded.has(userId)) return;
    const { data } = await db
      .from("user_setor_permissoes")
      .select("permissao_id")
      .eq("user_id", userId);
    setUserPerms(prev => ({
      ...prev,
      [userId]: new Set((data ?? []).map((r: { permissao_id: string }) => r.permissao_id)),
    }));
    setLoaded(prev => new Set([...prev, userId]));
  }

  function toggleUser(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      loadUserPerms(userId);
    }
  }

  function togglePerm(userId: string, permId: string) {
    setUserPerms(prev => {
      const current = new Set(prev[userId] ?? []);
      if (current.has(permId)) current.delete(permId);
      else current.add(permId);
      return { ...prev, [userId]: current };
    });
  }

  async function savePerms(userId: string) {
    setSaving(true);
    try {
      // Deletar todas as permissões atuais do usuário
      await db.from("user_setor_permissoes").delete().eq("user_id", userId);

      // Inserir as novas permissões
      const perms = [...(userPerms[userId] ?? [])];
      if (perms.length > 0) {
        const rows = perms.map(permId => {
          const setor = setores.find(s => s.permissoes?.some(p => p.id === permId));
          return { user_id: userId, setor_id: setor?.id, permissao_id: permId };
        }).filter(r => r.setor_id);
        const { error } = await db.from("user_setor_permissoes").insert(rows);
        if (error) throw error;
      }

      toast.success("Permissões salvas com sucesso");
    } catch {
      toast.error("Erro ao salvar permissões");
    } finally {
      setSaving(false);
    }
  }

  if (loadingSetores || loadingUsers) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Clique em um usuário para expandir e configurar o acesso por setor e permissão.
        Administradores têm acesso total automaticamente.
      </p>

      <div className="surface-card divide-y divide-border overflow-hidden">
        {usuarios.filter(u => u.role !== "cliente").map((u) => {
          const isExpanded = expandedUser === u.id;
          const isAdmin    = u.role === "admin";

          return (
            <div key={u.id}>
              {/* Header do usuário */}
              <button
                className="flex w-full items-center justify-between px-5 py-3.5 gap-4 hover:bg-muted/30 transition-colors text-left"
                onClick={() => toggleUser(u.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {(u.nome || u.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.nome || u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="rounded-full text-xs">
                    {ROLE_LABELS[u.role as UsuarioRole] ?? u.role}
                  </Badge>
                  {isAdmin && (
                    <Badge className="rounded-full text-xs bg-primary/10 text-primary border-0">
                      Acesso total
                    </Badge>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Painel de permissões */}
              {isExpanded && !isAdmin && (
                <div className="bg-muted/20 px-5 py-4 space-y-4 border-t border-border">
                  {!loaded.has(u.id) ? (
                    <div className="flex h-16 items-center justify-center">
                      <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <>
                      {setores.map((setor) => (
                        <div key={setor.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: setor.cor }}
                            />
                            <p className="text-sm font-semibold">{setor.nome}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pl-4">
                            {(setor.permissoes ?? []).map((perm) => (
                              <label
                                key={perm.id}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <Checkbox
                                  checked={userPerms[u.id]?.has(perm.id) ?? false}
                                  onCheckedChange={() => togglePerm(u.id, perm.id)}
                                />
                                <span className="text-xs text-foreground">{perm.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end pt-2 border-t border-border">
                        <Button
                          size="sm"
                          onClick={() => savePerms(u.id)}
                          disabled={saving}
                        >
                          {saving ? "Salvando..." : "Salvar permissões"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
              {isExpanded && isAdmin && (
                <div className="bg-muted/20 px-5 py-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Administradores têm acesso irrestrito a todos os módulos. Não é necessário configurar permissões individuais.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-ABA 2: Convites
// ─────────────────────────────────────────────────────────────────────────────
function ConvitesTab() {
  const { setores } = useSetores();
  const {
    convites, loading, sending,
    pendentes, aceitos, expirados,
    enviar, cancelar, reenviar,
  } = useConvites();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    email: "", role: "assistente", mensagem: "", setores_ids: [] as string[],
  });

  function toggleSetor(id: string) {
    setForm(prev => ({
      ...prev,
      setores_ids: prev.setores_ids.includes(id)
        ? prev.setores_ids.filter(s => s !== id)
        : [...prev.setores_ids, id],
    }));
  }

  async function handleEnviar() {
    if (!form.email || !form.role) return;
    const result = await enviar({
      email: form.email,
      role: form.role,
      setores_ids: form.setores_ids,
      mensagem: form.mensagem || undefined,
    });
    if (result.ok) {
      setDialogOpen(false);
      setForm({ email: "", role: "assistente", mensagem: "", setores_ids: [] });
    }
  }

  function statusBadge(c: typeof convites[0]) {
    if (c.usado_em)     return <Badge className="pill bg-green-500/10 text-green-600 border-0 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Aceito</Badge>;
    if (c.cancelado_em) return <Badge className="pill bg-red-500/10 text-red-600 border-0 text-xs"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
    if (new Date(c.expira_em) <= new Date()) return <Badge className="pill bg-yellow-500/10 text-yellow-600 border-0 text-xs"><AlertCircle className="h-3 w-3 mr-1" />Expirado</Badge>;
    return <Badge className="pill bg-blue-500/10 text-blue-600 border-0 text-xs"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Convites pendentes: <strong>{pendentes.length}</strong> ·
            Aceitos: <strong>{aceitos.length}</strong> ·
            Expirados: <strong>{expirados.length}</strong>
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />Convidar usuário
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : convites.length === 0 ? (
        <div className="surface-card py-12 text-center">
          <Mail className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum convite enviado ainda.</p>
          <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
            <UserPlus className="h-4 w-4" />Enviar primeiro convite
          </Button>
        </div>
      ) : (
        <div className="surface-card divide-y divide-border overflow-hidden">
          {convites.map((c) => {
            const isPendente = !c.usado_em && !c.cancelado_em && new Date(c.expira_em) > new Date();
            return (
              <div key={c.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[c.role as UsuarioRole] ?? c.role}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">
                      Expira {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                    </span>
                    {c.setores_ids?.length > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          {c.setores_ids.length} setor(es)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(c)}
                  {isPendente && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => reenviar(c)} title="Reenviar">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => cancelar(c.id)} title="Cancelar">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog: Novo convite */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />Convidar usuário
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="usuario@exemplo.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Função *</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setores de acesso inicial</Label>
              <div className="grid grid-cols-2 gap-2">
                {setores.map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.setores_ids.includes(s.id)}
                      onCheckedChange={() => toggleSetor(s.id)}
                    />
                    <span className="text-sm">{s.nome}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                As permissões específicas dentro de cada setor poderão ser configuradas após o aceite.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Mensagem pessoal (opcional)</Label>
              <Textarea
                placeholder="Olá! Você foi convidado para acessar o sistema APOYA..."
                value={form.mensagem}
                onChange={e => setForm(p => ({ ...p, mensagem: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleEnviar} disabled={sending || !form.email || !form.role} className="gap-2">
              <Send className="h-4 w-4" />
              {sending ? "Enviando..." : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

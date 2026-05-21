import { useState } from "react";
import { useWaInstances, type WaInstance } from "@/hooks/use-wa-instances";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, Loader2, MessageSquare, Plus, QrCode, RefreshCw, Smartphone, Trash2, WifiOff, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DEPARTAMENTOS_SUGERIDOS = ["fiscal", "financeiro", "contábil", "dp", "atendimento", "comercial"];

export function WhatsappInstancesPanel() {
  const { instances, loading, creating, create, connect, refresh, logout, remove } = useWaInstances();
  const [open, setOpen] = useState(false);
  const [qrInstance, setQrInstance] = useState<WaInstance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WaInstance | null>(null);

  const activeQr = qrInstance ? instances.find(i => i.id === qrInstance.id) ?? qrInstance : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Instâncias do WhatsApp</h3>
          <p className="text-xs text-muted-foreground">Cada instância é um número conectado via Evolution API.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nova instância
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : instances.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-2 p-8 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma instância criada ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {instances.map((inst) => (
            <div key={inst.id} className="surface-card space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{inst.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{inst.nome}{inst.numero ? ` · +${inst.numero}` : ""}</p>
                </div>
                <StatusBadge status={inst.status} />
              </div>

              <div className="flex flex-wrap gap-1">
                {inst.departamentos.map((d) => (
                  <Badge key={d} variant="outline" className="rounded-full text-[10px] capitalize">{d}</Badge>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {inst.status !== "connected" && (
                  <Button size="sm" variant="default" onClick={() => { setQrInstance(inst); connect(inst.id).catch(e => toast.error(e.message)); }}>
                    <QrCode className="h-4 w-4" /> {inst.qr_code ? "Ver QR" : "Conectar"}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => refresh(inst.id).catch(e => toast.error(e.message))}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                {inst.status === "connected" && (
                  <Button size="sm" variant="outline" onClick={() => logout(inst.id).then(() => toast.success("Desconectada"))}>
                    <WifiOff className="h-3.5 w-3.5" /> Desconectar
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={async () => {
                  if (!confirm(`Excluir a instância "${inst.display_name}"? Esta ação remove a conexão WhatsApp.`)) return;
                  await remove(inst.id);
                  toast.success("Instância removida");
                }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateDialog
        open={open}
        onOpenChange={setOpen}
        loading={creating}
        onCreate={async (name, deps) => {
          try {
            const r = await create(name, deps);
            toast.success("Instância criada. Gerando QR code…");
            setOpen(false);
            const placeholder: WaInstance = { id: r.id, nome: r.nome, display_name: name, departamentos: deps, numero: null, status: "connecting", qr_code: null, last_qr_at: null, last_connected_at: null, created_at: "" };
            setQrInstance(placeholder);
            try { await connect(r.id); } catch (e: any) { toast.error(e?.message ?? "Falha ao gerar QR"); }
          } catch (e: any) {
            toast.error(e?.message ?? "Falha ao criar instância");
          }
        }}
      />

      <QRDialog
        instance={activeQr}
        onClose={() => setQrInstance(null)}
        onRefresh={() => activeQr && connect(activeQr.id).catch(e => toast.error(e.message))}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: WaInstance["status"] }) {
  const map: Record<WaInstance["status"], { label: string; cls: string; Icon: any }> = {
    connected:    { label: "Conectada",    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", Icon: CheckCircle2 },
    connecting:   { label: "Conectando…",  cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: Loader2 },
    creating:     { label: "Criando…",     cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: Loader2 },
    created:      { label: "Criada",       cls: "border-muted bg-muted text-muted-foreground", Icon: Smartphone },
    disconnected: { label: "Desconectada", cls: "border-destructive/30 bg-destructive/10 text-destructive", Icon: XCircle },
  };
  const m = map[status] ?? map.disconnected;
  const Icon = m.Icon;
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-full border whitespace-nowrap", m.cls)}>
      <Icon className={cn("h-3 w-3", status === "connecting" || status === "creating" ? "animate-spin" : "")} />
      {m.label}
    </Badge>
  );
}

function CreateDialog({
  open, onOpenChange, loading, onCreate,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; loading: boolean;
  onCreate: (name: string, departamentos: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [deps, setDeps] = useState<string[]>([]);
  const [custom, setCustom] = useState("");

  function toggleDep(d: string) {
    setDeps((cur) => cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d]);
  }
  function addCustom() {
    const v = custom.trim().toLowerCase();
    if (!v) return;
    if (!deps.includes(v)) setDeps([...deps, v]);
    setCustom("");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setName(""); setDeps([]); setCustom(""); } onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova instância WhatsApp</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da instância</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Fiscal · Apoya" />
            <p className="text-xs text-muted-foreground">Esse nome aparece na lista de instâncias e no chat.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Departamentos que usarão esta linha</Label>
            <div className="flex flex-wrap gap-1.5">
              {DEPARTAMENTOS_SUGERIDOS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDep(d)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs capitalize transition-colors",
                    deps.includes(d) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Outro departamento…" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
              <Button type="button" size="sm" variant="outline" onClick={addCustom}>Adicionar</Button>
            </div>
            {deps.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {deps.map((d) => (
                  <Badge key={d} variant="secondary" className="gap-1 capitalize">
                    {d}
                    <button type="button" onClick={() => toggleDep(d)} aria-label={`Remover ${d}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onCreate(name, deps)} disabled={loading || !name.trim() || deps.length === 0}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar e gerar QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QRDialog({
  instance, onClose, onRefresh,
}: {
  instance: WaInstance | null; onClose: () => void; onRefresh: () => void;
}) {
  if (!instance) return null;
  const qr = instance.qr_code ?? null;

  return (
    <Dialog open={!!instance} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar {instance.display_name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {instance.status === "connected" ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-medium">Conectada com sucesso!</p>
              {instance.numero && <p className="text-xs text-muted-foreground">+{instance.numero}</p>}
            </div>
          ) : qr ? (
            <>
              <img
                src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
                alt="QR Code"
                className="h-64 w-64 rounded-lg border bg-white p-2"
              />
              <div className="text-center text-xs text-muted-foreground">
                <p>Abra o WhatsApp no celular &gt; Dispositivos conectados &gt; Conectar dispositivo</p>
                <p className="mt-1">O QR atualiza automaticamente a cada minuto.</p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Aguardando QR code…</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" /> Gerar novo QR
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

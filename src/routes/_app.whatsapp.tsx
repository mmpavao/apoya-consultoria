import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bot, Check, CheckCheck, Circle, FileText, MessageSquare, Paperclip,
  Phone, Power, Search, Send, User, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PagePlaceholder";
import { whatsappStore, type Conversa, type ConversationTag } from "@/lib/whatsapp-store";

export const Route = createFileRoute("/_app/whatsapp")({
  component: WhatsappPage,
  head: () => ({ meta: [{ title: "WhatsApp · APOYA Gestão" }] }),
});

const TAGS: Record<ConversationTag, { label: string; cls: string }> = {
  automacao:  { label: "Automação", cls: "bg-info/10 text-info border-info/20" },
  manual:     { label: "Manual",    cls: "bg-muted text-muted-foreground border-border" },
  cobranca:   { label: "Cobrança",  cls: "bg-destructive/10 text-destructive border-destructive/20" },
  fiscal:     { label: "Fiscal",    cls: "bg-warning/10 text-warning-foreground border-warning/30" },
  suporte:    { label: "Suporte",   cls: "bg-success/10 text-success border-success/20" },
};

function WhatsappPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<"todas" | ConversationTag>("todas");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [conn, setConn] = useState<"connected" | "connecting" | "disconnected">(whatsappStore.getConnStatus());
  const [, forceTick] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const refresh = () => setConversas(whatsappStore.list());
    const refreshConn = () => setConn(whatsappStore.getConnStatus());
    const refreshTyping = () => forceTick((n) => n + 1);
    refresh();
    window.addEventListener("apoya:whatsapp:changed", refresh);
    window.addEventListener("apoya:whatsapp:conn", refreshConn);
    window.addEventListener("apoya:whatsapp:typing", refreshTyping);
    return () => {
      window.removeEventListener("apoya:whatsapp:changed", refresh);
      window.removeEventListener("apoya:whatsapp:conn", refreshConn);
      window.removeEventListener("apoya:whatsapp:typing", refreshTyping);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversas
      .filter((c) => (q ? `${c.clienteNome} ${c.telefone}`.toLowerCase().includes(q) : true))
      .filter((c) => tag === "todas" || c.tag === tag);
  }, [conversas, query, tag]);

  const active = useMemo(
    () => (activeId ? conversas.find((c) => c.id === activeId) ?? null : null),
    [activeId, conversas],
  );

  useEffect(() => {
    if (active && active.naoLidas > 0) whatsappStore.marcarLida(active.id);
  }, [active?.id]); // eslint-disable-line

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [active?.mensagens.length]);

  const totais = useMemo(() => ({
    todas: conversas.length,
    naoLidas: conversas.reduce((s, c) => s + c.naoLidas, 0),
  }), [conversas]);

  function enviar() {
    if (!active || !draft.trim()) return;
    whatsappStore.enviar(active.id, draft.trim());
    setDraft("");
  }

  function enviarArquivo(tipo: "pdf" | "xml" | "img") {
    if (!active) return;
    const map = { pdf: "DAS-11-2026.pdf", xml: "NFSe-845221.xml", img: "comprovante.jpg" as const };
    whatsappStore.enviarArquivo(active.id, map[tipo], tipo);
    toast.success(`${map[tipo]} enviado via Evolution API (mock)`);
  }

  const connMeta = {
    connected: { label: "Evolution conectada", cls: "bg-success/10 text-success border-success/20", icon: Wifi },
    connecting: { label: "Conectando…", cls: "bg-warning/10 text-warning border-warning/30", icon: Circle },
    disconnected: { label: "Desconectada", cls: "bg-destructive/10 text-destructive border-destructive/20", icon: WifiOff },
  }[conn];

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp"
        subtitle={`${totais.todas} conversas · ${totais.naoLidas} não lidas — via Evolution API (mock)`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("gap-1.5 rounded-full border", connMeta.cls)}>
              <connMeta.icon className={cn("h-3 w-3", conn === "connecting" && "animate-pulse")} />
              {connMeta.label}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                if (conn === "connected") {
                  whatsappStore.setConnStatus("disconnected");
                  toast.warning("Evolution API desconectada");
                } else {
                  whatsappStore.setConnStatus("connecting");
                  setTimeout(() => { whatsappStore.setConnStatus("connected"); toast.success("Evolution API conectada"); }, 900);
                }
              }}
            >
              <Power className="h-4 w-4" /> {conn === "connected" ? "Desconectar" : "Reconectar"}
            </Button>
          </div>
        }
      />

      <div className="grid h-[calc(100vh-13rem)] grid-cols-1 overflow-hidden rounded-2xl border bg-card shadow-sm md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]">
        {/* Lista de conversas */}
        <aside
          className={cn(
            "flex flex-col border-r border-border md:flex",
            active ? "hidden md:flex" : "flex",
          )}
        >
          <div className="space-y-2 border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 rounded-xl pl-9"
              />
            </div>
            <Select value={tag} onValueChange={(v) => setTag(v as typeof tag)}>
              <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as etiquetas</SelectItem>
                {(Object.keys(TAGS) as ConversationTag[]).map((k) => (
                  <SelectItem key={k} value={k}>{TAGS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Nenhuma conversa
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 p-3 text-left transition-colors hover:bg-muted/40",
                  active?.id === c.id && "bg-primary-soft/40",
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {c.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.clienteNome}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(c.ultimaAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">{c.ultimaMensagem}</span>
                    {c.naoLidas > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-success px-1.5 text-[10px] font-semibold text-success-foreground">
                        {c.naoLidas}
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("mt-1.5 rounded-full border text-[10px]", TAGS[c.tag].cls)}>
                    {TAGS[c.tag].label}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Painel de mensagens */}
        <section
          className={cn(
            "flex min-w-0 flex-col bg-muted/20",
            active ? "flex" : "hidden md:flex",
          )}
        >
          {!active && (
            <div className="flex flex-1 items-center justify-center p-10 text-center">
              <div>
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Selecione uma conversa para começar</p>
              </div>
            </div>
          )}

          {active && (
            <>
              <header className="flex items-center gap-3 border-b bg-card px-3 py-3 md:px-4">
                <Button
                  variant="ghost" size="icon"
                  className="md:hidden -ml-1 h-9 w-9"
                  onClick={() => setActiveId(null)}
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {active.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{active.clienteNome}</div>
                  <div className="truncate text-xs text-muted-foreground">{active.telefone}</div>
                </div>
                <Badge variant="outline" className={cn("hidden sm:inline-flex rounded-full border", TAGS[active.tag].cls)}>
                  {TAGS[active.tag].label}
                </Badge>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Ligar">
                  <Phone className="h-4 w-4" />
                </Button>
              </header>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 md:px-6">
                <div className="mx-auto flex max-w-2xl flex-col gap-2">
                  {active.mensagens.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex max-w-[85%] flex-col gap-1 rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                        m.direction === "out"
                          ? "self-end bg-success/15 text-foreground"
                          : "self-start bg-card",
                      )}
                    >
                      {m.autor && m.direction === "out" && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                          {m.autor.includes("auto") ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {m.autor}
                        </div>
                      )}
                      {m.kind === "text" ? (
                        <p className="whitespace-pre-wrap break-words leading-snug">{m.content}</p>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg bg-background/60 p-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{m.fileName}</div>
                            <div className="text-[10px] uppercase text-muted-foreground">{m.fileType}</div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {m.direction === "out" && (
                          m.lida ? <CheckCheck className="h-3 w-3 text-info" /> : <Check className="h-3 w-3" />
                        )}
                      </div>
                    </div>
                  ))}
                  {whatsappStore.isTyping(active.id) && (
                    <div className="flex max-w-[60%] items-center gap-1 self-start rounded-2xl bg-card px-3 py-2 shadow-sm">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "300ms" }} />
                      <span className="ml-1 text-[10px] text-muted-foreground">digitando…</span>
                    </div>
                  )}
                </div>
              </div>

              <footer className="flex items-center gap-2 border-t bg-card px-3 py-3 md:px-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label="Anexar">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => enviarArquivo("pdf")}>
                      <FileText className="h-4 w-4" /> Enviar DAS (PDF)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => enviarArquivo("xml")}>
                      <FileText className="h-4 w-4" /> Enviar NFS-e (XML)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => enviarArquivo("img")}>
                      <FileText className="h-4 w-4" /> Enviar comprovante
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
                  }}
                  placeholder="Digite uma mensagem…"
                  className="h-10 flex-1 rounded-xl"
                />
                <Button onClick={enviar} disabled={!draft.trim()} className="h-10 rounded-xl px-4">
                  <Send className="h-4 w-4" />
                </Button>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

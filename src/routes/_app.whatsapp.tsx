import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Bot, Check, CheckCheck, FileText, Loader2, MessageSquare,
  Mic, MicOff, Paperclip, Search, Send, User, UserPlus,
  X as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PagePlaceholder";
import { useWaInstances } from "@/hooks/use-wa-instances";
import {
  useWaConversas, useWaMensagens, useWaActions, useDigitandoLive,
  type WaConversa,
} from "@/hooks/use-wa-chat";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/whatsapp")({
  component: WhatsappPage,
  head: () => ({ meta: [{ title: "WhatsApp · APOYA Gestão" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tel:  (s["tel"]  as string) ?? "",
    nome: (s["nome"] as string) ?? "",
  }),
});

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function initials(s: string | null) {
  if (!s) return "?";
  return s.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

function WhatsappPage() {
  const { profile } = useAuth();
  const { tel: deepLinkTel, nome: deepLinkNome } = Route.useSearch();
  const { instances } = useWaInstances();
  const [instanceId, setInstanceId] = useState<string>("");
  useEffect(() => {
    if (!instanceId && instances.length) setInstanceId(instances[0].id);
  }, [instances, instanceId]);

  const { conversas } = useWaConversas(instanceId || undefined);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const actions = useWaActions();

  // Deep link: se chegou com ?tel=, auto-selecionar ou criar conversa
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (!deepLinkTel || !instanceId || deepLinkHandled.current) return;
    const tel = deepLinkTel.replace(/\D/g, "");
    // Procurar conversa existente
    const existing = conversas.find(c => c.telefone.replace(/\D/g,"") === tel);
    if (existing) {
      setActiveId(existing.id);
      deepLinkHandled.current = true;
      return;
    }
    // Se conversas já carregaram e não achou, criar nova conversa
    if (conversas !== undefined) {
      actions.iniciar({ instanceId, telefone: tel, nomeContato: deepLinkNome || undefined })
        .then((conv: any) => {
          if (conv?.conversa?.id) setActiveId(conv.conversa.id);
          deepLinkHandled.current = true;
        })
        .catch(() => { deepLinkHandled.current = true; });
    }
  }, [deepLinkTel, instanceId, conversas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversas.filter(c =>
      !q ? true : `${c.nome_contato ?? ""} ${c.telefone}`.toLowerCase().includes(q),
    );
  }, [conversas, query]);
  const active = useMemo(() => conversas.find(c => c.id === activeId) ?? null, [conversas, activeId]);
  const activeInstance = useMemo(() => instances.find(i => i.id === (active?.instance_id || instanceId)), [instances, active, instanceId]);

  const { mensagens, reload: reloadMensagens, setMensagens: setMensagensLocal } = useWaMensagens(active?.id ?? null);
  const [draft, setDraft] = useState("");
  const [departamento, setDepartamento] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const digitando = useDigitandoLive(active?.contato_digitando_ate ?? null);

  useEffect(() => {
    if (active) actions.marcarLida(active.id).catch(() => {});
  }, [active?.id]); // eslint-disable-line

  // ref para o sentinel (último elemento do chat)
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Áudio: gravação via MediaRecorder ──────────────────────────────
  const [gravando, setGravando] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl]   = useState<string | null>(null);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // duplo rAF garante que o DOM já foi pintado antes de scrollar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    });
  }, [mensagens.length, digitando]);

  useEffect(() => {
    if (activeInstance?.departamentos?.length) {
      setDepartamento((d) => d && activeInstance.departamentos.includes(d) ? d : activeInstance.departamentos[0]);
    }
  }, [activeInstance?.id]); // eslint-disable-line

  const isMine = active?.assigned_to === profile?.id;

  async function assumir() {
    if (!active || !departamento) return;
    try { await actions.assumir(active.id, departamento); toast.success("Conversa assumida"); }
    catch (e: any) { toast.error(e?.message ?? "Erro"); }
  }
  // ── Funções de gravação de áudio ──────────────────────────────────
  async function iniciarGravacao() {
    if (!active || !isMine) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setGravando(true);
    } catch {
      toast.error("Sem permissão para acessar o microfone");
    }
  }

  function pararGravacao() {
    mediaRef.current?.stop();
    setGravando(false);
  }

  function cancelarAudio() {
    if (gravando) mediaRef.current?.stop();
    setGravando(false);
    setAudioBlob(null);
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
  }

  async function enviarAudio() {
    if (!active || !audioBlob) return;
    const tempId = `temp_audio_${Date.now()}`;
    const localUrl = audioUrl!;
    const tempMsg = {
      id: tempId,
      conversa_id: active.id,
      direcao: "enviada" as const,
      tipo: "audio" as const,
      conteudo: null,
      arquivo_url: localUrl,
      arquivo_nome: "audio.webm",
      mime_type: "audio/webm",
      evolution_id: null,
      agente_nome: profile?.nome ?? null,
      departamento: active.departamento,
      reply_to: null,
      reaction: null,
      reaction_to: null,
      status: "enviando",
      created_at: new Date().toISOString(),
      lida_em: null,
    };
    setMensagensLocal((prev) => [...prev, tempMsg]);
    setAudioBlob(null);
    setAudioUrl(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = String(reader.result).split(",")[1];
        await actions.enviarAudio(active.id, base64);
        setTimeout(() => reloadMensagens(), 2000);
      };
      reader.readAsDataURL(audioBlob);
    } catch (e: any) {
      setMensagensLocal((prev) => prev.filter((m) => m.id !== tempId));
      toast.error(e?.message ?? "Erro ao enviar áudio");
    }
  }

  async function enviar() {
    if (!active || !draft.trim()) return;
    const texto = draft.trim();
    setDraft("");
    // optimistic update — mensagem aparece imediatamente no chat
    const tempId = `temp_${Date.now()}`;
    const tempMsg = {
      id: tempId,
      conversa_id: active.id,
      direcao: "enviada" as const,
      tipo: "text",
      conteudo: texto,
      arquivo_url: null,
      arquivo_nome: null,
      mime_type: null,
      evolution_id: null,
      agente_nome: profile?.nome ?? null,
      departamento: active.departamento,
      reply_to: null,
      reaction: null,
      reaction_to: null,
      status: "enviando",
      created_at: new Date().toISOString(),
      lida_em: null,
    };
    setMensagensLocal(prev => [...prev, tempMsg]);
    try {
      await actions.enviarTexto(active.id, texto);
      // reload para substituir a msg temporária pela definitiva do banco
      setTimeout(() => reloadMensagens(), 1500);
    } catch (e: any) {
      // reverter optimistic update em caso de erro
      setMensagensLocal(prev => prev.filter(m => m.id !== tempId));
      toast.error(e?.message ?? "Erro ao enviar");
      setDraft(texto);
    }
  }
  async function uploadArquivo(f: File) {
    if (!active) return;
    const tipo: "image" | "video" | "document" =
      f.type.startsWith("image/") ? "image" :
      f.type.startsWith("video/") ? "video" : "document";

    // Preview local imediato via object URL
    const localUrl = URL.createObjectURL(f);
    const tempId = `temp_media_${Date.now()}`;
    const tempMsg = {
      id: tempId,
      conversa_id: active.id,
      direcao: "enviada" as const,
      tipo,
      conteudo: tipo === "document" ? f.name : null,
      arquivo_url: localUrl,
      arquivo_nome: f.name,
      mime_type: f.type,
      evolution_id: null,
      agente_nome: profile?.nome ?? null,
      departamento: active.departamento,
      reply_to: null,
      reaction: null,
      reaction_to: null,
      status: "enviando",
      created_at: new Date().toISOString(),
      lida_em: null,
    };
    setMensagensLocal(prev => [...prev, tempMsg]);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const base64 = dataUrl.split(",")[1];
      try {
        await actions.enviarMidia({
          conversaId: active.id, mediatype: tipo, mimetype: f.type || "application/octet-stream",
          media: base64, fileName: f.name,
        });
        // reload para substituir o preview temporário pelo definitivo
        setTimeout(() => reloadMensagens(), 2000);
      } catch (e: any) {
        // reverter optimistic update em erro
        setMensagensLocal(prev => prev.filter(m => m.id !== tempId));
        URL.revokeObjectURL(localUrl);
        toast.error(e?.message ?? "Erro ao enviar arquivo");
      }
    };
    reader.readAsDataURL(f);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp"
        subtitle={`${conversas.length} conversas · ${conversas.reduce((s, c) => s + c.nao_lidas, 0)} não lidas`}
        actions={
          <Select value={instanceId} onValueChange={setInstanceId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
            <SelectContent>
              {instances.map(i => (
                <SelectItem key={i.id} value={i.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full",
                      i.status === "connected" ? "bg-emerald-500" : i.status === "connecting" ? "bg-amber-500" : "bg-destructive")} />
                    {i.display_name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {instances.length === 0 ? (
        <div className="surface-card flex flex-col items-center gap-2 p-10 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Nenhuma instância configurada.</p>
          <p className="text-xs text-muted-foreground">Crie uma em Configurações → Integrações → WhatsApp.</p>
        </div>
      ) : (
        <div className="grid h-[calc(100vh-11rem)] grid-cols-1 overflow-hidden rounded-2xl border bg-card shadow-sm md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]">
          <aside className={cn("flex flex-col border-r border-border md:flex", active ? "hidden md:flex" : "flex")}>
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar conversa…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 rounded-xl pl-9" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  Nenhuma conversa
                </div>
              )}
              {filtered.map((c) => (
                <ConversaItem key={c.id} c={c} active={active?.id === c.id} onClick={() => setActiveId(c.id)} />
              ))}
            </div>
          </aside>

          <section className={cn("flex min-w-0 flex-col bg-muted/20 overflow-hidden", active ? "flex" : "hidden md:flex")}>
            {!active ? (
              <div className="flex flex-1 items-center justify-center p-10 text-center">
                <div>
                  <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
                </div>
              </div>
            ) : (
              <>
                <header className="flex shrink-0 items-center gap-3 border-b bg-card px-3 py-3 md:px-4">
                  <Button variant="ghost" size="icon" className="md:hidden -ml-1 h-9 w-9" onClick={() => setActiveId(null)}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    {initials(active.nome_contato)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{active.nome_contato || `+${active.telefone}`}</div>
                    <div className="truncate text-xs text-muted-foreground">+{active.telefone}{active.departamento ? ` · ${active.departamento}` : ""}</div>
                  </div>
                  {active.assigned_to ? (
                    isMine ? (
                      <Button size="sm" variant="ghost" onClick={() => actions.liberar(active.id)}>Liberar</Button>
                    ) : (
                      <Badge variant="outline" className="gap-1"><User className="h-3 w-3" /> Em atendimento</Badge>
                    )
                  ) : (
                    <div className="flex items-center gap-2">
                      {activeInstance?.departamentos && activeInstance.departamentos.length > 1 && (
                        <Select value={departamento} onValueChange={setDepartamento}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {activeInstance.departamentos.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                      <Button size="sm" onClick={assumir}><UserPlus className="h-4 w-4" />Assumir</Button>
                    </div>
                  )}
                </header>

                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
                  <div className="mx-auto flex max-w-2xl flex-col gap-2">
                    {mensagens.map((m) => (
                      <div key={m.id} className={cn("flex max-w-[85%] flex-col gap-1 rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[70%]",
                        m.direcao === "enviada" ? "self-end bg-success/15 text-foreground" : "self-start bg-card")}>
                        {m.agente_nome && m.direcao === "enviada" && (
                          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                            <User className="h-3 w-3" />
                            {m.agente_nome.split(" ")[0]}
                            {m.departamento ? (
                              <><span className="opacity-40 mx-0.5">|</span>{m.departamento.charAt(0).toUpperCase() + m.departamento.slice(1).toLowerCase()}</>
                            ) : null}
                          </div>
                        )}
                        {m.tipo === "reaction" ? (
                          <span className="text-2xl">{m.reaction}</span>
                        ) : m.arquivo_url ? (
                          m.tipo === "image" ? (
                            <div className="relative">
                              <img src={m.arquivo_url} alt={m.arquivo_nome ?? "imagem"} className="max-h-64 w-full rounded-xl object-cover" />
                              {m.status === "enviando" && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20">
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                          ) : m.tipo === "video" ? (
                            <div className="relative">
                              <video src={m.arquivo_url} controls className="max-h-64 w-full rounded-xl" />
                              {m.status === "enviando" && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/20">
                                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                                </div>
                              )}
                            </div>
                          ) : m.tipo === "audio" ? (
                            <audio controls src={m.arquivo_url} className="max-w-full" />
                          ) : (
                            <a href={m.arquivo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-background/60 p-2 hover:underline">
                              <FileText className="h-5 w-5 shrink-0" />
                              <span className="truncate text-xs">{m.arquivo_nome ?? "arquivo"}</span>
                            </a>
                          )
                        ) : null}
                        {m.conteudo && <p className="whitespace-pre-wrap break-words leading-snug">{m.conteudo}</p>}
                        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                          {fmtTime(m.created_at)}
                          {m.direcao === "enviada" && (
                            m.status === "lida" ? <CheckCheck className="h-3 w-3 text-info" /> :
                            m.status === "entregue" ? <CheckCheck className="h-3 w-3" /> :
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    ))}
                    {digitando && (
                      <div className="flex max-w-[60%] items-center gap-1 self-start rounded-2xl bg-card px-3 py-2 shadow-sm">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: "300ms" }} />
                        <span className="ml-1 text-[10px] text-muted-foreground">digitando…</span>
                      </div>
                    )}
                    {/* sentinel — scroll automático até aqui */}
                    <div ref={bottomRef} className="h-1 shrink-0" />
                  </div>
                </div>

                <footer className="flex shrink-0 flex-col border-t bg-card px-3 py-2 md:px-4">
                  {/* Preview de áudio gravado */}
                  {audioUrl && !gravando && (
                    <div className="mb-2 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                      <audio controls src={audioUrl} className="h-8 flex-1" />
                      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={cancelarAudio}>
                        <XIcon className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={enviarAudio} className="h-7 shrink-0 rounded-lg px-3">
                        <Send className="h-3.5 w-3.5 mr-1" />Enviar
                      </Button>
                    </div>
                  )}

                  {/* Row principal: anexo + input + mic + send */}
                  {!audioUrl && (
                    <div className="flex items-center gap-2">
                      <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-muted">
                        <Paperclip className="h-5 w-5" />
                        <input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadArquivo(f); e.target.value = ""; }} />
                      </label>
                      <Input
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          if (active && isMine) actions.sinalizarDigitando(active.id).catch(() => {});
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                        placeholder={isMine ? "Digite uma mensagem…" : "Assuma a conversa para responder"}
                        disabled={!isMine}
                        className="h-10 flex-1 rounded-xl"
                      />
                      {/* Botão de microfone */}
                      {isMine && !draft.trim() && (
                        <Button
                          type="button"
                          size="icon"
                          variant={gravando ? "destructive" : "ghost"}
                          className="h-10 w-10 shrink-0 rounded-xl"
                          onClick={gravando ? pararGravacao : iniciarGravacao}
                          title={gravando ? "Parar gravação" : "Gravar áudio"}
                        >
                          {gravando ? (
                            <MicOff className="h-5 w-5 animate-pulse" />
                          ) : (
                            <Mic className="h-5 w-5" />
                          )}
                        </Button>
                      )}
                      {/* Botão de enviar (aparece só quando há texto) */}
                      {(draft.trim() || !isMine) && (
                        <Button onClick={enviar} disabled={!isMine || !draft.trim()} className="h-10 rounded-xl px-4">
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Indicador de gravação ativa */}
                  {gravando && (
                    <div className="mt-1 flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                        <span className="text-xs text-destructive font-medium">Gravando… toque no microfone para parar</span>
                      </div>
                      <button type="button" onClick={cancelarAudio} className="text-xs text-muted-foreground hover:text-destructive">Cancelar</button>
                    </div>
                  )}
                </footer>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ConversaItem({ c, active, onClick }: { c: WaConversa; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "flex w-full items-start gap-3 border-b border-border/60 p-3 text-left transition-colors hover:bg-muted/40",
      active && "bg-primary-soft/40",
    )}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {initials(c.nome_contato)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{c.nome_contato || `+${c.telefone}`}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{fmtTime(c.ultima_em)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{c.ultima_mensagem ?? "—"}</span>
          {c.nao_lidas > 0 && (
            <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-success px-1.5 text-[10px] font-semibold text-success-foreground">
              {c.nao_lidas}
            </span>
          )}
        </div>
        {c.departamento && (
          <Badge variant="outline" className="mt-1.5 rounded-full text-[10px] capitalize">{c.departamento}</Badge>
        )}
      </div>
    </button>
  );
}

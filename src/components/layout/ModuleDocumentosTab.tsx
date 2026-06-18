/**
 * ModuleDocumentosTab.tsx
 *
 * Componente reutilizável de Documentos para todos os módulos.
 * Usa as tabelas documento_pasta + documento_arquivo com filtro por modulo.
 * Upload para Supabase Storage bucket "documentos".
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useClientes } from "@/hooks/use-clientes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Upload, FolderOpen, FileText, Download, Trash2,
  Search, Plus, File, FileImage, FileCode, Loader2,
  ChevronRight, FolderPlus, X, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

/* ── Types ────────────────────────────────────────────── */
export type Modulo = "fiscal" | "dp" | "contabil" | "financeiro" | "societario" | "geral";

interface Pasta {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  icone: string | null;
  cliente_id: string | null;
  modulo: string;
  created_at: string;
}

interface Arquivo {
  id: string;
  pasta_id: string | null;
  cliente_id: string | null;
  nome: string;
  descricao: string | null;
  tipo_mime: string | null;
  tamanho_bytes: number | null;
  storage_path: string;
  storage_url: string | null;
  tags: string[] | null;
  modulo: string;
  created_at: string;
}

/* ── Helpers ──────────────────────────────────────────── */
function fmtBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mime: string | null) {
  if (!mime) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (mime.includes("xml") || mime.includes("json")) return <FileCode className="h-4 w-4 text-green-600" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const CORES_PASTA = ["#6366f1","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#ec4899","#14b8a6"];

/* ── Componente principal ─────────────────────────────── */
export function ModuleDocumentosTab({ modulo, titulo }: { modulo: Modulo; titulo?: string }) {
  const { clientes } = useClientes();

  const [pastas, setPastas]       = useState<Pasta[]>([]);
  const [arquivos, setArquivos]   = useState<Arquivo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);

  // Filtros
  const [pastaSel, setPastaSel]     = useState<string | null>(null);
  const [clienteSel, setClienteSel] = useState("todos");
  const [query, setQuery]           = useState("");

  // Dialogs
  const [novaPastaOpen, setNovaPastaOpen] = useState(false);
  const [novaPastaName, setNovaPastaName] = useState("");
  const [novaPastaCor, setNovaPastaCor]   = useState(CORES_PASTA[0]);
  const [criandoPasta, setCriandoPasta]   = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Load ─────────────────────────────────────────── */
  const loadTudo = useCallback(async () => {
    setLoading(true);
    try {
      // Cliente é a fonte canônica: além dos docs do módulo, inclui o drive do
      // cliente (modulo IS NULL) pra não haver silo entre as telas.
      const [{ data: ps }, { data: arqs }] = await Promise.all([
        (supabase as any)
          .from("documento_pasta")
          .select("*")
          .or(`modulo.eq.${modulo},modulo.is.null`)
          .order("nome"),
        (supabase as any)
          .from("documento_arquivo")
          .select("*")
          .or(`modulo.eq.${modulo},modulo.is.null`)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      setPastas(ps ?? []);
      setArquivos(arqs ?? []);
    } catch (e: any) {
      toast.error("Erro ao carregar documentos: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [modulo]);

  useEffect(() => { loadTudo(); }, [loadTudo]);

  /* ── Filtros ──────────────────────────────────────── */
  const arquivosFiltrados = useMemo(() => {
    return arquivos.filter(a => {
      if (pastaSel && a.pasta_id !== pastaSel) return false;
      if (clienteSel !== "todos" && a.cliente_id !== clienteSel) return false;
      if (query) {
        const q = query.toLowerCase();
        const nome = a.nome.toLowerCase();
        const tags = (a.tags ?? []).join(" ").toLowerCase();
        if (!nome.includes(q) && !tags.includes(q)) return false;
      }
      return true;
    });
  }, [arquivos, pastaSel, clienteSel, query]);

  /* ── Upload ───────────────────────────────────────── */
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    // cliente_id e pasta_id são NOT NULL no banco — exigir antes do upload
    // (antes gravava null e o insert quebrava calado).
    if (clienteSel === "todos" || !clienteSel) {
      toast.error("Selecione um cliente específico antes de enviar");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (!pastaSel) {
      toast.error("Selecione (ou crie) uma pasta antes de enviar");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    const toastId = "doc-upload";
    toast.loading(`Enviando ${files.length} arquivo(s)…`, { id: toastId });

    try {
      for (const file of Array.from(files)) {
        const path = `${modulo}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
        const { error: upErr } = await (supabase as any).storage
          .from("documentos")
          .upload(path, file, { upsert: false });
        if (upErr) throw upErr;

        const { data: urlData } = (supabase as any).storage
          .from("documentos")
          .getPublicUrl(path);

        await (supabase as any).from("documento_arquivo").insert({
          nome: file.name,
          tipo_mime: file.type || null,
          tamanho_bytes: file.size,
          storage_path: path,
          storage_url: urlData?.publicUrl ?? null,
          bucket: "documentos",
          pasta_id: pastaSel,
          cliente_id: clienteSel,
          modulo,
        });
      }
      toast.success(`${files.length} arquivo(s) enviado(s)!`, { id: toastId });
      await loadTudo();
    } catch (e: any) {
      toast.error("Erro no upload: " + e.message, { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /* ── Criar pasta ──────────────────────────────────── */
  async function criarPasta() {
    if (!novaPastaName.trim()) return;
    // cliente_id é NOT NULL — exigir um cliente selecionado (antes gravava null e quebrava)
    if (clienteSel === "todos") {
      toast.error("Selecione um cliente específico para criar a pasta");
      return;
    }
    setCriandoPasta(true);
    try {
      const { error } = await (supabase as any).from("documento_pasta").insert({
        nome: novaPastaName.trim(),
        cor: novaPastaCor,
        modulo,
        cliente_id: clienteSel,
      });
      if (error) throw error;
      toast.success("Pasta criada!");
      setNovaPastaOpen(false);
      setNovaPastaName("");
      await loadTudo();
    } catch (e: any) {
      toast.error("Erro ao criar pasta: " + e.message);
    } finally {
      setCriandoPasta(false);
    }
  }

  /* ── Excluir arquivo ──────────────────────────────── */
  async function excluirArquivo(arq: Arquivo) {
    if (!confirm(`Excluir "${arq.nome}"?`)) return;
    try {
      await (supabase as any).storage.from((arq as any).bucket ?? "documentos").remove([arq.storage_path]);
      await (supabase as any).from("documento_arquivo").delete().eq("id", arq.id);
      setArquivos(prev => prev.filter(a => a.id !== arq.id));
      toast.success("Arquivo excluído");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    }
  }

  /* ── Abrir/baixar (signed URL do bucket da linha — robusto p/ bucket privado) ── */
  async function abrirArquivo(arq: Arquivo, download = false) {
    const bucket = (arq as any).bucket ?? "documentos";
    const { data, error } = await (supabase as any).storage
      .from(bucket)
      .createSignedUrl(arq.storage_path, 3600, download ? { download: arq.nome } : undefined);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  }

  /* ── KPIs ─────────────────────────────────────────── */
  const totalBytes = arquivos.reduce((s, a) => s + (a.tamanho_bytes ?? 0), 0);

  /* ── Render ───────────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Arquivos",  val: String(arquivos.length) },
          { label: "Pastas",    val: String(pastas.length) },
          { label: "Tamanho",   val: fmtBytes(totalBytes) },
          { label: "Clientes",  val: String(new Set(arquivos.map(a => a.cliente_id).filter(Boolean)).size) },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{k.label}</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{k.val}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro cliente */}
          <Select value={clienteSel} onValueChange={setClienteSel}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.razaoSocial ?? c.nomeFantasia}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Busca */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar arquivo…"
              className="h-8 pl-7 text-xs w-44"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nova pasta */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setNovaPastaOpen(true)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Nova pasta
          </Button>

          {/* Upload */}
          <label className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-md",
            "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer transition-colors font-medium",
            uploading && "opacity-50 pointer-events-none"
          )}>
            {uploading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Upload className="h-3.5 w-3.5" />
            }
            Enviar arquivo
            <input
              ref={fileRef}
              type="file"
              multiple
              className="sr-only"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <div className="flex gap-4 min-h-[400px]">
        {/* Sidebar de pastas */}
        <div className="w-48 shrink-0 space-y-0.5">
          <button
            onClick={() => setPastaSel(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              pastaSel === null
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="truncate">Todos os arquivos</span>
            <span className="ml-auto text-[11px] tabular-nums">{arquivos.length}</span>
          </button>

          {pastas.map(p => {
            const count = arquivos.filter(a => a.pasta_id === p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setPastaSel(pastaSel === p.id ? null : p.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  pastaSel === p.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span
                  className="h-3 w-3 rounded-sm shrink-0"
                  style={{ backgroundColor: p.cor ?? "#6366f1" }}
                />
                <span className="truncate flex-1 text-left">{p.nome}</span>
                <span className="ml-auto text-[11px] tabular-nums">{count}</span>
              </button>
            );
          })}

          {pastas.length === 0 && !loading && (
            <p className="px-3 py-2 text-xs text-muted-foreground/50">Nenhuma pasta</p>
          )}
        </div>

        {/* Lista de arquivos */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : arquivosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-border rounded-xl bg-muted/20">
              <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum arquivo</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Clique em "Enviar arquivo" para adicionar documentos
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">Cliente</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Tamanho</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Data</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {arquivosFiltrados.map(arq => {
                    const cliente = clientes.find(c => c.id === arq.cliente_id);
                    const pasta = pastas.find(p => p.id === arq.pasta_id);
                    return (
                      <tr key={arq.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {fileIcon(arq.tipo_mime)}
                            <div className="min-w-0">
                              <p className="font-medium truncate max-w-[200px]">{arq.nome}</p>
                              {pasta && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <span
                                    className="inline-block h-1.5 w-1.5 rounded-full"
                                    style={{ backgroundColor: pasta.cor ?? "#6366f1" }}
                                  />
                                  {pasta.nome}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground truncate max-w-[140px] block">
                            {cliente?.razaoSocial ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {fmtBytes(arq.tamanho_bytes)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(arq.created_at)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              type="button"
                              onClick={() => abrirArquivo(arq)}
                              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Visualizar"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirArquivo(arq, true)}
                              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => excluirArquivo(arq)}
                              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialog nova pasta */}
      <Dialog open={novaPastaOpen} onOpenChange={setNovaPastaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nome</label>
              <Input
                value={novaPastaName}
                onChange={e => setNovaPastaName(e.target.value)}
                placeholder="Ex: Declarações 2026"
                onKeyDown={e => e.key === "Enter" && criarPasta()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Cor</label>
              <div className="flex gap-2 flex-wrap">
                {CORES_PASTA.map(cor => (
                  <button
                    key={cor}
                    onClick={() => setNovaPastaCor(cor)}
                    className={cn(
                      "h-7 w-7 rounded-lg transition-all",
                      novaPastaCor === cor && "ring-2 ring-offset-2 ring-foreground scale-110"
                    )}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaPastaOpen(false)}>Cancelar</Button>
            <Button onClick={criarPasta} disabled={criandoPasta || !novaPastaName.trim()}>
              {criandoPasta && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Criar pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  File, FileText, FileImage, FileArchive, FileVideo,
  Folder, FolderOpen, Plus, Search, Upload,
  Trash2, Download, Eye, MoreHorizontal, X,
} from "lucide-react";
import { useClientes } from "@/hooks/use-clientes";
import { useDocumentosCliente } from "@/hooks/use-documentos-cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger,
  DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/documentos")({
  component: DocumentosPage,
  head: () => ({ meta: [{ title: "Documentos · APOYA Gestão" }] }),
});

// ─── ícone por mimetype ───────────────────────────────────────────────────────
function FileIcon({ mime, size = 18 }: { mime?: string; size?: number }) {
  const cls = `text-muted-foreground`;
  if (!mime) return <File size={size} className={cls} />;
  if (mime.startsWith("image/")) return <FileImage size={size} className="text-blue-400" />;
  if (mime.startsWith("video/")) return <FileVideo size={size} className="text-purple-400" />;
  if (mime === "application/pdf") return <FileText size={size} className="text-red-400" />;
  if (mime.includes("zip") || mime.includes("rar")) return <FileArchive size={size} className="text-yellow-400" />;
  return <File size={size} className={cls} />;
}

function fmtBytes(b?: number) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

// ─── componente interno ──────────────────────────────────────────────────────
function ClienteDrive({ clienteId, clienteNome }: { clienteId: string; clienteNome: string }) {
  const { pastas, loading, criarPasta, excluirPasta, uploadArquivo, excluirArquivo, getSignedUrl, arquivosDaPasta } =
    useDocumentosCliente(clienteId);
  const [pastaAberta, setPastaAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [novaPastaModal, setNovaPastaModal] = useState(false);
  const [nomePasta, setNomePasta] = useState("");
  const [uploading, setUploading] = useState(false);

  const pastaAtual = pastas.find(p => p.id === pastaAberta);
  const arqsVisiveis = pastaAberta
    ? arquivosDaPasta(pastaAberta).filter(a => a.nome.toLowerCase().includes(busca.toLowerCase()))
    : [];

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!pastaAberta || !e.target.files?.length) return;
    setUploading(true);
    for (const file of Array.from(e.target.files)) {
      await uploadArquivo(pastaAberta, file);
    }
    setUploading(false);
    e.target.value = "";
  }

  async function handleDownload(storagePath: string, nome: string) {
    const url = await getSignedUrl(storagePath);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = nome; a.target = "_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  async function handleCriarPasta() {
    if (!nomePasta.trim()) return;
    await criarPasta({ nome: nomePasta.trim(), cor: "#E8721C", icone: "folder" });
    setNomePasta(""); setNovaPastaModal(false);
  }

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Carregando…</div>;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setPastaAberta(null)}
          className="text-primary hover:underline font-medium"
        >
          {clienteNome}
        </button>
        {pastaAtual && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground font-medium">{pastaAtual.nome}</span>
          </>
        )}
      </div>

      {!pastaAberta ? (
        /* ── GRID DE PASTAS ─────────────────────────────────────────────── */
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">{pastas.length} pastas</span>
            <Button size="sm" onClick={() => setNovaPastaModal(true)}>
              <Plus size={14} className="mr-1" /> Nova pasta
            </Button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {pastas.map(p => (
              <button
                key={p.id}
                onClick={() => setPastaAberta(p.id)}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <FolderOpen size={36} className="text-primary" />
                <span className="text-xs font-medium leading-tight">{p.nome}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {p.total_arquivos ?? 0} arquivo{p.total_arquivos !== 1 ? "s" : ""}
                </Badge>
              </button>
            ))}
            {pastas.length === 0 && (
              <div className="col-span-full py-10 text-center text-muted-foreground text-sm">
                Nenhuma pasta. Crie a primeira.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── CONTEÚDO DA PASTA ──────────────────────────────────────────── */
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Buscar arquivo…"
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <label className="cursor-pointer">
              <Button size="sm" disabled={uploading} asChild>
                <span>
                  <Upload size={14} className="mr-1" />
                  {uploading ? "Enviando…" : "Upload"}
                  <input type="file" className="hidden" multiple onChange={handleUpload} />
                </span>
              </Button>
            </label>
            <Button
              size="sm" variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Excluir pasta e todos os arquivos?")) { excluirPasta(pastaAberta); setPastaAberta(null); } }}
            >
              <Trash2 size={14} />
            </Button>
          </div>

          {/* Tabela de arquivos */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="ft-table w-full text-sm">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Nome</th>
                  <th className="hidden md:table-cell">Tipo</th>
                  <th className="hidden sm:table-cell">Tamanho</th>
                  <th className="hidden lg:table-cell">Data</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {arqsVisiveis.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      {busca ? "Nenhum arquivo encontrado." : "Pasta vazia. Faça upload de arquivos."}
                    </td>
                  </tr>
                ) : arqsVisiveis.map(arq => (
                  <tr key={arq.id}>
                    <td className="pl-3"><FileIcon mime={arq.tipo_mime} /></td>
                    <td className="font-medium">{arq.nome}</td>
                    <td className="hidden md:table-cell text-muted-foreground text-xs">
                      {arq.tipo_mime?.split("/")[1]?.toUpperCase() ?? "—"}
                    </td>
                    <td className="hidden sm:table-cell text-muted-foreground text-xs">
                      {fmtBytes(arq.tamanho_bytes)}
                    </td>
                    <td className="hidden lg:table-cell text-muted-foreground text-xs">
                      {new Date(arq.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={async () => { const u = await getSignedUrl(arq.storage_path); if (u) window.open(u, "_blank"); }}>
                            <Eye size={13} className="mr-2" /> Visualizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(arq.storage_path, arq.nome)}>
                            <Download size={13} className="mr-2" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm("Excluir arquivo?")) excluirArquivo(arq); }}
                          >
                            <Trash2 size={13} className="mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nova pasta */}
      <Dialog open={novaPastaModal} onOpenChange={setNovaPastaModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nome da pasta</Label>
            <Input
              autoFocus
              value={nomePasta}
              onChange={e => setNomePasta(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCriarPasta()}
              placeholder="Ex: Contratos 2026"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovaPastaModal(false)}>Cancelar</Button>
            <Button onClick={handleCriarPasta} disabled={!nomePasta.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function DocumentosPage() {
  const { clientes, loading: loadingClientes } = useClientes();
  const [clienteSel, setClienteSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const clientesFiltrados = clientes.filter(c =>
    c.razaoSocial.toLowerCase().includes(busca.toLowerCase()) ||
    c.cnpj.includes(busca)
  );

  const clienteAtual = clientes.find(c => c.id === clienteSel);

  return (
    <div className="animate-fade-up space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Documentos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gestão de arquivos por cliente
          </p>
        </div>
        {clienteSel && (
          <Button variant="ghost" size="sm" onClick={() => setClienteSel(null)}>
            <X size={14} className="mr-1" /> Fechar cliente
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Coluna esquerda — lista de clientes */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Buscar cliente…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          {loadingClientes ? (
            <p className="text-sm text-muted-foreground px-2">Carregando…</p>
          ) : (
            <div className="space-y-1 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
              {clientesFiltrados.map(c => (
                <button
                  key={c.id}
                  onClick={() => setClienteSel(c.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    clienteSel === c.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <Folder size={15} className={clienteSel === c.id ? "text-primary-foreground" : "text-primary"} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight truncate">{c.razaoSocial}</p>
                    <p className={`text-[10px] ${clienteSel === c.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {c.cnpj}
                    </p>
                  </div>
                </button>
              ))}
              {clientesFiltrados.length === 0 && (
                <p className="text-sm text-muted-foreground px-2 py-4 text-center">Nenhum cliente.</p>
              )}
            </div>
          )}
        </div>

        {/* Coluna direita — drive do cliente */}
        <div className="lg:col-span-3">
          {!clienteSel ? (
            <div className="flex flex-col items-center justify-center h-64 text-center rounded-2xl border-2 border-dashed border-border">
              <Folder size={40} className="text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">Selecione um cliente</p>
              <p className="text-sm text-muted-foreground/60 mt-1">para visualizar e gerenciar seus documentos</p>
            </div>
          ) : (
            <div className="surface-card p-5 rounded-2xl border border-border">
              <ClienteDrive clienteId={clienteSel} clienteNome={clienteAtual?.razaoSocial ?? ""} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

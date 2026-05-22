/**
 * TabDocumentos — Mini-drive Google Drive style por cliente
 */
import { useCallback, useRef, useState } from "react";
import {
  Plus, Folder, File, FileText, Image, Film, Music, Archive,
  Trash2, Download, Upload, Pencil, X, FolderPlus, Loader2,
  ChevronLeft, ExternalLink, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDocumentosCliente, type DocumentoPasta, type DocumentoArquivo } from "@/hooks/use-documentos-cliente";

const fmtBytes = (b?: number | null) => {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
};

const fmtData = (d: string) => new Date(d).toLocaleDateString("pt-BR");

const PASTA_CORES = [
  { label: "Índigo",    value: "#6366f1" },
  { label: "Laranja",   value: "#f97316" },
  { label: "Emerald",   value: "#10b981" },
  { label: "Rose",      value: "#f43f5e" },
  { label: "Azul",      value: "#3b82f6" },
  { label: "Violeta",   value: "#8b5cf6" },
  { label: "Âmbar",     value: "#f59e0b" },
  { label: "Teal",      value: "#14b8a6" },
];

const PASTAS_DEFAULT = [
  { nome: "Contratos", cor: "#6366f1", descricao: "Contratos assinados e aditivos" },
  { nome: "Documentos Fiscais", cor: "#f97316", descricao: "Notas fiscais, DAS, guias de impostos" },
  { nome: "Declarações", cor: "#3b82f6", descricao: "IRPF, IRPJ, DIPJ e outras declarações" },
  { nome: "Societário", cor: "#8b5cf6", descricao: "Contrato social, alterações e certidões" },
  { nome: "Folha de Pagamento", cor: "#10b981", descricao: "Holerites, FGTS e rescisões" },
  { nome: "Certidões", cor: "#f59e0b", descricao: "CND Federal, Estadual e Municipal" },
];

/* ── Ícone por tipo de arquivo ──────────────────────────────────────────── */
function FileIcon({ mime, ext, size = 4 }: { mime?: string; ext?: string; size?: number }) {
  const s = `h-${size} w-${size}`;
  if (mime?.startsWith("image/")) return <Image className={`${s} text-rose-500`} />;
  if (mime?.startsWith("video/")) return <Film className={`${s} text-violet-500`} />;
  if (mime?.startsWith("audio/")) return <Music className={`${s} text-blue-500`} />;
  if (mime?.includes("pdf")) return <FileText className={`${s} text-red-500`} />;
  if (mime?.includes("sheet") || ext === "xlsx" || ext === "csv") return <FileSpreadsheet className={`${s} text-emerald-500`} />;
  if (mime?.includes("zip") || mime?.includes("rar")) return <Archive className={`${s} text-amber-500`} />;
  if (mime?.includes("word") || ext === "doc" || ext === "docx") return <FileText className={`${s} text-blue-500`} />;
  return <File className={`${s} text-slate-400`} />;
}

/* ── Modal criar pasta ──────────────────────────────────────────────────── */
function ModalPasta({ clienteId, pasta, onClose }: { clienteId: string; pasta?: DocumentoPasta; onClose: () => void }) {
  const { criarPasta, atualizarPasta } = useDocumentosCliente(clienteId);
  const [form, setForm] = useState({
    nome: pasta?.nome ?? "",
    descricao: pasta?.descricao ?? "",
    cor: pasta?.cor ?? "#6366f1",
  });
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-4 w-4" />
            {pasta ? "Editar Pasta" : "Nova Pasta"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Documentos Fiscais" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Opcional…" />
          </div>
          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PASTA_CORES.map(c => (
                <button
                  key={c.value}
                  title={c.label}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${form.cor === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setForm(p => ({ ...p, cor: c.value }))}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button disabled={saving || !form.nome} onClick={async () => {
            setSaving(true);
            try {
              if (pasta) await atualizarPasta(pasta.id, form);
              else await criarPasta(form);
              onClose();
            } catch { } finally { setSaving(false); }
          }}>
            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Salvando…</> : pasta ? "Salvar" : "Criar pasta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── View interna de pasta ──────────────────────────────────────────────── */
function PastaView({ pasta, clienteId, onBack }: { pasta: DocumentoPasta; clienteId: string; onBack: () => void }) {
  const { arquivosDaPasta, uploadArquivo, excluirArquivo, getSignedUrl, uploading } = useDocumentosCliente(clienteId);
  const arquivos = arquivosDaPasta(pasta.id);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      await uploadArquivo(pasta.id, f);
    }
  }, [pasta.id, uploadArquivo]);

  const handleDownload = async (arq: DocumentoArquivo) => {
    const url = await getSignedUrl(arq.storage_path);
    if (url) window.open(url, "_blank");
  };

  const ext = (nome: string) => nome.includes(".") ? nome.split(".").pop() ?? "" : "";

  return (
    <div className="space-y-4">
      {/* Header da pasta */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 text-xs">
          <ChevronLeft className="h-4 w-4 mr-1" />Voltar
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: pasta.cor + "22" }}>
            <Folder className="h-4 w-4" style={{ color: pasta.cor }} />
          </div>
          <span className="font-semibold text-sm">{pasta.nome}</span>
          {pasta.descricao && <span className="text-xs text-muted-foreground">— {pasta.descricao}</span>}
        </div>
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando…</> : <><Upload className="h-4 w-4 mr-2" />Enviar arquivo(s)</>}
        </Button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
      </div>

      {/* Área de drop */}
      <div
        className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center transition-colors hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Arraste arquivos aqui ou clique para selecionar</p>
        <p className="text-xs text-muted-foreground/70 mt-1">PDF, Word, Excel, imagens, ZIP — até 50MB por arquivo</p>
      </div>

      {/* Lista de arquivos */}
      {arquivos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <File className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Pasta vazia. Envie o primeiro arquivo.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {arquivos.map(arq => (
            <div key={arq.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors group">
              <FileIcon mime={arq.tipo_mime} ext={ext(arq.nome)} size={5} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{arq.nome}</p>
                <p className="text-xs text-muted-foreground">{fmtBytes(arq.tamanho_bytes)} · {fmtData(arq.created_at)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Download" onClick={() => handleDownload(arq)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {arq.storage_url && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Abrir" asChild>
                    <a href={arq.storage_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" title="Excluir" onClick={() => excluirArquivo(arq)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Export principal ───────────────────────────────────────────────────── */
export function TabDocumentos({ clienteId }: { clienteId: string }) {
  const { pastas, loading, criarPasta, excluirPasta } = useDocumentosCliente(clienteId);
  const [pastaAtiva, setPastaAtiva] = useState<DocumentoPasta | null>(null);
  const [editando, setEditando] = useState<DocumentoPasta | undefined>(undefined);
  const [showNovaPasta, setShowNovaPasta] = useState(false);
  const [criandoPadroes, setCriandoPadroes] = useState(false);

  const criarPastasPadrao = async () => {
    setCriandoPadroes(true);
    try {
      for (const p of PASTAS_DEFAULT) {
        await criarPasta(p);
      }
    } catch { } finally { setCriandoPadroes(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (pastaAtiva) {
    return <PastaView pasta={pastaAtiva} clienteId={clienteId} onBack={() => setPastaAtiva(null)} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Documentos do Cliente</h3>
          <p className="text-xs text-muted-foreground">{pastas.length} pasta(s) · {pastas.reduce((a, p) => a + (p.total_arquivos ?? 0), 0)} arquivo(s)</p>
        </div>
        <div className="flex items-center gap-2">
          {pastas.length === 0 && (
            <Button size="sm" variant="outline" onClick={criarPastasPadrao} disabled={criandoPadroes}>
              {criandoPadroes ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando…</> : <><FolderPlus className="h-4 w-4 mr-2" />Criar pastas padrão</>}
            </Button>
          )}
          <Button size="sm" onClick={() => setShowNovaPasta(true)}>
            <Plus className="h-4 w-4 mr-2" />Nova Pasta
          </Button>
        </div>
      </div>

      {/* Grid de pastas — estilo Drive */}
      {pastas.length === 0 ? (
        <div className="surface-card rounded-xl p-10 text-center text-muted-foreground">
          <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Nenhuma pasta criada</p>
          <p className="text-xs mt-1">Clique em "Criar pastas padrão" para começar com uma estrutura de pastas recomendada.</p>
          <Button size="sm" className="mt-4" onClick={criarPastasPadrao} disabled={criandoPadroes}>
            {criandoPadroes ? "Criando…" : "Criar pastas padrão"}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {pastas.map(p => (
            <div
              key={p.id}
              className="group relative border border-border/60 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-border transition-all bg-background"
              onClick={() => setPastaAtiva(p)}
            >
              {/* Ações ocultas */}
              <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted transition-colors" onClick={() => { setEditando(p); setShowNovaPasta(true); }}>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button className="h-6 w-6 rounded flex items-center justify-center hover:bg-red-50 transition-colors" onClick={() => excluirPasta(p.id)}>
                  <Trash2 className="h-3 w-3 text-red-500" />
                </button>
              </div>

              <div className="flex flex-col items-center text-center gap-2 pt-1">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                  style={{ backgroundColor: p.cor + "22" }}>
                  <Folder className="h-7 w-7" style={{ color: p.cor }} />
                </div>
                <div>
                  <p className="text-sm font-medium leading-tight">{p.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.total_arquivos === 0 ? "Vazio" : `${p.total_arquivos} arquivo${(p.total_arquivos ?? 0) > 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modais */}
      {showNovaPasta && (
        <ModalPasta
          clienteId={clienteId}
          pasta={editando}
          onClose={() => { setShowNovaPasta(false); setEditando(undefined); }}
        />
      )}
    </div>
  );
}

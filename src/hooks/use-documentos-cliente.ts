/**
 * use-documentos-cliente — Mini-drive de documentos por cliente
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type DocumentoPasta = {
  id: string;
  cliente_id: string;
  nome: string;
  descricao?: string;
  cor: string;
  icone: string;
  ordem: number;
  created_at: string;
  updated_at: string;
  // virtual — preenchido pelo hook
  total_arquivos?: number;
};

export type DocumentoArquivo = {
  id: string;
  pasta_id: string;
  cliente_id: string;
  nome: string;
  descricao?: string;
  tipo_mime?: string;
  tamanho_bytes?: number;
  storage_path: string;
  storage_url?: string;
  bucket?: string;        // qual bucket guarda o arquivo (canônico do cliente = 'documentos-clientes')
  tags: string[];
  created_at: string;
  updated_at: string;
};

const CLIENTE_BUCKET = "documentos-clientes";

export function useDocumentosCliente(clienteId: string) {
  const [pastas, setPastas] = useState<DocumentoPasta[]>([]);
  const [arquivos, setArquivos] = useState<DocumentoArquivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    const [{ data: ps }, { data: arqs }] = await Promise.all([
      supabase
        .from("documento_pasta")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("ordem", { ascending: true }),
      supabase
        .from("documento_arquivo")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false }),
    ]);
    const pastasData = (ps ?? []) as DocumentoPasta[];
    const arquivosData = (arqs ?? []) as DocumentoArquivo[];
    // Contar arquivos por pasta
    const pastasComContagem = pastasData.map(p => ({
      ...p,
      total_arquivos: arquivosData.filter(a => a.pasta_id === p.id).length,
    }));
    setPastas(pastasComContagem);
    setArquivos(arquivosData);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => { load(); }, [load]);

  // ── Pastas ───────────────────────────────────────────────────────────────

  const criarPasta = useCallback(async (payload: {
    nome: string; descricao?: string; cor?: string; icone?: string;
  }) => {
    const { data, error } = await supabase
      .from("documento_pasta")
      .insert({ ...payload, cliente_id: clienteId })
      .select()
      .single();
    if (error) { toast.error("Erro ao criar pasta"); throw error; }
    toast.success("Pasta criada!");
    await load();
    return data as DocumentoPasta;
  }, [clienteId, load]);

  const atualizarPasta = useCallback(async (id: string, payload: Partial<DocumentoPasta>) => {
    const { error } = await (supabase.from("documento_pasta") as any)
      .update(payload)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar pasta"); throw error; }
    toast.success("Pasta atualizada!");
    await load();
  }, [load]);

  const excluirPasta = useCallback(async (id: string) => {
    // Deletar arquivos no storage primeiro
    const arqsDaPasta = arquivos.filter(a => a.pasta_id === id);
    for (const arq of arqsDaPasta) {
      await supabase.storage.from(arq.bucket ?? CLIENTE_BUCKET).remove([arq.storage_path]);
    }
    const { error } = await supabase.from("documento_pasta").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir pasta"); throw error; }
    toast.success("Pasta excluída.");
    await load();
  }, [arquivos, load]);

  // ── Arquivos ─────────────────────────────────────────────────────────────

  const uploadArquivo = useCallback(async (pastaId: string, file: File, descricao?: string) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${clienteId}/${pastaId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("documentos-clientes")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) { toast.error("Erro no upload: " + upErr.message); throw upErr; }

      const { data: urlData } = supabase.storage
        .from("documentos-clientes")
        .getPublicUrl(path);

      // `bucket` é coluna real (migration 031); types.ts foi gerado antes dela,
      // por isso o cast — regenerar os tipos depois remove o `as any`.
      const { error: dbErr } = await (supabase.from("documento_arquivo") as any).insert({
        pasta_id: pastaId,
        cliente_id: clienteId,
        nome: file.name,
        descricao,
        tipo_mime: file.type,
        tamanho_bytes: file.size,
        storage_path: path,
        storage_url: urlData?.publicUrl ?? null,
        bucket: CLIENTE_BUCKET,
      });
      if (dbErr) { toast.error("Erro ao registrar arquivo"); throw dbErr; }
      toast.success(`"${file.name}" enviado!`);
      await load();
    } finally {
      setUploading(false);
    }
  }, [clienteId, load]);

  const excluirArquivo = useCallback(async (arquivo: DocumentoArquivo) => {
    await supabase.storage.from(arquivo.bucket ?? CLIENTE_BUCKET).remove([arquivo.storage_path]);
    const { error } = await supabase.from("documento_arquivo").delete().eq("id", arquivo.id);
    if (error) { toast.error("Erro ao excluir arquivo"); throw error; }
    toast.success("Arquivo removido.");
    await load();
  }, [load]);

  const getSignedUrl = useCallback(async (storagePath: string, bucket = CLIENTE_BUCKET, expiresIn = 3600) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);
    if (error) { toast.error("Não foi possível gerar link"); return null; }
    return data.signedUrl;
  }, []);

  const arquivosDaPasta = useCallback(
    (pastaId: string) => arquivos.filter(a => a.pasta_id === pastaId),
    [arquivos]
  );

  return {
    pastas, arquivos, loading, uploading, reload: load,
    criarPasta, atualizarPasta, excluirPasta,
    uploadArquivo, excluirArquivo, getSignedUrl, arquivosDaPasta,
  };
}

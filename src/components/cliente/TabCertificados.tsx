/**
 * TabCertificados — Cadastro manual de certificado digital A1/A3
 * Fluxo: operador anexa o .pfx (arquivado no Storage) e informa tipo e
 * validade manualmente. CNPJ/razão vêm do cadastro do cliente.
 */
import { useEffect, useState, useRef, useCallback } from "react";
import {
  FileKey2, Shield, ShieldOff, Upload,
  CheckCircle2, AlertTriangle, Clock, Loader2, X,
  RefreshCw, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CertInfo {
  id?:                   string;
  tipo:                  "A1" | "A3";
  pfxNomeRazao?:         string;
  pfxCnpj?:              string;
  pfxSerial?:            string;
  pfxValidade?:          string;
  hasProcuracao:         boolean;
  procuracaoValidade?:   string;
  focusEntregue:        boolean;
  focusEntregueEm?:     string;
  focusCertId?:             string;
}

const EMPTY: CertInfo = { tipo: "A1", hasProcuracao: false, focusEntregue: false };

function diasParaVencer(iso?: string): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function ValidadeBadge({ data, label }: { data?: string; label: string }) {
  const dias = diasParaVencer(data);
  if (dias === null) return <span className="text-muted-foreground text-xs">Não informada</span>;
  if (dias < 0)   return <Badge className="bg-rose-100 text-rose-700 border-0 gap-1"><ShieldOff className="h-3 w-3"/>{label} expirado</Badge>;
  if (dias < 30)  return <Badge className="bg-amber-100 text-amber-700 border-0 gap-1"><AlertTriangle className="h-3 w-3"/>Vence em {dias}d</Badge>;
  if (dias < 90)  return <Badge className="bg-yellow-100 text-yellow-700 border-0 gap-1"><Clock className="h-3 w-3"/>Vence em {dias}d</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1"><CheckCircle2 className="h-3 w-3"/>{new Date(data!).toLocaleDateString("pt-BR")}</Badge>;
}

interface Props { clienteId: string; cnpj?: string; razaoSocial?: string; onCertificateUpdated?: () => void; }

export function TabCertificados({ clienteId, cnpj, razaoSocial, onCertificateUpdated }: Props) {
  const [cert, setCert]           = useState<CertInfo>(EMPTY);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tipoInput, setTipoInput]         = useState<"A1" | "A3">("A1");
  const [validadeInput, setValidadeInput] = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [savingProc, setSavingProc]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("cliente_certificado")
          .select("id,tipo,pfx_nome_razao,pfx_cnpj,pfx_serial,pfx_validade,has_procuracao,procuracao_validade,focus_cert_ref,focus_cert_enviado_em")
          .eq("cliente_id", clienteId)
          .maybeSingle();
        if (data) {
          setCert({
            id:                  data.id,
            tipo:                data.tipo ?? "A1",
            pfxNomeRazao:        data.pfx_nome_razao,
            pfxCnpj:             data.pfx_cnpj,
            pfxSerial:           data.pfx_serial,
            pfxValidade:         data.pfx_validade,
            hasProcuracao:       data.has_procuracao ?? false,
            procuracaoValidade:  data.procuracao_validade,
            focusEntregue:      !!data.focus_cert_ref,
            focusEntregueEm:    data.focus_cert_enviado_em,
            focusCertId:        data.focus_cert_ref,
          });
          setTipoInput(data.tipo === "A3" ? "A3" : "A1");
          setValidadeInput(data.pfx_validade?.split("T")[0] ?? "");
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [clienteId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  }, []);

  function validateAndSetFile(file: File) {
    if (!file.name.match(/\.(pfx|p12)$/i)) {
      toast.error("Apenas arquivos .pfx ou .p12 são aceitos");
      return;
    }
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile) { toast.error("Selecione o arquivo .pfx"); return; }
    if (!validadeInput) { toast.error("Informe a validade do certificado"); return; }

    setUploading(true);
    toast.loading("Salvando certificado…", { id: "cert-up" });

    try {
      // Metadados informados manualmente pelo operador (modo manual).
      // CNPJ e razão social vêm do cadastro do cliente.
      const certMeta = {
        nomeRazao: razaoSocial ?? "",
        cnpj:      (cnpj ?? "").replace(/\D/g, ""),
        serial:    "",
        validoAte: validadeInput,
        tipo:      tipoInput,
      };

      // Upload Supabase Storage (bucket privado) — apenas arquiva o .pfx
      const storagePath = `certificados/${clienteId}/${Date.now()}_cert.pfx`;
      const { error: storErr } = await supabase.storage
        .from("documentos-clientes")
        .upload(storagePath, selectedFile, { upsert: true, contentType: "application/x-pkcs12" });
      if (storErr) throw storErr;

      // 4. Marcar referência Focus NF-e (certificado gerenciado pelo painel app.focusnfe.com.br)
      // O upload real do certificado é feito manualmente no painel da Focus.
      // Aqui apenas registramos o CNPJ como referência para rastrear o status.
      let focusCertId: string | undefined = certMeta.cnpj || undefined;
      let focusUploadedAt: string | undefined = focusCertId ? new Date().toISOString() : undefined;

      // 5. Persistir no banco
      const row: Record<string, unknown> = {
        cliente_id:              clienteId,
        tipo:                    certMeta.tipo,
        pfx_cnpj:                certMeta.cnpj || undefined,
        pfx_nome_razao:          certMeta.nomeRazao || undefined,
        pfx_serial:              certMeta.serial || undefined,
        pfx_validade:            certMeta.validoAte || undefined,
        focus_cert_ref:          focusCertId || undefined,
        focus_cert_enviado_em:   focusUploadedAt || undefined,
        has_procuracao:          cert.hasProcuracao,
        procuracao_validade:     cert.procuracaoValidade || null,
      };

      if (cert.id) {
        const { error: upErr } = await (supabase as any).from("cliente_certificado").update(row).eq("id", cert.id);
        if (upErr) throw upErr;
      } else {
        const { data: ins, error: insErr } = await (supabase as any)
          .from("cliente_certificado").insert(row).select().single();
        if (insErr) throw insErr;
        if (ins) row.id = (ins as any).id;
      }

      // 6. Flag tem_certificado
      await (supabase as any).from("clientes")
        .update({ tem_certificado: true }).eq("id", clienteId);

      // 7. Obrigação de alerta de vencimento (60 dias antes)
      if (certMeta.validoAte) {
        const dtAlerta = new Date(certMeta.validoAte);
        dtAlerta.setDate(dtAlerta.getDate() - 60);
        // competencia e responsavel são NOT NULL em obrigacoes.
        const { data: { user } } = await supabase.auth.getUser();
        await (supabase as any).from("obrigacoes").upsert({
          cliente_id:   clienteId,
          codigo:       `CERT-VENC-${clienteId.slice(0, 8)}`,
          nome:         "Renovação de Certificado Digital",
          descricao:    `Certificado A1 vence em ${new Date(certMeta.validoAte).toLocaleDateString("pt-BR")}. Iniciar processo de renovação com a AC.`,
          tipo:         "certificado",
          regime:       "todos",
          competencia:  dtAlerta.toISOString().slice(0, 7),
          vencimento:   dtAlerta.toISOString().split("T")[0],
          status:       "pendente",
          responsavel:  user?.email ?? "Escritório",
          cliente_nome: razaoSocial ?? "",
        }, { onConflict: "codigo" });
      }

      // 8. Atualizar state
      setCert(p => ({
        ...p,
        id:              (row.id as string) ?? p.id,
        tipo:            certMeta.tipo,
        pfxNomeRazao:    certMeta.nomeRazao || razaoSocial,
        pfxCnpj:         certMeta.cnpj,
        pfxSerial:       certMeta.serial,
        pfxValidade:     certMeta.validoAte,
        focusEntregue:  !!focusCertId,
        focusEntregueEm: focusUploadedAt,
        focusCertId,
      }));

      setSelectedFile(null);
      toast.success("Certificado cadastrado com sucesso!", { id: "cert-up" });
      onCertificateUpdated?.();
    } catch (err: any) {
      toast.error("Erro: " + (err.message ?? "Falha no upload"), { id: "cert-up" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveProcuracao() {
    setSavingProc(true);
    try {
      const row = {
        cliente_id:          clienteId,
        tipo:                cert.tipo,
        has_procuracao:      cert.hasProcuracao,
        procuracao_validade: cert.procuracaoValidade || null,
      };
      if (cert.id) {
        const { error: upErr } = await (supabase as any).from("cliente_certificado").update(row).eq("id", cert.id);
        if (upErr) throw upErr;
      } else {
        const { data: ins, error: insErr } = await (supabase as any)
          .from("cliente_certificado").insert(row).select().single();
        if (insErr) throw insErr;
        if (ins) setCert(p => ({ ...p, id: (ins as any).id }));
      }
      await (supabase as any).from("clientes")
        .update({ tem_procuracao: cert.hasProcuracao }).eq("id", clienteId);
      toast.success("Procuração salva");
      onCertificateUpdated?.();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setSavingProc(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-apoya-orange" />
    </div>
  );

  const temCert  = !!cert.pfxValidade || cert.focusEntregue;
  const diasCert = diasParaVencer(cert.pfxValidade);
  const diasProc = diasParaVencer(cert.procuracaoValidade);

  return (
    <div className="space-y-6">

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`rounded-xl p-4 border-2 flex items-start gap-3 ${
          temCert
            ? (diasCert !== null && diasCert < 30 ? "border-amber-400 bg-amber-50" : "border-emerald-400 bg-emerald-50")
            : "border-border bg-muted/30"
        }`}>
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${temCert ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
            <FileKey2 className="h-5 w-5"/>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">Certificado Digital</p>
            <p className="text-xs text-muted-foreground">{cert.tipo}</p>
            {cert.pfxNomeRazao && <p className="text-xs font-medium truncate mt-0.5" title={cert.pfxNomeRazao}>{cert.pfxNomeRazao}</p>}
            <div className="mt-1">
              {temCert ? <ValidadeBadge data={cert.pfxValidade} label="Cert."/> : <span className="text-xs text-rose-600 font-medium">Não cadastrado</span>}
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-4 border-2 flex items-start gap-3 ${
          cert.hasProcuracao
            ? (diasProc !== null && diasProc < 30 ? "border-amber-400 bg-amber-50" : "border-emerald-400 bg-emerald-50")
            : "border-border bg-muted/30"
        }`}>
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${cert.hasProcuracao ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
            <Shield className="h-5 w-5"/>
          </div>
          <div>
            <p className="font-semibold text-sm">Procuração eCAC</p>
            <p className="text-xs text-muted-foreground">Acesso SERPRO/RFB</p>
            <div className="mt-1">
              {cert.hasProcuracao ? <ValidadeBadge data={cert.procuracaoValidade} label="Proc."/> : <span className="text-xs text-rose-600 font-medium">Não cadastrada</span>}
            </div>
          </div>
        </div>

        <div className={`rounded-xl p-4 border-2 flex items-start gap-3 ${cert.focusEntregue ? "border-emerald-400 bg-emerald-50" : "border-border bg-muted/30"}`}>
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${cert.focusEntregue ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
            <CheckCircle2 className="h-5 w-5"/>
          </div>
          <div>
            <p className="font-semibold text-sm">Focus NF-e</p>
            <p className="text-xs text-muted-foreground">Emissão de NFS-e</p>
            <div className="mt-1">
              {cert.focusEntregue
                ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Ativo</Badge>
                : <span className="text-xs text-muted-foreground">Certificado não cadastrado no painel Focus</span>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-apoya-orange"/>
          <h3 className="font-semibold text-sm">
            {temCert ? "Substituir Certificado" : "Cadastrar Certificado"}
          </h3>
          {temCert && <Badge variant="outline" className="text-xs ml-auto">Substitui o anterior</Badge>}
        </div>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all select-none ${
            dragOver ? "border-apoya-orange bg-orange-50 scale-[1.01]"
            : selectedFile ? "border-emerald-400 bg-emerald-50"
            : "border-border hover:border-apoya-orange/50 hover:bg-muted/30"
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pfx,.p12"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); }}
          />
          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileKey2 className="h-8 w-8 text-emerald-600 shrink-0"/>
              <div className="text-left">
                <p className="font-medium text-sm text-emerald-700">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB — pronto para envio</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="ml-auto p-1 rounded hover:bg-emerald-100"
              >
                <X className="h-4 w-4 text-emerald-600"/>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <FileKey2 className={`h-10 w-10 mx-auto ${dragOver ? "text-apoya-orange" : "text-muted-foreground"}`}/>
              <p className="font-medium text-sm">Arraste o arquivo .pfx aqui</p>
              <p className="text-xs text-muted-foreground">ou clique para selecionar · aceita .pfx e .p12</p>
            </div>
          )}
        </div>

        {/* Tipo + validade (entrada manual) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cert-tipo" className="text-sm">Tipo do certificado</Label>
            <select
              id="cert-tipo"
              value={tipoInput}
              onChange={e => setTipoInput(e.target.value === "A3" ? "A3" : "A1")}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="A1">A1 (arquivo .pfx)</option>
              <option value="A3">A3 (token/cartão)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cert-validade" className="text-sm">Validade do certificado</Label>
            <Input
              id="cert-validade"
              type="date"
              value={validadeInput}
              onChange={e => setValidadeInput(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3 shrink-0"/>
          Nome e CNPJ vêm do cadastro do cliente. Informe tipo e validade manualmente.
        </p>

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !validadeInput || uploading}
          className="w-full bg-apoya-orange hover:bg-apoya-orange/90 text-white gap-2"
        >
          {uploading
            ? <><Loader2 className="h-4 w-4 animate-spin"/>Processando…</>
            : <><Upload className="h-4 w-4"/>Enviar certificado</>
          }
        </Button>
      </div>

      {/* Dados extraídos (read-only) */}
      {temCert && (cert.pfxNomeRazao || cert.pfxCnpj || cert.pfxValidade) && (
        <div className="surface-card p-5 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dados do certificado atual</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {cert.pfxNomeRazao && (
              <div><span className="text-xs text-muted-foreground block">Titular</span><span className="font-medium">{cert.pfxNomeRazao}</span></div>
            )}
            {cert.pfxCnpj && (
              <div><span className="text-xs text-muted-foreground block">CNPJ</span><span className="font-mono">{cert.pfxCnpj}</span></div>
            )}
            {cert.pfxValidade && (
              <div><span className="text-xs text-muted-foreground block">Validade</span><ValidadeBadge data={cert.pfxValidade} label="Cert."/></div>
            )}
            {cert.pfxSerial && (
              <div><span className="text-xs text-muted-foreground block">Serial</span><span className="font-mono text-xs text-muted-foreground">{cert.pfxSerial}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Procuração */}
      <div className="surface-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-apoya-orange"/>
          <h3 className="font-semibold text-sm">Procuração eCAC</h3>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={cert.hasProcuracao}
            onChange={e => setCert(p => ({ ...p, hasProcuracao: e.target.checked }))}
            className="h-4 w-4 accent-apoya-orange"
          />
          <span className="text-sm">Procuração eCAC concedida</span>
        </label>
        {cert.hasProcuracao && (
          <div className="space-y-1.5">
            <Label className="text-sm">Validade da procuração</Label>
            <Input
              type="date"
              value={cert.procuracaoValidade?.split("T")[0] ?? ""}
              onChange={e => setCert(p => ({ ...p, procuracaoValidade: e.target.value }))}
              className="max-w-xs"
            />
          </div>
        )}
        <Button onClick={saveProcuracao} disabled={savingProc} variant="outline" size="sm" className="gap-2">
          {savingProc ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4"/>}
          Salvar
        </Button>
      </div>

    </div>
  );
}

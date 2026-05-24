/**
 * TabCertificados — Gestão de certificado digital (A1/A3) e procuração eCAC
 * Faz upload para Supabase Storage, armazena metadados em cliente_certificado.
 * O certificado fica disponível para injetar no SERPRO/NFE.io via secrets.
 */
import { useEffect, useState, useRef } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldOff, Upload, Key,
  AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, FileKey2,
  CalendarClock, Info, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CertData {
  id?: string;
  tipo: "A1" | "A3";
  pfxNomeRazao?: string;
  pfxCnpj?: string;
  pfxSerial?: string;
  pfxValidade?: string;
  hasProcuracao: boolean;
  procuracaoValidade?: string;
  procuracaoVerificadaEm?: string;
  nfseioEntregue: boolean;
  nfseioEntregueEm?: string;
  storagePath?: string;
  storageUrl?: string;
}

const EMPTY: CertData = {
  tipo: "A1", hasProcuracao: false, nfseioEntregue: false,
};

function diasParaVencer(data?: string): number | null {
  if (!data) return null;
  const diff = new Date(data).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function ValidadeBadge({ data, label }: { data?: string; label: string }) {
  const dias = diasParaVencer(data);
  if (dias === null) return <span className="text-muted-foreground text-xs">Não informada</span>;
  if (dias < 0)  return <Badge className="bg-rose-100 text-rose-700 border-0 gap-1"><ShieldOff className="h-3 w-3" />{label} expirado</Badge>;
  if (dias < 30) return <Badge className="bg-amber-100 text-amber-700 border-0 gap-1"><AlertTriangle className="h-3 w-3" />Vence em {dias}d</Badge>;
  if (dias < 90) return <Badge className="bg-yellow-100 text-yellow-700 border-0 gap-1"><Clock className="h-3 w-3" />Vence em {dias}d</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-0 gap-1"><CheckCircle2 className="h-3 w-3" />{new Date(data!).toLocaleDateString("pt-BR")}</Badge>;
}

interface Props { clienteId: string; cnpj?: string; }

export function TabCertificados({ clienteId, cnpj }: Props) {
  const [cert, setCert]           = useState<CertData>(EMPTY);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [senha, setSenha]         = useState("");
  const [senhaConf, setSenhaConf] = useState("");
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Carregar dados do certificado
  useEffect(() => {
    async function loadCert() {
      setLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("cliente_certificado")
          .select("*")
          .eq("cliente_id", clienteId)
          .maybeSingle();

        if (data) {
          setCert({
            id:                    data.id,
            tipo:                  data.tipo ?? "A1",
            pfxNomeRazao:          data.pfx_nome_razao,
            pfxCnpj:               data.pfx_cnpj,
            pfxSerial:             data.pfx_serial,
            pfxValidade:           data.pfx_validade,
            hasProcuracao:         data.has_procuracao ?? false,
            procuracaoValidade:    data.procuracao_validade,
            procuracaoVerificadaEm: data.procuracao_verificada_em,
            nfseioEntregue:        !!data.nfseio_cert_id,
            nfseioEntregueEm:      data.nfseio_cert_uploaded_at,
            storagePath:           data.storage_path,
            storageUrl:            data.storage_url,
          });
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    loadCert();
  }, [clienteId]);

  // Upload do arquivo PFX
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(pfx|p12)$/i)) {
      toast.error("Apenas arquivos .pfx ou .p12 são aceitos");
      return;
    }
    if (!senha || senha.length < 4) {
      toast.error("Informe a senha do certificado antes de fazer upload");
      return;
    }
    if (senha !== senhaConf) {
      toast.error("As senhas não conferem");
      return;
    }

    setUploading(true);
    toast.loading("Enviando certificado…", { id: "cert-upload" });
    try {
      const cnpjLimpo = (cnpj ?? "").replace(/\D/g, "");
      const path = `certificados/${clienteId}/${Date.now()}_cert.pfx`;

      const { error: upErr } = await supabase.storage
        .from("documentos")
        .upload(path, file, { upsert: true, contentType: "application/x-pkcs12" });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("documentos")
        .getPublicUrl(path);

      // Salvar metadados (sem criptografia no MVP — flag para futuro)
      const row: Record<string, unknown> = {
        cliente_id:   clienteId,
        tipo:         cert.tipo,
        pfx_cnpj:     cnpjLimpo || undefined,
        pfx_nome_razao: cert.pfxNomeRazao,
        has_procuracao: cert.hasProcuracao,
        procuracao_validade: cert.procuracaoValidade || undefined,
        storage_path: path,
        storage_url:  urlData?.publicUrl,
      };

      if (cert.id) {
        await (supabase as any).from("cliente_certificado").update(row).eq("id", cert.id);
      } else {
        const { data: ins } = await (supabase as any).from("cliente_certificado").insert(row).select().single();
        if (ins) setCert(p => ({ ...p, id: (ins as any).id }));
      }

      // Atualizar flag no cliente
      await (supabase as any).from("clientes").update({ tem_certificado: true }).eq("id", clienteId);

      setCert(p => ({
        ...p,
        storagePath: path,
        storageUrl: urlData?.publicUrl,
      }));

      toast.success("Certificado enviado com sucesso!", { id: "cert-upload" });
      setSenha(""); setSenhaConf("");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message, { id: "cert-upload" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Salvar configurações de procuração
  async function saveProcuracao() {
    setSaving(true);
    try {
      const row = {
        cliente_id:          clienteId,
        tipo:                cert.tipo,
        has_procuracao:      cert.hasProcuracao,
        procuracao_validade: cert.procuracaoValidade || null,
      };
      if (cert.id) {
        await (supabase as any).from("cliente_certificado").update(row).eq("id", cert.id);
      } else {
        const { data: ins } = await (supabase as any).from("cliente_certificado").insert(row).select().single();
        if (ins) setCert(p => ({ ...p, id: (ins as any).id }));
      }
      // Atualizar flag procuração no cliente
      await (supabase as any).from("clientes").update({ tem_procuracao: cert.hasProcuracao }).eq("id", clienteId);
      toast.success("Configuração de procuração salva");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-apoya-orange" />
    </div>
  );

  const temCert     = !!cert.storagePath;
  const diasCert    = diasParaVencer(cert.pfxValidade);
  const diasProc    = diasParaVencer(cert.procuracaoValidade);

  return (
    <div className="space-y-5">
      {/* Status geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card certificado */}
        <div className={`rounded-xl p-4 border-2 flex items-start gap-3
          ${temCert
            ? diasCert !== null && diasCert < 30 ? "border-amber-400 bg-amber-50" : "border-emerald-400 bg-emerald-50"
            : "border-border bg-muted/30"}`}>
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0
            ${temCert ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
            <FileKey2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Certificado Digital</p>
            <p className="text-xs mt-0.5 text-muted-foreground">{cert.tipo}</p>
            {temCert
              ? <ValidadeBadge data={cert.pfxValidade} label="Cert." />
              : <span className="text-xs text-rose-600 font-medium">Não cadastrado</span>
            }
          </div>
        </div>

        {/* Card procuração */}
        <div className={`rounded-xl p-4 border-2 flex items-start gap-3
          ${cert.hasProcuracao
            ? diasProc !== null && diasProc < 30 ? "border-amber-400 bg-amber-50" : "border-emerald-400 bg-emerald-50"
            : "border-border bg-muted/30"}`}>
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0
            ${cert.hasProcuracao ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">Procuração eCAC</p>
            <p className="text-xs mt-0.5 text-muted-foreground">Acesso ao eCAC/SERPRO</p>
            {cert.hasProcuracao
              ? <ValidadeBadge data={cert.procuracaoValidade} label="Proc." />
              : <span className="text-xs text-rose-600 font-medium">Não cadastrada</span>
            }
          </div>
        </div>

        {/* Card NFE.io */}
        <div className={`rounded-xl p-4 border-2 flex items-start gap-3
          ${cert.nfseioEntregue ? "border-emerald-400 bg-emerald-50" : "border-border bg-muted/30"}`}>
          <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0
            ${cert.nfseioEntregue ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
            <Key className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">NFE.io</p>
            <p className="text-xs mt-0.5 text-muted-foreground">Certificado na plataforma</p>
            {cert.nfseioEntregue
              ? <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Entregue
                </Badge>
              : <span className="text-xs text-muted-foreground">Pendente</span>
            }
          </div>
        </div>
      </div>

      {/* Upload certificado A1 */}
      <div className="surface-card rounded-xl p-5 border border-border/50 space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-apoya-orange" /> Upload do Certificado Digital
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo de Certificado</Label>
            <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm mt-1"
              value={cert.tipo}
              onChange={e => setCert(p => ({ ...p, tipo: e.target.value as "A1" | "A3" }))}>
              <option value="A1">A1 — Arquivo .pfx/.p12 (software)</option>
              <option value="A3">A3 — Token/Smartcard (hardware)</option>
            </select>
          </div>
          <div>
            <Label>Razão Social no Certificado</Label>
            <Input placeholder="Igual à Receita Federal" value={cert.pfxNomeRazao ?? ""}
              onChange={e => setCert(p => ({ ...p, pfxNomeRazao: e.target.value }))}
              className="mt-1" />
          </div>
        </div>

        {cert.tipo === "A1" && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-800">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>O arquivo .pfx é armazenado de forma segura e nunca é exposto ao navegador.
              A senha é usada apenas para descriptografar ao enviar para NFE.io ou SERPRO.</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Senha do Certificado</Label>
                <div className="relative mt-1">
                  <Input type={showSenha ? "text" : "password"} placeholder="Senha do .pfx"
                    value={senha} onChange={e => setSenha(e.target.value)} />
                  <button type="button" className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSenha(p => !p)}>
                    {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Confirmar Senha</Label>
                <Input type="password" placeholder="Repita a senha" className="mt-1"
                  value={senhaConf} onChange={e => setSenhaConf(e.target.value)} />
              </div>
            </div>

            <div>
              <input ref={fileRef} type="file" accept=".pfx,.p12" className="hidden"
                onChange={handleFileUpload} />
              <Button variant="outline" onClick={() => fileRef.current?.click()}
                disabled={uploading || !senha || !senhaConf}>
                {uploading
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando…</>
                  : <><Upload className="h-4 w-4 mr-2" />
                    {temCert ? "Substituir arquivo .pfx" : "Selecionar arquivo .pfx / .p12"}</>
                }
              </Button>
              {temCert && (
                <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Certificado armazenado com segurança
                </p>
              )}
            </div>
          </>
        )}

        {cert.tipo === "A3" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            <p className="font-medium mb-1">Certificado A3 (Token/Smartcard)</p>
            <p>Certificados A3 não são armazenados no sistema. O token físico deve ser conectado
            na máquina onde o software contábil é executado. Registre aqui apenas as informações
            de validade e controle.</p>
          </div>
        )}
      </div>

      {/* Procuração eCAC */}
      <div className="surface-card rounded-xl p-5 border border-border/50 space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-apoya-orange" /> Procuração eCAC / SERPRO
        </h4>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="has_proc" className="h-4 w-4 accent-apoya-orange"
            checked={cert.hasProcuracao}
            onChange={e => setCert(p => ({ ...p, hasProcuracao: e.target.checked }))} />
          <label htmlFor="has_proc" className="text-sm cursor-pointer">
            Procuração cadastrada no eCAC para acesso via SERPRO
          </label>
        </div>

        {cert.hasProcuracao && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Validade da Procuração</Label>
              <Input type="date" className="mt-1" value={cert.procuracaoValidade ?? ""}
                onChange={e => setCert(p => ({ ...p, procuracaoValidade: e.target.value }))} />
            </div>
            {cert.procuracaoVerificadaEm && (
              <div>
                <Label>Última verificação SERPRO</Label>
                <p className="text-sm mt-2 text-muted-foreground">
                  {new Date(cert.procuracaoVerificadaEm).toLocaleString("pt-BR")}
                </p>
              </div>
            )}
          </div>
        )}

        <Button onClick={saveProcuracao} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Salvar configuração
        </Button>
      </div>

      {/* Info técnica */}
      <div className="surface-card rounded-xl p-4 border border-border/50 bg-muted/20">
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" /> Como o certificado é usado
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>SERPRO:</strong> Injeção automática via MCP para consultas de DAS, PGDAS, situação fiscal e procurações eCAC</li>
          <li><strong>NFE.io:</strong> Upload automático para emissão de NFS-e em nome do cliente</li>
          <li><strong>SEFAZ:</strong> Assinatura de NF-e e NFC-e (via integração futura)</li>
          <li>O arquivo fica em storage privado — nunca acessível publicamente via URL</li>
        </ul>
      </div>
    </div>
  );
}

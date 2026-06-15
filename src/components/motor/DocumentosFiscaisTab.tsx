/**
 * DocumentosFiscaisTab — NF-e entrada/saída + NFS-e de um cliente
 * Motor contábil: visualiza, classifica e aciona lançamentos
 */
import { useState, useEffect, useRef } from "react";
import {
  FileText, Upload, RefreshCw, Loader2, AlertTriangle,
  CheckCircle2, Clock, XCircle, Filter, ChevronDown,
  ArrowDownToLine, ArrowUpFromLine, Receipt, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InlineBadge } from "@/components/DataTable";

interface DocumentoFiscal {
  id: string;
  tipo: string;
  numero?: string;
  serie?: string;
  chave_acesso?: string;
  modelo?: string;
  data_emissao?: string;
  mes_referencia?: string;
  emitente_cnpj?: string;
  emitente_razao?: string;
  destinatario_cnpj?: string;
  valor_total?: number;
  valor_icms?: number;
  natureza_fiscal?: string;
  natureza_operacao?: string;
  xml_url?: string;
  gera_credito_icms?: boolean;
  valor_credito_icms?: number;
  conta_contabil_sugerida?: string;
  status?: string;
  classificado_por?: string;
  confianca?: string;
}

const TIPO_LABEL: Record<string, string> = {
  nfe_entrada:    "NF-e Entrada",
  nfe_saida:      "NF-e Saída",
  nfse_emitida:   "NFS-e Emitida",
  nfse_recebida:  "NFS-e Recebida",
  cte:            "CT-e",
  manual:         "Manual",
};

const TIPO_ICON: Record<string, any> = {
  nfe_entrada:   ArrowDownToLine,
  nfe_saida:     ArrowUpFromLine,
  nfse_emitida:  Receipt,
  nfse_recebida: Receipt,
};

const STATUS_COLOR: Record<string, "green" | "blue" | "gray" | "red" | "violet"> = {
  recebido:                "gray",
  classificado_auto:       "blue",
  classificado_confirmado: "green",
  lancado:                 "violet",
  erro:                    "red",
  cancelado:               "red",
  ignorado:                "gray",
};

const NATUREZA_LABEL: Record<string, string> = {
  compra_revenda:    "Compra p/ Revenda",
  uso_consumo:       "Uso e Consumo",
  ativo_imobilizado: "Ativo Imobilizado",
  venda:             "Venda",
  servico_prestado:  "Serviço Prestado",
  servico_tomado:    "Serviço Tomado",
  devolucao:         "Devolução",
  outro:             "Outro",
};

const fmtBRL  = (v?: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtDate = (d?: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

const onlyDigits = (s?: string | null) => (s ?? "").replace(/\D/g, "");

/**
 * Parseia um XML fiscal (NF-e/NFC-e layout SEFAZ; best-effort p/ NFS-e) e
 * devolve os campos para inserir em documentos_fiscais. Roda só no cliente
 * (chamado dentro de handler de evento, nunca no SSR).
 */
function parseXmlFiscal(xml: string, clienteCnpj?: string): Partial<DocumentoFiscal> & { tipo: string } {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const txt = (tag: string) => doc.getElementsByTagName(tag)?.[0]?.textContent?.trim() || undefined;
  const num = (tag: string) => { const v = txt(tag); return v != null ? Number(v) : undefined; };

  // --- NF-e / NFC-e (tem infNFe) ---
  const infNFe = doc.getElementsByTagName("infNFe")?.[0];
  if (infNFe) {
    const chave = (infNFe.getAttribute("Id") || "").replace(/^NFe/i, "") || undefined;
    const emitCnpj = onlyDigits(txt("CNPJ"));               // 1º CNPJ = emitente
    const dhEmi = txt("dhEmi") || txt("dEmi");               // datetime ou date
    const dataEmissao = dhEmi ? dhEmi.slice(0, 10) : undefined;
    const modelo = txt("mod");
    const cliCnpj = onlyDigits(clienteCnpj);
    // emitente == cliente → saída; senão entrada (NFC-e mod 65 é sempre saída)
    const tipo = modelo === "65" || (cliCnpj && emitCnpj === cliCnpj) ? "nfe_saida" : "nfe_entrada";
    return {
      tipo,
      chave_acesso: chave,
      numero: txt("nNF"),
      serie: txt("serie"),
      modelo,
      data_emissao: dataEmissao,
      mes_referencia: dataEmissao?.slice(0, 7),
      emitente_cnpj: emitCnpj || undefined,
      emitente_razao: txt("xNome"),
      valor_total: num("vNF"),
      valor_icms: num("vICMS"),
      natureza_operacao: txt("natOp"),
    };
  }

  // --- NFS-e (best-effort; layout varia por município) ---
  const isNfse = doc.getElementsByTagName("Nfse")?.[0] || doc.getElementsByTagName("InfNfse")?.[0]
    || doc.getElementsByTagName("CompNfse")?.[0];
  if (isNfse) {
    const prestCnpj = onlyDigits(txt("Cnpj"));
    const cliCnpj = onlyDigits(clienteCnpj);
    const dataEmissao = (txt("DataEmissao") || txt("Competencia"))?.slice(0, 10);
    return {
      tipo: cliCnpj && prestCnpj === cliCnpj ? "nfse_emitida" : "nfse_recebida",
      numero: txt("Numero"),
      data_emissao: dataEmissao,
      mes_referencia: dataEmissao?.slice(0, 7),
      emitente_cnpj: prestCnpj || undefined,
      emitente_razao: txt("RazaoSocial"),
      valor_total: num("ValorServicos") ?? num("ValorLiquidoNfse"),
    };
  }

  // --- Desconhecido: guarda mesmo assim p/ classificação manual ---
  return { tipo: "manual" };
}

interface Props {
  clienteId: string;
  clienteCnpj?: string;
  mesReferencia?: string; // 'YYYY-MM' — se omitido, mostra todos
}

export function DocumentosFiscaisTab({ clienteId, clienteCnpj, mesReferencia }: Props) {
  const [docs, setDocs]         = useState<DocumentoFiscal[]>([]);
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const fileRef = useRef<HTMLInputElement>(null);

  async function carregarDocs() {
    setLoading(true);
    try {
      let q = (supabase as any)
        .from("documentos_fiscais")
        .select("*")
        .eq("empresa_id", clienteId)
        .order("data_emissao", { ascending: false })
        .limit(100);

      if (mesReferencia) q = q.eq("mes_referencia", mesReferencia);
      if (tipoFiltro !== "todos") q = q.eq("tipo", tipoFiltro);
      if (statusFiltro !== "todos") q = q.eq("status", statusFiltro);

      const { data, error } = await q;
      if (error) throw error;
      setDocs(data ?? []);
    } catch (e: any) {
      toast.error("Erro ao carregar documentos: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregarDocs(); }, [clienteId, mesReferencia, tipoFiltro, statusFiltro]);

  async function confirmarClassificacao(docId: string) {
    const { error } = await (supabase as any)
      .from("documentos_fiscais")
      .update({ status: "classificado_confirmado", classificado_por: "humano" })
      .eq("id", docId);
    if (error) { toast.error("Erro ao confirmar"); return; }
    toast.success("Classificação confirmada");
    carregarDocs();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!files.length) return;

    setUploading(true);
    let ok = 0, erros = 0;
    for (const file of files) {
      try {
        const xml = await file.text();
        const parsed = parseXmlFiscal(xml, clienteCnpj);

        // 1) sobe o XML cru pro storage (bucket "documentos")
        const path = `fiscal/${clienteId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await (supabase as any).storage
          .from("documentos").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = (supabase as any).storage.from("documentos").getPublicUrl(path);

        // 2) cria o registro em documentos_fiscais (status recebido p/ classificar)
        const { error: insErr } = await (supabase as any).from("documentos_fiscais").insert({
          empresa_id: clienteId,
          tipo: parsed.tipo,
          numero: parsed.numero ?? null,
          serie: parsed.serie ?? null,
          chave_acesso: parsed.chave_acesso ?? null,
          modelo: parsed.modelo ?? null,
          data_emissao: parsed.data_emissao ?? null,
          mes_referencia: parsed.mes_referencia ?? mesReferencia ?? null,
          emitente_cnpj: parsed.emitente_cnpj ?? null,
          emitente_razao: parsed.emitente_razao ?? null,
          valor_total: parsed.valor_total ?? null,
          valor_icms: parsed.valor_icms ?? null,
          natureza_operacao: parsed.natureza_operacao ?? null,
          xml_url: pub?.publicUrl ?? null,
          observacoes: parsed.tipo === "manual" ? `Importado: ${file.name} (layout não reconhecido)` : null,
          status: "recebido",
          classificado_por: "upload_manual",
        });
        if (insErr) throw insErr;
        ok++;
      } catch (err: any) {
        erros++;
        // eslint-disable-next-line no-console
        console.error("upload XML falhou:", file.name, err?.message);
      }
    }
    setUploading(false);
    if (ok)    toast.success(`${ok} documento(s) importado(s)`);
    if (erros) toast.error(`${erros} arquivo(s) falharam (veja o console)`);
    if (ok) carregarDocs();
  }

  async function excluirDoc(doc: DocumentoFiscal & { xml_url?: string | null }) {
    if (!confirm(`Excluir o documento ${TIPO_LABEL[doc.tipo] ?? doc.tipo}${doc.numero ? ` nº ${doc.numero}` : ""}? Esta ação não pode ser desfeita.`)) return;
    try {
      // best-effort: remove o XML do storage se houver
      const xmlUrl = (doc as any).xml_url as string | undefined;
      const marker = "/documentos/";
      if (xmlUrl && xmlUrl.includes(marker)) {
        const storagePath = decodeURIComponent(xmlUrl.split(marker)[1].split("?")[0]);
        await (supabase as any).storage.from("documentos").remove([storagePath]);
      }
      const { error } = await (supabase as any).from("documentos_fiscais").delete().eq("id", doc.id);
      if (error) throw error;
      toast.success("Documento excluído");
      carregarDocs();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    }
  }

  // KPIs rápidos
  const totalEntrada = docs.filter(d => d.tipo === "nfe_entrada").reduce((s, d) => s + (d.valor_total ?? 0), 0);
  const totalSaida   = docs.filter(d => d.tipo === "nfe_saida" || d.tipo === "nfse_emitida").reduce((s, d) => s + (d.valor_total ?? 0), 0);
  const creditoIcms  = docs.filter(d => d.gera_credito_icms).reduce((s, d) => s + (d.valor_credito_icms ?? 0), 0);
  const pendentes    = docs.filter(d => d.status === "recebido" || d.status === "classificado_auto").length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Entradas",   value: fmtBRL(totalEntrada), tone: "text-foreground" },
          { label: "Total Saídas",     value: fmtBRL(totalSaida),   tone: "text-foreground" },
          { label: "Crédito ICMS",     value: fmtBRL(creditoIcms),  tone: "text-emerald-600" },
          { label: "Aguard. Revisão",  value: String(pendentes),     tone: pendentes > 0 ? "text-amber-600 font-bold" : "text-foreground" },
        ].map(k => (
          <div key={k.label} className="surface-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className={`text-lg font-bold tabular-nums mt-0.5 ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={tipoFiltro}
          onChange={e => { e.stopPropagation(); setTipoFiltro(e.target.value); }}
          className="h-8 rounded-lg border border-border/60 bg-background text-xs px-2 pr-6 appearance-none"
        >
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={statusFiltro}
          onChange={e => { e.stopPropagation(); setStatusFiltro(e.target.value); }}
          className="h-8 rounded-lg border border-border/60 bg-background text-xs px-2 pr-6 appearance-none"
        >
          <option value="todos">Todos os status</option>
          <option value="recebido">Recebido</option>
          <option value="classificado_auto">Classificado (auto)</option>
          <option value="classificado_confirmado">Confirmado</option>
          <option value="lancado">Lançado</option>
          <option value="erro">Erro</option>
        </select>
        <div className="flex-1" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={e => { e.stopPropagation(); carregarDocs(); }}
          disabled={loading}
          className="h-8 gap-1.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Atualizar
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
          disabled={uploading}
          className="h-8 gap-1.5"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Enviando…" : "Upload XML"}
        </Button>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div className="surface-card border-dashed flex flex-col items-center justify-center py-12 gap-3">
          <FileText className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum documento fiscal encontrado</p>
          <p className="text-xs text-muted-foreground/70">
            {mesReferencia ? `Competência ${mesReferencia}` : "Os documentos aparecerão aqui após a escrituração"}
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-hidden">
          <table className="ft-table w-full">
            <thead>
              <tr>
                <th className="text-left">Tipo / Número</th>
                <th className="text-left hidden sm:table-cell">Emitente</th>
                <th className="text-left hidden md:table-cell">Data</th>
                <th className="text-right">Valor</th>
                <th className="text-left hidden lg:table-cell">Natureza</th>
                <th className="text-left">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => {
                const Icon = TIPO_ICON[doc.tipo] ?? FileText;
                return (
                  <tr key={doc.id} className="group">
                    <td>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">{TIPO_LABEL[doc.tipo] ?? doc.tipo}</p>
                          {doc.numero && <p className="text-[11px] text-muted-foreground font-mono">Nº {doc.numero}{doc.serie ? ` / ${doc.serie}` : ""}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell">
                      <p className="text-xs truncate max-w-[160px]">{doc.emitente_razao ?? "—"}</p>
                      {doc.emitente_cnpj && <p className="text-[11px] font-mono text-muted-foreground">{doc.emitente_cnpj}</p>}
                    </td>
                    <td className="hidden md:table-cell text-xs">{fmtDate(doc.data_emissao)}</td>
                    <td className="text-right text-xs font-semibold tabular-nums">{fmtBRL(doc.valor_total)}</td>
                    <td className="hidden lg:table-cell">
                      {doc.natureza_fiscal ? (
                        <span className="text-[11px] text-muted-foreground">
                          {NATUREZA_LABEL[doc.natureza_fiscal] ?? doc.natureza_fiscal}
                        </span>
                      ) : <span className="text-[11px] text-muted-foreground/50">—</span>}
                    </td>
                    <td>
                      <InlineBadge color={STATUS_COLOR[doc.status ?? "recebido"] ?? "gray"} dot>
                        {doc.status === "recebido"                ? "Recebido"
                        : doc.status === "classificado_auto"      ? "Auto"
                        : doc.status === "classificado_confirmado"? "Confirmado"
                        : doc.status === "lancado"                ? "Lançado"
                        : doc.status === "erro"                   ? "Erro"
                        : doc.status ?? "—"}
                      </InlineBadge>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {doc.status === "classificado_auto" && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); confirmarClassificacao(doc.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          >
                            Confirmar
                          </button>
                        )}
                        <button
                          type="button"
                          title="Excluir documento"
                          onClick={e => { e.stopPropagation(); excluirDoc(doc); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
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
  );
}

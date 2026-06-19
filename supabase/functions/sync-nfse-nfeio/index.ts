/**
 * sync-nfse-nfeio — Sincroniza NFS-e emitidas do NFE.io para o banco
 *
 * Payload: { cliente_id: string, cnpj: string }
 * Busca as notas emitidas pela APOYA para aquele tomador (cnpj)
 * e insere/atualiza na tabela nfse_emitida.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/agent.ts";

const NFEIO_KEY    = Deno.env.get("NFEIO_API_KEY_NFSE")!;
const EMITENTE_ID  = "d8e1f4b5f4674fdaaaf034e5a837b85d"; // APOYA
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // FAIL-CLOSED: era pública → anon key alcançava NFE.io (API paga) e gravava
  // nfse_emitida via service-role. Exige JWT de usuário.
  const denied = await requireUser(req, corsHeaders);
  if (denied) return denied;

  try {
    const { cliente_id, cnpj } = await req.json();
    if (!cliente_id || !cnpj) {
      return new Response(JSON.stringify({ ok: false, error: "cliente_id e cnpj obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cnpjDigits = cnpj.replace(/\D/g, "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Buscar NFs da APOYA que têm este CNPJ como tomador
    let allInvoices: any[] = [];
    let pageIndex = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.nfe.io/v1/companies/${EMITENTE_ID}/serviceinvoices?pageSize=50&pageIndex=${pageIndex}`;
      const res = await fetch(url, { headers: { Authorization: NFEIO_KEY } });
      if (!res.ok) break;

      const data = await res.json();
      const invoices: any[] = data.serviceInvoices ?? [];
      
      // Filtrar pelo CNPJ do tomador
      const filtered = invoices.filter((n: any) => {
        const borrowerTax = String(n.borrower?.federalTaxNumber ?? "").replace(/\D/g, "");
        return borrowerTax === cnpjDigits;
      });
      
      allInvoices = allInvoices.concat(filtered);
      hasMore = data.page?.hasNext ?? false;
      pageIndex++;
      if (invoices.length === 0) break;
    }

    if (allInvoices.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, message: "Nenhuma NFS-e encontrada para este cliente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mapear para o schema nfse_emitida
    const rows = allInvoices.map((n: any) => ({
      cliente_id,
      nfseio_id:        n.id,
      numero:           n.number ? String(n.number) : null,
      codigo_verificacao: n.verificCode ?? null,
      status:           mapStatus(n.flowStatus),
      competencia:      n.issuedOn ? n.issuedOn.substring(0, 7) : null,
      data_emissao:     n.issuedOn ? n.issuedOn.substring(0, 10) : null,
      tomador_nome:     n.borrower?.name ?? null,
      tomador_cnpj_cpf: cnpj,
      tomador_email:    n.borrower?.email ?? null,
      tomador_municipio: n.borrower?.address?.city ?? null,
      tomador_uf:       n.borrower?.address?.state ?? null,
      descricao_servico: n.description ?? null,
      codigo_servico:   n.cityServiceCode ?? null,
      valor_servico:    n.servicesAmount ?? 0,
      aliquota_iss:     (n.issRate ?? 0) * 100,
      valor_iss:        n.issTaxAmount ?? 0,
      valor_deducoes:   n.deductionsAmount ?? 0,
      issretido:        n.issAmountWithheld > 0,
      pdf_url:          null,
      erro_msg:         n.flowStatus !== "Issued" ? n.flowMessage : null,
    }));

    // Upsert por nfseio_id
    const { error, count } = await supabase
      .from("nfse_emitida")
      .upsert(rows, { onConflict: "nfseio_id", ignoreDuplicates: false })
      .select("id");

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, synced: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("sync-nfse-nfeio error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapStatus(flowStatus: string): string {
  const map: Record<string, string> = {
    "Issued":         "emitida",
    "IssueFailed":    "erro",
    "Cancelled":      "cancelada",
    "CancelFailed":   "erro",
    "WaitingCalculateTaxes": "processando",
    "WaitingDefineRpsNumber": "processando",
    "WaitingSendToProviderSynchronously": "processando",
    "WaitingReturn": "processando",
  };
  return map[flowStatus] ?? "erro";
}

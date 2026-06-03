/**
 * sync-nfse-focus — Sincroniza NFS-e emitidas via Focus NF-e para o banco
 *
 * Payload: { cliente_id: string, cnpj: string, data_inicio?: string, data_fim?: string }
 * Busca as notas emitidas pela APOYA para aquele tomador (cnpj)
 * e insere/atualiza na tabela nfse_emitida.
 *
 * Auth Focus NF-e: HTTP Basic (token : "")
 * Secret: FOCUSNFE_API_TOKEN
 * Docs: https://doc.focusnfe.com.br/reference/consultar_nfse
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FOCUS_TOKEN  = Deno.env.get("FOCUSNFE_API_TOKEN")!;
const FOCUS_BASE   = Deno.env.get("FOCUSNFE_AMBIENTE") === "producao"
  ? "https://api.focusnfe.com.br/v2"
  : "https://homologacao.focusnfe.com.br/v2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function focusAuth(): string {
  return `Basic ${btoa(`${FOCUS_TOKEN}:`)}`;
}

function mapStatus(status: string): string {
  const m: Record<string, string> = {
    "autorizado":              "emitida",
    "processando_autorizacao": "processando",
    "erro_autorizacao":        "erro",
    "cancelado":               "cancelada",
  };
  return m[status] ?? "processando";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { cliente_id, cnpj, data_inicio, data_fim } = await req.json();
    if (!cliente_id || !cnpj) {
      return new Response(JSON.stringify({ ok: false, error: "cliente_id e cnpj obrigatórios" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase   = createClient(SUPABASE_URL, SUPABASE_KEY);
    const cnpjDigits = cnpj.replace(/\D/g, "");

    // Buscar NFS-e emitidas para este tomador via Focus NF-e
    // GET /v2/nfse?cnpj_tomador=xxx&data_inicio=xxx&data_fim=xxx
    const qs = new URLSearchParams({ cnpj_tomador: cnpjDigits });
    if (data_inicio) qs.set("data_inicio", data_inicio);
    if (data_fim)    qs.set("data_fim", data_fim);

    const url = `${FOCUS_BASE}/nfse?${qs}`;
    const res = await fetch(url, { headers: { Authorization: focusAuth() } });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Focus NF-e HTTP ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    // Focus retorna array direto ou objeto com campo "notas_fiscais_servico"
    const notas: any[] = Array.isArray(data) ? data : (data?.notas_fiscais_servico ?? []);

    if (notas.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, message: "Nenhuma NFS-e encontrada para este cliente" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const rows = notas.map((n: any) => ({
      cliente_id,
      focus_ref:          n.ref ?? null,
      numero:             n.numero ? String(n.numero) : null,
      codigo_verificacao: n.codigo_verificacao ?? null,
      status:             mapStatus(n.status ?? "processando_autorizacao"),
      competencia:        n.data_emissao ? String(n.data_emissao).slice(0, 7) : null,
      data_emissao:       n.data_emissao ? String(n.data_emissao).slice(0, 10) : null,
      tomador_nome:       n.tomador?.razao_social ?? null,
      tomador_cnpj_cpf:   cnpj,
      tomador_email:      n.tomador?.email ?? null,
      tomador_municipio:  n.tomador?.endereco?.municipio ?? null,
      tomador_uf:         n.tomador?.endereco?.uf ?? null,
      descricao_servico:  n.servico?.discriminacao ?? null,
      codigo_servico:     n.servico?.item_lista_servico ?? null,
      valor_servico:      n.servico?.valor_servicos ?? 0,
      aliquota_iss:       n.servico?.aliquota_iss ?? 0,
      valor_iss:          n.servico?.valor_iss ?? 0,
      issretido:          n.servico?.iss_retido === true,
      pdf_url:            n.caminho_pdf_nota_fiscal ?? null,
      erro_msg:           n.status === "erro_autorizacao" ? (n.erros?.[0]?.mensagem ?? null) : null,
    }));

    const { error } = await supabase
      .from("nfse_emitida")
      .upsert(rows, { onConflict: "focus_ref", ignoreDuplicates: false });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, synced: rows.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("sync-nfse-focus error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

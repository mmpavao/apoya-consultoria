/**
 * API Routes — NFS-e via Focus NF-e
 * GET  /api/nfse?cliente_id=xxx&tipo=emitidas|recebidas&competencia=YYYY-MM
 * POST /api/nfse  { action: "emitir"|"cancelar"|"sincronizar_recebidas"|"pdf"|"xml" }
 *
 * Auth Focus NF-e: HTTP Basic — usuário = API_TOKEN, senha = "" (vazio)
 * Secret: FOCUSNFE_API_TOKEN (Cloudflare Worker secret)
 * Ref do emitente: escritorio_config.focus_emitente_ref (CNPJ do escritório, 14 dígitos)
 * Endpoints:
 *   Produção:     https://api.focusnfe.com.br/v2
 *   Homologação:  https://homologacao.focusnfe.com.br/v2
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseServiceFetch } from "@/lib/supabase-server";

// ── Configuração de ambiente ────────────────────────────────────────────────
const FOCUS_BASE_PROD = "https://api.focusnfe.com.br/v2";
const FOCUS_BASE_HML  = "https://homologacao.focusnfe.com.br/v2";

function getFocusBase(ambiente?: string | null): string {
  return (ambiente === "producao") ? FOCUS_BASE_PROD : FOCUS_BASE_HML;
}

function getFocusToken(): string {
  const k = (globalThis as any).__env__?.FOCUSNFE_API_TOKEN ?? process.env.FOCUSNFE_API_TOKEN ?? "";
  if (!k) throw new Error("FOCUSNFE_API_TOKEN não configurado");
  return k;
}

/** HTTP Basic Auth: usuário = token, senha = vazio */
function focusAuthHeader(token: string): string {
  const encoded = btoa(`${token}:`);
  return `Basic ${encoded}`;
}

// ── Helper HTTP ─────────────────────────────────────────────────────────────
async function focusRequest<T = any>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  ambiente?: string | null,
): Promise<{ data: T; status: number }> {
  const token = getFocusToken();
  const base  = getFocusBase(ambiente);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": focusAuthHeader(token),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  // PDF/XML podem chegar como redirect
  if (res.status === 302) {
    const loc = res.headers.get("location") ?? "";
    const r2 = await fetch(loc);
    return { data: (await r2.arrayBuffer()) as any, status: r2.status };
  }

  let data: any;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const msg = data?.mensagem ?? data?.erro ?? data?.message ?? `Focus HTTP ${res.status}`;
    throw new Error(msg);
  }
  return { data, status: res.status };
}

// ── Helpers utilitários ──────────────────────────────────────────────────────
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

async function getSupabaseUser(authHeader: string) {
  const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYXFiZHNhbHhmZ3J3cGpidGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDgzMjMsImV4cCI6MjA5NDg4NDMyM30.QI9pwP1W3x6jFzOPsI_8lTGCY8Moup0AIhcsoG6jDQM";
  const SUPA_URL = "https://ajaqbdsalxfgrwpjbtbn.supabase.co";
  const token = authHeader.replace("Bearer ", "");
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return { userId: d.id, token };
}

async function supaRest(_token: string, table: string, method: string, body?: unknown, params?: string) {
  return supabaseServiceFetch(table, method as "GET" | "POST" | "PATCH" | "DELETE", params, body);
}

/**
 * Log de operação na tabela focus_nfse_log
 * Mantém rastreabilidade de todas as chamadas à Focus NF-e
 */
async function logOp(
  token: string,
  clienteId: string | undefined,
  operacao: string,
  focusRef: string | undefined,
  status: "ok" | "erro",
  payload: unknown,
  resposta: unknown,
  erroMsg: string | undefined,
  duracao: number,
  userId: string,
) {
  try {
    await supaRest(token, "focus_nfse_log", "POST", {
      cliente_id:  clienteId ?? null,
      operacao,
      focus_ref:   focusRef ?? null,
      status,
      payload:     payload ?? null,
      resposta:    resposta ?? null,
      erro_msg:    erroMsg ?? null,
      duracao_ms:  duracao,
      created_by:  userId,
    });
  } catch { /* log nunca deve quebrar a operação principal */ }
}

/**
 * Buscar configuração do escritório: CNPJ emitente + ambiente Focus
 * A "ref" no Focus NF-e é um identificador único definido pelo sistema emitente —
 * usamos o UUID da nota no banco local como ref.
 */
async function getEscritorioConfig(token: string): Promise<{ cnpj: string; ambiente: string }> {
  try {
    const rows = await supaRest(token, "escritorio_config", "GET", undefined,
      "select=cnpj,focus_ambiente&limit=1");
    const row = Array.isArray(rows) ? rows[0] : null;
    if (row?.cnpj) {
      return {
        cnpj:     row.cnpj.replace(/\D/g, ""),
        ambiente: row.focus_ambiente ?? "homologacao",
      };
    }
  } catch (e) {
    console.error("[nfse-api] erro ao buscar config escritório:", (e as any)?.message);
  }
  // Fallback seguro — nunca quebra
  return { cnpj: "", ambiente: "homologacao" };
}

// ── Mapeamento de status Focus → interno ────────────────────────────────────
function mapStatusFocus(status: string): string {
  const m: Record<string, string> = {
    "autorizado":               "emitida",
    "processando_autorizacao":  "processando",
    "erro_autorizacao":         "erro",
    "cancelado":                "cancelada",
    "cancelamento_negado":      "emitida",
  };
  return m[status] ?? "processando";
}

// ── Rotas ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/nfse/")({
  server: {
    handlers: {

      // ── GET /api/nfse ──────────────────────────────────────────────────────
      GET: async ({ request }) => {
        const h = request.headers.get("authorization") ?? "";
        const user = await getSupabaseUser(h);
        if (!user) return err("Unauthorized", 401);

        const url        = new URL(request.url);
        const clienteId  = url.searchParams.get("cliente_id");
        const tipo       = url.searchParams.get("tipo") ?? "emitidas";
        const competencia = url.searchParams.get("competencia");

        const table = tipo === "recebidas" ? "nfse_recebida" : "nfse_emitida";
        const cols  = tipo === "recebidas"
          ? "id,cliente_id,numero,competencia,data_emissao,valor_servico,prestador_nome,prestador_cnpj,pdf_url,fonte,created_at"
          : "id,cliente_id,numero,status,competencia,data_emissao,valor_servico,tomador_nome,tomador_cnpj_cpf,pdf_url,focus_ref,created_at";

        let params = `select=${cols}&order=created_at.desc&limit=200`;
        if (clienteId)   params += `&cliente_id=eq.${clienteId}`;
        if (competencia) params += `&competencia=eq.${competencia}`;

        const rows = await supaRest(user.token, table, "GET", undefined, params);
        return json({ notas: Array.isArray(rows) ? rows : [] });
      },

      // ── POST /api/nfse ─────────────────────────────────────────────────────
      POST: async ({ request }) => {
        const h = request.headers.get("authorization") ?? "";
        const user = await getSupabaseUser(h);
        if (!user) return err("Unauthorized", 401);
        const { userId, token } = user;

        let body: any;
        try { body = await request.json(); } catch { return err("JSON inválido"); }

        const { action, cliente_id } = body;
        const t0 = Date.now();
        const config = await getEscritorioConfig(token);

        // ── EMITIR NFS-e ────────────────────────────────────────────────────
        if (action === "emitir") {
          const { nota } = body;
          if (!nota) return err("campo 'nota' é obrigatório");

          // Salvar rascunho local antes de chamar a API
          const rascunho = await supaRest(token, "nfse_emitida", "POST", {
            cliente_id,
            status:           "processando",
            competencia:      nota.competencia,
            tomador_nome:     nota.tomador?.razao_social,
            tomador_cnpj_cpf: String(nota.tomador?.cnpj ?? nota.tomador?.cpf ?? ""),
            tomador_email:    nota.tomador?.email,
            tomador_municipio: nota.tomador?.endereco?.municipio,
            tomador_uf:       nota.tomador?.endereco?.uf,
            descricao_servico: nota.servico?.discriminacao,
            codigo_servico:   nota.servico?.item_lista_servico,
            valor_servico:    nota.servico?.valor_servicos,
            aliquota_iss:     nota.servico?.aliquota_iss,
            issretido:        nota.servico?.iss_retido ?? false,
            created_by:       userId,
          });
          const localId = Array.isArray(rascunho) ? (rascunho[0] as any)?.id : (rascunho as any)?.id;
          if (!localId) return err("Falha ao criar rascunho no banco", 500);

          // ref única para a Focus NF-e = UUID do registro local
          const focusRef = localId;

          try {
            // Montar payload Focus NF-e (NFS-e)
            // https://doc.focusnfe.com.br/reference/emitir_nfse
            const payload = {
              data_emissao:             nota.data_emissao ?? new Date().toISOString(),
              natureza_operacao:        nota.natureza_operacao ?? "1",
              optante_simples_nacional: nota.optante_simples_nacional ?? true,
              regime_especial_tributacao: nota.regime_especial_tributacao ?? "6", // ME/EPP Simples
              prestador: {
                cnpj:                 config.cnpj,
                inscricao_municipal:  nota.prestador?.inscricao_municipal ?? "",
              },
              tomador: {
                cnpj:          nota.tomador?.cnpj?.replace(/\D/g, "") || undefined,
                cpf:           nota.tomador?.cpf?.replace(/\D/g, "")  || undefined,
                razao_social:  nota.tomador?.razao_social,
                email:         nota.tomador?.email,
                endereco: {
                  logradouro:       nota.tomador?.endereco?.logradouro,
                  numero:           nota.tomador?.endereco?.numero ?? "S/N",
                  bairro:           nota.tomador?.endereco?.bairro,
                  codigo_municipio: nota.tomador?.endereco?.codigo_municipio,
                  uf:               nota.tomador?.endereco?.uf,
                  cep:              nota.tomador?.endereco?.cep?.replace(/\D/g, ""),
                },
              },
              servico: {
                valor_servicos:             nota.servico?.valor_servicos,
                item_lista_servico:         nota.servico?.item_lista_servico ?? "17.20",
                codigo_tributacao_municipio: nota.servico?.codigo_tributacao_municipio,
                discriminacao:              nota.servico?.discriminacao,
                codigo_municipio:           nota.servico?.codigo_municipio,
                aliquota_iss:               nota.servico?.aliquota_iss,
                iss_retido:                 nota.servico?.iss_retido ?? false,
              },
            };

            const { data: result } = await focusRequest<any>(
              "POST",
              `/nfse?ref=${focusRef}`,
              payload,
              config.ambiente,
            );

            const numero  = String(result?.numero ?? "");
            const status  = mapStatusFocus(result?.status ?? "processando_autorizacao");
            const pdfUrl  = result?.caminho_pdf_nota_fiscal ?? null;

            await supaRest(token, `nfse_emitida?id=eq.${localId}`, "PATCH", {
              focus_ref:    focusRef,
              numero,
              status,
              data_emissao: new Date().toISOString().slice(0, 10),
              pdf_url:      pdfUrl,
            });

            await logOp(token, cliente_id, "emitir", focusRef, "ok",
              payload, { numero, status, pdfUrl }, undefined, Date.now() - t0, userId);

            return json({ ok: true, id: localId, focus_ref: focusRef, numero, pdf_url: pdfUrl, status });

          } catch (e: any) {
            await supaRest(token, `nfse_emitida?id=eq.${localId}`, "PATCH",
              { status: "erro", erro_msg: e?.message });
            await logOp(token, cliente_id, "emitir", focusRef, "erro",
              nota, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao emitir nota", 502);
          }
        }

        // ── CONSULTAR STATUS ────────────────────────────────────────────────
        if (action === "consultar") {
          const { nota_id } = body;
          if (!nota_id) return err("nota_id obrigatório");

          const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
            undefined, "select=focus_ref,cliente_id");
          const row = Array.isArray(rows) ? rows[0] : null;
          if (!row?.focus_ref) return err("Nota não encontrada ou sem ref Focus");

          try {
            const { data } = await focusRequest<any>(
              "GET", `/nfse?ref=${row.focus_ref}`, undefined, config.ambiente);

            const status = mapStatusFocus(data?.status ?? "processando_autorizacao");
            const numero = String(data?.numero ?? "");
            const pdfUrl = data?.caminho_pdf_nota_fiscal ?? null;

            await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "PATCH",
              { status, numero, pdf_url: pdfUrl });

            return json({ ok: true, status, numero, pdf_url: pdfUrl, raw: data });
          } catch (e: any) {
            return err(e?.message ?? "Falha ao consultar nota", 502);
          }
        }

        // ── PDF ─────────────────────────────────────────────────────────────
        if (action === "pdf") {
          const { nota_id } = body;
          if (!nota_id) return err("nota_id obrigatório");

          const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
            undefined, "select=focus_ref,cliente_id,pdf_url");
          const row = Array.isArray(rows) ? rows[0] : null;
          if (!row?.focus_ref) return err("Nota não encontrada ou sem ref Focus");

          try {
            const tkn = getFocusToken();
            const base = getFocusBase(config.ambiente);
            const r = await fetch(
              `${base}/nfse?ref=${row.focus_ref}&pdf=1`,
              { headers: { "Authorization": focusAuthHeader(tkn) }, redirect: "follow" });
            if (!r.ok) return err(`PDF não disponível (HTTP ${r.status})`, 502);
            const buf = await r.arrayBuffer();
            const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
            return json({ ok: true, pdf_base64: b64 });
          } catch (e: any) {
            return err(e?.message ?? "Falha ao obter PDF", 502);
          }
        }

        // ── XML ──────────────────────────────────────────────────────────────
        if (action === "xml") {
          const { nota_id } = body;
          if (!nota_id) return err("nota_id obrigatório");

          const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
            undefined, "select=focus_ref,cliente_id");
          const row = Array.isArray(rows) ? rows[0] : null;
          if (!row?.focus_ref) return err("Nota não encontrada ou sem ref Focus");

          try {
            const tkn  = getFocusToken();
            const base = getFocusBase(config.ambiente);
            const r = await fetch(
              `${base}/nfse?ref=${row.focus_ref}&xml=1`,
              { headers: { "Authorization": focusAuthHeader(tkn) }, redirect: "follow" });
            if (!r.ok) return err(`XML não disponível (HTTP ${r.status})`, 502);
            const xml = await r.text();
            if (nota_id) {
              await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "PATCH", { xml_content: xml });
            }
            return json({ ok: true, xml });
          } catch (e: any) {
            return err(e?.message ?? "Falha ao obter XML", 502);
          }
        }

        // ── CANCELAR ─────────────────────────────────────────────────────────
        if (action === "cancelar") {
          const { nota_id, motivo } = body;
          if (!nota_id) return err("nota_id obrigatório");

          const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
            undefined, "select=focus_ref,cliente_id");
          const row = Array.isArray(rows) ? rows[0] : null;
          if (!row?.focus_ref) return err("Nota não encontrada ou sem ref Focus");

          try {
            await focusRequest("DELETE",
              `/nfse?ref=${row.focus_ref}`, undefined, config.ambiente);

            await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "PATCH", {
              status:             "cancelada",
              data_cancelamento:  new Date().toISOString().slice(0, 10),
              erro_msg:           motivo ?? null,
            });
            await logOp(token, row.cliente_id, "cancelar", row.focus_ref, "ok",
              { nota_id, motivo }, null, undefined, Date.now() - t0, userId);
            return json({ ok: true });
          } catch (e: any) {
            await logOp(token, row.cliente_id, "cancelar", row.focus_ref, "erro",
              { nota_id }, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao cancelar nota", 502);
          }
        }

        // ── SINCRONIZAR RECEBIDAS ────────────────────────────────────────────
        // Focus NF-e: GET /v2/nfse_recebidas?cnpj=xxx&data_inicio=xxx&data_fim=xxx
        if (action === "sincronizar_recebidas") {
          const { cnpj, data_inicio, data_fim } = body;
          if (!cnpj || !cliente_id) return err("cnpj e cliente_id obrigatórios");
          const cnpjLimpo = cnpj.replace(/\D/g, "");

          try {
            // Focus usa query string para filtrar por tomador
            const qs = new URLSearchParams({
              cnpj_tomador: cnpjLimpo,
              ...(data_inicio ? { data_inicio } : {}),
              ...(data_fim   ? { data_fim }    : {}),
            });
            const { data } = await focusRequest<any>(
              "GET", `/nfse_recebidas?${qs}`, undefined, config.ambiente);

            const notas: any[] = data?.notas_fiscais_servico ?? data ?? [];
            let inserted = 0;

            for (const n of notas) {
              try {
                await supaRest(token, "nfse_recebida", "POST", {
                  cliente_id,
                  cnpj_tomador:    cnpjLimpo,
                  prestador_nome:  n.prestador?.razao_social,
                  prestador_cnpj:  String(n.prestador?.cnpj ?? ""),
                  numero:          String(n.numero ?? n.ref ?? ""),
                  codigo_verificacao: n.codigo_verificacao ?? null,
                  data_emissao:    n.data_emissao?.slice(0, 10),
                  competencia:     n.data_emissao?.slice(0, 7),
                  valor_servico:   n.valor_servicos,
                  valor_iss:       n.valor_iss,
                  aliquota_iss:    n.aliquota_iss,
                  issretido:       n.iss_retido === true,
                  descricao_servico: n.discriminacao,
                  codigo_servico:  n.item_lista_servico,
                  focus_ref:       n.ref ?? null,
                  fonte:           "focus",
                });
                inserted++;
              } catch { /* skip duplicates */ }
            }

            await logOp(token, cliente_id, "sincronizar_recebidas", undefined, "ok",
              { cnpj: cnpjLimpo }, { total: notas.length, inserted },
              undefined, Date.now() - t0, userId);
            return json({ ok: true, total: notas.length, inserted });

          } catch (e: any) {
            await logOp(token, cliente_id, "sincronizar_recebidas", undefined, "erro",
              { cnpj: cnpjLimpo }, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao sincronizar notas recebidas", 502);
          }
        }

        return err(`Ação desconhecida: ${action}`);
      },
    },
  },
});

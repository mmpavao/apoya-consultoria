/**
 * API Routes NFE.io — NFS-e
 * GET  /api/nfse?cliente_id=xxx&tipo=emitidas|recebidas&competencia=YYYY-MM
 * POST /api/nfse  { action: "emitir"|"cancelar"|"sincronizar_recebidas"|"pdf"|"xml" }
 *
 * Auth NFE.io: Bearer <NFSEIO_API_KEY> (não Basic)
 * Secret: NFSEIO_API_KEY (Cloudflare Worker secret)
 * Emitente: escritorio_config.nfseio_emitente_id
 */
import { createFileRoute } from "@tanstack/react-router";

const NFSEIO_BASE = "https://api.nfe.io/v1";
const FALLBACK_EMITENTE_ID = "10ecf6c4445648549695358f7ac944e7"; // ZAP TECHNOLOGY (DEV)

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

function getNfseKey(): string {
  const k = (globalThis as any).__env__?.NFSEIO_API_KEY ?? process.env.NFSEIO_API_KEY ?? "";
  if (!k) throw new Error("NFSEIO_API_KEY não configurada");
  return k;
}

async function nfseio<T = any>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ data: T; status: number }> {
  const key = getNfseKey();
  const res = await fetch(`${NFSEIO_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: key,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  // Para PDF/XML, o status 302 precisa ser seguido
  if (res.status === 302) {
    const loc = res.headers.get("location") ?? "";
    const r2 = await fetch(loc);
    return { data: (await r2.arrayBuffer()) as any, status: r2.status };
  }
  let data: any;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? `NFE.io HTTP ${res.status}`);
  return { data, status: res.status };
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

async function supaRest(token: string, table: string, method: string, body?: unknown, params?: string) {
  const SUPA = "https://ajaqbdsalxfgrwpjbtbn.supabase.co/rest/v1";
  const SERVICE = (globalThis as any).__env__?.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Prefer: method === "POST" ? "return=representation" : "return=minimal",
    apikey: SERVICE || token,
    Authorization: SERVICE ? `Bearer ${SERVICE}` : `Bearer ${token}`,
  };
  const r = await fetch(`${SUPA}/${table}${params ? "?" + params : ""}`, {
    method, headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return r.json().catch(() => ({}));
}

async function logOp(
  token: string,
  clienteId: string | undefined,
  operacao: string,
  nfseioId: string | undefined,
  status: "ok" | "erro",
  payload: unknown,
  resposta: unknown,
  erroMsg: string | undefined,
  duracao: number,
  userId: string,
) {
  await supaRest(token, "nfseio_log", "POST", {
    cliente_id: clienteId ?? null,
    operacao,
    nfseio_id: nfseioId ?? null,
    status,
    payload: payload ?? null,
    resposta: resposta ?? null,
    erro_msg: erroMsg ?? null,
    duracao_ms: duracao,
    created_by: userId,
  });
}

/**
 * Obter o ID do emitente da APOYA.
 * Busca em escritorio_config.nfseio_emitente_id.
 * Se não encontrar, usa fallback (ZAP TECHNOLOGY para DEV).
 * ✅ FIX BUG-05: adicionado try/catch + logging
 */
async function getEmitenteId(token: string): Promise<string> {
  try {
    const rows = await supaRest(token, "escritorio_config", "GET", undefined, "select=nfseio_emitente_id&limit=1");
    const id = Array.isArray(rows) ? rows[0]?.nfseio_emitente_id : null;
    if (id) {
      console.log(`[nfse-api] emitente encontrado: ${id}`);
      return id;
    }
  } catch (e) {
    console.error(`[nfse-api] erro ao buscar emitente: ${(e as any)?.message}`);
  }
  console.warn(`[nfse-api] usando fallback emitente: ${FALLBACK_EMITENTE_ID}`);
  return FALLBACK_EMITENTE_ID;
}

export const Route = createFileRoute("/api/nfse/")({
  server: {
    handlers: {
      // GET /api/nfse?cliente_id=xxx&tipo=emitidas|recebidas&competencia=YYYY-MM
      GET: async ({ request }) => {
        const h = request.headers.get("authorization") ?? "";
        const user = await getSupabaseUser(h);
        if (!user) return err("Unauthorized", 401);
        const { token } = user;

        const url = new URL(request.url);
        const clienteId = url.searchParams.get("cliente_id");
        const tipo = url.searchParams.get("tipo") ?? "emitidas";
        const competencia = url.searchParams.get("competencia");

        const table = tipo === "recebidas" ? "nfse_recebida" : "nfse_emitida";
        const cols = tipo === "recebidas"
          ? "id,cliente_id,numero,competencia,data_emissao,valor_servico,prestador_nome,prestador_cnpj,pdf_url,fonte,created_at"
          : "id,cliente_id,numero,status,competencia,data_emissao,valor_servico,tomador_nome,tomador_cnpj_cpf,pdf_url,nfseio_id,created_at";

        let params = `select=${cols}&order=created_at.desc&limit=200`;
        if (clienteId) params += `&cliente_id=eq.${clienteId}`;
        if (competencia) params += `&competencia=eq.${competencia}`;

        const rows = await supaRest(token, table, "GET", undefined, params);
        return json({ notas: Array.isArray(rows) ? rows : [] });
      },

      POST: async ({ request }) => {
        const h = request.headers.get("authorization") ?? "";
        const user = await getSupabaseUser(h);
        if (!user) return err("Unauthorized", 401);
        const { userId, token } = user;

        let body: any;
        try { body = await request.json(); } catch { return err("JSON inválido"); }

        const { action, cliente_id } = body;
        const t0 = Date.now();

        // ── EMITIR ─────────────────────────────────────────────────────
        if (action === "emitir") {
          const { nota } = body;
          if (!nota) return err("nota é obrigatório");
          const emitenteId = body.emitente_id ?? (await getEmitenteId(token));

          // Salvar rascunho
          const rascunho = await supaRest(token, "nfse_emitida", "POST", {
            cliente_id,
            status: "processando",
            competencia: nota.competencia,
            tomador_nome: nota.borrower?.name,
            tomador_cnpj_cpf: String(nota.borrower?.federalTaxNumber ?? ""),
            tomador_email: nota.borrower?.email,
            tomador_municipio: nota.borrower?.address?.city?.name,
            tomador_uf: nota.borrower?.address?.state,
            descricao_servico: nota.description,
            codigo_servico: nota.cityServiceCode,
            valor_servico: nota.servicesAmount,
            aliquota_iss: nota.issRate,
            issretido: nota.issRetained ?? false,
            created_by: userId,
          });
          const localId = Array.isArray(rascunho) ? rascunho[0]?.id : rascunho?.id;
          if (!localId) return err("Falha ao criar rascunho no banco", 500);

          try {
            const { data: result } = await nfseio<any>("POST",
              `/companies/${emitenteId}/serviceinvoices`, nota);

            const nfseioId = result?.id;
            const numero = String(result?.number ?? "");
            const pdfUrl = result?.pdfUrl ?? null;

            await supaRest(token, `nfse_emitida?id=eq.${localId}`, "PATCH", {
              nfseio_id: nfseioId,
              numero,
              status: "emitida",
              data_emissao: new Date().toISOString().slice(0, 10),
              pdf_url: pdfUrl,
            });

            await logOp(token, cliente_id, "emitir", nfseioId, "ok",
              { ...nota, _emitente: emitenteId }, { numero, pdfUrl },
              undefined, Date.now() - t0, userId);

            return json({ ok: true, id: localId, nfseio_id: nfseioId, numero, pdf_url: pdfUrl });
          } catch (e: any) {
            await supaRest(token, `nfse_emitida?id=eq.${localId}`, "PATCH",
              { status: "erro", erro_msg: e?.message });
            await logOp(token, cliente_id, "emitir", undefined, "erro",
              nota, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao emitir nota", 502);
          }
        }

        // ── PDF ─────────────────────────────────────────────────────────
        if (action === "pdf") {
          const { nota_id, nfseio_id } = body;
          let nId = nfseio_id;
          if (!nId && nota_id) {
            const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
              undefined, "select=nfseio_id,cliente_id");
            nId = Array.isArray(rows) ? rows[0]?.nfseio_id : null;
          }
          if (!nId) return err("nfseio_id não encontrado");
          const emitenteId = body.emitente_id ?? (await getEmitenteId(token));

          try {
            const key = getNfseKey();
            const r = await fetch(
              `${NFSEIO_BASE}/companies/${emitenteId}/serviceinvoices/${nId}/pdf`,
              { headers: { Authorization: key }, redirect: "follow" });
            if (!r.ok) return err(`PDF não disponível (HTTP ${r.status})`, 502);
            const buf = await r.arrayBuffer();
            const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
            return json({ ok: true, pdf_base64: b64 });
          } catch (e: any) {
            return err(e?.message ?? "Falha ao buscar PDF", 502);
          }
        }

        // ── XML ─────────────────────────────────────────────────────────
        if (action === "xml") {
          const { nota_id, nfseio_id } = body;
          let nId = nfseio_id;
          if (!nId && nota_id) {
            const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
              undefined, "select=nfseio_id,cliente_id");
            nId = Array.isArray(rows) ? rows[0]?.nfseio_id : null;
          }
          if (!nId) return err("nfseio_id não encontrado");
          const emitenteId = body.emitente_id ?? (await getEmitenteId(token));

          try {
            const key = getNfseKey();
            const r = await fetch(
              `${NFSEIO_BASE}/companies/${emitenteId}/serviceinvoices/${nId}/xml`,
              { headers: { Authorization: key }, redirect: "follow" });
            if (!r.ok) return err(`XML não disponível (HTTP ${r.status})`, 502);
            const xml = await r.text();
            if (nota_id) {
              await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "PATCH", { xml_content: xml });
            }
            return json({ ok: true, xml });
          } catch (e: any) {
            return err(e?.message ?? "Falha ao buscar XML", 502);
          }
        }

        // ── CANCELAR ─────────────────────────────────────────────────────
        if (action === "cancelar") {
          const { nota_id, motivo } = body;
          if (!nota_id) return err("nota_id obrigatório");
          const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
            undefined, "select=nfseio_id,cliente_id");
          const row = Array.isArray(rows) ? rows[0] : null;
          if (!row?.nfseio_id) return err("Nota não encontrada ou sem ID NFE.io");
          const emitenteId = body.emitente_id ?? (await getEmitenteId(token));

          try {
            await nfseio("DELETE",
              `/companies/${emitenteId}/serviceinvoices/${row.nfseio_id}`);
            await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "PATCH", {
              status: "cancelada",
              data_cancelamento: new Date().toISOString().slice(0, 10),
              erro_msg: motivo ?? null,
            });
            await logOp(token, cliente_id ?? row.cliente_id, "cancelar",
              row.nfseio_id, "ok", { nota_id, motivo }, null,
              undefined, Date.now() - t0, userId);
            return json({ ok: true });
          } catch (e: any) {
            await logOp(token, cliente_id ?? row.cliente_id, "cancelar",
              row.nfseio_id, "erro", { nota_id }, null,
              e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao cancelar nota", 502);
          }
        }

        // ── SINCRONIZAR RECEBIDAS (notas emitidas CONTRA o CNPJ do cliente) ──
        if (action === "sincronizar_recebidas") {
          const { cnpj, pageIndex = 1, pageCount = 50 } = body;
          if (!cnpj || !cliente_id) return err("cnpj e cliente_id obrigatórios");
          const emitenteId = body.emitente_id ?? (await getEmitenteId(token));
          const cnpjLimpo = cnpj.replace(/\D/g, "");

          try {
            const { data } = await nfseio<any>("GET",
              `/companies/${emitenteId}/serviceinvoices?pageIndex=${pageIndex}&pageCount=${pageCount}&takerFederalTaxNumber=${cnpjLimpo}`);
            const notas = data?.serviceInvoices ?? [];

            let inserted = 0;
            for (const n of notas) {
              try {
                await supaRest(token, "nfse_recebida", "POST", {
                  cliente_id,
                  cnpj_tomador: cnpjLimpo,
                  prestador_nome: n.provider?.name ?? n.provider?.tradeName,
                  prestador_cnpj: String(n.provider?.federalTaxNumber ?? ""),
                  prestador_municipio: n.provider?.address?.city?.name,
                  numero: String(n.number ?? n.id),
                  codigo_verificacao: n.checkCode ?? n.verificationCode,
                  data_emissao: n.issuedOn?.slice(0, 10),
                  competencia: n.issuedOn?.slice(0, 7),
                  valor_servico: n.servicesAmount,
                  valor_iss: n.issAmount,
                  aliquota_iss: n.issAliquot ?? n.issRate,
                  issretido: n.issRetained === true,
                  descricao_servico: n.description ?? n.servicesDescription,
                  codigo_servico: n.cityServiceCode,
                  nfseio_id: n.id,
                  fonte: "nfeio",
                });
                inserted++;
              } catch { /* skip duplicates */ }
            }

            await logOp(token, cliente_id, "listar_recebidas", undefined, "ok",
              { cnpj: cnpjLimpo }, { total: notas.length, inserted },
              undefined, Date.now() - t0, userId);
            return json({ ok: true, total: notas.length, inserted });
          } catch (e: any) {
            await logOp(token, cliente_id, "listar_recebidas", undefined, "erro",
              { cnpj: cnpjLimpo }, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao sincronizar notas recebidas", 502);
          }
        }

        return err(`Ação desconhecida: ${action}`);
      },
    },
  },
});

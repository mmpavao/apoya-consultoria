/**
 * API Routes NFE.io — NFS-e
 * POST /api/nfse  → action dispatcher
 *
 * Actions:
 *   emitir        → emite NFS-e via NFE.io, salva PDF+XML no banco
 *   cancelar      → cancela nota
 *   consultar     → consulta status de uma nota
 *   listar        → lista notas emitidas de um cliente
 *   listar_recebidas → notas emitidas CONTRA o CNPJ (tomador)
 *   baixar_pdf    → retorna PDF base64 de nota específica
 *   sincronizar   → busca notas recebidas na API NFE.io e salva no banco
 *
 * Auth: Bearer Supabase no header Authorization.
 * Secret: NFSEIO_API_KEY (Supabase secret / Worker binding)
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// NFE.io base URL
const NFSEIO_BASE = "https://api.nfe.io/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

async function authenticate(request: Request): Promise<{ userId: string } | Response> {
  const h = request.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return err("Unauthorized", 401);
  const { data, error } = await (supabaseAdmin as any).auth.getUser(h.replace("Bearer ", ""));
  if (error || !data?.user) return err("Token inválido", 401);
  return { userId: data.user.id };
}

function getNfseioKey(): string {
  const key = process.env.NFSEIO_API_KEY ?? "";
  if (!key) throw new Error("NFSEIO_API_KEY não configurada. Adicione nas variáveis de ambiente do Worker.");
  return key;
}

async function nfseio<T = any>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey = getNfseioKey();
  const res = await fetch(`${NFSEIO_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(apiKey + ":")}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message ?? `NFE.io HTTP ${res.status}`);
  return data as T;
}

async function logOp(
  db: any,
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
  await db.from("nfseio_log").insert({
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

export const Route = createFileRoute("/api/nfse/")({
  server: {
    handlers: {
      // GET /api/nfse?cliente_id=xxx  → lista notas emitidas do cliente
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const url = new URL(request.url);
        const clienteId = url.searchParams.get("cliente_id");
        const tipo = url.searchParams.get("tipo") ?? "emitidas"; // emitidas | recebidas
        const competencia = url.searchParams.get("competencia");
        const db = supabaseAdmin as any;

        if (tipo === "recebidas") {
          let q = db.from("nfse_recebida")
            .select("*")
            .order("data_emissao", { ascending: false })
            .limit(100);
          if (clienteId) q = q.eq("cliente_id", clienteId);
          if (competencia) q = q.eq("competencia", competencia);
          const { data, error } = await q;
          if (error) return err(error.message, 500);
          return json({ notas: data ?? [] });
        }

        // emitidas
        let q = db.from("nfse_emitida")
          .select("id,cliente_id,numero,status,competencia,data_emissao,valor_servico,tomador_nome,tomador_cnpj_cpf,pdf_url,created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (clienteId) q = q.eq("cliente_id", clienteId);
        if (competencia) q = q.eq("competencia", competencia);
        const { data, error } = await q;
        if (error) return err(error.message, 500);
        return json({ notas: data ?? [] });
      },

      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (auth instanceof Response) return auth;
        const { userId } = auth;

        let body: any;
        try { body = await request.json(); } catch { return err("JSON inválido"); }

        const { action, cliente_id } = body;
        const db = supabaseAdmin as any;
        const t0 = Date.now();

        // ── EMITIR ──────────────────────────────────────────────────────
        if (action === "emitir") {
          const { emitente_id, nota } = body;
          if (!emitente_id || !nota) return err("emitente_id e nota são obrigatórios");

          // Criar registro rascunho
          const ins = await db.from("nfse_emitida").insert({
            cliente_id,
            status: "processando",
            competencia: nota.competencia,
            tomador_nome: nota.tomador?.nome,
            tomador_cnpj_cpf: nota.tomador?.cpfCnpj,
            tomador_email: nota.tomador?.email,
            tomador_municipio: nota.tomador?.endereco?.municipio,
            tomador_uf: nota.tomador?.endereco?.uf,
            descricao_servico: nota.servico?.descricao,
            codigo_servico: nota.servico?.codigo,
            valor_servico: nota.servico?.valorServicos,
            aliquota_iss: nota.servico?.aliquota,
            issretido: nota.servico?.issRetido ?? false,
            created_by: userId,
          }).select("id").single();

          if (ins.error) return err(ins.error.message, 500);
          const localId = ins.data.id;

          try {
            const result = await nfseio<any>("POST", `/companies/${emitente_id}/serviceinvoices`, nota);
            const nfseioId = result?.id ?? result?.serviceInvoice?.id;
            const numero = result?.number ?? result?.serviceInvoice?.number;
            const pdfUrl = result?.pdfUrl ?? result?.serviceInvoice?.pdfUrl;
            const xmlUrl = result?.xmlUrl ?? result?.serviceInvoice?.xmlUrl;

            // Buscar XML se disponível
            let xmlContent: string | null = null;
            if (xmlUrl) {
              try {
                const xmlRes = await fetch(xmlUrl, {
                  headers: { Authorization: `Basic ${btoa(getNfseioKey() + ":")}` },
                });
                xmlContent = await xmlRes.text();
              } catch { /* ignore */ }
            }

            await db.from("nfse_emitida").update({
              nfseio_id: nfseioId,
              numero,
              status: "emitida",
              data_emissao: new Date().toISOString().slice(0, 10),
              pdf_url: pdfUrl,
              xml_content: xmlContent,
            }).eq("id", localId);

            await logOp(db, cliente_id, "emitir", nfseioId, "ok", nota, { numero, pdfUrl }, undefined, Date.now() - t0, userId);
            return json({ ok: true, id: localId, nfseio_id: nfseioId, numero, pdf_url: pdfUrl });
          } catch (e: any) {
            await db.from("nfse_emitida").update({ status: "erro", erro_msg: e?.message }).eq("id", localId);
            await logOp(db, cliente_id, "emitir", undefined, "erro", nota, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao emitir nota", 502);
          }
        }

        // ── CANCELAR ─────────────────────────────────────────────────────
        if (action === "cancelar") {
          const { nota_id } = body;
          if (!nota_id) return err("nota_id obrigatório");
          const r = await db.from("nfse_emitida").select("nfseio_id").eq("id", nota_id).single();
          if (r.error || !r.data?.nfseio_id) return err("Nota não encontrada ou sem ID NFE.io");

          // Buscar emitente_id do cliente
          const cli = await db.from("clientes").select("nfseio_emitente_id").eq("id", cliente_id).single();
          if (!cli.data?.nfseio_emitente_id) return err("Cliente sem emitente NFE.io configurado");

          try {
            await nfseio("DELETE", `/companies/${cli.data.nfseio_emitente_id}/serviceinvoices/${r.data.nfseio_id}`);
            await db.from("nfse_emitida").update({ status: "cancelada", data_cancelamento: new Date().toISOString().slice(0, 10) }).eq("id", nota_id);
            await logOp(db, cliente_id, "cancelar", r.data.nfseio_id, "ok", { nota_id }, null, undefined, Date.now() - t0, userId);
            return json({ ok: true });
          } catch (e: any) {
            await logOp(db, cliente_id, "cancelar", r.data.nfseio_id, "erro", { nota_id }, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao cancelar nota", 502);
          }
        }

        // ── SINCRONIZAR RECEBIDAS ─────────────────────────────────────────
        if (action === "sincronizar_recebidas") {
          const { emitente_id, cnpj, pageIndex = 1, pageCount = 50 } = body;
          if (!emitente_id || !cnpj) return err("emitente_id e cnpj obrigatórios");

          try {
            const result = await nfseio<any>("GET",
              `/companies/${emitente_id}/serviceinvoices?pageIndex=${pageIndex}&pageCount=${pageCount}&takerFederalTaxNumber=${cnpj.replace(/\D/g,"")}`
            );
            const notas = result?.serviceInvoices ?? result?.data ?? [];

            let inserted = 0;
            for (const n of notas) {
              const upsert = await db.from("nfse_recebida").upsert({
                cliente_id,
                cnpj_tomador: cnpj.replace(/\D/g, ""),
                prestador_nome: n.provider?.name,
                prestador_cnpj: n.provider?.federalTaxNumber,
                prestador_municipio: n.provider?.address?.city,
                numero: String(n.number ?? n.id),
                codigo_verificacao: n.verificationCode,
                data_emissao: n.issuedOn?.slice(0, 10),
                competencia: n.issuedOn?.slice(0, 7).replace("-", "-"),
                valor_servico: n.servicesAmount,
                valor_iss: n.deductionsAmount,
                aliquota_iss: n.issRate,
                issretido: n.issTaxPayer === "true",
                descricao_servico: n.servicesDescription,
                codigo_servico: n.cityServiceCode,
                nfseio_id: n.id,
                fonte: "nfeio",
              }, { onConflict: "cnpj_tomador,numero,prestador_cnpj", ignoreDuplicates: true });
              if (!upsert.error) inserted++;
            }

            await logOp(db, cliente_id, "listar_recebidas", undefined, "ok", { cnpj }, { total: notas.length, inserted }, undefined, Date.now() - t0, userId);
            return json({ ok: true, total: notas.length, inserted });
          } catch (e: any) {
            await logOp(db, cliente_id, "listar_recebidas", undefined, "erro", { cnpj }, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao sincronizar notas recebidas", 502);
          }
        }

        return err(`Ação desconhecida: ${action}`);
      },
    },
  },
});

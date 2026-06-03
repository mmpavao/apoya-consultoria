/**
 * API Routes — NFS-e via Focus NF-e
 *
 * GET  /api/nfse?cliente_id=xxx&tipo=emitidas|recebidas&competencia=YYYY-MM
 * POST /api/nfse  { action: "emitir"|"cancelar"|"consultar"|"pdf"|"xml"|
 *                           "sincronizar_emitidas"|"sincronizar_recebidas" }
 *
 * Autenticação Focus NF-e: HTTP Basic — usuário = API_TOKEN, senha = "" (vazio)
 * Secret: FOCUSNFE_API_TOKEN (Cloudflare Worker secret)
 * Docs:   https://dev.focusnfe.com.br/
 *
 * Homologação: https://homologacao.focusnfe.com.br/v2
 * Produção:    https://api.focusnfe.com.br/v2
 *
 * IMPORTANTE: O "ref" de uma NFS-e no Focus é um identificador único
 * definido pelo emitente (nós). Usamos o UUID do registro local (nfse_emitida.id).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseServiceFetch } from "@/lib/supabase-server";

// ── Configuração ────────────────────────────────────────────────────────────
const FOCUS_HML  = "https://homologacao.focusnfe.com.br/v2";
const FOCUS_PROD = "https://api.focusnfe.com.br/v2";

function getFocusBase(ambiente?: string | null): string {
  return ambiente === "producao" ? FOCUS_PROD : FOCUS_HML;
}

// Cache em memória para evitar query no banco a cada request
let _cachedToken: string | null = null;
let _cachedTokenTs = 0;
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

async function getFocusToken(): Promise<string> {
  // 1. Tentar env do Worker
  const fromEnv =
    (globalThis as any).__env__?.FOCUSNFE_API_TOKEN ??
    process.env.FOCUSNFE_API_TOKEN ?? "";
  if (fromEnv) return fromEnv;

  // 2. Cache em memória
  if (_cachedToken && Date.now() - _cachedTokenTs < TOKEN_CACHE_TTL) {
    return _cachedToken;
  }

  // 3. Fallback: buscar do banco (escritorio_config.focusnfe_api_token)
  try {
    const rows = await supabaseServiceFetch(
      "escritorio_config",
      "GET",
      "select=focusnfe_api_token,focus_ambiente&limit=1",
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (row?.focusnfe_api_token) {
      _cachedToken = row.focusnfe_api_token;
      _cachedTokenTs = Date.now();
      return row.focusnfe_api_token;
    }
  } catch {}

  throw new Error("FOCUSNFE_API_TOKEN não configurado. Configure em Configurações → Integrações.");
}

async function getEscritorioConfigFull(): Promise<{ cnpj: string; ambiente: string; inscricao_municipal: string; codigo_municipio: string; token: string }> {
  try {
    const rows = await supabaseServiceFetch(
      "escritorio_config",
      "GET",
      "select=cnpj,focus_ambiente,inscricao_municipal,codigo_municipio_ibge,focusnfe_api_token&limit=1",
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    const token = row?.focusnfe_api_token
      ?? (globalThis as any).__env__?.FOCUSNFE_API_TOKEN
      ?? process.env.FOCUSNFE_API_TOKEN ?? "";
    if (token) {
      _cachedToken = token;
      _cachedTokenTs = Date.now();
    }
    return {
      cnpj:               (row?.cnpj ?? "").replace(/\D/g, ""),
      ambiente:            row?.focus_ambiente ?? "homologacao",
      inscricao_municipal: row?.inscricao_municipal ?? "",
      codigo_municipio:    row?.codigo_municipio_ibge ?? "",
      token,
    };
  } catch {
    return { cnpj: "", ambiente: "homologacao", inscricao_municipal: "", codigo_municipio: "", token: "" };
  }
}

/** HTTP Basic Auth: login = token, senha = vazio */
function focusAuth(token: string): string {
  return "Basic " + btoa(`${token}:`);
}

// ── HTTP helper ─────────────────────────────────────────────────────────────
async function focusRequest<T = any>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  ambiente?: string | null,
): Promise<{ data: T; status: number }> {
  const token = await getFocusToken();
  const base  = getFocusBase(ambiente);
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type":  "application/json",
      "Authorization": focusAuth(token),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: "follow",
  });

  let data: any;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    data = await res.json().catch(() => ({}));
  } else if (ct.includes("application/pdf") || ct.includes("application/xml") || ct.includes("text/xml")) {
    data = await res.arrayBuffer();
  } else {
    data = await res.text().catch(() => "");
  }

  if (!res.ok) {
    const msg =
      (typeof data === "object" && data !== null)
        ? (data?.mensagem ?? data?.erro ?? data?.message ?? `Focus HTTP ${res.status}`)
        : `Focus HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return { data, status: res.status };
}

// ── Utilitários ─────────────────────────────────────────────────────────────
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
  const token = authHeader.replace("Bearer ", "");
  const r = await fetch("https://ajaqbdsalxfgrwpjbtbn.supabase.co/auth/v1/user", {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return { userId: d.id, token };
}

async function supaRest(
  _token: string,
  table: string,
  method: string,
  body?: unknown,
  params?: string,
) {
  return supabaseServiceFetch(
    table,
    method as "GET" | "POST" | "PATCH" | "DELETE",
    params,
    body,
  );
}

// ── Log de operações ────────────────────────────────────────────────────────
async function logOp(
  _token: string,
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
    await supabaseServiceFetch("focus_nfse_log", "POST", undefined, {
      cliente_id: clienteId ?? null,
      operacao,
      focus_ref:  focusRef ?? null,
      status,
      payload:    payload ?? null,
      resposta:   resposta ?? null,
      erro_msg:   erroMsg ?? null,
      duracao_ms: duracao,
      created_by: userId,
    });
  } catch { /* log nunca pode quebrar a operação */ }
}

// getEscritorioConfig substituído por getEscritorioConfigFull acima

// ── Mapeamento de status Focus → interno ────────────────────────────────────
function mapStatus(s: string): string {
  const m: Record<string, string> = {
    autorizado:              "emitida",
    processando_autorizacao: "processando",
    erro_autorizacao:        "erro",
    cancelado:               "cancelada",
    cancelamento_negado:     "emitida",
  };
  return m[s] ?? "processando";
}

// ── ROTA ─────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/nfse/")({
  server: {
    handlers: {

      // ── GET /api/nfse ────────────────────────────────────────────────────
      GET: async ({ request }) => {
        const user = await getSupabaseUser(
          request.headers.get("authorization") ?? "",
        );
        if (!user) return err("Unauthorized", 401);

        const url        = new URL(request.url);
        const clienteId  = url.searchParams.get("cliente_id");
        const tipo       = url.searchParams.get("tipo") ?? "emitidas";
        const competencia = url.searchParams.get("competencia");

        const table = tipo === "recebidas" ? "nfse_recebida" : "nfse_emitida";
        const cols  =
          tipo === "recebidas"
            ? "id,cliente_id,numero,competencia,data_emissao,valor_servico,prestador_nome,prestador_cnpj,pdf_url,focus_ref,fonte,created_at"
            : "id,cliente_id,numero,status,competencia,data_emissao,valor_servico,tomador_nome,tomador_cnpj_cpf,pdf_url,focus_ref,created_at";

        let params = `select=${cols}&order=created_at.desc&limit=200`;
        if (clienteId)   params += `&cliente_id=eq.${clienteId}`;
        if (competencia) params += `&competencia=eq.${competencia}`;

        const rows = await supaRest(user.token, table, "GET", undefined, params);
        return json({ notas: Array.isArray(rows) ? rows : [] });
      },

      // ── POST /api/nfse ───────────────────────────────────────────────────
      POST: async ({ request }) => {
        const user = await getSupabaseUser(
          request.headers.get("authorization") ?? "",
        );
        if (!user) return err("Unauthorized", 401);
        const { userId, token } = user;

        let body: any;
        try { body = await request.json(); } catch { return err("JSON inválido"); }

        const { action, cliente_id } = body;
        const t0     = Date.now();
        const config = await getEscritorioConfigFull();
        if (!config.token) return err("FOCUSNFE_API_TOKEN não configurado. Acesse Configurações → Integrações e salve o token da Focus NF-e.", 500);

        // ────────────────────────────────────────────────────────────────────
        // EMITIR NFS-e
        // Docs: https://dev.focusnfe.com.br/referencia/nfse/
        // ────────────────────────────────────────────────────────────────────
        if (action === "emitir") {
          const { nota } = body;
          if (!nota) return err("campo 'nota' é obrigatório");
          if (!config.cnpj) return err("CNPJ do escritório não configurado em escritorio_config");

          // 1. Criar rascunho local
          const rascunho = await supaRest(token, "nfse_emitida", "POST", {
            cliente_id,
            status:            "processando",
            competencia:       nota.competencia ?? new Date().toISOString().slice(0, 7),
            tomador_nome:      nota.tomador?.razao_social ?? null,
            tomador_cnpj_cpf:  String(nota.tomador?.cnpj ?? nota.tomador?.cpf ?? ""),
            tomador_email:     nota.tomador?.email ?? null,
            tomador_municipio: nota.tomador?.endereco?.municipio ?? null,
            tomador_uf:        nota.tomador?.endereco?.uf ?? null,
            descricao_servico: nota.servico?.discriminacao ?? null,
            codigo_servico:    nota.servico?.item_lista_servico ?? null,
            valor_servico:     nota.servico?.valor_servicos ?? 0,
            aliquota_iss:      nota.servico?.aliquota_iss ?? 0,
            issretido:         nota.servico?.iss_retido ?? false,
            created_by:        userId,
          });
          const localId = (Array.isArray(rascunho) ? rascunho[0] : rascunho)?.id;
          if (!localId) return err("Falha ao criar rascunho", 500);

          // 2. ref = UUID local (imutável, rastreável)
          const focusRef = localId;

          try {
            const payload = {
              data_emissao:               nota.data_emissao ?? new Date().toISOString(),
              natureza_operacao:          nota.natureza_operacao ?? "1",
              optante_simples_nacional:   nota.optante_simples_nacional ?? true,
              regime_especial_tributacao: nota.regime_especial_tributacao ?? "6",
              incentivo_fiscal:           nota.incentivo_fiscal ?? false,
              prestador: {
                cnpj:               config.cnpj,
                inscricao_municipal: nota.prestador?.inscricao_municipal ?? config.inscricao_municipal ?? "",
                codigo_municipio:    nota.prestador?.codigo_municipio ?? config.codigo_municipio ?? nota.servico?.codigo_municipio ?? "",
              },
              tomador: {
                cnpj:         nota.tomador?.cnpj?.replace(/\D/g, "") || undefined,
                cpf:          nota.tomador?.cpf?.replace(/\D/g, "")  || undefined,
                razao_social: nota.tomador?.razao_social,
                email:        nota.tomador?.email,
                endereco: nota.tomador?.endereco
                  ? {
                      logradouro:       nota.tomador.endereco.logradouro,
                      numero:           nota.tomador.endereco.numero ?? "S/N",
                      complemento:      nota.tomador.endereco.complemento,
                      bairro:           nota.tomador.endereco.bairro,
                      codigo_municipio: nota.tomador.endereco.codigo_municipio,
                      uf:               nota.tomador.endereco.uf,
                      cep:              nota.tomador.endereco.cep?.replace(/\D/g, ""),
                    }
                  : undefined,
              },
              servico: {
                valor_servicos:              nota.servico?.valor_servicos,
                valor_deducoes:              nota.servico?.valor_deducoes ?? 0,
                valor_iss:                   nota.servico?.valor_iss,
                aliquota_iss:                nota.servico?.aliquota_iss,
                iss_retido:                  nota.servico?.iss_retido ?? false,
                item_lista_servico:          nota.servico?.item_lista_servico ?? "17.19",
                codigo_tributacao_municipio: nota.servico?.codigo_tributacao_municipio,
                discriminacao:               nota.servico?.discriminacao,
                codigo_municipio:            nota.servico?.codigo_municipio,
              },
            };

            const { data: result } = await focusRequest(
              "POST",
              `/nfse?ref=${focusRef}`,
              payload,
              config.ambiente,
            );

            const numero = String(result?.numero ?? "");
            const status = mapStatus(result?.status ?? "processando_autorizacao");
            const pdfUrl = result?.caminho_pdf_nota_fiscal ?? null;

            await supaRest(token, `nfse_emitida?id=eq.${localId}`, "PATCH", {
              focus_ref:    focusRef,
              numero,
              status,
              data_emissao: new Date().toISOString().slice(0, 10),
              pdf_url:      pdfUrl,
            });

            await logOp(token, cliente_id, "emitir", focusRef, "ok", payload,
              { numero, status, pdfUrl }, undefined, Date.now() - t0, userId);

            return json({ ok: true, id: localId, focus_ref: focusRef, numero, pdf_url: pdfUrl, status });

          } catch (e: any) {
            const msg = e?.message ?? "Falha ao emitir";
            const statusCode = msg.includes("não autorizado") || msg.includes("permissao_negada") ? 403 : 502;
            const msgClara = statusCode === 403
              ? "CNPJ do emitente não cadastrado na Focus NF-e. Acesse o painel em app.focusnfe.com.br e cadastre o emitente APOYA antes de emitir notas."
              : msg;
            await supaRest(token, `nfse_emitida?id=eq.${localId}`, "PATCH",
              { status: "erro", erro_msg: msgClara });
            await logOp(token, cliente_id, "emitir", focusRef, "erro",
              nota, null, msgClara, Date.now() - t0, userId);
            return err(msgClara, statusCode);
          }
        }

        // ────────────────────────────────────────────────────────────────────
        // CONSULTAR status de uma nota
        // ────────────────────────────────────────────────────────────────────
        if (action === "consultar") {
          const { nota_id } = body;
          if (!nota_id) return err("nota_id obrigatório");

          const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
            undefined, "select=focus_ref,cliente_id");
          const row = Array.isArray(rows) ? rows[0] : null;
          if (!row?.focus_ref) return err("Nota não encontrada ou sem ref Focus");

          try {
            const { data } = await focusRequest("GET",
              `/nfse?ref=${row.focus_ref}`, undefined, config.ambiente);
            const status = mapStatus(data?.status ?? "processando_autorizacao");
            const numero = String(data?.numero ?? "");
            const pdfUrl = data?.caminho_pdf_nota_fiscal ?? null;

            await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "PATCH",
              { status, numero, pdf_url: pdfUrl });

            return json({ ok: true, status, numero, pdf_url: pdfUrl });
          } catch (e: any) {
            return err(e?.message ?? "Falha ao consultar", 502);
          }
        }

        // ────────────────────────────────────────────────────────────────────
        // PDF da nota
        // ────────────────────────────────────────────────────────────────────
        if (action === "pdf") {
          const { nota_id } = body;
          if (!nota_id) return err("nota_id obrigatório");

          const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
            undefined, "select=focus_ref,pdf_url");
          const row = Array.isArray(rows) ? rows[0] : null;

          // Retornar pdf_url se já existe
          if (row?.pdf_url) return json({ ok: true, pdf_url: row.pdf_url });
          if (!row?.focus_ref) return err("Nota sem ref Focus");

          try {
            const tkn  = await getFocusToken();
            const base = getFocusBase(config.ambiente);
            const r = await fetch(`${base}/nfse?ref=${row.focus_ref}`,
              { headers: { Authorization: focusAuth(tkn) } });
            const d = await r.json().catch(() => ({}));
            const pdfUrl = d?.caminho_pdf_nota_fiscal ?? null;
            if (pdfUrl) {
              await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "PATCH",
                { pdf_url: pdfUrl });
              return json({ ok: true, pdf_url: pdfUrl });
            }
            return err("PDF ainda não disponível", 404);
          } catch (e: any) {
            return err(e?.message ?? "Falha ao obter PDF", 502);
          }
        }

        // ────────────────────────────────────────────────────────────────────
        // XML da nota
        // ────────────────────────────────────────────────────────────────────
        if (action === "xml") {
          const { nota_id } = body;
          if (!nota_id) return err("nota_id obrigatório");

          const rows = await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "GET",
            undefined, "select=focus_ref,xml_content");
          const row = Array.isArray(rows) ? rows[0] : null;
          if (row?.xml_content) return json({ ok: true, xml: row.xml_content });
          if (!row?.focus_ref) return err("Nota sem ref Focus");

          try {
            const tkn  = await getFocusToken();
            const base = getFocusBase(config.ambiente);
            const r = await fetch(`${base}/nfse?ref=${row.focus_ref}&completo=1`,
              { headers: { Authorization: focusAuth(tkn) } });
            const d = await r.json().catch(() => ({}));
            const xml = d?.xml_nota_fiscal ?? null;
            if (xml) {
              await supaRest(token, `nfse_emitida?id=eq.${nota_id}`, "PATCH",
                { xml_content: xml });
              return json({ ok: true, xml });
            }
            return err("XML não disponível", 404);
          } catch (e: any) {
            return err(e?.message ?? "Falha ao obter XML", 502);
          }
        }

        // ────────────────────────────────────────────────────────────────────
        // CANCELAR nota
        // ────────────────────────────────────────────────────────────────────
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
              status:            "cancelada",
              data_cancelamento: new Date().toISOString().slice(0, 10),
              erro_msg:          motivo ?? null,
            });
            await logOp(token, row.cliente_id, "cancelar", row.focus_ref, "ok",
              { nota_id, motivo }, null, undefined, Date.now() - t0, userId);
            return json({ ok: true });
          } catch (e: any) {
            await logOp(token, row.cliente_id, "cancelar", row.focus_ref, "erro",
              { nota_id }, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao cancelar", 502);
          }
        }

        // ────────────────────────────────────────────────────────────────────
        // SINCRONIZAR EMITIDAS — atualiza status das notas existentes no banco
        // Nota: Focus NF-e não possui endpoint de listagem por CNPJ/período.
        // Sincronizamos consultando nota a nota pelas refs já salvas no banco.
        // ────────────────────────────────────────────────────────────────────
        if (action === "sincronizar_emitidas") {
          if (!cliente_id) return err("cliente_id obrigatório");

          try {
            // Buscar notas com focus_ref no banco que ainda não estão concluídas
            const notas: any[] = await supabaseServiceFetch(
              "nfse_emitida",
              "GET",
              `select=id,focus_ref,status&cliente_id=eq.${cliente_id}&focus_ref=not.is.null&status=not.in.(emitida,cancelada)&limit=50`,
            ) as any[];

            let atualizadas = 0;
            for (const n of notas) {
              if (!n.focus_ref) continue;
              try {
                const { data } = await focusRequest("GET",
                  `/nfse/${n.focus_ref}`, undefined, config.ambiente);
                const novoStatus = mapStatus(data?.status ?? n.status);
                const numero     = String(data?.numero ?? "");
                const pdfUrl     = data?.caminho_pdf_nota_fiscal ?? null;

                if (novoStatus !== n.status || numero || pdfUrl) {
                  await supabaseServiceFetch("nfse_emitida", "PATCH",
                    `id=eq.${n.id}`,
                    { status: novoStatus, ...(numero ? { numero } : {}), ...(pdfUrl ? { pdf_url: pdfUrl } : {}) });
                  atualizadas++;
                }
              } catch { /* nota não encontrada no Focus — manter status local */ }
            }

            await logOp(token, cliente_id, "sincronizar_emitidas", undefined, "ok",
              {}, { total: notas.length, atualizadas }, undefined, Date.now() - t0, userId);
            return json({ ok: true, total: notas.length, atualizadas,
              msg: `${atualizadas} nota(s) atualizada(s) de ${notas.length} consultada(s)` });

          } catch (e: any) {
            await logOp(token, cliente_id, "sincronizar_emitidas", undefined, "erro",
              {}, null, e?.message, Date.now() - t0, userId);
            return err(e?.message ?? "Falha ao sincronizar", 502);
          }
        }

        // ────────────────────────────────────────────────────────────────────
        // SINCRONIZAR RECEBIDAS
        // ────────────────────────────────────────────────────────────────────
        if (action === "sincronizar_recebidas") {
          const { cnpj, competencia: comp, data_inicio, data_fim } = body;
          if (!cnpj || !cliente_id) return err("cnpj e cliente_id obrigatórios");
          const cnpjLimpo = cnpj.replace(/\D/g, "");

          let ini = data_inicio;
          let fim = data_fim;
          if (!ini && comp) {
            const [yyyy, mm] = comp.split("-");
            ini = `${yyyy}-${mm}-01`;
            fim = `${yyyy}-${mm}-${new Date(Number(yyyy), Number(mm), 0).getDate()}`;
          }
          if (!ini) {
            const now  = new Date();
            ini = `${now.getFullYear()}-01-01`;
            fim = now.toISOString().slice(0, 10);
          }

          try {
            // Focus NF-e não possui endpoint de listagem de notas recebidas.
            // Retornamos as notas já importadas manualmente no banco.
            const existentes: any[] = await supabaseServiceFetch(
              "nfse_recebida", "GET",
              `select=id&cliente_id=eq.${cliente_id}&limit=1`,
            ) as any[];

            return json({
              ok: true,
              total: existentes.length,
              inserted: 0,
              msg: "Focus NF-e não oferece consulta automática de notas recebidas. Utilize importação manual via XML ou consulta no portal da prefeitura.",
            });
          } catch (e: any) {
            return err(e?.message ?? "Falha ao consultar recebidas", 502);
          }
        }

        return err(`Ação desconhecida: ${action}`);
      },
    },
  },
});

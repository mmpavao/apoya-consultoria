/**
 * POST /api/nfse/emitir-cobranca
 *
 * Emissão automática de NFS-e ao receber confirmação de pagamento.
 * Chamado pelo webhook do Asaas quando cobrança é paga.
 *
 * Fluxo:
 *  1. Recebe { cobranca_id }
 *  2. Busca dados da cobrança + cliente no banco
 *  3. Chama /api/nfse POST { action: "emitir" } (Focus NF-e)
 *  4. Salva nfse_emitida.cobranca_id + pdf_url + focus_ref
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseServiceFetch } from "@/lib/supabase-server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400) { return json({ error: msg }, status); }

// Valida um JWT de usuário consultando o endpoint de auth do Supabase.
const SUPA_URL = (globalThis as any).__env__?.SUPABASE_URL
  ?? (typeof process !== "undefined" ? process.env.SUPABASE_URL : "")
  ?? "https://ajaqbdsalxfgrwpjbtbn.supabase.co";
function anonKey(): string {
  return (globalThis as any).__env__?.VITE_SUPABASE_PUBLISHABLE_KEY
    ?? (typeof process !== "undefined" ? process.env.VITE_SUPABASE_PUBLISHABLE_KEY : "")
    ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYXFiZHNhbHhmZ3J3cGpidGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDgzMjMsImV4cCI6MjA5NDg4NDMyM30.QI9pwP1W3x6jFzOPsI_8lTGCY8Moup0AIhcsoG6jDQM";
}
async function isValidSupabaseUser(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey() },
    });
    return r.ok;
  } catch { return false; }
}

// ── Focus NF-e helpers ───────────────────────────────────────────────────────
const FOCUS_HML  = "https://homologacao.focusnfe.com.br/v2";
const FOCUS_PROD = "https://api.focusnfe.com.br/v2";

function getFocusToken(): string {
  return (globalThis as any).__env__?.FOCUSNFE_API_TOKEN
    ?? process.env.FOCUSNFE_API_TOKEN ?? "";
}
function focusAuth(t: string): string { return "Basic " + btoa(`${t}:`); }

function getFocusBase(amb?: string | null): string {
  return amb === "producao" ? FOCUS_PROD : FOCUS_HML;
}

async function focusEmitir(payload: any, focusRef: string, ambiente?: string | null) {
  const token = getFocusToken();
  if (!token) throw new Error("FOCUSNFE_API_TOKEN não configurado");
  const base = getFocusBase(ambiente);
  const res = await fetch(`${base}/nfse?ref=${focusRef}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: focusAuth(token) },
    body: JSON.stringify(payload),
    redirect: "follow",
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d?.mensagem ?? d?.erro ?? `Focus HTTP ${res.status}`);
  return d;
}

function mapStatus(s: string): string {
  return { autorizado: "emitida", processando_autorizacao: "processando",
    erro_autorizacao: "erro", cancelado: "cancelada" }[s] ?? "processando";
}

// ── Rota ─────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/nfse/emitir-cobranca")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth gate (SEC-002, reforçado) ────────────────────────────────
        // Interno (webhook): x-internal === APOYA_SERVICE_TOKEN (fail-closed
        // se o token não estiver configurado). Humano (UI): Bearer = JWT de
        // usuário REAL, validado no Supabase (não mais "qualquer string >20").
        const authHeader = request.headers.get("Authorization") ?? "";
        const xInternal  = request.headers.get("x-internal") ?? "";
        const serviceToken = (globalThis as any).__env__?.APOYA_SERVICE_TOKEN
          ?? process.env.APOYA_SERVICE_TOKEN ?? "";
        const hasValidInternal = serviceToken !== "" && xInternal === serviceToken;

        let hasValidUser = false;
        if (!hasValidInternal && authHeader.startsWith("Bearer ")) {
          hasValidUser = await isValidSupabaseUser(authHeader.slice(7).trim());
        }
        if (!hasValidInternal && !hasValidUser) {
          return json({ error: "Unauthorized" }, 401);
        }
        // ── Bloqueio emissão (SEC-005) ────────────────────────────────────
        const nfseBloqueada = (globalThis as any).__env__?.NFSE_EMISSAO_BLOQUEADA
          ?? process.env.NFSE_EMISSAO_BLOQUEADA ?? "";
        if (nfseBloqueada === "true") {
          return json({
            error: "Emissão de NFS-e temporariamente suspensa",
            motivo: "Pendência junto à prefeitura de Caçapava — Erro 11",
          }, 503);
        }
        // ─────────────────────────────────────────────────────────────────
        let body: any;
        try { body = await request.json(); } catch { return err("JSON inválido"); }

        const { cobranca_id } = body;
        if (!cobranca_id) return err("cobranca_id obrigatório");

        // 1. Buscar cobrança
        const cobRows = await supabaseServiceFetch(
          "cobrancas",
          "GET",
          `select=id,cliente_id,valor,descricao,competencia,nfse_status&id=eq.${cobranca_id}&limit=1`,
        );
        const cob = Array.isArray(cobRows) ? cobRows[0] : null;
        if (!cob) return err("Cobrança não encontrada", 404);
        if (cob.nfse_status === "emitida") return json({ ok: true, msg: "Nota já emitida" });

        // 2. Buscar cliente
        const cliRows = await supabaseServiceFetch(
          "clientes",
          "GET",
          `select=id,cnpj,razao_social,regime,email,municipio,uf,codigo_municipio_ibge,aliquota_iss,codigo_servico_nfse,inscricao_municipal&id=eq.${cob.cliente_id}&limit=1`,
        );
        const cli = Array.isArray(cliRows) ? cliRows[0] : null;
        if (!cli) return err("Cliente não encontrado", 404);

        // 3. Config do escritório
        const cfgRows = await supabaseServiceFetch(
          "escritorio_config",
          "GET",
          "select=cnpj,focus_ambiente,inscricao_municipal,codigo_municipio_ibge&limit=1",
        );
        const cfg = Array.isArray(cfgRows) ? cfgRows[0] : null;
        const cnpjEscritorioLimpo = (cfg?.cnpj ?? "").replace(/\D/g, "");
        const ambiente            = cfg?.focus_ambiente ?? "homologacao";

        if (!cnpjEscritorioLimpo) {
          await supabaseServiceFetch("cobrancas", "PATCH", `id=eq.${cobranca_id}`,
            { nfse_status: "erro", nfse_erro: "CNPJ do escritório não configurado" });
          return err("CNPJ do escritório não configurado", 500);
        }

        // 4. Criar rascunho local
        const rascunho = await supabaseServiceFetch("nfse_emitida", "POST", undefined, {
          cliente_id:       cob.cliente_id,
          cobranca_id:      cobranca_id,
          status:           "processando",
          competencia:      cob.competencia ?? new Date().toISOString().slice(0, 7),
          tomador_nome:     cli.razao_social,
          tomador_cnpj_cpf: (cli.cnpj ?? "").replace(/\D/g, ""),
          descricao_servico: cob.descricao ?? `Serviços contábeis — ${cob.competencia ?? ""}`,
          codigo_servico:   cli.codigo_servico_nfse ?? "17.19",
          valor_servico:    cob.valor,
          aliquota_iss:     cli.aliquota_iss ?? 3,
        });
        const localId = (Array.isArray(rascunho) ? rascunho[0] : rascunho)?.id;
        if (!localId) return err("Falha ao criar rascunho", 500);

        const focusRef = localId;
        const val  = parseFloat(cob.valor) || 0;
        const ali  = parseFloat(cli.aliquota_iss ?? 3) || 3;

        const payload = {
          data_emissao:               new Date().toISOString(),
          natureza_operacao:          "1",
          optante_simples_nacional:   true,
          regime_especial_tributacao: "6",
          incentivo_fiscal:           false,
          prestador: {
            cnpj:                cnpjEscritorioLimpo,
            inscricao_municipal: cfg?.inscricao_municipal ?? "",
            codigo_municipio:    cfg?.codigo_municipio_ibge ?? "",
          },
          tomador: {
            cnpj:         (cli.cnpj ?? "").replace(/\D/g, "") || undefined,
            razao_social: cli.razao_social,
            email:        cli.email || undefined,
            endereco:     cli.municipio
              ? { municipio: cli.municipio, uf: cli.uf ?? "SP",
                  codigo_municipio: cli.codigo_municipio_ibge ?? "" }
              : undefined,
          },
          servico: {
            valor_servicos:              val,
            aliquota_iss:                ali,
            valor_iss:                   +(val * ali / 100).toFixed(2),
            iss_retido:                  false,
            item_lista_servico:          cli.codigo_servico_nfse ?? "17.19",
            discriminacao:               cob.descricao ?? `Serviços contábeis — competência ${cob.competencia ?? ""}`,
            codigo_municipio:            cli.codigo_municipio_ibge ?? "",
            codigo_tributacao_municipio: cli.codigo_servico_nfse ?? "17.19",
          },
        };

        try {
          // Corrigir referência config (config.cnpj → cnpjEscritorioLimpo)
          
          const result = await focusEmitir(payload, focusRef, ambiente);
          const numero = String(result?.numero ?? "");
          const status = mapStatus(result?.status ?? "processando_autorizacao");
          const pdfUrl = result?.caminho_pdf_nota_fiscal ?? null;

          await supabaseServiceFetch("nfse_emitida", "PATCH", `id=eq.${localId}`, {
            focus_ref: focusRef, numero, status,
            data_emissao: new Date().toISOString().slice(0, 10), pdf_url: pdfUrl,
          });
          await supabaseServiceFetch("cobrancas", "PATCH", `id=eq.${cobranca_id}`, {
            nfse_status: status, nfse_emitida_em: new Date().toISOString(),
            nfse_numero: numero, nfse_pdf_url: pdfUrl,
          });

          return json({ ok: true, focus_ref: focusRef, numero, status, pdf_url: pdfUrl });
        } catch (e: any) {
          await supabaseServiceFetch("nfse_emitida", "PATCH", `id=eq.${localId}`,
            { status: "erro", erro_msg: e?.message });
          await supabaseServiceFetch("cobrancas", "PATCH", `id=eq.${cobranca_id}`,
            { nfse_status: "erro", nfse_erro: e?.message });
          return err(e?.message ?? "Falha ao emitir", 502);
        }
      },
    },
  },
});

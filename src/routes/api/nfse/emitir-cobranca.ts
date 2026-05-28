/**
 * POST /api/nfse/emitir-cobranca
 * Emite NFS-e para uma cobrança paga que ainda não tem nota.
 * 
 * Body: { cobranca_id: string }
 * 
 * Fluxo:
 *  1. Busca cobrança (deve estar paga e sem nfse_status)
 *  2. Busca cliente (dados fiscais: inscricao_municipal, codigo_servico, aliquota_iss)
 *  3. Monta payload NFE.io e chama POST /api/nfse/ com action=emitir
 *  4. Atualiza cobrancas.nfse_status = "emitida" | "erro"
 *  5. Envia PDF por WhatsApp se emitido com sucesso
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseServiceFetch } from "@/lib/supabase-server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqYXFiZHNhbHhmZ3J3cGpidGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDgzMjMsImV4cCI6MjA5NDg4NDMyM30.QI9pwP1W3x6jFzOPsI_8lTGCY8Moup0AIhcsoG6jDQM";
const SUPA_URL = "https://ajaqbdsalxfgrwpjbtbn.supabase.co";

async function getSupabaseUser(authHeader: string) {
  const token = authHeader.replace("Bearer ", "");
  // Aceitar cookie de sessão ou bearer token
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return { userId: d.id as string, token };
}

function getNfseKey(): string {
  return (globalThis as any).__env__?.NFSEIO_API_KEY ?? process.env.NFSEIO_API_KEY ?? "";
}

function getEvolutionCreds() {
  const env = (globalThis as any).__env__ ?? process.env;
  return {
    base: env.EVOLUTION_BASE_URL ?? "",
    key:  env.EVOLUTION_API_KEY  ?? "",
    instance: env.EVOLUTION_INSTANCE ?? "meucontador",
  };
}

export const Route = createFileRoute("/api/nfse/emitir-cobranca")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth ──────────────────────────────────────────────────────
        const authHeader  = request.headers.get("authorization") ?? "";
        const isInternal  = request.headers.get("x-internal") === "webhook";
        const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

        let userId = "system";

        if (isInternal && SERVICE_KEY && authHeader === `Bearer ${SERVICE_KEY}`) {
          // Chamada interna do webhook Asaas — aceitar diretamente
          userId = "webhook-asaas";
        } else if (authHeader) {
          // Chamada do frontend — validar token de usuário
          const user = await getSupabaseUser(authHeader);
          if (!user) return err("Unauthorized", 401);
          userId = user.userId;
        } else {
          return err("Unauthorized", 401);
        }

        // ── Body ──────────────────────────────────────────────────────
        let body: any;
        try { body = await request.json(); } catch { return err("JSON inválido"); }
        const { cobranca_id } = body;
        if (!cobranca_id) return err("cobranca_id é obrigatório");

        // ── Buscar cobrança ───────────────────────────────────────────
        const cobRows = await supabaseServiceFetch(
          "cobrancas",
          "GET",
          `id=eq.${cobranca_id}&select=id,cliente_id,cliente_nome,cnpj,valor,competencia,descricao,status,nfse_status`
        ) as any[];
        const cob = cobRows?.[0];
        if (!cob) return err("Cobrança não encontrada", 404);
        if (cob.status !== "paga") return err("Cobrança não está paga", 400);
        if (cob.nfse_status === "emitida") return err("NFS-e já emitida para esta cobrança", 409);

        // ── Buscar cliente ────────────────────────────────────────────
        const cliRows = await supabaseServiceFetch(
          "clientes",
          "GET",
          `id=eq.${cob.cliente_id}&select=id,razao_social,cnpj,email,inscricao_municipal,codigo_servico_nfse,aliquota_iss,municipio,uf,logradouro,numero,bairro,cep,whatsapp,telefone`
        ) as any[];
        const cli = cliRows?.[0];
        if (!cli) return err("Cliente não encontrado", 404);

        // ── Buscar emitente (APOYA) ───────────────────────────────────
        const FALLBACK_EMITENTE = "c134d1687b1a4e23aaa63217bda1d124"; // APOYA PROD
        let emitenteId = FALLBACK_EMITENTE;
        try {
          const cfgRows = await supabaseServiceFetch(
            "escritorio_config",
            "GET",
            "select=nfseio_emitente_id&limit=1"
          ) as any[];
          if (cfgRows?.[0]?.nfseio_emitente_id) {
            emitenteId = cfgRows[0].nfseio_emitente_id;
          }
        } catch {}

        // ── Montar payload NFE.io ─────────────────────────────────────
        const cnpjNum = (cli.cnpj ?? "").replace(/\D/g, "");
        const [year, month] = (cob.competencia ?? "2026-05").split("-");
        const competencia = `${year}-${month}`;

        const nota = {
          cityServiceCode: cli.codigo_servico_nfse ?? "0107",
          federalServiceCode: "17.20",
          description: cob.descricao ?? `Honorários Contábeis — ${competencia}`,
          servicesAmount: Number(cob.valor),
          issRate: Number(cli.aliquota_iss ?? 2),
          issRetained: false,
          taxationType: "WithinCity",
          competencia,
          borrower: {
            type: cnpjNum.length === 14 ? "J" : "F",
            name: cli.razao_social ?? cob.cliente_nome,
            federalTaxNumber: parseInt(cnpjNum, 10),
            email: cli.email ?? "",
            address: {
              country: "BRA",
              postalCode: (cli.cep ?? "").replace(/\D/g, ""),
              street: cli.logradouro ?? "",
              number: cli.numero ?? "S/N",
              district: cli.bairro ?? "",
              city: {
                code: "3509502", // Caçapava padrão; idealmente buscar do cliente
                name: cli.municipio ?? "São Paulo",
              },
              state: cli.uf ?? "SP",
            },
          },
        };

        // ── Marcar como processando ───────────────────────────────────
        await supabaseServiceFetch(
          `cobrancas?id=eq.${cobranca_id}`,
          "PATCH",
          undefined,
          { nfse_status: "processando", nfse_tentativas: (cob.nfse_tentativas ?? 0) + 1 }
        );

        // ── Chamar NFE.io ─────────────────────────────────────────────
        const nfseKey = getNfseKey();
        if (!nfseKey) {
          await supabaseServiceFetch(
            `cobrancas?id=eq.${cobranca_id}`,
            "PATCH",
            undefined,
            { nfse_status: "erro", nfse_erro: "NFSEIO_API_KEY não configurada" }
          );
          return err("NFSEIO_API_KEY não configurada", 500);
        }

        let nfseioResult: any;
        try {
          const nfseRes = await fetch(`https://api.nfe.io/v1/companies/${emitenteId}/serviceinvoices`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: nfseKey },
            body: JSON.stringify(nota),
          });
          nfseioResult = await nfseRes.json().catch(() => ({}));
          if (!nfseRes.ok) throw new Error(nfseioResult?.message ?? `NFE.io HTTP ${nfseRes.status}`);
        } catch (e: any) {
          await supabaseServiceFetch(
            `cobrancas?id=eq.${cobranca_id}`,
            "PATCH",
            undefined,
            { nfse_status: "erro", nfse_erro: e.message ?? "Erro NFE.io" }
          );
          return err(e.message ?? "Erro ao emitir nota", 502);
        }

        const nfseioId  = nfseioResult?.id;
        const numero    = String(nfseioResult?.number ?? "");
        const pdfUrl    = nfseioResult?.pdfUrl ?? null;

        // ── Registrar nota no banco ───────────────────────────────────
        await supabaseServiceFetch("nfse_emitida", "POST", undefined, {
          cliente_id:       cob.cliente_id,
          cobranca_id:      cobranca_id,
          nfseio_id:        nfseioId,
          numero,
          status:           "emitida",
          competencia,
          data_emissao:     new Date().toISOString().slice(0, 10),
          valor_servico:    cob.valor,
          tomador_nome:     cli.razao_social ?? cob.cliente_nome,
          tomador_cnpj_cpf: cnpjNum,
          pdf_url:          pdfUrl,
          created_by:       userId,
        });

        // ── Atualizar cobrança ────────────────────────────────────────
        await supabaseServiceFetch(
          `cobrancas?id=eq.${cobranca_id}`,
          "PATCH",
          undefined,
          { nfse_status: "emitida" }
        );

        // ── Enviar PDF por WhatsApp (se tiver número e PDF) ──────────
        const whatsapp = (cli.whatsapp ?? cli.telefone ?? "").replace(/\D/g, "");
        if (whatsapp && pdfUrl) {
          const { base, key, instance } = getEvolutionCreds();
          try {
            await fetch(`${base}/message/sendMedia/${instance}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: key },
              body: JSON.stringify({
                number: whatsapp,
                mediatype: "document",
                media: pdfUrl,
                fileName: `NFS-e_${numero}_${competencia}.pdf`,
                caption: `✅ *Nota Fiscal emitida!*\n\n📄 NFS-e nº ${numero}\n📅 Competência: ${competencia}\n💰 Valor: R$ ${Number(cob.valor).toFixed(2)}\n\nSegue em anexo o PDF da sua nota fiscal.`,
              }),
            });
          } catch {}
        }

        return json({ ok: true, numero, pdf_url: pdfUrl, nfseio_id: nfseioId });
      },
    },
  },
});

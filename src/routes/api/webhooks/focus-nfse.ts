/**
 * Webhook Receptor — Focus NF-e
 * POST /api/webhooks/focus-nfse?event=nfse|nfe|nfse_recebida|nfe_recebida|nfce_contingencia
 *
 * Recebe notificações em tempo real da Focus NF-e quando documentos são
 * autorizados, cancelados ou têm erros.
 *
 * Autenticação: Bearer webhook-focus-apoya-2026 (header Authorization)
 * Docs: https://doc.focusnfe.com.br/reference/webhooks
 *
 * Payload da Focus (exemplo NFS-e):
 * {
 *   "cnpj_prestador": "43507838000189",
 *   "ref": "<uuid-do-banco>",
 *   "status": "autorizado",
 *   "numero": "42",
 *   "url_danfse": "https://..."
 * }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseServiceFetch } from "@/lib/supabase-server";

const WEBHOOK_SECRET = "Bearer webhook-focus-apoya-2026";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mapStatus(status: string): string {
  const m: Record<string, string> = {
    "autorizado":              "emitida",
    "processando_autorizacao": "processando",
    "erro_autorizacao":        "erro",
    "cancelado":               "cancelada",
    "cancelamento_negado":     "emitida",
  };
  return m[status] ?? "processando";
}

async function supaRest(table: string, method: string, body?: unknown, params?: string) {
  return supabaseServiceFetch(table, method as "GET" | "POST" | "PATCH" | "DELETE", params, body);
}

export const Route = createFileRoute("/api/webhooks/focus-nfse")({
  server: {
    handlers: {

      // Focus NF-e sempre envia POST
      POST: async ({ request }) => {
        // ── Validar autenticação ──────────────────────────────────────────
        const auth = request.headers.get("authorization") ?? "";
        if (auth !== WEBHOOK_SECRET) {
          console.warn("[focus-webhook] auth inválida:", auth?.slice(0, 20));
          // Retornar 200 para a Focus não retentar — mas não processar
          return json({ ok: false, error: "unauthorized" }, 200);
        }

        const url      = new URL(request.url);
        const eventType = url.searchParams.get("event") ?? "unknown";

        let payload: any;
        try { payload = await request.json(); } catch {
          return json({ ok: false, error: "json_invalido" });
        }

        const ref    = payload?.ref;
        const status = payload?.status;
        const cnpj   = payload?.cnpj_prestador ?? payload?.cnpj_emitente ?? null;

        console.log(`[focus-webhook] event=${eventType} ref=${ref} status=${status}`);

        try {
          // ── NFS-e emitida ──────────────────────────────────────────────
          if (eventType === "nfse") {
            if (!ref) return json({ ok: true, skip: "sem ref" });

            const patch: Record<string, unknown> = {
              status:  mapStatus(status),
              updated_at: new Date().toISOString(),
            };

            if (payload.numero)          patch.numero             = String(payload.numero);
            if (payload.url_danfse)      patch.pdf_url            = payload.url_danfse;
            if (payload.url)             patch.pdf_url            = patch.pdf_url ?? payload.url;
            if (payload.codigo_verificacao) patch.codigo_verificacao = payload.codigo_verificacao;
            if (payload.data_emissao)    patch.data_emissao       = payload.data_emissao?.slice(0, 10);

            if (status === "erro_autorizacao" && payload.erros?.length) {
              patch.erro_msg = payload.erros[0]?.mensagem ?? "Erro na autorização";
            }

            await supaRest(`nfse_emitida?focus_ref=eq.${ref}`, "PATCH", patch);
            return json({ ok: true, event: "nfse", ref, status: patch.status });
          }

          // ── NFS-e recebida ─────────────────────────────────────────────
          if (eventType === "nfse_recebida") {
            if (!ref) return json({ ok: true, skip: "sem ref" });

            // Buscar o cliente pelo CNPJ do tomador
            const tomadorCnpj = payload?.cnpj_tomador?.replace(/\D/g, "");
            if (!tomadorCnpj) return json({ ok: true, skip: "sem cnpj_tomador" });

            // Tentar upsert na tabela nfse_recebida
            const row = {
              focus_ref:         ref,
              cnpj_tomador:      tomadorCnpj,
              prestador_nome:    payload.prestador?.razao_social ?? null,
              prestador_cnpj:    String(payload.prestador?.cnpj ?? ""),
              numero:            String(payload.numero ?? ref),
              codigo_verificacao: payload.codigo_verificacao ?? null,
              data_emissao:      payload.data_emissao?.slice(0, 10) ?? null,
              competencia:       payload.data_emissao?.slice(0, 7) ?? null,
              valor_servico:     payload.valor_servicos ?? null,
              valor_iss:         payload.valor_iss ?? null,
              descricao_servico: payload.discriminacao ?? null,
              codigo_servico:    payload.item_lista_servico ?? null,
              pdf_url:           payload.url_danfse ?? null,
              fonte:             "focus",
            };

            // Encontrar o cliente pelo CNPJ do tomador
            const clientes = await supaRest(
              `clientes?cnpj=eq.${tomadorCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`,
              "GET", undefined, "select=id&limit=1"
            );
            const clienteId = Array.isArray(clientes) ? clientes[0]?.id : null;
            if (clienteId) (row as any).cliente_id = clienteId;

            await supaRest("nfse_recebida", "POST", row);
            return json({ ok: true, event: "nfse_recebida", ref });
          }

          // ── NF-e emitida ───────────────────────────────────────────────
          if (eventType === "nfe") {
            if (!ref) return json({ ok: true, skip: "sem ref" });

            const patch: Record<string, unknown> = {
              status:     mapStatus(status),
              updated_at: new Date().toISOString(),
            };

            if (payload.chave_nfe)       patch.chave_nfe         = payload.chave_nfe;
            if (payload.numero)          patch.numero             = String(payload.numero);
            if (payload.caminho_danfe)   patch.pdf_url            = payload.caminho_danfe;
            if (payload.data_emissao)    patch.data_emissao       = payload.data_emissao?.slice(0, 10);

            if (status === "erro_autorizacao" && payload.erros?.length) {
              patch.erro_msg = payload.erros[0]?.mensagem ?? "Erro na autorização";
            }

            // Tentar atualizar por focus_ref na tabela notas_fiscais
            await supaRest(`notas_fiscais?focus_ref=eq.${ref}`, "PATCH", patch);
            return json({ ok: true, event: "nfe", ref, status: patch.status });
          }

          // ── NF-e recebida ──────────────────────────────────────────────
          if (eventType === "nfe_recebida") {
            // Log apenas por enquanto — módulo de NF-e recebida a implementar
            console.log("[focus-webhook] nfe_recebida recebida:", JSON.stringify(payload).slice(0, 200));
            return json({ ok: true, event: "nfe_recebida", queued: true });
          }

          // ── NFC-e contingência ─────────────────────────────────────────
          if (eventType === "nfce_contingencia") {
            console.log("[focus-webhook] nfce_contingencia:", JSON.stringify(payload).slice(0, 200));
            return json({ ok: true, event: "nfce_contingencia", queued: true });
          }

          // Evento desconhecido — aceitar sem erro para Focus não retentar
          console.log(`[focus-webhook] evento desconhecido: ${eventType}`);
          return json({ ok: true, skip: `evento_desconhecido:${eventType}` });

        } catch (e: any) {
          console.error("[focus-webhook] erro ao processar:", e?.message);
          // Retornar 200 para Focus não retentar — registrar internamente
          return json({ ok: false, error: e?.message }, 200);
        }
      },

      // GET para health-check (Focus pode verificar se a URL está ativa)
      GET: async ({ request }) => {
        return json({
          ok: true,
          service: "Focus NF-e Webhook Receiver",
          version: "1.0",
          timestamp: new Date().toISOString(),
        });
      },
    },
  },
});

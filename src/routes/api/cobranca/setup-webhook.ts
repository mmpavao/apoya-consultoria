/**
 * POST /api/cobranca/setup-webhook
 * Registra (ou atualiza) o webhook Asaas apontando para este worker.
 * Idempotente — pode ser chamado múltiplas vezes com segurança.
 * 
 * Auth: header x-setup-key === env SETUP_KEY (obrigatória)
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin }   from "@/integrations/supabase/client.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/cobranca/setup-webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {

        // Auth via secret header — segredo lido de env (fail-closed se ausente)
        const setupKey = request.headers.get("x-setup-key") ?? "";
        const expectedSetupKey = (globalThis as any).__env__?.SETUP_KEY
          ?? process.env.SETUP_KEY ?? "";
        if (!expectedSetupKey || setupKey !== expectedSetupKey) {
          return json({ error: "Não autorizado" }, 401);
        }

        const apiKey = process.env.ASAAS_API_KEY;
        if (!apiKey) return json({ error: "ASAAS_API_KEY não configurada" }, 503);

        // Detectar ambiente (prod: $aact_prod | sandbox: $aact_YTg etc.)
        const isSandbox = !apiKey.toLowerCase().startsWith("$aact_prod");
        const baseUrl   = isSandbox
          ? "https://sandbox.asaas.com/api/v3"
          : "https://api.asaas.com/v3";

        const webhookBase = process.env.WORKER_BASE_URL
          ?? (globalThis as any).__env__?.WORKER_BASE_URL
          ?? "https://apoyaproject.zapro.tech";
        const webhookUrl   = `${webhookBase.replace(/\/$/, "")}/api/cobranca/webhook`;
        const webhookToken = crypto.randomUUID().replace(/-/g, "");

        const headers = {
          access_token:    apiKey,
          "Content-Type":  "application/json",
          "User-Agent":    "APOYA-Gestao/1.0",
        };

        // Verificar se já existe webhook para esta URL
        const listRes  = await fetch(`${baseUrl}/webhooks`, { headers });
        const listData = await listRes.json() as any;
        const existing  = listData?.data?.find((w: any) => w.url === webhookUrl);

        const payload = {
          name:        "APOYA Gestão",
          url:         webhookUrl,
          email:       "contato@apoya.com.br",
          enabled:     true,
          interrupted: false,
          sendType:    "SEQUENTIALLY",
          authToken:   webhookToken,
          events: [
            "PAYMENT_RECEIVED",
            "PAYMENT_CONFIRMED",
            "PAYMENT_OVERDUE",
            "PAYMENT_DELETED",
            "PAYMENT_REFUNDED",
          ],
        };

        let result: any;
        let acao: string;

        if (existing) {
          const r = await fetch(`${baseUrl}/webhooks/${existing.id}`, {
            method:  "PUT",
            headers,
            body:    JSON.stringify(payload),
          });
          result = await r.json();
          acao   = "atualizado";
        } else {
          const r = await fetch(`${baseUrl}/webhooks`, {
            method:  "POST",
            headers,
            body:    JSON.stringify(payload),
          });
          result = await r.json();
          acao   = "criado";
        }

        if (result?.errors?.length) {
          return json({ error: "Asaas recusou", detail: result.errors }, 400);
        }

        // Persistir dados na config do banco (upsert — antes só update quebrava se a linha não existia)
        const db = supabaseAdmin as any;
        const configPayload = {
          sandbox:         isSandbox,
          base_url:        baseUrl,
          webhook_id:      result.id ?? existing?.id,
          webhook_token:   webhookToken,
          webhook_url:     webhookUrl,
          configurado_em:  new Date().toISOString(),
        };
        const { data: cfgRow } = await db.from("integracao_config")
          .select("id").eq("tipo", "asaas").maybeSingle();
        if (cfgRow) {
          await db.from("integracao_config").update({ config: configPayload, ativa: true })
            .eq("tipo", "asaas");
        } else {
          await db.from("integracao_config").insert({
            tipo: "asaas",
            ativa: true,
            config: configPayload,
          });
        }

        return json({
          ok:          true,
          acao,
          webhook_id:  result.id ?? existing?.id,
          webhook_url: webhookUrl,
          ambiente:    isSandbox ? "sandbox" : "produção",
        });
      },
    },
  },
});

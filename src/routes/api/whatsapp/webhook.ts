/**
 * POST /api/whatsapp/webhook
 * Recebe eventos da Evolution API e roteia para o agente correto.
 * Responde sempre 200 para evitar reenvios da Evolution.
 */
import { createFileRoute } from "@tanstack/react-router";
import { handleWhatsAppMessage } from "@/server/whatsapp-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/whatsapp/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          // env vem via c.env no Cloudflare Workers — no TanStack Start
          // as variáveis de ambiente são acessíveis via process.env
          const env = {
            SUPABASE_URL: process.env.SUPABASE_URL ?? "",
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
            OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
            EVOLUTION_BASE_URL: process.env.EVOLUTION_BASE_URL ?? "https://evolution-api-production-f159.up.railway.app",
            EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE ?? "zapmei",
            EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY ?? "",
            ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
          };
          await handleWhatsAppMessage(body, env);
          return json({ status: "ok" });
        } catch (err) {
          console.error("[webhook] error:", err);
          // Retorna 200 mesmo em erro para não reprocessar na Evolution
          return json({ status: "error", message: String(err) });
        }
      },
      // GET para verificação de saúde do webhook
      GET: async () => {
        return json({ status: "webhook ativo", timestamp: new Date().toISOString() });
      },
    },
  },
});

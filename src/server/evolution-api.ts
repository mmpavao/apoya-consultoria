/**
 * evolution-api.ts
 * Cliente para envio de mensagens via Evolution API
 */

interface EvolutionSendPayload {
  tipo: "texto" | "audio" | "documento" | "imagem";
  texto?: string;
  url?: string;
  filename?: string;
  caption?: string;
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENAI_API_KEY: string;
  EVOLUTION_BASE_URL: string;
  EVOLUTION_INSTANCE: string;
  EVOLUTION_API_KEY: string;
  ELEVENLABS_API_KEY?: string;
}

export async function sendEvolutionMessage(
  phone: string,
  payload: EvolutionSendPayload,
  env: Env
): Promise<void> {
  const baseUrl = env.EVOLUTION_BASE_URL;
  const instance = env.EVOLUTION_INSTANCE;
  const apiKey = env.EVOLUTION_API_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: apiKey,
  };

  try {
    if (payload.tipo === "texto" && payload.texto) {
      await fetch(`${baseUrl}/message/sendText/${instance}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: phone,
          text: payload.texto,
        }),
      });
    } else if (payload.tipo === "audio" && payload.url) {
      await fetch(`${baseUrl}/message/sendMedia/${instance}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: phone,
          mediatype: "audio",
          media: payload.url,
          fileName: "mensagem.mp3",
        }),
      });
    } else if (payload.tipo === "documento" && payload.url) {
      await fetch(`${baseUrl}/message/sendMedia/${instance}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: phone,
          mediatype: "document",
          media: payload.url,
          fileName: payload.filename ?? "documento.pdf",
          caption: payload.caption ?? "",
        }),
      });
    } else if (payload.tipo === "imagem" && payload.url) {
      await fetch(`${baseUrl}/message/sendMedia/${instance}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          number: phone,
          mediatype: "image",
          media: payload.url,
          caption: payload.caption ?? "",
        }),
      });
    }
  } catch (err) {
    console.error("[evolution-api] sendEvolutionMessage error:", err);
    throw err;
  }
}

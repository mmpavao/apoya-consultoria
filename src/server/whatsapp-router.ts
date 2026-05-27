/**
 * whatsapp-router.ts
 * Cérebro do atendimento WhatsApp
 * Fluxo: Evolution webhook → lookup → intent → agente → resposta
 */

import { createClient } from "@supabase/supabase-js";
import { classifyIntent } from "./intent-classifier";
import { dispatchAgent } from "./agent-dispatcher";
import { sendEvolutionMessage } from "./evolution-api";
import type { Env } from "./evolution-api";

// Payload normalizado da Evolution API
interface WhatsAppMessage {
  phone: string;
  message: string;
  mediaUrl?: string;
  mediaType?: string;
  isAudio: boolean;
}

// ─── Entry point principal ──────────────────────────────────────────────────
export async function handleWhatsAppMessage(
  raw: unknown,
  env: Env
): Promise<Response> {
  // 1. Normalizar payload
  const msg = normalizeEvolutionPayload(raw);
  if (!msg) return new Response("ignored", { status: 200 });

  // Ignorar mensagens sem texto e sem mídia (ex: reações, status)
  if (!msg.message && !msg.isAudio) return new Response("ignored", { status: 200 });

  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 2. Lookup: phone → client_id
  const { data: session } = await supabase
    .from("whatsapp_sessions")
    .select("client_id, modo_humano, last_agent")
    .eq("phone_number", msg.phone)
    .single();

  // 3. Número desconhecido → onboarding
  if (!session?.client_id) {
    await iniciarOnboarding(msg.phone, supabase, env);
    return new Response("ok", { status: 200 });
  }

  // 4. Modo humano → silêncio (humano está atendendo pelo painel)
  if (session.modo_humano) {
    return new Response("human_mode", { status: 200 });
  }

  const { client_id } = session;

  // 5. Carregar perfil do cliente
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, razao_social, regime, municipio, uf, status, valor_honorario, onboarding_step, campos_faltantes")
    .eq("id", client_id)
    .single();

  if (!cliente) return new Response("client_not_found", { status: 200 });

  // 6. Histórico recente (últimas 10 mensagens)
  const { data: historico } = await supabase
    .from("conversas")
    .select("role, agent, content, created_at")
    .eq("client_id", client_id)
    .order("created_at", { ascending: false })
    .limit(10);

  // 7. Áudio → transcrever com Whisper
  let textoFinal = msg.message;
  if (msg.isAudio && msg.mediaUrl) {
    textoFinal = await transcreverAudio(msg.mediaUrl, env.OPENAI_API_KEY);
  }

  // Gravar mensagem do usuário
  await supabase.from("conversas").insert({
    client_id,
    phone_number: msg.phone,
    role: "user",
    content: textoFinal || "[mídia sem texto]",
    media_url: msg.mediaUrl,
    media_type: msg.mediaType,
  });

  // 8. Classificar intenção
  const intent = await classifyIntent(
    textoFinal,
    historico ?? [],
    {
      razao_social: cliente.razao_social,
      regime: cliente.regime,
      municipio: cliente.municipio,
      uf: cliente.uf,
    },
    env.OPENAI_API_KEY
  );

  // 9. Despachar para agente
  const resposta = await dispatchAgent(
    intent,
    textoFinal,
    client_id,
    {
      razao_social: cliente.razao_social,
      regime: cliente.regime,
      municipio: cliente.municipio,
      uf: cliente.uf,
      status_contrato: cliente.status,
      onboarding_step: cliente.onboarding_step,
      campos_faltantes: cliente.campos_faltantes,
    },
    historico ?? [],
    env
  );

  // 10. Gravar resposta do agente
  await supabase.from("conversas").insert({
    client_id,
    phone_number: msg.phone,
    role: "assistant",
    agent: resposta.agente,
    content: resposta.texto,
    intent: intent.intent,
    tokens_used: resposta.tokens,
  });

  // 11. Atualizar sessão
  await supabase
    .from("whatsapp_sessions")
    .update({
      last_agent: resposta.agente,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", client_id);

  // 12. Enviar resposta via Evolution API
  if (msg.isAudio && env.ELEVENLABS_API_KEY) {
    try {
      const audioUrl = await gerarAudio(resposta.texto, resposta.agente, env.ELEVENLABS_API_KEY);
      await sendEvolutionMessage(msg.phone, { tipo: "audio", url: audioUrl }, env);
    } catch {
      // Fallback para texto se áudio falhar
      await sendEvolutionMessage(msg.phone, { tipo: "texto", texto: resposta.texto }, env);
    }
  } else {
    await sendEvolutionMessage(msg.phone, { tipo: "texto", texto: resposta.texto }, env);
  }

  // 13. Documento anexo (boleto, PDF, holerite)
  if (resposta.documentoUrl) {
    await sendEvolutionMessage(msg.phone, {
      tipo: "documento",
      url: resposta.documentoUrl,
      filename: resposta.documentoNome ?? "documento.pdf",
    }, env);
  }

  // 14. Audit log
  await supabase.from("eventos").insert({
    client_id,
    tipo: "mensagem_respondida",
    descricao: `Intent: ${intent.intent} | Agente: ${resposta.agente} | Confiança: ${intent.confianca}`,
    agente: resposta.agente,
    payload: { intent, tokens: resposta.tokens, urgente: intent.urgente },
  });

  return new Response("ok", { status: 200 });
}

// ─── Normalização do payload Evolution API ──────────────────────────────────
function normalizeEvolutionPayload(raw: unknown): WhatsAppMessage | null {
  try {
    const p = raw as Record<string, unknown>;
    const event = (p.event as string) ?? "";

    // Aceitar apenas mensagens recebidas
    if (!["messages.upsert", "message", "MESSAGES_UPSERT"].includes(event)) return null;

    const data = (p.data ?? p) as Record<string, unknown>;
    const key = data.key as Record<string, unknown> | undefined;
    const msg = data.message as Record<string, unknown> | undefined;

    // Ignorar mensagens enviadas pelo próprio bot
    if (key?.fromMe === true) return null;

    // Extrair número do remetente
    const remoteJid = (key?.remoteJid as string) ?? "";
    const phone = remoteJid
      .replace("@s.whatsapp.net", "")
      .replace("@c.us", "");

    if (!phone || phone.includes("-")) return null; // ignorar grupos

    // Texto simples ou texto estendido
    const texto =
      (msg?.conversation as string) ??
      ((msg?.extendedTextMessage as Record<string, unknown>)?.text as string) ??
      "";

    // Áudio
    const audioMsg = msg?.audioMessage as Record<string, unknown> | undefined;
    const isAudio = !!audioMsg;
    const mediaUrl =
      (data.mediaUrl as string) ??
      (audioMsg?.url as string) ??
      undefined;

    // Tipo de mídia
    const docMsg = msg?.documentMessage as Record<string, unknown> | undefined;
    const imgMsg = msg?.imageMessage as Record<string, unknown> | undefined;

    let mediaType: string | undefined;
    if (isAudio) mediaType = "audio";
    else if (docMsg) mediaType = "document";
    else if (imgMsg) mediaType = "image";

    return { phone, message: texto, mediaUrl, mediaType, isAudio };
  } catch {
    return null;
  }
}

// ─── Transcrição de áudio (Whisper) ─────────────────────────────────────────
async function transcreverAudio(url: string, openaiKey: string): Promise<string> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();

    const form = new FormData();
    form.append("file", blob, "audio.ogg");
    form.append("model", "whisper-1");
    form.append("language", "pt");

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
    });

    const data = await resp.json() as { text?: string };
    return data.text ?? "";
  } catch (err) {
    console.error("[whatsapp-router] transcreverAudio error:", err);
    return "";
  }
}

// ─── Geração de áudio (ElevenLabs) ──────────────────────────────────────────
async function gerarAudio(texto: string, agente: string, elevenKey: string): Promise<string> {
  // Voice IDs por agente (ElevenLabs)
  const voices: Record<string, string> = {
    ana:     "21m00Tcm4TlvDq8ikWAM", // Rachel — voz feminina natural
    sofia:   "EXAVITQu4vr4xnSDxMaL", // Bella — voz feminina profissional
    hugo:    "VR6AewLTigWG4xSOukaG", // Arnold — voz masculina
    marcos:  "pNInz6obpgDQGcFmaJgB", // Adam — voz masculina sênior
    carla:   "MF3mGyEYCl7XYWbV9V6O", // Elli — voz feminina
    pedro:   "TxGEqnHWrfWFTfGW9XjX", // Josh — voz masculina
    rafael:  "yoZ06aMxZJJ28mfd3POQ", // Sam — voz masculina
    default: "21m00Tcm4TlvDq8ikWAM",
  };
  const voiceId = voices[agente] ?? voices.default;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": elevenKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: texto,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  // Retornar como data URL (Workers não têm filesystem)
  const buffer = await res.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64 = btoa(binary);
  return `data:audio/mpeg;base64,${base64}`;
}

// ─── Onboarding — novo número ────────────────────────────────────────────────
async function iniciarOnboarding(
  phone: string,
  supabase: ReturnType<typeof createClient>,
  env: Env
): Promise<void> {
  const bemVindo = `Olá! 👋 Aqui é a *Ana*, do *meucontador.ai*.

Sou sua contadora virtual — estou aqui para cuidar de tudo da sua empresa: impostos, notas fiscais, folha de pagamento e muito mais.

Para começar, me diz: qual é o *CNPJ* da sua empresa?`;

  await sendEvolutionMessage(phone, { tipo: "texto", texto: bemVindo }, env);

  // Registrar tentativa de onboarding no log
  await supabase.from("eventos").insert({
    tipo: "onboarding_iniciado",
    descricao: `Novo número: ${phone}`,
    agente: "ana",
    payload: { phone },
  });
}
